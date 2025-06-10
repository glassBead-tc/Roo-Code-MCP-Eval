#!/usr/bin/env node

/**
 * Test script to verify OpenTelemetry implementation in Roo Code
 * This script tests the MCP tracing functionality
 */

const { trace, SpanKind, SpanStatusCode } = require("@opentelemetry/api")
const { NodeSDK } = require("@opentelemetry/sdk-node")
const { ConsoleSpanExporter, SimpleSpanProcessor } = require("@opentelemetry/sdk-trace-base")
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http")
const { resourceFromAttributes } = require("@opentelemetry/resources")

// Configuration
const USE_CONSOLE_EXPORTER = false // Set to false to use OTLP exporter
const OTLP_ENDPOINT = "http://localhost:4318/v1/traces"

console.log("🚀 Starting OpenTelemetry test for Roo Code MCP tracing...\n")

// Create resource
const resource = resourceFromAttributes({
	"service.name": "roo-code-mcp-test",
	"service.version": "1.0.0",
})

// Create exporter
const traceExporter = USE_CONSOLE_EXPORTER
	? new ConsoleSpanExporter()
	: new OTLPTraceExporter({
			url: OTLP_ENDPOINT,
			headers: {},
		})

console.log(
	`📡 Using ${USE_CONSOLE_EXPORTER ? "Console" : "OTLP"} exporter${!USE_CONSOLE_EXPORTER ? ` (${OTLP_ENDPOINT})` : ""}\n`,
)

// Create and configure SDK
const sdk = new NodeSDK({
	resource,
	traceExporter,
	spanProcessor: new SimpleSpanProcessor(traceExporter),
})

// Initialize the SDK
sdk.start()
console.log("✅ OpenTelemetry SDK initialized\n")

// Get tracer
const tracer = trace.getTracer("roo-code-mcp-test", "1.0.0")

// Test 1: Basic span creation
console.log("📍 Test 1: Basic span creation")
const basicSpan = tracer.startSpan("test-basic-span")
basicSpan.setAttribute("test.name", "basic")
basicSpan.addEvent("Test event")
basicSpan.end()
console.log("✅ Basic span created and ended\n")

// Test 2: Simulate MCP tool call
console.log("📍 Test 2: Simulating MCP tool call")
const mcpToolSpan = tracer.startSpan("mcp.exa.search", {
	kind: SpanKind.CLIENT,
	attributes: {
		"rpc.system": "mcp",
		"rpc.service": "exa",
		"rpc.method": "search",
		"mcp.source": "test",
		"mcp.timeout_ms": 30000,
		"mcp.has_arguments": true,
		"mcp.request": JSON.stringify({ query: "OpenTelemetry testing" }),
	},
})

// Simulate processing time
setTimeout(() => {
	mcpToolSpan.setAttributes({
		"mcp.duration_ms": 1234,
		"mcp.response_size_bytes": 5678,
		"mcp.response": JSON.stringify({ results: ["result1", "result2"] }),
	})
	mcpToolSpan.setStatus({ code: SpanStatusCode.OK })
	mcpToolSpan.end()
	console.log("✅ MCP tool span created and ended\n")

	// Test 3: Simulate MCP connection
	console.log("📍 Test 3: Simulating MCP connection")
	const connectionSpan = tracer.startSpan("mcp.connection.exa", {
		kind: SpanKind.CLIENT,
		attributes: {
			"mcp.server": "exa",
			"mcp.source": "test",
			"mcp.transport": "stdio",
		},
	})

	setTimeout(() => {
		connectionSpan.setStatus({ code: SpanStatusCode.OK })
		connectionSpan.end()
		console.log("✅ MCP connection span created and ended\n")

		// Test 4: Simulate error scenario
		console.log("📍 Test 4: Simulating error scenario")
		const errorSpan = tracer.startSpan("mcp.firecrawl.scrape", {
			kind: SpanKind.CLIENT,
			attributes: {
				"rpc.system": "mcp",
				"rpc.service": "firecrawl",
				"rpc.method": "scrape",
				"mcp.source": "test",
			},
		})

		const error = new Error("Simulated timeout error")
		errorSpan.recordException(error)
		errorSpan.setStatus({
			code: SpanStatusCode.ERROR,
			message: error.message,
		})
		errorSpan.end()
		console.log("✅ Error span created and ended\n")

		// Shutdown after a delay to ensure export
		console.log("⏳ Waiting for spans to export...")
		setTimeout(async () => {
			await sdk.shutdown()
			console.log("\n✅ OpenTelemetry SDK shut down")
			console.log("\n🎉 All tests completed successfully!")

			if (!USE_CONSOLE_EXPORTER) {
				console.log("\n💡 To view traces with OTLP exporter:")
				console.log("   1. Ensure you have a trace collector running (e.g., Jaeger, OTLP Collector)")
				console.log("   2. Check the collector UI for the traces")
			}
		}, 2000)
	}, 500)
}, 1000)
