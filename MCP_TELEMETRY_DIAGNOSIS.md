# MCP Telemetry Diagnosis

## Root Cause Analysis

### 1. Benchmark Records Created But No Tool Calls

- `/packages/evals/src/cli/index.ts:122` creates benchmark records with hardcoded values:
    - `mcpServerName: "default_mcp_server"`
    - `userIntent: "default_user_intent"`
- These are placeholder values, not real MCP activity

### 2. McpBenchmarkProcessor Filter Issue

- `/packages/evals/src/benchmark/McpBenchmarkProcessor.ts:20` filters spans:
    ```typescript
    if (!["exa", "firecrawl"].includes(serverName)) return
    ```
- This rejects "default_mcp_server" spans, so no tool calls are recorded

### 3. Telemetry Flow

1. **McpHub** (`/src/services/mcp/McpHub.ts`) emits events:

    - `mcp:tool:start`, `mcp:tool:success`, `mcp:tool:error`
    - `mcp:connection:start`, `mcp:connection:established`, `mcp:connection:error`
    - `mcp:resource:start`, `mcp:resource:success`, `mcp:resource:error`

2. **McpTraceManager** (`/src/services/mcp/tracing/McpTraceManager.ts`) listens to events and creates OpenTelemetry spans

3. **McpBenchmarkProcessor** processes spans but only for "exa" and "firecrawl" servers

4. **Telemetry is enabled** (`/src/services/mcp/tracing/initializeTracing.ts:26`):
    ```typescript
    const enabled = config.get<boolean>("telemetry.mcp.enabled", false) || true // FORCE ON FOR TESTING
    ```

## Solutions

### Option 1: Update McpBenchmarkProcessor Filter

Add "default_mcp_server" to the allowed list:

```typescript
if (!["exa", "firecrawl", "default_mcp_server"].includes(serverName)) return
```

### Option 2: Use Real MCP Servers

Ensure eval tasks actually use MCP servers like "exa" or "firecrawl"

### Option 3: Fix CLI to Use Actual Server Names

Update `/packages/evals/src/cli/index.ts:122` to use the actual MCP server name being tested

## Current Status

- ✅ Telemetry infrastructure working
- ✅ Benchmark records being created
- ❌ No actual MCP tool calls captured due to server name filter
- ❌ Roo Code GUI not appearing (separate issue)
