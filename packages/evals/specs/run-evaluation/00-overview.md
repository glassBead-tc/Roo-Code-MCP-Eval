# MCP Evaluation Execution Guide - Overview

This guide provides step-by-step instructions for running MCP (Model Context Protocol) evaluations to benchmark how AI agents use external tools during code generation tasks.

## What is MCP Evaluation?

The MCP evaluation system tracks and analyzes how AI agents use MCP servers (like Exa and Firecrawl) when solving programming exercises. It captures:

- Which tools are called and in what sequence
- Request/response data for each tool call
- Performance metrics (duration, response sizes)
- Success/failure patterns
- Tool usage patterns across different programming tasks

## Architecture Overview

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   Eval CLI      │────▶│  VS Code     │────▶│ MCP Servers │
│                 │ IPC │  Extension   │     │             │
└─────────────────┘     └──────────────┘     └─────────────┘
         │                      │                     │
         │                      ▼                     │
         │              ┌──────────────┐             │
         │              │ OpenTelemetry│◀────────────┘
         │              │   Tracing    │
         │              └──────────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐     ┌──────────────┐
│   PostgreSQL    │◀────│ McpBenchmark │
│    Database     │     │  Processor   │
└─────────────────┘     └──────────────┘
```

## Tracked MCP Servers

The system currently tracks these MCP servers:

- **exa**: Search and research capabilities
- **firecrawl**: Web scraping and content extraction

## Execution Modes

### 1. **Docker Mode** (Recommended for servers)

- Runs VS Code in headless mode using Xvfb
- No GUI windows appear
- Stable and resource-efficient
- Limited to concurrency of 1

### 2. **Local Headless Mode** (Recommended for local development)

- Uses Xvfb on your local machine
- No flashing windows
- Can run with higher concurrency
- Requires Xvfb installation

### 3. **Standard Mode** (For debugging)

- Opens actual VS Code windows
- Useful for watching execution
- Can be resource-intensive with high concurrency

## Prerequisites Checklist

Before running MCP evaluations, ensure you have:

- [ ] PostgreSQL database running
- [ ] Node.js v20.19.2 installed
- [ ] PNPM package manager
- [ ] OpenRouter API key
- [ ] At least one MCP server configured in VS Code
- [ ] (For headless mode) Xvfb installed
- [ ] Built the Roo Code extension (.vsix file)

## Guide Structure

This guide is organized into the following sections:

1. **Database Setup** - Preparing PostgreSQL and applying migrations
2. **Build Process** - Building all necessary packages
3. **MCP Configuration** - Setting up MCP servers in VS Code
4. **Environment Setup** - Configuring environment variables
5. **Running Evaluations** - Executing the evaluation with different modes
6. **Monitoring** - Tracking execution progress and debugging
7. **Viewing Results** - Accessing and interpreting the data
8. **Report Generation** - Creating analysis reports

Each section contains detailed instructions, troubleshooting tips, and example commands.

## Quick Start

For experienced users, here's the minimal command sequence:

```bash
# Start database
cd packages/evals
docker-compose up -d

# Apply migrations
pnpm db:push

# Build project
pnpm build

# Run evaluation (headless)
export ROO_HEADLESS=true
export OPENROUTER_API_KEY=your_key
export ROO_EVAL_MODE=true
pnpm cli --model claude-3-5-haiku --concurrent 2

# View results
pnpm db:studio
```

Continue to the next section for detailed setup instructions.
