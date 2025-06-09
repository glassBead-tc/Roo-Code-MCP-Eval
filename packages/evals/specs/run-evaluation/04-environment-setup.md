# Step 4: Environment Setup

Configure the necessary environment variables for running MCP evaluations. These control API access, evaluation modes, and telemetry behavior.

## Required Environment Variables

### OpenRouter API Key (Required)

The evaluation system uses OpenRouter to access various AI models:

```bash
export OPENROUTER_API_KEY="your-openrouter-api-key-here"
```

To obtain an OpenRouter API key:

1. Visit [https://openrouter.ai](https://openrouter.ai)
2. Create an account
3. Navigate to API Keys
4. Generate a new key

### Evaluation Mode (Required)

Enable evaluation-specific tracking:

```bash
export ROO_EVAL_MODE=true
```

This flag:

- Enables task context tracking
- Activates MCP benchmark collection
- Ensures proper task ID mapping

## Optional Environment Variables

### Telemetry Configuration

Control OpenTelemetry logging and debugging:

```bash
# Enable debug logging for telemetry
export OTEL_LOG_LEVEL=debug

# Set specific exporter (console, jaeger, otlp)
export OTEL_TRACES_EXPORTER=console

# Configure OTLP endpoint (if using OTLP exporter)
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Set service name
export OTEL_SERVICE_NAME=roo-code-mcp-eval
```

### Headless Mode Configuration

For running without GUI windows:

```bash
# Enable headless mode (requires Xvfb)
export ROO_HEADLESS=true

# Set virtual display (if needed)
export DISPLAY=:99
```

### Database Configuration

If using non-default database settings:

```bash
# Default: postgres://postgres:password@localhost:5432/evals_development
export DATABASE_URL="postgres://user:pass@host:port/dbname"

# For Docker networking
export DATABASE_URL="postgres://postgres:password@postgres:5432/evals_development"
```

### MCP-Specific Settings

Configure MCP telemetry behavior:

```bash
# Set MCP servers to track (comma-separated)
export MCP_TRACKED_SERVERS="exa,firecrawl"

# Enable MCP request/response logging
export MCP_LOG_REQUESTS=true

# Set MCP timeout (milliseconds)
export MCP_DEFAULT_TIMEOUT=30000
```

## Environment File Setup

### Create .env File

For convenience, create an environment file:

```bash
cd packages/evals
cat > .env << 'EOF'
# API Keys
OPENROUTER_API_KEY=your-openrouter-key
EXA_API_KEY=your-exa-key
FIRECRAWL_API_KEY=your-firecrawl-key

# Evaluation Settings
ROO_EVAL_MODE=true
NODE_ENV=development

# Telemetry
OTEL_LOG_LEVEL=info
OTEL_TRACES_EXPORTER=console

# Database
DATABASE_URL=postgres://postgres:password@localhost:5432/evals_development

# Headless Mode (uncomment to enable)
# ROO_HEADLESS=true
EOF
```

### Load Environment

```bash
# Source the .env file
source .env

# Or use dotenv
npm install -g dotenv-cli
dotenv -- pnpm cli
```

## Environment Validation

### Check Required Variables

```bash
# Create validation script
cat > check-env.sh << 'EOF'
#!/bin/bash

required_vars=(
  "OPENROUTER_API_KEY"
  "ROO_EVAL_MODE"
)

optional_vars=(
  "EXA_API_KEY"
  "FIRECRAWL_API_KEY"
  "OTEL_LOG_LEVEL"
  "ROO_HEADLESS"
)

echo "Checking required environment variables..."
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing: $var"
  else
    echo "✅ Set: $var"
  fi
done

echo -e "\nChecking optional environment variables..."
for var in "${optional_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "⚠️  Not set: $var"
  else
    echo "✅ Set: $var"
  fi
done
EOF

chmod +x check-env.sh
./check-env.sh
```

## Environment for Different Scenarios

### Development/Testing

```bash
export NODE_ENV=development
export OTEL_LOG_LEVEL=debug
export OTEL_TRACES_EXPORTER=console
export ROO_EVAL_MODE=true
```

### Production Evaluation

```bash
export NODE_ENV=production
export OTEL_LOG_LEVEL=warn
export OTEL_TRACES_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_ENDPOINT=http://telemetry-collector:4318
```

### CI/CD Pipeline

```bash
export ROO_HEADLESS=true
export ROO_EVAL_MODE=true
export DATABASE_URL=$CI_DATABASE_URL
export OPENROUTER_API_KEY=$CI_OPENROUTER_KEY
```

## Security Considerations

### Protecting API Keys

1. **Never commit .env files**:

    ```bash
    # Ensure .env is in .gitignore
    grep -q "^\.env$" .gitignore || echo ".env" >> .gitignore
    ```

2. **Use secret management**:

    ```bash
    # Example with 1Password CLI
    export OPENROUTER_API_KEY=$(op read "op://vault/OpenRouter/api_key")
    ```

3. **Rotate keys regularly**:
    - Set calendar reminders
    - Use key expiration if available

### Docker Secrets

For Docker deployments:

```yaml
# docker-compose.yml
services:
    evaluator:
        environment:
            - OPENROUTER_API_KEY_FILE=/run/secrets/openrouter_key
        secrets:
            - openrouter_key

secrets:
    openrouter_key:
        external: true
```

## Troubleshooting

### Variable Not Loading

1. **Check shell configuration**:

    ```bash
    echo $SHELL  # Identify your shell
    # Add exports to ~/.bashrc, ~/.zshrc, etc.
    ```

2. **Verify no typos**:

    ```bash
    env | grep ROO  # Check all ROO_ variables
    ```

3. **Check file permissions**:
    ```bash
    ls -la .env  # Should be readable
    ```

### API Key Validation

Test your API keys:

```bash
# Test OpenRouter
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models

# Should return list of available models
```

## Next Steps

With environment variables configured, proceed to [Step 5: Running Evaluations](./05-run-evaluation.md) to execute the MCP evaluation.
