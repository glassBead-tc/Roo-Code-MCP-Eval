# MCP Evaluation Documentation Errors

This report documents discrepancies found between the run-evaluation documentation and the actual codebase implementation.

## Critical Errors

### 1. Database Configuration Mismatch

**Location**: `01-database-setup.md` and `04-environment-setup.md`

**Documentation states**:

- Port: 5433
- Database name: `roo_code_evals`
- User: `roo_code`
- Example URL: `postgresql://roo_code:password@localhost:5433/roo_code_evals`

**Actual implementation**:

- Port: 5432 (from docker-compose.yml and .env files)
- Database name: `evals_development`
- User: `postgres`
- Actual URL: `postgres://postgres:password@localhost:5432/evals_development`

**Impact**: Users following the documentation will fail to connect to the database.

### 2. MCP Server Package Names

**Location**: `03-configure-mcp-servers.md`

**Documentation shows**:

- Generic package names like `@modelcontextprotocol/server-exa`
- Consistent naming pattern for all servers

**Actual implementation** (based on codebase analysis):

- `exa`: Local build path or custom package
- `firecrawl`: `firecrawl-mcp` (not `@modelcontextprotocol/server-firecrawl`)
- `context7`: `@upstash/context7-mcp` (not `@modelcontextprotocol/server-context7`)
- `perplexity-ask`: Package name unclear from codebase

**Impact**: MCP servers may fail to start with incorrect package names.

## Minor Inconsistencies

### 1. Docker Container Name

**Location**: `01-database-setup.md`

**Documentation**: References `evals-postgres-1`
**Actual**: Container name is `postgres-evals` (from docker-compose.yml)

### 2. Resume Flag

**Location**: `05-run-evaluation.md`

**Documentation**: Shows `--resume 42`
**Actual**: The CLI uses `--run-id` flag (from cli/index.ts)

## Recommendations

1. Update all database connection information to match the actual docker-compose.yml configuration
2. Verify and update MCP server package names with actual working packages
3. Update container names to match docker-compose service names
4. Correct the resume command flag from `--resume` to `--run-id`
5. Consider adding a validation script that checks if the documented configuration matches the actual setup

## Verification Commands

To verify the correct configuration:

```bash
# Check actual database port
grep -E "ports:|DATABASE_URL" packages/evals/docker-compose.yml packages/evals/.env*

# Check container name
docker-compose ps

# Verify CLI flags
pnpm cli --help
```
