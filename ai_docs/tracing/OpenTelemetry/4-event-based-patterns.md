# OpenTelemetry Event-Based Instrumentation Patterns

This document covers patterns for implementing event-based tracing instrumentation, which aligns with the recommended approach for MCP tool call tracing.

## Event Emitter Integration Pattern

While OpenTelemetry doesn't provide built-in event emitter patterns in the TypeScript SDK, you can implement event-based tracing by combining Node.js EventEmitter with OpenTelemetry instrumentation.

### Basic Event-Based Tracing Implementation

```typescript
import { EventEmitter } from "events"
import { trace, Span, SpanStatusCode, SpanKind } from "@opentelemetry/api"

export interface McpTraceEvent {
	serverName: string
	toolName: string
	toolArguments?: Record<string, unknown>
	source?: "global" | "project"
	timeout?: number
	timestamp: number
}

export interface McpTraceSuccessEvent extends McpTraceEvent {
	duration: number
	responseSize: number
}

export interface McpTraceErrorEvent extends McpTraceEvent {
	error: string
	duration: number
}

export class TracedMcpHub extends EventEmitter {
	private tracer = trace.getTracer("mcp-hub", "1.0.0")
	private activeSpans = new Map<string, Span>()

	constructor() {
		super()
		this.setupTraceListeners()
	}

	private setupTraceListeners() {
		// Start span on tool call start
		this.on("mcp:tool:start", (event: McpTraceEvent) => {
			const span = this.tracer.startSpan(`mcp.tool.${event.toolName}`, {
				kind: SpanKind.CLIENT,
				attributes: {
					"mcp.server": event.serverName,
					"mcp.tool": event.toolName,
					"mcp.source": event.source || "unknown",
					"mcp.timeout": event.timeout || 60000,
				},
			})

			// Store span for later
			const spanKey = `${event.serverName}-${event.toolName}-${event.timestamp}`
			this.activeSpans.set(spanKey, span)
		})

		// End span on success
		this.on("mcp:tool:success", (event: McpTraceSuccessEvent) => {
			const spanKey = `${event.serverName}-${event.toolName}-${event.timestamp}`
			const span = this.activeSpans.get(spanKey)

			if (span) {
				span.setAttributes({
					"mcp.duration_ms": event.duration,
					"mcp.response_size": event.responseSize,
				})
				span.setStatus({ code: SpanStatusCode.OK })
				span.end()
				this.activeSpans.delete(spanKey)
			}
		})

		// End span on error
		this.on("mcp:tool:error", (event: McpTraceErrorEvent) => {
			const spanKey = `${event.serverName}-${event.toolName}-${event.timestamp}`
			const span = this.activeSpans.get(spanKey)

			if (span) {
				span.recordException(new Error(event.error))
				span.setStatus({
					code: SpanStatusCode.ERROR,
					message: event.error,
				})
				span.setAttributes({
					"mcp.duration_ms": event.duration,
				})
				span.end()
				this.activeSpans.delete(spanKey)
			}
		})
	}

	// Your existing callTool method with event emissions
	async callTool(
		serverName: string,
		toolName: string,
		toolArguments?: Record<string, unknown>,
		source?: "global" | "project",
	): Promise<McpToolCallResponse> {
		const startTime = Date.now()

		// Emit start event
		this.emit("mcp:tool:start", {
			serverName,
			toolName,
			toolArguments,
			source,
			timeout: this.getTimeout(serverName),
			timestamp: startTime,
		})

		try {
			const result = await this.performToolCall(serverName, toolName, toolArguments)

			// Emit success event
			this.emit("mcp:tool:success", {
				serverName,
				toolName,
				duration: Date.now() - startTime,
				responseSize: JSON.stringify(result).length,
				timestamp: startTime,
			})

			return result
		} catch (error) {
			// Emit error event
			this.emit("mcp:tool:error", {
				serverName,
				toolName,
				error: error.message,
				duration: Date.now() - startTime,
				timestamp: startTime,
			})

			throw error
		}
	}
}
```

## Using Context for Event Correlation

When events might be processed asynchronously or out of order, you can use OpenTelemetry context to maintain trace continuity:

```typescript
import { context, trace, Context } from "@opentelemetry/api"

export class ContextAwareTracedMcpHub extends EventEmitter {
	private tracer = trace.getTracer("mcp-hub", "1.0.0")

	async callTool(/* params */) {
		// Create span and make it active
		return this.tracer.startActiveSpan(`mcp.tool.${toolName}`, async (span) => {
			const startTime = Date.now()

			// Store context for event handlers
			const traceContext = context.active()

			this.emit("mcp:tool:start", {
				serverName,
				toolName,
				context: traceContext, // Pass context in event
				timestamp: startTime,
			})

			try {
				const result = await this.performToolCall(serverName, toolName, toolArguments)

				this.emit("mcp:tool:success", {
					serverName,
					toolName,
					context: traceContext,
					result,
					timestamp: startTime,
				})

				span.setStatus({ code: SpanStatusCode.OK })
				return result
			} catch (error) {
				this.emit("mcp:tool:error", {
					serverName,
					toolName,
					context: traceContext,
					error,
					timestamp: startTime,
				})

				span.recordException(error)
				span.setStatus({ code: SpanStatusCode.ERROR })
				throw error
			} finally {
				span.end()
			}
		})
	}
}
```

## Async Event Processing with Context

For scenarios where event handlers need to create child spans:

```typescript
this.on("mcp:tool:validation", (event: { context: Context; data: any }) => {
	// Run validation in the trace context
	context.with(event.context, () => {
		const validationSpan = this.tracer.startSpan("mcp.tool.validation")

		try {
			// Perform validation
			this.validateToolCall(event.data)
			validationSpan.setStatus({ code: SpanStatusCode.OK })
		} catch (error) {
			validationSpan.recordException(error)
			validationSpan.setStatus({ code: SpanStatusCode.ERROR })
		} finally {
			validationSpan.end()
		}
	})
})
```

## Integration with Express-style Middleware

For web frameworks, you can combine event-based patterns with instrumentation hooks:

```typescript
import { ExpressInstrumentation, ExpressLayerType } from "@opentelemetry/instrumentation-express"

const expressInstrumentation = new ExpressInstrumentation({
	requestHook: function (span: Span, info: ExpressRequestInfo) {
		if (info.layerType === ExpressLayerType.REQUEST_HANDLER) {
			// Emit event for request handling
			eventEmitter.emit("http:request:start", {
				span,
				method: info.request.method,
				url: info.request.baseUrl,
			})
		}
	},
})
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/libraries.md#_snippet_6`

## Best Practices for Event-Based Tracing

1. **Event Naming**: Use hierarchical naming (e.g., `mcp:tool:start`, `mcp:connection:established`)
2. **Timestamp Correlation**: Include timestamps in events to handle out-of-order processing
3. **Context Propagation**: Pass OpenTelemetry context in events when child spans might be created
4. **Error Handling**: Always emit error events in catch blocks before re-throwing
5. **Cleanup**: Remove stored spans from maps to prevent memory leaks
6. **Attributes**: Include relevant attributes at event emission time for rich telemetry

## Configuration Pattern

```typescript
interface TracingConfig {
	enabled: boolean
	serviceName: string
	exporters: "console" | "otlp" | "zipkin"
	samplingRatio: number
}

export class ConfigurableTracedMcpHub extends TracedMcpHub {
	constructor(private config: TracingConfig) {
		super()

		if (!config.enabled) {
			// Disable all event listeners
			this.removeAllListeners()
		}
	}
}
```

This event-based approach provides flexibility to:

- Enable/disable tracing via configuration
- Add multiple trace consumers
- Integrate with existing logging/monitoring
- Maintain separation of concerns between business logic and telemetry
