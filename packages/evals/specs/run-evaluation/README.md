# MCP Evaluation Execution Guide

This directory contains comprehensive documentation for running MCP (Model Context Protocol) evaluations to benchmark how AI agents use external tools during code generation tasks.

## Quick Start

If you're already familiar with the system:

```bash
# 1. Start database
cd packages/evals
docker-compose up -d

# 2. Apply migrations
pnpm db:push

# 3. Build project
pnpm build

# 4. Run evaluation (headless mode)
export ROO_HEADLESS=true
export OPENROUTER_API_KEY=your_key
export ROO_EVAL_MODE=true
pnpm cli --model claude-3-5-haiku --concurrent 2

# 5. View results
pnpm db:studio
```

## Documentation Structure

The guide is organized into 8 sequential steps:

### [00-overview.md](./00-overview.md)

- Introduction to MCP evaluation
- Architecture overview
- Prerequisites checklist
- Execution modes (Docker, headless, standard)

### [01-database-setup.md](./01-database-setup.md)

- Starting PostgreSQL with Docker
- Applying database migrations
- Understanding MCP telemetry schema
- Troubleshooting database issues

### [02-build-project.md](./02-build-project.md)

- Installing dependencies
- Building TypeScript packages
- Creating VS Code extension package
- Docker build alternative

### [03-configure-mcp-servers.md](./03-configure-mcp-servers.md)

- Setting up tracked MCP servers (exa, firecrawl)
- VS Code configuration methods
- Obtaining API keys
- Testing server connections

### [04-environment-setup.md](./04-environment-setup.md)

- Required environment variables
- OpenRouter API configuration
- Telemetry settings
- Security best practices

### [05-run-evaluation.md](./05-run-evaluation.md)

- Command-line options and arguments
- Execution modes (headless, Docker, standard)
- Model selection and concurrency
- Language filtering

### [06-monitor-execution.md](./06-monitor-execution.md)

- Real-time log monitoring
- Database queries for progress tracking
- Debugging common issues
- Performance monitoring

### [07-view-results.md](./07-view-results.md)

- Using Drizzle Studio GUI
- SQL queries for analysis
- Exporting data
- Creating visualizations

### [08-generate-reports.md](./08-generate-reports.md)

- Autonomous analysis system
- Report templates and customization
- Automated report generation
- Distribution methods

## Key Concepts

### MCP Servers Tracked

The evaluation system monitors these MCP servers:

- **exa** - Search and research
- **firecrawl** - Web scraping

### Data Collected

For each MCP tool call:

- Server and tool name
- Request/response data
- Duration and response size
- Success/failure status
- Task context

### Execution Modes

1. **Docker Mode** - Fully isolated, headless execution
2. **Local Headless** - Uses Xvfb for GUI-free execution
3. **Standard Mode** - Opens VS Code windows (for debugging)

## Common Commands

```bash
# Run evaluation with specific model
pnpm cli --model claude-3-5-sonnet --concurrent 4

# Run only JavaScript exercises
pnpm cli --include javascript --model claude-3-5-haiku

# Resume a failed run
pnpm cli --run-id 42

# Generate analysis report
pnpm tsx src/autonomous/cli/autonomous-analysis.ts
```

## Troubleshooting

Common issues and solutions:

1. **No MCP data collected**

    - Verify MCP servers are configured in VS Code
    - Check `ROO_EVAL_MODE=true` is set
    - Ensure at least one tracked server has valid API key

2. **VS Code windows flashing**

    - Install Xvfb and set `ROO_HEADLESS=true`
    - Or use Docker mode for complete isolation

3. **Database connection errors**
    - Verify PostgreSQL is running: `docker ps`
    - Check port 5432 is available
    - Confirm DATABASE_URL is correct

## Support

For issues or questions:

- Check the detailed documentation in each step
- Review logs with `DEBUG=*` environment variable
- Examine database with `pnpm db:studio`

## Contributing

To improve this documentation:

1. Test the steps on a clean system
2. Note any missing information or errors
3. Submit updates with clear explanations

---

Last updated: January 2025
