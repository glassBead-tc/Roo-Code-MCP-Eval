# Docker Infrastructure Specification

## Overview

The Roo Code evaluation system uses a containerized architecture with Docker Compose orchestrating multiple services. The system provides a complete development environment with PostgreSQL database, VS Code integration, and multi-language support for running coding evaluations.

## Container Architecture

### Service Topology

```
┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   Roo Evals     │
│   Container     │◄───┤   Container     │
│   (postgres)    │    │   (evals)       │
└─────────────────┘    └─────────────────┘
         │                       │
         │                       │
    Host Network              Host Network
    (Port 5432)               (Port 3000)
```

### Base Image: `node:20-slim`

The evaluation container builds on Node.js 20 slim image with comprehensive toolchain installation:

- **Package Manager**: PNPM (via corepack)
- **System Dependencies**: sudo, curl, git, vim, jq
- **Development Tools**: VS Code, Xvfb (virtual display)
- **Language Runtimes**:
    - C++: cmake 3.28.3
    - Go: golang-go 1.22.2
    - Java: default-jre (Java 21)
    - Python: python3, python3-venv, python3-dev, python3-pip, uv 0.6.6
    - Rust: 1.85 (via rustup)

## Multi-Container Orchestration

### PostgreSQL Service (`postgres`)

```yaml
container_name: postgres-evals
image: postgres:15.4
ports:
    - 5432:5432
volumes:
    - ./.docker/postgres:/var/lib/postgresql/data
    - ./.docker/scripts/postgres:/docker-entrypoint-initdb.d
environment:
    - POSTGRES_USER=postgres
    - POSTGRES_PASSWORD=password
    - POSTGRES_DATABASES=evals_development,evals_test
```

**Features**:

- Uses PostgreSQL 15.4 official image
- Exposes port 5432 to host for external connections
- Persistent data storage via volume mount
- Auto-initialization scripts for database creation
- Creates both development and test databases

### Evaluation Service (`evals`)

```yaml
container_name: roo-evals
build:
    context: ../../..
    dockerfile: Roo-Code/packages/evals/Dockerfile
depends_on:
    - postgres
environment:
    - DATABASE_URL=postgres://postgres:password@postgres:5432/evals_development
volumes:
    - /tmp:/tmp # For IPC sockets
command: pnpm cli --exercise two-bucket --include javascript
```

**Features**:

- Custom-built container from monorepo context
- Service dependency on PostgreSQL
- IPC socket sharing via /tmp volume mount
- Configurable evaluation command execution

## Build Process and Dependencies

### Multi-Stage Build Structure

The Dockerfile uses a single-stage build process with the following phases:

1. **Base Environment Setup**

    - Install Node.js 20 and PNPM
    - Configure system dependencies and user accounts
    - Install development tools and language runtimes

2. **VS Code Installation**

    - Add Microsoft package repository
    - Install VS Code with GPG verification
    - Configure Xvfb for headless operation

3. **User Configuration**

    - Create `vscode` user with sudo privileges
    - Set up proper permissions and shell environment
    - Configure language-specific environments (Rust PATH, etc.)

4. **Workspace Preparation**

    - Clone Roo Code evaluation exercises
    - Set up Python environment with uv
    - Create monorepo structure for dependency resolution

5. **Dependency Installation**

    - Copy workspace configuration (pnpm-lock.yaml, pnpm-workspace.yaml)
    - Copy all required packages with source code
    - Install dependencies via pnpm
    - Install Roo Code VS Code extension

6. **Runtime Configuration**
    - Create symbolic links for exercise resolution
    - Initialize database schema
    - Set default command and expose port 3000

### Workspace Structure in Container

```
/home/vscode/
├── evals/                    # Cloned evaluation exercises
│   └── python/              # Python exercises with uv environment
├── repo/
│   └── benchmark/           # Monorepo structure
│       ├── packages/
│       │   ├── evals/       # Main evaluation package
│       │   ├── config-eslint/
│       │   ├── config-typescript/
│       │   ├── ipc/
│       │   └── types/
│       ├── pnpm-lock.yaml
│       └── pnpm-workspace.yaml
└── roo-code-latest.vsix     # VS Code extension
```

## Networking Configuration

### Internal Service Communication

- **Service Discovery**: Docker Compose automatic DNS resolution
- **Database Connection**: `postgres://postgres:password@postgres:5432/evals_development`
- **Network**: Default bridge network created by Docker Compose

### Port Mapping

- **PostgreSQL**: Host:5432 → Container:5432
- **Evaluation Service**: Container:3000 (exposed but not mapped to host)

### Inter-Service Dependencies

```yaml
depends_on:
    - postgres
```

Ensures PostgreSQL starts before the evaluation service.

## Data Persistence and Volume Management

### PostgreSQL Data Persistence

```yaml
volumes:
    - ./.docker/postgres:/var/lib/postgresql/data
    - ./.docker/scripts/postgres:/docker-entrypoint-initdb.d
```

- **Data Directory**: `./.docker/postgres` → `/var/lib/postgresql/data`
- **Initialization Scripts**: `./.docker/scripts/postgres` → `/docker-entrypoint-initdb.d`

### IPC Socket Sharing

```yaml
volumes:
    - /tmp:/tmp # For IPC sockets
```

Enables communication between VS Code extension and evaluation system via Unix domain sockets.

### Database Initialization

The PostgreSQL container uses an initialization script (`create-databases.sh`) that:

```bash
#!/bin/bash
set -e
set -u

if [ -n "$POSTGRES_DATABASES" ]; then
  for db in $(echo $POSTGRES_DATABASES | tr ',' ' '); do
    echo "Creating $db..."
    psql -U postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $db;"
  done
fi
```

Creates multiple databases from the `POSTGRES_DATABASES` environment variable.

## Environment Configuration and Security

### PostgreSQL Environment Variables

```yaml
environment:
    - POSTGRES_USER=postgres
    - POSTGRES_PASSWORD=password
    - POSTGRES_DATABASES=evals_development,evals_test
```

### Evaluation Service Environment

```yaml
environment:
    - DATABASE_URL=postgres://postgres:password@postgres:5432/evals_development
```

### Runtime Environment Files

The evaluation system uses multiple environment configuration files:

- **Development**: `.env.development`
- **Testing**: `.env.test`
- **Local Overrides**: `.env.local`

#### Key Environment Variables

```bash
DATABASE_URL=postgres://postgres:password@localhost:5432/evals_test
MEM0_API_KEY=your_mem0_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
ROO_EVAL_MODE=true
ROO_CODE_IPC_SOCKET_PATH=/tmp/roo-code-eval.sock
```

### Security Considerations

1. **User Privileges**: vscode user has passwordless sudo access
2. **Database Security**: Default credentials (development only)
3. **API Keys**: Hardcoded in environment files (development setup)
4. **Network Exposure**: PostgreSQL port exposed to host

## Deployment Considerations

### Development Workflow

```bash
# Start services
pnpm db:start  # docker compose up -d

# Stop services
pnpm db:stop   # docker compose down

# Database operations
pnpm db:push   # Push schema changes
pnpm db:migrate # Run migrations
```

### Build Context

The Docker build requires the entire monorepo as context (`../../..`) to access:

- Workspace configuration files
- All package dependencies
- Pre-built VS Code extension

### Performance Optimizations

1. **Layer Caching**: Dependencies installed before copying source code
2. **Multi-language Support**: All language runtimes pre-installed
3. **VS Code Integration**: Extension pre-installed and configured
4. **Database Persistence**: Data survives container restarts

### Scaling Considerations

- **Single Container**: Current design runs single evaluation instance
- **Resource Requirements**: Full development environment with multiple language runtimes
- **Database Sharing**: Single PostgreSQL instance supports multiple evaluation runs
- **IPC Limitations**: Socket-based communication limits to single host

## Summary

The Docker infrastructure provides a comprehensive, reproducible environment for running Roo Code evaluations with:

- **Complete Language Support**: C++, Go, Java, Python, Rust, JavaScript
- **Integrated Development Environment**: VS Code with Roo Code extension
- **Persistent Data Storage**: PostgreSQL with volume-backed persistence
- **Flexible Configuration**: Environment-based configuration management
- **Service Orchestration**: Docker Compose for multi-container coordination

The architecture prioritizes development convenience and evaluation reproducibility over production security and scalability.
