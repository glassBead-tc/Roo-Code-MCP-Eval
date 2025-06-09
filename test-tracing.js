const { NodeSDK } = require("@opentelemetry/sdk-node")
const { ConsoleSpanExporter, SimpleSpanProcessor, AlwaysOnSampler } = require("@opentelemetry/sdk-trace-base")
const { trace, DiagConsoleLogger, DiagLogLevel, diag } = require("@opentelemetry/api")

// Enable debug logging
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG)

console.log("Creating NodeSDK...")
const sdk = new NodeSDK({
	traceExporter: new ConsoleSpanExporter(),
	sampler: new AlwaysOnSampler(),
	spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())], // Changed to plural
})

console.log("Starting SDK...")
sdk.start()

console.log("Getting tracer...")
const tracer = trace.getTracer("test-tracer", "1.0.0")

console.log("Creating MCP test span...")
const span = tracer.startSpan("mcp.exa.search", {
	kind: 1, // SpanKind.CLIENT
	attributes: {
		"rpc.system": "mcp",
		"rpc.service": "exa",
		"rpc.method": "search",
		"mcp.task_id": "test-task-123",
		"mcp.source": "test",
		"mcp.has_arguments": true,
	},
})
console.log("Span type:", span.constructor.name)
console.log("Span context:", span.spanContext())

// Simulate MCP call
span.setAttribute("mcp.request", JSON.stringify({ query: "test query" }))
span.addEvent("Request sent")

// Simulate response
setTimeout(() => {
	span.setAttribute("mcp.response", JSON.stringify({ result: "test result" }))
	span.setAttribute("mcp.response_size_bytes", 100)
	span.setAttribute("mcp.duration_ms", 50)
	span.setStatus({ code: 0 }) // SpanStatusCode.OK
	span.end()
	console.log("Span ended")
}, 100)

console.log("Test complete")

setTimeout(() => {
	console.log("Shutting down SDK...")
	sdk.shutdown().then(() => {
		console.log("SDK shut down")
		process.exit(0)
	})
}, 1000)
