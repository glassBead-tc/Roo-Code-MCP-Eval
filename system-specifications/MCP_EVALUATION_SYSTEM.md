# MCP Evaluation System Architecture

## Overview

The Roo Code MCP Evaluation System is a comprehensive framework for benchmarking and evaluating Model Context Protocol (MCP) server implementations. The system is built on the main branch and provides automated evaluation of MCP servers using standardized coding exercises across multiple programming languages.

## Core Architecture Components

### 1. CLI System (`packages/evals/src/cli/index.ts`)

**Primary Entry Point**: Command-line interface for creating and running evaluations.

**Key Features**:

- Creates evaluation runs with configurable models and languages
- Supports single exercise evaluation (`--exercise` flag)
- Concurrent task execution with configurable concurrency
- Integration with VS Code extension via IPC
- AI-native evaluation capabilities (optional)

**Command Structure**:

```bash
pnpm cli [options]
  --run-id, -r          # Execute existing run
  --model, -m           # Model to use (default: claude-3-5-haiku-20241022)
  --include, -i         # Languages to include (comma-separated)
  --exclude, -e         # Languages to exclude (comma-separated)
  --exercise, -x        # Single exercise name
  --concurrent, -c      # Concurrency level (default: 2)
  --description, -d     # Run description
  --ai-observer         # AI observation level: basic/full/autonomous
  --ai-steering         # AI steering: monitor-only/suggest/auto
  --ai-insights         # AI insights: store/export/realtime
  --ai-config          # Path to AI configuration file
```

### 2. Benchmark Processing (`packages/evals/src/benchmark/McpBenchmarkProcessor.ts`)

**Core Component**: OpenTelemetry SpanProcessor that captures MCP server interactions.

**Responsibilities**:

- Processes MCP client spans (rpc.system="mcp")
- Filters for specific MCP servers (exa, firecrawl)
- Maps task IDs between Roo's string IDs and database integer IDs
- Records MCP retrieval calls with request/response data
- Integrates with AI observation system (optional)

**Key Methods**:

- `startTaskBenchmark()`: Initializes benchmark tracking for a task
- `finishTaskBenchmark()`: Completes benchmark with success metrics
- `onEnd()`: Processes completed spans for MCP calls
- `registerTaskIdMapping()`: Links Roo task IDs to database IDs

### 3. Exercise System (`packages/evals/src/exercises/index.ts`)

**Structure**: Manages coding exercises across multiple languages.

**Supported Languages**: go, java, javascript, python, rust

**Exercise Path**: Resolves to `/evals` directory (external repository)

**Integration**:

- Uses external Roo-Code-Evals repository
- Language-specific test commands defined in CLI
- Prompts stored in `prompts/{language}.md`

### 4. IPC Communication

**Architecture**: Unix socket-based communication between CLI and VS Code extension.

**Flow**:

1. CLI creates socket at `/tmp/roo-code-ipc-{pid}.sock`
2. Launches VS Code with `xvfb-run` in headless mode
3. Extension connects to socket
4. Task context set with confirmation pattern
5. Bidirectional event streaming

**Key Messages**:

- `TaskCommand.SetTaskContext`: Establishes task context
- `TaskCommand.StartNewTask`: Initiates evaluation
- `TaskEvent.*`: Real-time task progress updates

### 5. OpenTelemetry Integration (`packages/evals/src/telemetry/`)

**System**: Configurable telemetry with plugin architecture.

**Components**:

- `initializeOtel.ts`: Main initialization with provider management
- `TelemetryPluginManager.ts`: Dynamic provider loading
- `providers/`: Built-in providers (OTLP, Jaeger, Console)

**Configuration**:

- Auto-discovery of available ports (starting from 4318)
- Environment-based configuration via OTEL\_\* variables
- Plugin-based extensibility for custom providers

## Data Flow

### Evaluation Execution Flow

1. **Run Creation**: CLI creates database run record with model/settings
2. **Task Generation**: Creates task records for each language/exercise combination
3. **Git Preparation**: Checks out clean branch for exercises
4. **VS Code Launch**: Spawns headless VS Code instance per task
5. **Task Execution**: Extension receives task context and executes evaluation
6. **MCP Tracking**: OpenTelemetry captures MCP server interactions
7. **Unit Testing**: Runs language-specific test commands
8. **Results Recording**: Updates database with success/failure status
9. **Git Commit**: Commits changes with run identifier

### MCP Telemetry Flow

1. **Span Creation**: Extension generates spans for MCP operations
2. **Attribute Setting**: Spans tagged with task_id, server name, request/response
3. **Processor Filtering**: McpBenchmarkProcessor filters relevant spans
4. **Database Recording**: MCP calls stored in `mcp_retrieval_calls` table
5. **Metrics Calculation**: Performance metrics aggregated per task

### AI Integration Flow (Optional)

1. **Observer Initialization**: AI integration starts if enabled
2. **Span Analysis**: Real-time processing of MCP spans
3. **Insight Generation**: AI analyzes patterns and generates recommendations
4. **Database Storage**: Insights stored in AI-specific tables
5. **Report Generation**: Comprehensive AI report at completion

## Docker Configuration

### Container Setup

- **Base**: `node:20-slim` with PNPM and development tools
- **VS Code**: Installed with headless display support (Xvfb)
- **Languages**: Go, Java, Python, Rust toolchains pre-installed
- **Extension**: Pre-installed Roo Code extension
- **Database**: PostgreSQL container for persistence

### Network Architecture

- **IPC**: Shared `/tmp` volume for Unix sockets
- **Database**: Internal Docker network communication
- **Ports**: 3000 exposed, 5432 for PostgreSQL

## Integration Points

### Database Layer

- **Core Tables**: runs, tasks, taskMetrics, toolErrors
- **MCP Tables**: mcpRetrievalBenchmarks, mcpRetrievalCalls
- **Events**: mcpConnectionEvents, mcpResourceEvents
- **AI Tables**: aiInsights, aiSteeringRecommendations, aiAnomalies, aiObserverSessions

### External Dependencies

- **Roo-Code-Evals**: External repository with exercise definitions
- **VS Code Extension**: Main Roo Code extension for AI interaction
- **MCP Servers**: Exa, Firecrawl, and other MCP implementations
- **OpenTelemetry**: Observability infrastructure

### Configuration Management

- **Environment**: `.env.development`, `.env.test` files
- **Database**: Drizzle ORM with migrations
- **Telemetry**: JSON configuration files with provider settings
- **Docker**: Compose-based multi-container setup

## Current Limitations

1. **VS Code Integration**: Headless mode with display virtualization
2. **MCP Server Scope**: Limited to specific servers (exa, firecrawl)
3. **AI Features**: Framework exists but implementation is placeholder-based
4. **Concurrency**: Unix socket per task limits scalability
5. **Exercise Repository**: External dependency on separate Git repository

## Security Considerations

1. **IPC Isolation**: Unix sockets provide process-level security
2. **Container Sandboxing**: Docker isolation for evaluation environments
3. **Database Access**: Credential-based PostgreSQL authentication
4. **Environment Variables**: Secure configuration injection
5. **Git Operations**: Controlled repository manipulation in containers

This architecture provides a robust foundation for MCP server evaluation with extensibility for AI-native capabilities and comprehensive observability through OpenTelemetry integration.
