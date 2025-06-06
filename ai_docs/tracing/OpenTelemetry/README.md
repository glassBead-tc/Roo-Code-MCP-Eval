# OpenTelemetry Documentation for MCP Tracing

This folder contains OpenTelemetry documentation specifically curated for implementing tracing in the Model Context Protocol (MCP) tool calls within the Roo-Code project.

## Documentation Structure

1. **[1-setup-and-initialization.md](./1-setup-and-initialization.md)** - Basic OpenTelemetry SDK setup patterns for TypeScript/Node.js
2. **[2-manual-instrumentation.md](./2-manual-instrumentation.md)** - Manual span creation, attributes, events, and error handling
3. **[3-context-propagation.md](./3-context-propagation.md)** - Context management and propagation for async operations
4. **[4-event-based-patterns.md](./4-event-based-patterns.md)** - Event-driven instrumentation patterns (recommended approach)
5. **[5-mcp-specific-implementation.md](./5-mcp-specific-implementation.md)** - Specific implementation guidance for Roo-Code MCP integration

## Source References

All documentation in this folder is sourced from the official OpenTelemetry documentation using Context7:

- **Library ID**: `/open-telemetry/opentelemetry.io`
- **Trust Score**: 9.3
- **Code Snippets Available**: 1910

To retrieve the original documentation or explore additional topics, you can use Context7 with the library ID above.

## Quick Start for MCP Tracing

Based on the analysis of the Roo-Code codebase, the recommended approach is:

1. **Use Event-Based Pattern** (Option 3 from high-level approach)

    - Minimal code changes required
    - Leverages Node.js EventEmitter
    - Maintains separation of concerns

2. **Primary Integration Points**:

    - `McpHub.callTool()` at `/src/services/mcp/McpHub.ts:1248-1287`
    - `useMcpToolTool()` at `/src/core/tools/useMcpToolTool.ts:79-82`

3. **Key Events to Emit**:
    - `mcp:tool:start` - When tool call begins
    - `mcp:tool:success` - On successful completion
    - `mcp:tool:error` - On errors
    - `mcp:connection:established` - For connection lifecycle
    - `mcp:resource:read` - For resource access

## Implementation Checklist

- [ ] Add OpenTelemetry dependencies to package.json
- [ ] Make McpHub extend EventEmitter
- [ ] Add event emissions at key points
- [ ] Create McpTraceManager to handle events
- [ ] Add configuration settings for enable/disable
- [ ] Test with console exporter first
- [ ] Configure OTLP exporter for production

## Example Event Emission

```typescript
// In McpHub.callTool()
this.emit("mcp:tool:start", {
	serverName,
	toolName,
	toolArguments,
	source,
	timeout,
	timestamp: Date.now(),
})
```

## Additional Resources

- [OpenTelemetry JS Getting Started](https://opentelemetry.io/docs/languages/js/getting-started/)
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
- [OTLP Exporter Configuration](https://opentelemetry.io/docs/languages/js/exporters/)
