# OpenTelemetry MCP Tracing Testing Plan

## Overview

This document outlines the testing plan for the OpenTelemetry tracing implementation for Model Context Protocol (MCP) tool calls in Roo Code. The implementation provides event-based tracing that captures comprehensive telemetry data for MCP operations.

## Expected Behavior When Tracing is Enabled

When MCP tracing is enabled, we should observe:

### 1. Span Creation for MCP Operations

- **Tool Calls**: Spans with name pattern `mcp.{serverName}.{toolName}`
- **Connections**: Spans with name pattern `mcp.connection.{serverName}`
- **Resources**: Spans with name pattern `mcp.resource.{serverName}`

### 2. Rich Span Attributes

- **RPC Semantic Conventions**: `rpc.system`, `rpc.service`, `rpc.method`
- **MCP-Specific Attributes**: `mcp.source`, `mcp.timeout_ms`, `mcp.has_arguments`
- **Performance Data**: `mcp.duration_ms`, `mcp.response_size_bytes`
- **Error Information**: Exception recordings with error messages

### 3. Trace Output Destinations

- **Console Output**: When `useConsoleExporter` is enabled
- **OTLP HTTP Endpoint**: When configured with external observability platform

### 4. Configuration-Driven Behavior

- Tracing **disabled by default** for performance
- Controllable via VS Code settings
- Real-time enable/disable without restart

## Testing Steps

### Prerequisites

1. **Build the Extension**

    ```bash
    npm install
    npm run bundle
    ```

2. **Configure MCP Server** (User Action Required)
    - Add at least one MCP server to test with
    - Use VS Code command palette: "MCP Servers"
    - Or manually edit the global MCP settings file
    - Suggested test server: A simple server with basic tools

### Phase 1: Development Environment Setup

1. **Open Project in VS Code**

    ```bash
    code . # In the Roo-Code project root
    ```

2. **Start Development Mode**

    - Use F5 or "Run Extension" from launch.json
    - This launches the extension in a new VS Code Extension Development Host window

3. **Verify Extension Loading**
    - Open Roo Code sidebar in the Extension Development Host
    - Confirm MCP servers are loaded (if configured)

### Phase 2: Console Exporter Testing

1. **Enable Console Tracing**
   In the Extension Development Host, open Settings (Cmd/Ctrl + ,) and configure:

    ```json
    {
    	"roo-cline.telemetry.mcp.enabled": true,
    	"roo-cline.telemetry.mcp.useConsoleExporter": true
    }
    ```

2. **Trigger MCP Tool Calls**

    - Ask Roo Code to use an MCP tool
    - Execute any available tool from configured MCP servers
    - Try both successful and failing operations

3. **Verify Console Output**
    - Check Developer Console (Help > Toggle Developer Tools)
    - Look for OpenTelemetry span output in the console
    - Verify span names follow expected patterns
    - Confirm attribute presence and accuracy

### Phase 3: OTLP Exporter Testing

1. **Set Up OTLP Receiver** (Optional but Recommended)

    - Run a local OpenTelemetry Collector or Jaeger
    - Example with Docker:

    ```bash
    docker run -d --name jaeger \
      -p 16686:16686 \
      -p 14250:14250 \
      -p 14268:14268 \
      -p 4317:4317 \
      -p 4318:4318 \
      jaegertracing/all-in-one:latest
    ```

2. **Configure OTLP Export**

    ```json
    {
    	"roo-cline.telemetry.mcp.enabled": true,
    	"roo-cline.telemetry.mcp.useConsoleExporter": false,
    	"roo-cline.telemetry.mcp.endpoint": "http://localhost:4318/v1/traces"
    }
    ```

3. **Execute Test Operations**
    - Perform various MCP operations
    - Verify traces appear in Jaeger UI (http://localhost:16686)

### Phase 4: Error Handling Testing

1. **Test Invalid Server Configurations**

    - Configure an invalid MCP server
    - Verify connection error spans are created

2. **Test Tool Call Failures**

    - Call a non-existent tool
    - Verify error spans with proper status codes

3. **Test Network Timeouts**
    - Configure very short timeouts
    - Verify timeout errors are properly traced

### Phase 5: Performance Impact Testing

1. **Baseline Performance** (Tracing Disabled)

    - Measure MCP operation latency without tracing
    - Record memory usage baseline

2. **Tracing Overhead** (Tracing Enabled)
    - Enable tracing and repeat measurements
    - Compare performance impact
    - Verify acceptable overhead (<5% for normal operations)

### Phase 6: Configuration Testing

1. **Runtime Configuration Changes**

    - Toggle tracing on/off during operation
    - Verify immediate effect without restart

2. **Setting Validation**
    - Test invalid endpoint URLs
    - Verify graceful handling of configuration errors

## Expected Trace Structure

### Successful Tool Call

```
Span: mcp.server-name.tool-name
├── Attributes:
│   ├── rpc.system: "mcp"
│   ├── rpc.service: "server-name"
│   ├── rpc.method: "tool-name"
│   ├── mcp.source: "global"|"project"
│   ├── mcp.timeout_ms: 60000
│   ├── mcp.has_arguments: true|false
│   ├── mcp.duration_ms: 123
│   └── mcp.response_size_bytes: 456
├── Status: OK
└── Events: []
```

### Failed Tool Call

```
Span: mcp.server-name.tool-name
├── Attributes:
│   ├── rpc.system: "mcp"
│   ├── rpc.service: "server-name"
│   ├── rpc.method: "tool-name"
│   ├── mcp.source: "global"|"project"
│   ├── mcp.timeout_ms: 60000
│   ├── mcp.has_arguments: true|false
│   └── mcp.duration_ms: 123
├── Status: ERROR ("Tool not found")
└── Events: [Exception recorded]
```

### Connection Lifecycle

```
Span: mcp.connection.server-name
├── Attributes:
│   ├── mcp.server: "server-name"
│   ├── mcp.source: "global"|"project"
│   └── mcp.transport: "stdio"|"sse"
├── Status: OK|ERROR
└── Events: []
```

## Success Criteria

✅ **Spans are created for all MCP operations**
✅ **Attributes follow OpenTelemetry semantic conventions**
✅ **Error conditions are properly recorded**
✅ **Performance overhead is minimal (<5%)**
✅ **Configuration changes take effect immediately**
✅ **No crashes or stability issues**
✅ **Trace data is exportable to external systems**

## Troubleshooting

### Common Issues

1. **No spans appearing**: Check if tracing is enabled in settings
2. **Console export not working**: Verify `useConsoleExporter` is true
3. **OTLP export failing**: Check endpoint URL and network connectivity
4. **High overhead**: Consider reducing trace sampling or disabling for production

### Debug Steps

1. Check VS Code Developer Console for errors
2. Verify OpenTelemetry SDK initialization logs
3. Confirm MCP server connectivity independently
4. Test with minimal MCP server configuration

## Manual Testing Checklist

- [ ] Extension builds without errors
- [ ] Extension loads in development host
- [ ] MCP tracing settings are visible in VS Code settings
- [ ] Console exporter produces visible output
- [ ] OTLP exporter sends traces to external system
- [ ] Span names follow expected patterns
- [ ] Attributes contain expected values
- [ ] Error cases produce error spans
- [ ] Configuration changes take effect immediately
- [ ] Performance impact is acceptable
- [ ] No memory leaks during extended testing
