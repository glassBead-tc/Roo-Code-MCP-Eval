# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Prerequisites

- Node.js v20.19.2 (specified in engines)
- PNPM (managed via monorepo root)
- Docker (for PostgreSQL database)
- VS Code (for running evaluations)
- OpenRouter API key

### Database Setup

```bash
# Start PostgreSQL via Docker
docker-compose up -d

# Run database migrations
pnpm drizzle-kit migrate

# Generate database client
pnpm drizzle-kit generate

# Check migration status
pnpm drizzle-kit check
```

### Common Commands

```bash
# Development
pnpm build          # Build TypeScript files
pnpm check-types    # Run TypeScript type checking
pnpm lint           # Run ESLint

# Database Management
pnpm db:push        # Push schema changes to database
pnpm db:studio      # Open Drizzle Studio for database inspection

# CLI Usage
pnpm cli            # Run the evaluation CLI with dev environment
pnpm cli --help     # Show CLI help and options

# Testing
pnpm test           # Run Vitest tests
pnpm test:watch     # Run tests in watch mode
pnpm test -- src/db/queries/__tests__/runs.test.ts  # Run specific test file
```

### Running Evaluations

```bash
# Run evaluation with default settings (claude-3-5-haiku)
pnpm cli

# Run with specific model and concurrency
pnpm cli --model claude-3-5-sonnet-20241022 --concurrent 4

# Run specific languages
pnpm cli --include javascript,python

# Exclude languages
pnpm cli --exclude rust,java

# Debug mode (verbose output)
DEBUG=* pnpm cli
```

## Architecture Overview

### Evaluation System Design

The evals package orchestrates automated testing of the Roo Code AI agent by:

1. **IPC Server Architecture**: Creates Unix socket server for VS Code extension communication
2. **Process Orchestration**: Manages concurrent VS Code instances with controlled lifecycle
3. **Exercise Injection**: Reads prompts from external exercise repository and injects via IPC
4. **Metrics Collection**: Real-time tracking of tokens, costs, duration, and tool usage
5. **Test Execution**: Language-specific unit test runners with timeout management

### Database Schema

The system uses Drizzle ORM with PostgreSQL, organized into four main tables:

- **runs**: Evaluation run metadata and aggregate metrics
- **tasks**: Individual exercise attempts with pass/fail status
- **taskMetrics**: Detailed performance metrics (tokens, costs, tool usage)
- **toolErrors**: Error tracking for failed tool operations

Key relationships:

- Each run contains multiple tasks (one per language/exercise combination)
- Tasks have associated metrics and can have tool errors
- Unique constraints prevent duplicate task attempts within a run

### Core Modules

#### CLI Runner (`src/cli/index.ts`)

- Command-line interface using cmd-ts
- Manages evaluation lifecycle: setup → execution → results
- Handles Git integration for result commits
- Implements graceful shutdown and cleanup

#### IPC Communication

- Server listens on Unix socket: `/tmp/roo-code-ipc-{pid}.sock`
- Message types: runTests, taskComplete, metrics updates
- Broadcasts events to all connected VS Code instances

#### Database Queries (`src/db/queries/`)

- `runs.ts`: Run creation and metric aggregation
- `tasks.ts`: Task CRUD operations with unique constraint handling
- `taskMetrics.ts`: Performance data storage and updates
- `toolErrors.ts`: Error tracking and reporting

### Language Support

Supported languages with test commands:

- **Go**: `go test -v ./...`
- **Java**: `gradle test`
- **JavaScript**: `npm test`
- **Python**: `python -m pytest`
- **Rust**: `cargo test`

### Key Design Patterns

1. **Repository Pattern**: All database operations abstracted in query modules
2. **Event Broadcasting**: IPC server broadcasts to all connected clients
3. **Process Tree Management**: Ensures clean subprocess termination
4. **Timeout Management**: 5-minute task timeout, 2-minute test timeout
5. **Error Boundaries**: Graceful degradation for individual task failures

### Environment Configuration

```bash
# Development (.env)
DATABASE_URL=postgres://postgres:password@localhost:5432/evals_development

# Testing (.env.test)
DATABASE_URL=postgres://postgres:password@localhost:5432/evals_test
```

### Integration Points

- **Exercise Repository**: Located at `../../evals` relative to package
- **VS Code Extension**: Communicates via IPC protocol
- **Web Interface**: Separate package (`@roo-code/web-evals`) for UI
- **Shared Packages**: Uses `@roo-code/ipc` and `@roo-code/types` from monorepo
