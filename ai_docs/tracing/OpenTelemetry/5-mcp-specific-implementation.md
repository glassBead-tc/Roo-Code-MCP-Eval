# OpenTelemetry Implementation for MCP Tool Calls

This document provides specific implementation guidance for adding OpenTelemetry tracing to MCP tool calls in the Roo-Code project.

## Implementation Locations

Based on the codebase analysis, here are the specific locations where tracing should be implemented:

### 1. McpHub.callTool() - Primary Instrumentation Point

**File**: `/src/services/mcp/McpHub.ts` (lines 1248-1287)

```typescript
async callTool(
  serverName: string,
  toolName: string,
  toolArguments?: Record<string, unknown>,
  source?: "global" | "project",
): Promise<McpToolCallResponse> {
  const startTime = Date.now();

  // Emit start event
  this.emit('mcp:tool:start', {
    serverName,
    toolName,
    toolArguments,
    source,
    timeout,
    timestamp: startTime,
  });

  try {
    const result = await connection.client.request(
      {
        method: "tools/call",
        params: {
          name: toolName,
          arguments: toolArguments,
        },
      },
      CallToolResultSchema,
      { timeout }
    );

    // Emit success event
    this.emit('mcp:tool:success', {
      serverName,
      toolName,
      duration: Date.now() - startTime,
      responseSize: JSON.stringify(result).length,
      timestamp: startTime,
    });

    return result;
  } catch (error) {
    // Emit error event
    this.emit('mcp:tool:error', {
      serverName,
      toolName,
      error: error.message,
      duration: Date.now() - startTime,
      timestamp: startTime,
    });

    throw error;
  }
}
```

### 2. McpHub Class Modification

**File**: `/src/services/mcp/McpHub.ts` (line 125)

```typescript
import { EventEmitter } from "events"

export class McpHub extends EventEmitter {
	private providerRef: WeakRef<ClineProvider>
	// ... existing properties

	constructor(provider: ClineProvider) {
		super() // Add EventEmitter constructor
		this.providerRef = new WeakRef(provider)
		// ... existing initialization

		// Initialize tracing if enabled
		if (this.isTracingEnabled()) {
			this.initializeTracing()
		}
	}

	private initializeTracing(): void {
		// Set up OpenTelemetry trace listeners
		const tracer = trace.getTracer("mcp-hub", "1.0.0")

		this.on("mcp:tool:start", (event) => {
			// Create span logic
		})

		this.on("mcp:tool:success", (event) => {
			// Complete span logic
		})

		this.on("mcp:tool:error", (event) => {
			// Error span logic
		})
	}
}
```

### 3. Additional Instrumentation Points

#### Resource Access - McpHub.readResource()

**File**: `/src/services/mcp/McpHub.ts` (lines 1232-1246)

```typescript
async readResource(
  serverName: string,
  uri: string,
  source?: "global" | "project",
): Promise<McpResourceResponse> {
  const startTime = Date.now();

  this.emit('mcp:resource:start', {
    serverName,
    uri,
    source,
    timestamp: startTime,
  });

  // ... existing implementation with events
}
```

#### Connection Lifecycle - McpHub.connectServer()

**File**: `/src/services/mcp/McpHub.ts` (~line 830)

```typescript
private async connectServer(server: McpServer): Promise<void> {
  this.emit('mcp:connection:start', {
    serverName: server.name,
    source: server.source,
    transport: server.type,
    timestamp: Date.now(),
  });

  // ... existing connection logic

  this.emit('mcp:connection:established', {
    serverName: server.name,
    source: server.source,
    transport: server.type,
    timestamp: Date.now(),
  });
}
```

#### High-Level Tool Execution - useMcpToolTool()

**File**: `/src/core/tools/useMcpToolTool.ts` (lines 78-101)

```typescript
// Before tool execution
this.emit("mcp:tool:execution:start", {
	serverName: server_name,
	toolName: tool_name,
	requiresApproval: needsApproval,
	timestamp: Date.now(),
})

const toolResult = await cline.providerRef.deref()?.getMcpHub()?.callTool(server_name, tool_name, parsedArguments)

// After tool execution
this.emit("mcp:tool:execution:complete", {
	serverName: server_name,
	toolName: tool_name,
	hasError: toolResult?.isError,
	timestamp: Date.now(),
})
```

## OpenTelemetry Setup for Roo-Code

### 1. Dependencies

```json
{
	"devDependencies": {
		"@opentelemetry/api": "^1.7.0",
		"@opentelemetry/sdk-node": "^0.45.0",
		"@opentelemetry/sdk-trace-base": "^1.18.0",
		"@opentelemetry/sdk-trace-node": "^1.18.0",
		"@opentelemetry/exporter-trace-otlp-http": "^0.45.0",
		"@opentelemetry/semantic-conventions": "^1.18.0"
	}
}
```

### 2. Trace Initialization Module

Create a new file: `/src/services/mcp/tracing/McpTraceManager.ts`

```typescript
import { trace, SpanKind, SpanStatusCode, Span } from "@opentelemetry/api"
import { EventEmitter } from "events"
import { SEMATTRS_RPC_SERVICE, SEMATTRS_RPC_METHOD, SEMATTRS_RPC_SYSTEM } from "@opentelemetry/semantic-conventions"

export class McpTraceManager {
	private tracer = trace.getTracer("roo-code-mcp", "1.0.0")
	private activeSpans = new Map<string, Span>()

	constructor(private eventEmitter: EventEmitter) {
		this.setupListeners()
	}

	private setupListeners(): void {
		this.eventEmitter.on("mcp:tool:start", this.handleToolStart.bind(this))
		this.eventEmitter.on("mcp:tool:success", this.handleToolSuccess.bind(this))
		this.eventEmitter.on("mcp:tool:error", this.handleToolError.bind(this))
	}

	private handleToolStart(event: any): void {
		const span = this.tracer.startSpan(`mcp.${event.serverName}.${event.toolName}`, {
			kind: SpanKind.CLIENT,
			attributes: {
				[SEMATTRS_RPC_SYSTEM]: "mcp",
				[SEMATTRS_RPC_SERVICE]: event.serverName,
				[SEMATTRS_RPC_METHOD]: event.toolName,
				"mcp.source": event.source || "unknown",
				"mcp.timeout_ms": event.timeout,
				"mcp.has_arguments": !!event.toolArguments,
			},
		})

		const spanKey = this.getSpanKey(event)
		this.activeSpans.set(spanKey, span)
	}

	private handleToolSuccess(event: any): void {
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

	private handleToolError(event: any): void {
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

	private getSpanKey(event: any): string {
		return `${event.serverName}-${event.toolName}-${event.timestamp}`
	}

	private getActiveSpan(event: any): Span | undefined {
		return this.activeSpans.get(this.getSpanKey(event))
	}
}
```

### 3. Configuration Integration

Add to VS Code settings:

```typescript
// In package.json contribution points
"roo-code.telemetry.mcp.enabled": {
  "type": "boolean",
  "default": false,
  "description": "Enable OpenTelemetry tracing for MCP tool calls"
},
"roo-code.telemetry.mcp.endpoint": {
  "type": "string",
  "default": "http://localhost:4318/v1/traces",
  "description": "OTLP endpoint for MCP traces"
}
```

### 4. Initialization in Extension

```typescript
// In src/extension.ts or similar initialization file
import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"

function initializeMcpTracing(config: vscode.WorkspaceConfiguration) {
	if (!config.get<boolean>("telemetry.mcp.enabled")) {
		return
	}

	const sdk = new NodeSDK({
		traceExporter: new OTLPTraceExporter({
			url: config.get<string>("telemetry.mcp.endpoint"),
		}),
		instrumentations: [
			getNodeAutoInstrumentations({
				"@opentelemetry/instrumentation-fs": {
					enabled: false, // Disable file system instrumentation
				},
			}),
		],
	})

	sdk.start()
}
```

This implementation provides:

- Minimal invasiveness to existing code
- Configuration-based enable/disable
- Rich trace data for MCP operations
- Compatibility with any OpenTelemetry-compatible backend
- Clear separation between business logic and telemetry concerns
