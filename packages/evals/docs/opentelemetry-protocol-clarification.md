# OpenTelemetry Protocol Clarification and Updates

## Protocol Mismatch Correction

You're absolutely right about the protocol mismatch. In the original plan, I mistakenly suggested:

- **Receiver (CLI)**: gRPC (`@opentelemetry/exporter-trace-otlp-grpc`)
- **Exporter (VS Code)**: HTTP (`@opentelemetry/exporter-trace-otlp-http`)

This was an error. Here's the corrected approach:

### Option 1: All gRPC (Recommended for Performance)

**Advantages:**

- More efficient for high-volume traces
- Binary protocol with better compression
- Persistent connections reduce overhead
- Better for streaming scenarios

**Implementation:**

```typescript
// packages/evals (Receiver)
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc"

// VS Code Extension (Exporter)
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc"
```

### Option 2: All HTTP (Simpler Setup)

**Advantages:**

- Works through more restrictive firewalls
- Easier to debug (can inspect with standard HTTP tools)
- No need for gRPC dependencies
- Works in browser environments

**Implementation:**

```typescript
// packages/evals (Receiver)
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

// VS Code Extension (Exporter)
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
```

## Span Attribute Limits for MCP Data

MCP responses can be large (search results, documentation, etc.), so we need to configure appropriate limits:

```typescript
// packages/evals/src/telemetry/initializeOtel.ts
import { NodeSDK } from "@opentelemetry/sdk-node"

export function initializeOpenTelemetry(port: number = 4317) {
	const sdk = new NodeSDK({
		resource: new Resource({
			[SemanticResourceAttributes.SERVICE_NAME]: "roo-code-evals",
		}),
		traceExporter,
		spanProcessors: [mcpProcessor],
		spanLimits: {
			// Increase for large MCP responses
			attributeValueLengthLimit: 50000, // 50KB per attribute
			attributeCountLimit: 256, // Max attributes per span
			eventCountLimit: 128, // Max events per span
			linkCountLimit: 128, // Max links per span
		},
	})

	return sdk
}
```

## Updated Dependency Recommendations

### For gRPC approach:

```json
// packages/evals/package.json
{
  "dependencies": {
    "@grpc/grpc-js": "^1.11.0",
    "@opentelemetry/exporter-trace-otlp-grpc": "^0.52.0"
  }
}

// VS Code extension package.json
{
  "dependencies": {
    "@grpc/grpc-js": "^1.11.0",
    "@opentelemetry/exporter-trace-otlp-grpc": "^0.52.0"
  }
}
```

### For HTTP approach:

```json
// packages/evals/package.json
{
  "dependencies": {
    "@opentelemetry/exporter-trace-otlp-http": "^0.52.0"
  }
}

// VS Code extension package.json
{
  "dependencies": {
    "@opentelemetry/exporter-trace-otlp-http": "^0.52.0"
  }
}
```

## Handling Large MCP Payloads

For very large MCP responses, consider:

1. **Truncation Strategy**:

```typescript
function truncateAttribute(value: any, maxLength: number = 10000): any {
	if (typeof value === "string" && value.length > maxLength) {
		return value.substring(0, maxLength) + "... [truncated]"
	}
	if (typeof value === "object") {
		const stringified = JSON.stringify(value)
		if (stringified.length > maxLength) {
			return stringified.substring(0, maxLength) + "... [truncated]"
		}
	}
	return value
}
```

2. **Selective Attribute Storage**:

```typescript
// Only store essential parts of large responses
span.setAttributes({
	"mcp.response.size": response.length,
	"mcp.response.preview": response.substring(0, 1000),
	"mcp.response.hash": hashResponse(response), // Store hash for deduplication
})
```

3. **External Storage for Full Payloads**:

- Store full request/response in SQLite
- Reference via span ID in attributes
- Keep spans lightweight for OTLP transport

## Parallel Implementation Strategy Update

Given these considerations, here's the updated worktree strategy:

```bash
# Different protocol implementations
git worktree add ../Roo-Code-otel-grpc feature/otel-all-grpc
git worktree add ../Roo-Code-otel-http feature/otel-all-http

# Different payload handling strategies
git worktree add ../Roo-Code-otel-truncate feature/otel-with-truncation
git worktree add ../Roo-Code-otel-external feature/otel-external-storage
```

This allows you to compare:

1. gRPC vs HTTP performance and complexity
2. Different strategies for handling large MCP payloads
3. Trade-offs between completeness and performance
