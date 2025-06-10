# Step 1: Database Setup

The MCP evaluation system uses PostgreSQL to store benchmark data, telemetry information, and evaluation results.

## Starting PostgreSQL

### Using Docker Compose (Recommended)

```bash
cd packages/evals
docker-compose up -d
```

This starts PostgreSQL with the following configuration:

- **Host**: localhost
- **Port**: 5432 (default PostgreSQL port)
- **Database**: evals_development
- **User**: postgres
- **Password**: password

### Verify Database is Running

```bash
# Check Docker container status
docker ps | grep postgres

# Test connection
docker exec -it postgres-evals psql -U postgres -d evals_development -c "SELECT 1;"
```

## Applying Database Migrations

The database schema needs to be initialized with tables for storing evaluation data and MCP telemetry.

### Run All Migrations

```bash
cd packages/evals
pnpm db:push
```

This command:

1. Connects to the PostgreSQL database
2. Creates all necessary tables
3. Applies the MCP telemetry migration (`0003_mcp_telemetry_fields.sql`)

### Verify Migration Success

Check that all tables were created:

```bash
# Using Drizzle Studio (GUI)
pnpm db:studio
# Opens browser at http://localhost:4983

# Or using psql
docker exec -it postgres-evals psql -U postgres -d evals_development -c "\dt"
```

You should see these tables:

- `runs` - Evaluation run metadata
- `tasks` - Individual exercise attempts
- `taskMetrics` - Performance metrics
- `toolErrors` - Tool execution errors
- `mcp_retrieval_benchmarks` - MCP benchmark data
- `mcp_retrieval_calls` - Individual MCP tool calls
- `mcp_connection_events` - MCP connection lifecycle
- `mcp_resource_events` - MCP resource access

## MCP-Specific Schema

The MCP telemetry tables store:

### `mcp_retrieval_benchmarks`

- Links to specific evaluation runs and tasks
- Tracks which MCP server was used
- Records total steps and success status
- Stores error counts

### `mcp_retrieval_calls`

- Individual tool call details
- Request/response JSON data
- Response sizes in bytes
- Duration in milliseconds
- Error messages if failed
- Source context (global/project)
- Timeout values

### `mcp_connection_events`

- Connection lifecycle (start, established, error)
- Transport type used
- Duration of connections
- Error details

### `mcp_resource_events`

- Resource URI access patterns
- Response sizes
- Access duration
- Success/failure status

## Troubleshooting

### Database Connection Issues

If you can't connect to the database:

1. **Check Docker is running**:

    ```bash
    docker --version
    systemctl status docker  # Linux
    ```

2. **Check port availability**:

    ```bash
    lsof -i :5432  # Should show postgres
    ```

3. **Check environment variables**:
    ```bash
    echo $DATABASE_URL
    # Should be: postgres://postgres:password@localhost:5432/evals_development
    ```

### Migration Failures

If migrations fail:

1. **Check database exists**:

    ```bash
    docker exec -it postgres-evals psql -U postgres -c "\l"
    ```

2. **Reset and retry**:

    ```bash
    # Drop all tables (CAUTION: destroys data)
    docker exec -it postgres-evals psql -U postgres -d evals_development -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

    # Retry migration
    pnpm db:push
    ```

3. **Check migration files exist**:
    ```bash
    ls -la src/db/migrations/
    # Should include 0003_mcp_telemetry_fields.sql
    ```

## Alternative: Using Existing PostgreSQL

If you have PostgreSQL installed locally:

1. **Create database and user**:

    ```sql
    CREATE USER postgres WITH PASSWORD 'password';
    CREATE DATABASE evals_development OWNER postgres;
    ```

2. **Update connection string**:

    ```bash
    export DATABASE_URL="postgres://postgres:password@localhost:5432/evals_development"
    ```

3. **Run migrations**:
    ```bash
    pnpm db:push
    ```

## Next Steps

Once the database is set up and migrations are applied, proceed to [Step 2: Build Process](./02-build-project.md).
