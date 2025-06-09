# Step 5: Running Evaluations

Execute the MCP evaluation to track how AI agents use MCP tools when solving programming exercises.

## Recommended Evaluation Command

### Docker Mode (Recommended)

```bash
cd packages/evals

# Build Docker image
docker build -t roo-code-evals .

# Run evaluation
docker run --rm \
  --network=evals_default \
  -e OPENROUTER_API_KEY=$OPENROUTER_API_KEY \
  -e ROO_EVAL_MODE=true \
  -e DATABASE_URL=postgres://postgres:password@postgres:5432/evals_development \
  roo-code-evals pnpm cli --model claude-3-5-haiku
```

## Command Line Options

### Model Selection

```bash
# Available models (via OpenRouter)
pnpm cli --model claude-3-5-haiku        # Fast, cost-effective: use Haiku unless instructed otherwise
pnpm cli --model claude-3-5-sonnet       # Balanced performance
pnpm cli --model gpt-4o                  # OpenAI GPT-4
pnpm cli --model deepseek/deepseek-chat  # DeepSeek
```

### Concurrency Control

```bash
# Run sequentially (recommended for stability)
pnpm cli --concurrent 1

# Note: Docker mode uses concurrent=1 for optimal resource usage
```

### Language Filtering

```bash
# Run only specific languages
pnpm cli --include javascript,python

# Exclude specific languages
pnpm cli --exclude rust,java

# Available languages: go, java, javascript, python, rust
```

### Resume Failed Run

```bash
# Resume a previous run by ID
pnpm cli --run-id 42
```

## Docker Configuration

### Environment Variables

```bash
# Required for Docker mode
export OPENROUTER_API_KEY=your_api_key_here
export ROO_EVAL_MODE=true
export DATABASE_URL=postgres://postgres:password@postgres:5432/evals_development
```

### Network Setup

```bash
# Ensure PostgreSQL is running with Docker network
docker-compose up -d postgres
```

## What Happens During Evaluation

### 1. Initialization Phase

```
[cli] Starting evaluation run
[cli] Found 25 exercises across 5 languages
[cli] Using model: claude-3-5-haiku
[cli] Concurrency: 2
```

### 2. Task Execution

```
[cli#runExercise | javascript / two-fer] Starting headless VS Code instance
[cli#runExercise | javascript / two-fer] Connecting to IPC socket
[cli#runExercise | javascript / two-fer] Setting task context
[cli#runExercise | javascript / two-fer] Starting task
```

### 3. MCP Tracking

```
🎯 MCP_BENCHMARK: {
  "serverName": "exa",
  "toolName": "search",
  "duration": 1234,
  "responseSize": 5678,
  "timestamp": 1234567890,
  "arguments": {"query": "javascript two-fer kata"},
  "result": {...}
}
```

### 4. Test Execution

```
[cli#runExercise | javascript / two-fer] Running tests
[cli#runExercise | javascript / two-fer] Tests passed ✓
```

### 5. Completion

```
[cli#run] Run #123 completed
[cli#run] Passed: 20, Failed: 5
[cli#run] Total duration: 15 minutes
```

## Monitoring Execution

### Real-time Logs

```bash
# Enable debug logging
export OTEL_LOG_LEVEL=debug
export DEBUG=*
pnpm cli --model claude-3-5-haiku
```

### Watch Specific Components

```bash
# MCP operations only
pnpm cli 2>&1 | grep "MCP_BENCHMARK"

# Task progress
pnpm cli 2>&1 | grep "cli#runExercise"

# Errors only
pnpm cli 2>&1 | grep -E "(ERROR|FAIL|error)"
```

### Database Monitoring

In another terminal:

```bash
# Watch benchmark insertions
watch -n 1 'psql -U roo_code -d roo_code_evals -c "SELECT COUNT(*) FROM mcp_retrieval_calls;"'

# Monitor active tasks
watch -n 5 'psql -U roo_code -d roo_code_evals -c "SELECT language, exercise, passed FROM tasks WHERE run_id = (SELECT MAX(id) FROM runs);"'
```

## Handling Failures

### Common Issues

1. **VS Code fails to start**:

    ```bash
    # Check VS Code installation
    code --version

    # Try with logging
    code --log trace
    ```

2. **IPC connection timeout**:

    ```bash
    # Increase timeout in code
    # Or reduce concurrency
    pnpm cli --concurrent 1
    ```

3. **MCP server not available**:
    ```bash
    # Check MCP server config
    cat ~/.config/roo-cline/mcp_config.json
    ```

### Recovery Options

```bash
# Resume failed run
pnpm cli --run-id <run_id>

# Retry specific language
pnpm cli --include javascript --model claude-3-5-haiku

# Force new run
pnpm cli --model claude-3-5-haiku --force
```

## Performance Considerations

### Resource Usage

- **Memory**: ~500MB per VS Code instance
- **CPU**: Varies by model and task complexity
- **Disk**: Logs and temporary files

### Optimization Tips

1. **Adjust concurrency based on system**:

    ```bash
    # For 8GB RAM
    pnpm cli --concurrent 2

    # For 16GB+ RAM
    pnpm cli --concurrent 4
    ```

2. **Use faster models for testing**:

    ```bash
    # Quick test run
    pnpm cli --model claude-3-5-haiku --include javascript
    ```

3. **Clean up between runs**:
    ```bash
    # Remove old logs
    rm -rf ~/.roo/logs/*
    ```

## Sample Execution Scripts

### Full Evaluation with Docker

```bash
#!/bin/bash
# full-eval-docker.sh

set -e
source .env

echo "Starting full MCP evaluation with Docker..."

# Build image if needed
docker build -t roo-code-evals .

# Run evaluation
docker run --rm \
  --network=evals_default \
  -e OPENROUTER_API_KEY=$OPENROUTER_API_KEY \
  -e ROO_EVAL_MODE=true \
  -e DATABASE_URL=postgres://postgres:password@postgres:5432/evals_development \
  roo-code-evals \
  pnpm cli --model claude-3-5-sonnet --concurrent 1 \
  2>&1 | tee "eval-$(date +%Y%m%d-%H%M%S).log"

echo "Evaluation complete!"
```

### Language-Specific Test with Docker

```bash
#!/bin/bash
# test-javascript-docker.sh

docker run --rm \
  --network=evals_default \
  -e OPENROUTER_API_KEY=$OPENROUTER_API_KEY \
  -e ROO_EVAL_MODE=true \
  -e DATABASE_URL=postgres://postgres:password@postgres:5432/evals_development \
  roo-code-evals \
  pnpm cli --model claude-3-5-haiku --include javascript --concurrent 1
```

## Next Steps

Once the evaluation is running, proceed to [Step 6: Monitoring Execution](./06-monitor-execution.md) to track progress and debug issues.
