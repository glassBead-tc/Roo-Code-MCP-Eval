# OpenTelemetry Tracing Sequence for MCP Tool Calls

Sequence diagram of events during an eval run, annotated with code locations.

```mermaid
sequenceDiagram
    participant RooCode as Roo Code
    participant NodeSDK as NodeSDK
    participant McpInstrumentation as McpInstrumentation
    participant McpHub as McpHub
    participant ExaMCP as Exa MCP Server
    participant FirecrawlMCP as Firecrawl MCP Server
    participant SimpleSP as SimpleSpanProcessor
    participant OtlpExp as OTLPTraceExporter
    participant BenchProc as McpBenchmarkProcessor
    participant DB as Evals DB

    Note over RooCode: Call [`initializeMcpTracing()`](src/services/mcp/tracing/initializeTracing.ts:16)
    RooCode->>NodeSDK: sdk.start()
    Note over NodeSDK: Initialization in [`initializeMcpTracing()`](src/services/mcp/tracing/initializeTracing.ts:61-68)

    Note over McpInstrumentation: Created via [`new McpInstrumentation()`](src/services/mcp/tracing/initializeTracing.ts:67)
    NodeSDK->>McpInstrumentation: instrumentation.start()

    McpInstrumentation->>McpHub: subscribe to events

    %% Unified connection & tool call flow for each MCP server
    Note over loop: Servers receive the same challenge set (identical toolName & arguments)
    loop For each server (ExaMCP, FirecrawlMCP)
        RooCode->>McpHub: emit `mcp:connection:start` (src/services/mcp/McpHub.ts:494)
        McpHub-->>McpInstrumentation: event `mcp:connection:start`
        McpInstrumentation->>BenchProc: start span `mcp.${serverName}.connection`
        McpInstrumentation->>SimpleSP: record span

        McpInstrumentation->>ServerMCP: call challenge tool `${toolName}` with identical arguments
        ServerMCP-->>McpHub: emit `mcp:tool:success` (src/services/mcp/McpHub.ts:1437)
        McpHub-->>McpInstrumentation: event `mcp:tool:success`
        McpInstrumentation->>BenchProc: end span `mcp.${serverName}.${toolName}`
        McpInstrumentation->>SimpleSP: export span
    end

    %% Exporters and DB
    SimpleSP->>OtlpExp: HTTP export
    BenchProc->>DB: write metrics
```
