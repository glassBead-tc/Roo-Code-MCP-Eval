import { trace, SpanKind, SpanStatusCode, Span, context } from "@opentelemetry/api"
import { EventEmitter } from "events"
import { ATTR_RPC_SERVICE, ATTR_RPC_METHOD, ATTR_RPC_SYSTEM } from "./semconv"

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

export interface McpConnectionEvent {
	serverName: string
	source?: "global" | "project"
	transport?: string
	timestamp: number
}

export interface McpResourceEvent {
	serverName: string
	uri: string
	source?: "global" | "project"
	timestamp: number
}

export class McpTraceManager {
	private activeSpans = new Map<string, Span>()
	private enabled: boolean = false

	constructor(private eventEmitter: EventEmitter) {
		console.log("🔍 [McpTraceManager] Constructor called")
		this.setupListeners()
	}

	private get tracer() {
		// Get tracer lazily to ensure it uses the configured global provider
		const tracer = trace.getTracer("roo-code-mcp", "1.0.0")
		console.log("🔍 [McpTraceManager] Getting tracer - type:", tracer.constructor.name)
		return tracer
	}

	public setEnabled(enabled: boolean): void {
		console.log(`🔍 [McpTraceManager] setEnabled called with: ${enabled}`)
		this.enabled = enabled
	}

	private setupListeners(): void {
		console.log("🔍 [McpTraceManager] Setting up event listeners")
		// Tool call events
		this.eventEmitter.on("mcp:tool:start", this.handleToolStart.bind(this))
		this.eventEmitter.on("mcp:tool:success", this.handleToolSuccess.bind(this))
		this.eventEmitter.on("mcp:tool:error", this.handleToolError.bind(this))

		// Connection lifecycle events
		this.eventEmitter.on("mcp:connection:start", this.handleConnectionStart.bind(this))
		this.eventEmitter.on("mcp:connection:established", this.handleConnectionEstablished.bind(this))
		this.eventEmitter.on("mcp:connection:error", this.handleConnectionError.bind(this))

		// Resource access events
		this.eventEmitter.on("mcp:resource:start", this.handleResourceStart.bind(this))
		this.eventEmitter.on("mcp:resource:success", this.handleResourceSuccess.bind(this))
		this.eventEmitter.on("mcp:resource:error", this.handleResourceError.bind(this))
	}

	private handleToolStart(event: McpTraceEvent): void {
		console.log("🔍 [McpTraceManager] handleToolStart called with event:", event)
		console.log("🔍 [McpTraceManager] Enabled:", this.enabled)

		if (!this.enabled) {
			console.log("🔍 [McpTraceManager] Tracing is disabled, returning early")
			return
		}

		console.log("🔍 [McpTraceManager] Creating span...")
		const span = this.tracer.startSpan(`mcp.${event.serverName}.${event.toolName}`, {
			kind: SpanKind.CLIENT,
			attributes: {
				[ATTR_RPC_SYSTEM]: "mcp",
				[ATTR_RPC_SERVICE]: event.serverName,
				[ATTR_RPC_METHOD]: event.toolName,
				"mcp.source": event.source || "unknown",
				"mcp.timeout_ms": event.timeout,
				"mcp.has_arguments": !!event.toolArguments,
				// Add request data for the processor
				"mcp.request": event.toolArguments ? JSON.stringify(event.toolArguments) : "{}",
			},
		})

		console.log("🔍 [McpTraceManager] Span created:", span)
		console.log("🔍 [McpTraceManager] Span type:", span.constructor.name)

		const spanKey = this.getSpanKey(event)
		this.activeSpans.set(spanKey, span)
		console.log("🔍 [McpTraceManager] Span stored with key:", spanKey)
	}

	private handleToolSuccess(event: McpTraceSuccessEvent): void {
		if (!this.enabled) return

		const span = this.getActiveSpan(event)
		if (span) {
			span.setAttributes({
				"mcp.duration_ms": event.duration,
				"mcp.response_size_bytes": event.responseSize,
			})
			span.setStatus({ code: SpanStatusCode.OK })
			span.end()
			this.activeSpans.delete(this.getSpanKey(event))
		}
	}

	private handleToolError(event: McpTraceErrorEvent): void {
		if (!this.enabled) return

		const span = this.getActiveSpan(event)
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
			this.activeSpans.delete(this.getSpanKey(event))
		}
	}

	private handleConnectionStart(event: McpConnectionEvent): void {
		if (!this.enabled) return

		const span = this.tracer.startSpan(`mcp.connection.${event.serverName}`, {
			kind: SpanKind.CLIENT,
			attributes: {
				"mcp.server": event.serverName,
				"mcp.source": event.source || "unknown",
				"mcp.transport": event.transport || "unknown",
			},
		})

		const spanKey = `connection-${event.serverName}-${event.timestamp}`
		this.activeSpans.set(spanKey, span)
	}

	private handleConnectionEstablished(event: McpConnectionEvent): void {
		if (!this.enabled) return

		const spanKey = `connection-${event.serverName}-${event.timestamp}`
		const span = this.activeSpans.get(spanKey)
		if (span) {
			span.setStatus({ code: SpanStatusCode.OK })
			span.end()
			this.activeSpans.delete(spanKey)
		}
	}

	private handleConnectionError(event: McpConnectionEvent & { error: string }): void {
		if (!this.enabled) return

		const spanKey = `connection-${event.serverName}-${event.timestamp}`
		const span = this.activeSpans.get(spanKey)
		if (span) {
			span.recordException(new Error(event.error))
			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: event.error,
			})
			span.end()
			this.activeSpans.delete(spanKey)
		}
	}

	private handleResourceStart(event: McpResourceEvent): void {
		if (!this.enabled) return

		const span = this.tracer.startSpan(`mcp.resource.${event.serverName}`, {
			kind: SpanKind.CLIENT,
			attributes: {
				"mcp.server": event.serverName,
				"mcp.resource.uri": event.uri,
				"mcp.source": event.source || "unknown",
			},
		})

		const spanKey = `resource-${event.serverName}-${event.timestamp}`
		this.activeSpans.set(spanKey, span)
	}

	private handleResourceSuccess(event: McpResourceEvent & { duration: number; responseSize: number }): void {
		if (!this.enabled) return

		const spanKey = `resource-${event.serverName}-${event.timestamp}`
		const span = this.activeSpans.get(spanKey)
		if (span) {
			span.setAttributes({
				"mcp.duration_ms": event.duration,
				"mcp.response_size_bytes": event.responseSize,
			})
			span.setStatus({ code: SpanStatusCode.OK })
			span.end()
			this.activeSpans.delete(spanKey)
		}
	}

	private handleResourceError(event: McpResourceEvent & { error: string; duration: number }): void {
		if (!this.enabled) return

		const spanKey = `resource-${event.serverName}-${event.timestamp}`
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
	}

	private getSpanKey(event: McpTraceEvent): string {
		return `${event.serverName}-${event.toolName}-${event.timestamp}`
	}

	private getActiveSpan(event: McpTraceEvent): Span | undefined {
		return this.activeSpans.get(this.getSpanKey(event))
	}

	public cleanup(): void {
		// End any remaining active spans
		this.activeSpans.forEach((span) => {
			span.setStatus({ code: SpanStatusCode.ERROR, message: "Cleanup called with active span" })
			span.end()
		})
		this.activeSpans.clear()
	}
}
