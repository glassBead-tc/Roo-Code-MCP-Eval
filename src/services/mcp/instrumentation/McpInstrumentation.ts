import {
	InstrumentationBase,
	InstrumentationConfig,
	InstrumentationNodeModuleDefinition,
	InstrumentationNodeModuleFile,
} from "@opentelemetry/instrumentation"
import { SpanKind, SpanStatusCode, context, trace } from "@opentelemetry/api"

export class McpInstrumentation extends InstrumentationBase {
	constructor(config: InstrumentationConfig = {}) {
		super("mcp-instrumentation", "1.0.0", config)
	}

	protected init() {
		// Instrument the MCP SDK client
		return new InstrumentationNodeModuleDefinition(
			"@modelcontextprotocol/sdk",
			["*"],
			(moduleExports) => {
				if (moduleExports.Client) {
					this._wrap(moduleExports.Client.prototype, "request", this._patchRequest())
				}
				return moduleExports
			},
			(moduleExports) => {
				if (moduleExports.Client) {
					this._unwrap(moduleExports.Client.prototype, "request")
				}
			},
		)
	}

	private _patchRequest() {
		return function (original: any) {
			return async function (this: any, request: any, schema: any, options?: any) {
				const span = this.tracer.startSpan(`mcp.${request.method}`, {
					kind: SpanKind.CLIENT,
					attributes: {
						"mcp.method": request.method,
						"mcp.params": JSON.stringify(request.params),
					},
				})

				const ctx = trace.setSpan(context.active(), span)

				try {
					const result = await context.with(ctx, () => original.apply(this, [request, schema, options]))

					span.setAttributes({
						"mcp.response_size": JSON.stringify(result).length,
						"mcp.response": JSON.stringify(result), // Capture full response
					})
					span.setStatus({ code: SpanStatusCode.OK })

					return result
				} catch (error: any) {
					span.recordException(error)
					span.setStatus({
						code: SpanStatusCode.ERROR,
						message: error.message,
					})
					throw error
				} finally {
					span.end()
				}
			}
		}
	}
}
