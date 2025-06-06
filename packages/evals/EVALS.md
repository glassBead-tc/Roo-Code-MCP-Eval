# Roo Code Evaluation System

This document provides comprehensive information about the Roo Code evaluation system, including setup instructions and usage guidelines.

## Overview

The Roo Code evaluation system is designed to test the AI agent's ability to complete programming exercises across multiple languages. It automates the process of:

- Running coding tasks through the Roo Code VS Code extension
- Executing unit tests to verify correctness
- Tracking performance metrics and costs
- Providing a web interface to monitor and manage evaluation runs

## Architecture

### Components

1. **CLI Runner** (`src/cli/index.ts`)

    - Orchestrates evaluation runs
    - Manages VS Code instances for each task
    - Communicates with the extension via IPC (Unix sockets)
    - Executes unit tests after task completion

2. **Database** (PostgreSQL)

    - Stores run configurations and results
    - Tracks metrics: tokens, costs, duration, tool usage
    - Records task pass/fail status and errors

3. **Web Interface** (`apps/web-evals`)

    - Create and configure evaluation runs
    - Monitor real-time progress
    - View results and metrics
    - Built with Next.js and React

4. **Exercise Repository**
    - External repository containing programming exercises
    - Supports Go, Java, JavaScript, Python, and Rust
    - Each exercise includes prompts and unit tests

## Prerequisites

- **macOS only** (currently)
- Node.js 20.19.2
- PNPM package manager
- Docker (for PostgreSQL)
- Visual Studio Code
- OpenRouter API key

## Setup Instructions

### Automated Setup (Recommended)

The setup script handles all dependencies and configuration:

```bash
cd packages/evals
./scripts/setup.sh
```

The script will:

1. Prompt you to select which language environments to support
2. Install required tools (Homebrew, asdf, language runtimes)
3. Clone the exercises repository
4. Set up the database
5. Configure your OpenRouter API key
6. Optionally build and install the Roo Code extension

### Manual Setup

If you prefer manual setup or need to troubleshoot:

1. **Install Dependencies**

    ```bash
    # Install Homebrew (if not present)
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Install asdf version manager
    brew install asdf

    # Install PNPM
    brew install pnpm

    # Install GitHub CLI (for submitting results)
    brew install gh
    ```

2. **Install Language Runtimes** (as needed)

    ```bash
    # Node.js
    asdf plugin add nodejs
    asdf install nodejs 20.19.2
    asdf global nodejs 20.19.2

    # Python
    asdf plugin add python
    asdf install python 3.13.2
    asdf global python 3.13.2
    brew install uv  # Python package manager

    # Go
    asdf plugin add golang
    asdf install golang 1.24.2
    asdf global golang 1.24.2

    # Rust
    asdf plugin add rust
    asdf install rust 1.85.1
    asdf global rust 1.85.1

    # Java
    brew install openjdk@17
    ```

3. **Clone Exercise Repository**

    ```bash
    git clone https://github.com/cte/evals.git ../../evals
    ```

4. **Configure Environment**

    ```bash
    # Create .env.local file
    touch .env.local

    # Add your OpenRouter API key
    echo "OPENROUTER_API_KEY=sk-or-v1-..." >> .env.local
    ```

5. **Start Database**
    ```bash
    pnpm db:start  # Starts PostgreSQL in Docker
    pnpm db:push   # Create database schema
    ```

## Running Evaluations

### Using the Web Interface

1. **Start the Web App**

    ```bash
    pnpm --filter @roo-code/web-evals dev
    ```

    Navigate to http://localhost:3000

2. **Create a New Run**

    - Click "New Run"
    - Select model (e.g., claude-3-5-sonnet-20241022)
    - Choose languages and exercises to test
    - Configure settings (temperature, concurrency, etc.)
    - Click "Start Run"

3. **Monitor Progress**
    - Real-time updates show task status
    - View token usage and costs
    - See pass/fail results as tests complete

### Using the CLI

For direct CLI usage:

```bash
pnpm cli <run-id>
```

This executes a previously created run by its ID.

## Database Commands

```bash
# Start/stop PostgreSQL
pnpm db:start
pnpm db:stop

# Schema management
pnpm db:generate  # Generate migrations after schema changes
pnpm db:migrate   # Apply migrations
pnpm db:push      # Push schema directly (development)
pnpm db:check     # Verify schema consistency

# Test database
pnpm db:test:push   # Push schema to test database
pnpm db:test:check  # Check test database schema
```

## How Evaluations Work

1. **Task Execution**

    - Each exercise runs in a separate VS Code window
    - The extension receives the exercise prompt via IPC
    - AI agent attempts to solve the problem autonomously
    - Task has a 5-minute timeout

2. **Communication Protocol**

    - Unix socket-based IPC between CLI and extension
    - Real-time event streaming (task started, token updates, completion)
    - Metrics collection (tokens, cost, duration, tool usage)

3. **Unit Testing**

    - After task completion, unit tests run automatically
    - Each language has specific test commands:
        - Go: `go test`
        - Java: `./gradlew test`
        - JavaScript: `pnpm install && pnpm test`
        - Python: `uv run python3 -m pytest -o markers=task *_test.py`
        - Rust: `cargo test`
    - Tests have a 2-minute timeout

4. **Results Storage**
    - All results stored in PostgreSQL
    - Metrics include: tokens (in/out/context), cost, duration, cache usage
    - Tool usage statistics and errors tracked
    - Git commits created for each run

## Configuration Options

### Run Settings

- **Model**: AI model to use (via OpenRouter)
- **Temperature**: Controls randomness (0-2)
- **Concurrency**: Number of parallel tasks (default: 2)
- **Custom Instructions**: Additional guidance for the AI

### Environment Variables

- `OPENROUTER_API_KEY`: Required for API access
- `FOOTGUN_SYSTEM_PROMPT`: Optional system prompt override for testing

## Troubleshooting

### Common Issues

1. **Setup script fails**

    - Ensure you're on macOS
    - Check internet connection
    - Run with elevated permissions if needed

2. **Database connection errors**

    - Verify Docker is running
    - Check PostgreSQL container: `docker ps`
    - Restart database: `pnpm db:stop && pnpm db:start`

3. **VS Code not opening**

    - Ensure VS Code CLI is installed: `code --version`
    - Check extension is installed: `code --list-extensions | grep roo`

4. **Unit tests timing out**
    - Some exercises may have long-running tests
    - Check language-specific dependencies are installed
    - Verify exercise repository is up to date

### Debug Mode

For debugging evaluation runs:

- Add `--wait --log trace` to VS Code command in `src/cli/index.ts`
- Uncomment `subprocess.stdout.pipe(process.stdout)` for output
- Check IPC socket connections in `/tmp/`

## Development

### Adding New Languages

1. Update `exerciseLanguages` in `src/exercises/index.ts`
2. Add test command configuration in `src/cli/index.ts`
3. Update setup script to install language runtime
4. Add VS Code extension for the language

### Modifying Schema

1. Edit `src/db/schema.ts`
2. Generate migration: `pnpm db:generate`
3. Review generated SQL in `src/db/migrations/`
4. Apply migration: `pnpm db:migrate`

### Testing

```bash
# Run tests for the evals package
pnpm test

# Run specific test file
pnpm test src/db/queries/__tests__/runs.test.ts
```

## Additional Resources

- Exercise Repository: https://github.com/cte/evals
- OpenRouter API: https://openrouter.ai
- Main Roo Code Repository: https://github.com/RooCodeInc/Roo-Code
