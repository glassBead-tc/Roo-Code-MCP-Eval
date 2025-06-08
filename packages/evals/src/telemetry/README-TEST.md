# Telemetry Testing Without Database

This directory contains test configurations for running telemetry tests without requiring a database connection.

## Important Update: Jaeger Provider

The Jaeger provider has been updated to use OTLP HTTP protocol instead of the deprecated native Jaeger exporter. This change:

- Uses the same `@opentelemetry/exporter-trace-otlp-http` package as the OTLP provider
- Maintains backward compatibility with existing configurations
- Supports Jaeger 1.35+ which has native OTLP support

### Migration Notes for Jaeger Users

If you're using the old Jaeger configuration:

```json
{
	"id": "jaeger",
	"options": {
		"host": "localhost",
		"port": 6832
	}
}
```

Update to the new format:

```json
{
	"id": "jaeger",
	"options": {
		"endpoint": "http://localhost:4318/v1/traces"
	}
}
```

## Quick Start

### 1. Run the comprehensive test suite

```bash
pnpm test:telemetry
```

This runs a full test suite that includes:

- Basic span creation
- MCP tool call simulation
- Nested operations
- Error scenarios

### 2. Run a simple example

```bash
pnpm test:telemetry:simple
```

Or directly:

```bash
cd packages/evals
tsx src/telemetry/__tests__/simple-telemetry-test.ts
```

## Test Configuration Details

### Mock MCP Benchmark Processor

The test configuration includes a `MockMcpBenchmarkProcessor` that:

- Captures all spans without database writes
- Logs MCP-specific spans to console
- Provides statistics on processed spans
- No external dependencies required

### Features

1. **No Database Required**: Uses in-memory storage for spans
2. **Console Output**: All telemetry data is logged to console
3. **MCP Simulation**: Simulates MCP tool calls with proper attributes
4. **Error Handling**: Demonstrates error span creation
5. **Statistics**: Provides summary of processed spans

### Example Usage in Your Tests

```typescript
import { initializeTelemetryWithoutDb } from "../test-without-db.js"
import { trace } from "@opentelemetry/api"

// Initialize telemetry
const { shutdown } = await initializeTelemetryWithoutDb({
	debug: true,
	serviceName: "my-service",
})

// Create spans
const tracer = trace.getTracer("my-test")
const span = tracer.startSpan("my-operation")
// ... do work ...
span.end()

// Cleanup
await shutdown()
```

### MCP Span Attributes

When creating MCP spans, use these standard attributes:

```typescript
const mcpSpan = tracer.startSpan("mcp.server-name.tool-name", {
	kind: SpanKind.CLIENT,
	attributes: {
		"rpc.system": "mcp",
		"rpc.service": "server-name",
		"rpc.method": "tool-name",
		"mcp.task_id": "unique-task-id",
		"mcp.source": "test",
		"mcp.request": JSON.stringify(requestData),
		"mcp.has_arguments": true,
	},
})

// After processing
mcpSpan.setAttributes({
	"mcp.response": JSON.stringify(responseData),
	"mcp.response_size_bytes": 1024,
	"mcp.duration_ms": 150,
})
```

## Test Output

The test configuration provides detailed console output:

```
🚀 Initializing Telemetry (No Database Mode)...
✅ Telemetry initialized successfully

📊 MCP Span Captured:
   Name: mcp.test-server.search
   Duration: 150.23ms
   Status: ✅ OK
   Task ID: task-1234567890
   Source: test-harness
   Request: {"query":"test search query","filters":{"language":"javascript"},"limit":10}
   Response: {"results":[{"id":1,"title":"Result 1"},{"id":2,"title":"Result 2"}],"total":2}

📈 Total spans processed: 6
   MCP spans: 4
```

## Environment Variables

No environment variables required! The test configuration is self-contained.

## Troubleshooting

If you encounter module resolution issues:

1. Make sure you're running from the package directory
2. Use `tsx` instead of `node` for TypeScript files
3. Check that all dependencies are installed: `pnpm install`
