# Step 6: Monitoring Execution

Track the progress of your MCP evaluation run and debug any issues that arise.

## Real-Time Monitoring

### Console Output Patterns

#### MCP Benchmark Logs

The most important logs for MCP tracking:

```json
🎯 MCP_BENCHMARK: {
  "serverName": "exa",
  "toolName": "search",
  "duration": 1543,
  "responseSize": 12456,
  "timestamp": 1234567890123,
  "arguments": {
    "query": "python fibonacci implementation"
  },
  "result": {
    "results": [...]
  }
}
```

#### Task Progress Indicators

```
1234567890 [cli#runExercise | python / two-fer] starting task
1234567891 [cli#runExercise | python / two-fer] taskEvent -> TaskStarted
1234567892 [cli#runExercise | python / two-fer] taskEvent -> ToolUse { tool: "mcp_use_tool" }
1234567893 [cli#runExercise | python / two-fer] taskEvent -> TaskCompleted
```

#### OpenTelemetry Traces

With `OTEL_LOG_LEVEL=debug`:

```
🔍 [McpTraceManager] Creating span: mcp.exa.search
🔍 [McpTraceManager] Span created with attributes: {
  rpc.system: "mcp",
  rpc.service: "exa",
  rpc.method: "search",
  mcp.task_id: "abc-123",
  eval.task_id: 42
}
```

### Filtering Output

#### MCP Operations Only

```bash
pnpm cli 2>&1 | grep -E "(MCP_BENCHMARK|mcp\.|McpTraceManager)"
```

#### Errors and Failures

```bash
pnpm cli 2>&1 | grep -E "(ERROR|FAIL|error|failed|Failed)" --color=always
```

#### Task Completion Status

```bash
pnpm cli 2>&1 | grep -E "(Tests passed|Tests failed|taskEvent -> TaskCompleted)"
```

## Database Monitoring

### Live Queries

Open a new terminal for database monitoring:

```bash
# Connection alias
alias evaldb='psql -U roo_code -d roo_code_evals'

# Monitor MCP calls in real-time
watch -n 1 'evaldb -c "
SELECT
  mc.step_number,
  mb.mcp_server_name,
  mc.response_size,
  mc.duration_ms,
  CASE WHEN mc.error_message IS NULL THEN '\''✓'\'' ELSE '\''✗'\'' END as status
FROM mcp_retrieval_calls mc
JOIN mcp_retrieval_benchmarks mb ON mc.benchmark_id = mb.id
WHERE mb.run_id = (SELECT MAX(id) FROM runs)
ORDER BY mc.created_at DESC
LIMIT 10;"'
```

### Task Progress Dashboard

```sql
-- Create monitoring view
CREATE OR REPLACE VIEW evaluation_progress AS
SELECT
  r.id as run_id,
  r.model,
  COUNT(DISTINCT t.id) as total_tasks,
  COUNT(DISTINCT CASE WHEN t.passed = true THEN t.id END) as passed,
  COUNT(DISTINCT CASE WHEN t.passed = false THEN t.id END) as failed,
  COUNT(DISTINCT CASE WHEN t.passed IS NULL THEN t.id END) as running,
  COUNT(DISTINCT mb.id) as mcp_benchmarks,
  COUNT(DISTINCT mc.id) as mcp_calls,
  ROUND(AVG(mc.duration_ms)::numeric, 2) as avg_mcp_duration_ms,
  ROUND(AVG(mc.response_size)::numeric, 2) as avg_response_size
FROM runs r
LEFT JOIN tasks t ON r.id = t.run_id
LEFT JOIN mcp_retrieval_benchmarks mb ON t.id = mb.task_id
LEFT JOIN mcp_retrieval_calls mc ON mb.id = mc.benchmark_id
WHERE r.id = (SELECT MAX(id) FROM runs)
GROUP BY r.id, r.model;

-- Monitor progress
watch -n 5 'evaldb -c "SELECT * FROM evaluation_progress;"'
```

### MCP Server Usage

```sql
-- MCP server usage by task
SELECT
  mb.mcp_server_name,
  COUNT(DISTINCT mb.task_id) as tasks_used_in,
  COUNT(mc.id) as total_calls,
  ROUND(AVG(mc.duration_ms)::numeric, 2) as avg_duration_ms,
  SUM(mc.response_size) as total_bytes
FROM mcp_retrieval_benchmarks mb
JOIN mcp_retrieval_calls mc ON mb.id = mc.benchmark_id
WHERE mb.run_id = (SELECT MAX(id) FROM runs)
GROUP BY mb.mcp_server_name
ORDER BY total_calls DESC;
```

## Log Analysis

### Capture Full Logs

```bash
# Start evaluation with full logging
pnpm cli --model claude-3-5-haiku 2>&1 | tee eval-$(date +%Y%m%d-%H%M%S).log
```

### Analyze Log Patterns

```bash
# Count MCP calls by server
grep "MCP_BENCHMARK" eval-*.log | jq -r '.serverName' | sort | uniq -c

# Average response times
grep "MCP_BENCHMARK" eval-*.log | jq '.duration' | awk '{sum+=$1; count++} END {print "Average:", sum/count, "ms"}'

# Failed MCP calls
grep "mcp:tool:error" eval-*.log | wc -l
```

### Create Analysis Report

```bash
#!/bin/bash
# analyze-logs.sh

LOG_FILE=$1
echo "=== MCP Evaluation Analysis ==="
echo "Log file: $LOG_FILE"
echo ""

echo "Task Summary:"
grep "Tests passed" $LOG_FILE | wc -l | xargs echo "  Passed:"
grep "Tests failed" $LOG_FILE | wc -l | xargs echo "  Failed:"
echo ""

echo "MCP Usage:"
grep "MCP_BENCHMARK" $LOG_FILE | jq -r '.serverName' | sort | uniq -c | while read count server; do
  echo "  $server: $count calls"
done
echo ""

echo "Performance Metrics:"
grep "MCP_BENCHMARK" $LOG_FILE | jq '.duration' | awk '{
  sum+=$1;
  if(NR==1){min=$1; max=$1}
  if($1<min) min=$1;
  if($1>max) max=$1;
  count++
} END {
  print "  Average duration:", sum/count, "ms"
  print "  Min duration:", min, "ms"
  print "  Max duration:", max, "ms"
}'
```

## Debugging Issues

### Common Problems

#### 1. MCP Server Not Responding

```bash
# Check if MCP server is configured
grep "mcp:tool:error" logs/*.log

# Test MCP server directly
npx -y exa-mcp-server test
```

#### 2. Task Hanging

```bash
# Find stuck tasks
evaldb -c "
SELECT t.language, t.exercise,
  EXTRACT(EPOCH FROM (NOW() - t.started_at)) as seconds_running
FROM tasks t
WHERE t.run_id = (SELECT MAX(id) FROM runs)
  AND t.finished_at IS NULL
  AND t.started_at < NOW() - INTERVAL '5 minutes';"
```

#### 3. OpenTelemetry Not Capturing

```bash
# Check telemetry is enabled
env | grep OTEL

# Verify McpBenchmarkProcessor is loaded
grep "McpBenchmarkProcessor" logs/*.log
```

### Enable Verbose Debugging

```bash
# Maximum debugging
export DEBUG=*
export OTEL_LOG_LEVEL=debug
export MCP_LOG_REQUESTS=true

pnpm cli --model claude-3-5-haiku --concurrent 1 2>&1 | tee debug.log
```

## Performance Monitoring

### System Resources

```bash
# Monitor during execution
# Terminal 1: CPU and Memory
top -p $(pgrep -f "pnpm cli")

# Terminal 2: Disk I/O
iotop -p $(pgrep -f "code")

# Terminal 3: Network (MCP calls)
tcpdump -i any -n port 443 | grep -E "(exa|firecrawl)"
```

### VS Code Process Monitoring

```bash
# Count VS Code instances
ps aux | grep -c "code.*--disable-workspace-trust"

# Memory per instance
ps aux | grep "code.*--disable-workspace-trust" | awk '{sum+=$6} END {print "Total RSS:", sum/1024, "MB"}'
```

## Grafana Dashboard (Optional)

For advanced monitoring, set up Grafana:

```yaml
# docker-compose.yml addition
grafana:
    image: grafana/grafana:latest
    ports:
        - "3000:3000"
    volumes:
        - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    environment:
        - GF_AUTH_ANONYMOUS_ENABLED=true
```

Create dashboard with panels for:

- Tasks completed over time
- MCP calls by server
- Average response times
- Error rates

## Next Steps

Once you've monitored the execution and confirmed data is being collected, proceed to [Step 7: Viewing Results](./07-view-results.md) to analyze the captured MCP telemetry data.
