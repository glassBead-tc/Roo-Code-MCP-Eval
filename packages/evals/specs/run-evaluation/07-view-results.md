# Step 7: Viewing Results

Access and analyze the MCP telemetry data collected during evaluation runs.

## Drizzle Studio (GUI)

The easiest way to explore results:

```bash
cd packages/evals
pnpm db:studio
```

Opens browser at `http://localhost:4983`

### Key Tables to Explore

1. **runs** - Overview of evaluation runs
2. **tasks** - Individual exercise attempts
3. **mcp_retrieval_benchmarks** - MCP usage per task
4. **mcp_retrieval_calls** - Detailed MCP tool calls

### Drizzle Studio Navigation

1. Click on a table name in the sidebar
2. Use filters to narrow results:
    - `run_id = <latest_run_id>`
    - `mcp_server_name = 'exa'`
3. Click on JSON columns to view formatted data
4. Export results as CSV/JSON

## SQL Queries for Analysis

### Connect to Database

```bash
# Direct connection
psql -U roo_code -d roo_code_evals -h localhost -p 5432'

# Or create alias
alias evaldb='psql -U roo_code -d roo_code_evals -h localhost -p 5432'
```

### Essential Queries

#### 1. Latest Run Summary

```sql
SELECT
  r.id,
  r.model,
  r.created_at,
  r.passed,
  r.failed,
  COUNT(DISTINCT mb.id) as mcp_benchmarks,
  COUNT(DISTINCT mc.id) as total_mcp_calls
FROM runs r
LEFT JOIN tasks t ON r.id = t.run_id
LEFT JOIN mcp_retrieval_benchmarks mb ON t.id = mb.task_id
LEFT JOIN mcp_retrieval_calls mc ON mb.id = mc.benchmark_id
WHERE r.id = (SELECT MAX(id) FROM runs)
GROUP BY r.id;
```

#### 2. MCP Usage by Language

```sql
SELECT
  t.language,
  COUNT(DISTINCT t.id) as tasks,
  COUNT(DISTINCT mb.id) as tasks_using_mcp,
  COUNT(mc.id) as total_mcp_calls,
  ROUND(AVG(mc.duration_ms)::numeric, 2) as avg_duration_ms
FROM tasks t
LEFT JOIN mcp_retrieval_benchmarks mb ON t.id = mb.task_id
LEFT JOIN mcp_retrieval_calls mc ON mb.id = mc.benchmark_id
WHERE t.run_id = (SELECT MAX(id) FROM runs)
GROUP BY t.language
ORDER BY total_mcp_calls DESC;
```

#### 3. MCP Server Performance

```sql
SELECT
  mb.mcp_server_name,
  COUNT(mc.id) as calls,
  ROUND(AVG(mc.duration_ms)::numeric, 2) as avg_duration,
  ROUND(MIN(mc.duration_ms)::numeric, 2) as min_duration,
  ROUND(MAX(mc.duration_ms)::numeric, 2) as max_duration,
  ROUND(AVG(mc.response_size)::numeric, 2) as avg_response_size,
  COUNT(CASE WHEN mc.error_message IS NOT NULL THEN 1 END) as errors
FROM mcp_retrieval_benchmarks mb
JOIN mcp_retrieval_calls mc ON mb.id = mc.benchmark_id
WHERE mb.run_id = (SELECT MAX(id) FROM runs)
GROUP BY mb.mcp_server_name;
```

#### 4. Top MCP-Using Tasks

```sql
SELECT
  t.language,
  t.exercise,
  t.passed,
  mb.total_steps,
  mb.code_execution_success,
  COUNT(mc.id) as mcp_calls,
  SUM(mc.response_size) as total_bytes
FROM tasks t
JOIN mcp_retrieval_benchmarks mb ON t.id = mb.task_id
JOIN mcp_retrieval_calls mc ON mb.id = mc.benchmark_id
WHERE t.run_id = (SELECT MAX(id) FROM runs)
GROUP BY t.id, t.language, t.exercise, t.passed, mb.total_steps, mb.code_execution_success
ORDER BY mcp_calls DESC
LIMIT 10;
```

#### 5. MCP Call Sequences

```sql
-- View call sequence for a specific task
SELECT
  mc.step_number,
  mb.mcp_server_name,
  mc.request->>'tool' as tool_name,
  mc.duration_ms,
  mc.response_size,
  SUBSTRING(mc.request::text, 1, 100) as request_preview
FROM mcp_retrieval_calls mc
JOIN mcp_retrieval_benchmarks mb ON mc.benchmark_id = mb.id
WHERE mb.task_id = :task_id  -- Replace with actual task ID
ORDER BY mc.step_number;
```

## Export Results

### Export to CSV

```sql
-- Export MCP summary
\COPY (
  SELECT
    t.language,
    t.exercise,
    mb.mcp_server_name,
    COUNT(mc.id) as calls,
    AVG(mc.duration_ms) as avg_duration
  FROM tasks t
  JOIN mcp_retrieval_benchmarks mb ON t.id = mb.task_id
  JOIN mcp_retrieval_calls mc ON mb.id = mc.benchmark_id
  WHERE t.run_id = (SELECT MAX(id) FROM runs)
  GROUP BY t.language, t.exercise, mb.mcp_server_name
) TO '/tmp/mcp_summary.csv' WITH CSV HEADER;
```

### Export to JSON

```bash
# Export full MCP call data
evaldb -c "
SELECT json_agg(row_to_json(t))
FROM (
  SELECT * FROM mcp_retrieval_calls
  WHERE benchmark_id IN (
    SELECT id FROM mcp_retrieval_benchmarks
    WHERE run_id = (SELECT MAX(id) FROM runs)
  )
) t;" -t -A > mcp_calls.json
```

## Visualization

### Quick Charts with gnuplot

```bash
# Create data file
evaldb -t -A -c "
SELECT
  mb.mcp_server_name,
  COUNT(mc.id) as calls
FROM mcp_retrieval_benchmarks mb
JOIN mcp_retrieval_calls mc ON mb.id = mc.benchmark_id
WHERE mb.run_id = (SELECT MAX(id) FROM runs)
GROUP BY mb.mcp_server_name;" > mcp_usage.dat

# Generate chart
gnuplot << EOF
set terminal png
set output 'mcp_usage.png'
set style data histogram
set style fill solid
set xlabel 'MCP Server'
set ylabel 'Number of Calls'
plot 'mcp_usage.dat' using 2:xtic(1) title 'MCP Usage'
EOF
```

### Python Analysis

```python
# analyze_mcp.py
import psycopg2
import pandas as pd
import matplotlib.pyplot as plt

# Connect to database
conn = psycopg2.connect(
    "postgresql://roo_code:password@localhost:5432/roo_code_evals"
)

# Load MCP call data
query = """
SELECT
  t.language,
  mb.mcp_server_name,
  mc.duration_ms,
  mc.response_size
FROM tasks t
JOIN mcp_retrieval_benchmarks mb ON t.id = mb.task_id
JOIN mcp_retrieval_calls mc ON mb.id = mc.benchmark_id
WHERE t.run_id = (SELECT MAX(id) FROM runs)
"""

df = pd.read_sql(query, conn)

# Analysis
print("MCP Usage Summary:")
print(df.groupby(['language', 'mcp_server_name']).agg({
    'duration_ms': ['mean', 'std', 'count'],
    'response_size': ['mean', 'sum']
}).round(2))

# Visualization
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

# Duration by server
df.groupby('mcp_server_name')['duration_ms'].mean().plot(
    kind='bar', ax=ax1, title='Average Duration by MCP Server'
)
ax1.set_ylabel('Duration (ms)')

# Calls by language
df.groupby('language').size().plot(
    kind='pie', ax=ax2, title='MCP Calls by Language'
)

plt.tight_layout()
plt.savefig('mcp_analysis.png')
```

## Key Metrics to Analyze

### 1. MCP Adoption Rate

- What percentage of tasks use MCP tools?
- Which languages rely most on MCP?

### 2. Performance Impact

- Do tasks using MCP take longer?
- Is there a correlation between MCP usage and success?

### 3. Tool Preferences

- Which MCP servers are used most?
- Are certain tools preferred for specific languages?

### 4. Error Patterns

- What's the failure rate for MCP calls?
- Which tools are most reliable?

### 5. Usage Patterns

- Average number of MCP calls per task
- Typical sequence of tool usage

## Creating a Results Dashboard

```sql
-- Create materialized view for dashboard
CREATE MATERIALIZED VIEW mcp_evaluation_dashboard AS
WITH latest_run AS (
  SELECT MAX(id) as run_id FROM runs
)
SELECT
  r.id as run_id,
  r.model,
  r.created_at as run_date,

  -- Task metrics
  COUNT(DISTINCT t.id) as total_tasks,
  COUNT(DISTINCT CASE WHEN t.passed THEN t.id END) as passed_tasks,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN t.passed THEN t.id END) /
    COUNT(DISTINCT t.id), 2) as pass_rate,

  -- MCP metrics
  COUNT(DISTINCT mb.id) as tasks_using_mcp,
  COUNT(DISTINCT mc.id) as total_mcp_calls,
  COUNT(DISTINCT mb.mcp_server_name) as unique_servers_used,

  -- Performance
  ROUND(AVG(mc.duration_ms)::numeric, 2) as avg_mcp_duration,
  ROUND(SUM(mc.response_size)::numeric / 1024 / 1024, 2) as total_mb_transferred,

  -- Reliability
  ROUND(100.0 * COUNT(CASE WHEN mc.error_message IS NULL THEN 1 END) /
    COUNT(mc.id), 2) as mcp_success_rate

FROM latest_run lr
JOIN runs r ON r.id = lr.run_id
LEFT JOIN tasks t ON r.id = t.run_id
LEFT JOIN mcp_retrieval_benchmarks mb ON t.id = mb.task_id
LEFT JOIN mcp_retrieval_calls mc ON mb.id = mc.benchmark_id
GROUP BY r.id, r.model, r.created_at;

-- View dashboard
SELECT * FROM mcp_evaluation_dashboard;
```

## Next Steps

After analyzing the results, proceed to [Step 8: Generate Reports](./08-generate-reports.md) to create comprehensive analysis reports using the autonomous analysis system.
