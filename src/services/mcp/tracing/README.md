# OpenTelemetry Tracing for MCP Tool Calls

This directory contains the implementation of OpenTelemetry tracing for Model Context Protocol (MCP) tool calls in Roo Code.

## Overview

The tracing implementation follows an event-based pattern that minimizes invasiveness to the existing codebase while providing comprehensive telemetry data for MCP operations.

## Architecture

### Components

1. **McpTraceManager** (`McpTraceManager.ts`)

    - Manages OpenTelemetry spans for MCP operations
    - Listens to events emitted by McpHub
    - Creates and manages spans with appropriate attributes and status

2. **initializeTracing** (`initializeTracing.ts`)

    - Initializes the OpenTelemetry SDK
    - Configures exporters (OTLP HTTP or Console)
    - Manages SDK lifecycle

3. **McpHub** (modified)
    - Extended to inherit from EventEmitter
    - Emits events at key points in MCP operations
    - Maintains separation between business logic and telemetry

## Events

The following events are emitted and traced:

### Tool Call Events

- `mcp:tool:start` - When a tool call begins
- `mcp:tool:success` - When a tool call completes successfully
- `mcp:tool:error` - When a tool call fails

### Connection Lifecycle Events

- `mcp:connection:start` - When connecting to an MCP server
- `mcp:connection:established` - When connection is successfully established
- `mcp:connection:error` - When connection fails

### Resource Access Events

- `mcp:resource:start` - When reading a resource begins
- `mcp:resource:success` - When resource read completes successfully
- `mcp:resource:error` - When resource read fails

### High-Level Execution Events

- `mcp:tool:execution:start` - When tool execution begins (includes approval flow)
- `mcp:tool:execution:complete` - When tool execution completes

## Configuration

Add the following settings to your VS Code configuration:

```json
{
	"roo-cline.telemetry.mcp.enabled": false,
	"roo-cline.telemetry.mcp.endpoint": "http://localhost:4318/v1/traces",
	"roo-cline.telemetry.mcp.useConsoleExporter": false
}
```

### Settings

- **`telemetry.mcp.enabled`**: Enable/disable OpenTelemetry tracing for MCP calls
- **`telemetry.mcp.endpoint`**: OTLP HTTP endpoint for sending traces
- **`telemetry.mcp.useConsoleExporter`**: Use console exporter for debugging (outputs to console instead of OTLP)

## Span Attributes

### Common Attributes

- `mcp.source`: Source of the MCP server (global/project)
- `mcp.duration_ms`: Duration of the operation in milliseconds
- `mcp.response_size_bytes`: Size of the response in bytes

### Tool Call Attributes

- `rpc.system`: Always "mcp"
- `rpc.service`: MCP server name
- `rpc.method`: Tool name
- `mcp.timeout_ms`: Configured timeout for the tool call
- `mcp.has_arguments`: Whether the tool call has arguments

### Connection Attributes

- `mcp.server`: Server name
- `mcp.transport`: Transport type (stdio/sse/streamable-http)

### Resource Attributes

- `mcp.resource.uri`: URI of the resource being accessed

## Usage

1. Enable tracing in VS Code settings:

    ```json
    {
    	"roo-cline.telemetry.mcp.enabled": true
    }
    ```

2. Start an OpenTelemetry collector or use console exporter for debugging:

    ```json
    {
    	"roo-cline.telemetry.mcp.useConsoleExporter": true
    }
    ```

3. Use MCP tools normally - traces will be automatically generated

## Example Trace

A typical MCP tool call will generate a trace like:

```
mcp.github.list_repositories
├── Attributes:
│   ├── rpc.system: mcp
│   ├── rpc.service: github
│   ├── rpc.method: list_repositories
│   ├── mcp.source: global
│   ├── mcp.timeout_ms: 60000
│   ├── mcp.has_arguments: true
│   ├── mcp.duration_ms: 1234
│   └── mcp.response_size_bytes: 5678
└── Status: OK
```

## Development

### Adding New Events

To add tracing for new MCP operations:

1. Emit an event in McpHub at the appropriate point:

    ```typescript
    this.emit("mcp:operation:start", {
    	serverName,
    	operationName,
    	timestamp: Date.now(),
    })
    ```

2. Add event handlers in McpTraceManager:
    ```typescript
    private handleOperationStart(event: McpOperationEvent): void {
      if (!this.enabled) return;

      const span = this.tracer.startSpan(`mcp.${event.serverName}.${event.operationName}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          // Add relevant attributes
        },
      });

      // Store span for later
    }
    ```

### Testing

1. Enable console exporter for local testing
2. Perform MCP operations
3. Check console output for trace data
4. Verify span attributes and relationships

## Integration with Observability Platforms

The OTLP HTTP exporter is compatible with:

- Jaeger
- Zipkin (via OTLP collector)
- Datadog
- New Relic
- AWS X-Ray (via OTLP collector)
- Google Cloud Trace (via OTLP collector)
- Any OpenTelemetry-compatible backend

## Performance Considerations

- Tracing is disabled by default
- Event emission has minimal overhead when no listeners are attached
- Span creation only occurs when tracing is enabled
- Batch processing is used for OTLP export to minimize network overhead
