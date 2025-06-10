# Step 3: Configure MCP Servers

The MCP evaluation system tracks specific MCP servers during code generation tasks. This step covers configuring these servers in VS Code.

## Tracked MCP Servers

The system monitors these specific servers (hardcoded in `McpBenchmarkProcessor`):

1. **exa** - Search and research capabilities
2. **firecrawl** - Web scraping and content extraction

At least one of these must be configured for meaningful evaluation results.

## VS Code MCP Configuration

### Method 1: VS Code Settings (Recommended)

1. **Open VS Code Settings**:

    ```
    Code > Preferences > Settings (macOS)
    File > Preferences > Settings (Windows/Linux)
    ```

2. **Search for "MCP"** in settings

3. **Add MCP server configuration**:
    ```json
    {
      "roo-cline.mcpServers": {
        "exa": {
       "command": "npx",
       "args": ["-y", "exa-mcp-server"],
       "env": {
         "EXA_API_KEY": "your-api-key-here"
       }
     }
      "firecrawl": {
        "command": "npx",
        "args": ["-y", "firecrawl-mcp"],
        "env": {
          "FIRECRAWL_API_KEY": "your-firecrawl-api-key"
        }
      }
    }
    ```

### Method 2: MCP Configuration File

Create a global MCP configuration file:

```bash
# Create config directory
mkdir -p ~/.config/roo-cline

# Create MCP config
cat > ~/.config/roo-cline/mcp_config.json << 'EOF'
{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": ["/path/to/exa-mcp-server/build/index.js"],
      "env": {
        "EXA_API_KEY": "your-exa-api-key"
      }
    },
    "firecrawl-mcp": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "your-firecrawl-api-key"
      }
    }
  }
}
EOF
```

### Method 3: Environment Variables

Set API keys as environment variables:

```bash
# Add to ~/.bashrc or ~/.zshrc
export EXA_API_KEY="your-exa-api-key"
export FIRECRAWL_API_KEY="your-firecrawl-api-key"
```

## Obtaining API Keys

### Exa

1. Visit [https://exa.ai](https://exa.ai)
2. Sign up for an account
3. Navigate to API settings
4. Generate an API key

### Firecrawl

1. Visit [https://firecrawl.dev](https://firecrawl.dev)
2. Create an account
3. Go to dashboard
4. Copy your API key

## Verify MCP Server Configuration

### Test Individual Servers

```bash
# Test Exa server
# For local Exa build:
node /path/to/exa-mcp-server/build/index.js test

# Test Firecrawl
npx -y firecrawl-mcp test

# Check if servers are available
which npx  # Should return path to npx
```

### Check VS Code Recognition

1. Open VS Code
2. Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
3. Run "Roo Code: Show MCP Servers"
4. Verify your configured servers appear

## Configuration for Docker/Headless Mode

When running in Docker, MCP servers need to be configured in the container:

```dockerfile
# Add to Dockerfile or docker-compose.yml
ENV EXA_API_KEY=your-exa-api-key
ENV FIRECRAWL_API_KEY=your-firecrawl-api-key
```

Or pass during runtime:

```bash
docker run --rm \
  -e EXA_API_KEY=$EXA_API_KEY \
  -e FIRECRAWL_API_KEY=$FIRECRAWL_API_KEY \
  roo-code-evals pnpm cli
```

## Minimal Configuration

For a basic evaluation, configure at least one server:

```json
{
	"roo-cline.mcpServers": {
		"exa": {
			"command": "npx",
			"args": ["-y", "exa-mcp-server"],
			"env": {
				"EXA_API_KEY": "your-api-key-here"
			}
		}
	}
}
```

## Troubleshooting

### Servers Not Appearing

1. **Check VS Code restart**:

    ```bash
    # Restart VS Code after configuration
    ```

2. **Verify JSON syntax**:

    ```bash
    # Validate config file
    jq . ~/.config/roo-cline/mcp_config.json
    ```

3. **Check permissions**:
    ```bash
    ls -la ~/.config/roo-cline/
    # Should be readable by your user
    ```

### API Key Issues

1. **Test API keys directly**:

    ```bash
    curl -H "Authorization: Bearer $EXA_API_KEY" https://api.exa.ai/test
    ```

2. **Check environment variables**:
    ```bash
    env | grep -E "(EXA|FIRECRAWL)"
    ```

## Next Steps

With MCP servers configured, proceed to [Step 4: Environment Setup](./04-environment-setup.md) to configure the remaining environment variables needed for evaluation.
