#!/usr/bin/env node

/**
 * Simple telemetry test configuration without database dependency
 */

import { NodeSDK } from "@opentelemetry/sdk-node"
import { Resource } from "@opentelemetry/resources"
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from "@opentelemetry/semantic-conventions"
import { SimpleSpanProcessor, SpanProcessor, ReadableSpan } from "@opentelemetry/sdk-trace-base"
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api"
import { TelemetryPluginManager } from "./TelemetryPluginManager.js"
import { builtInProviders } from "./providers/index.js"

/**
 * Mock MCP Benchmark Processor that doesn't require database
 */
class MockMcpBenchmarkProcessor implements SpanProcessor {
	private spans: ReadableSpan[] = []

	onStart(): void {
		// No-op
	}

	onEnd(span: ReadableSpan): void {
		// Store span for inspection
		this.spans.push(span)

		// Log MCP-specific spans
		const spanName = span.name
		if (spanName.startsWith("mcp.")) {
			console.log("\n📊 MCP Span Captured:")
			console.log(`   Name: ${spanName}`)
			console.log(`   Duration: ${(span.duration[0] * 1000 + span.duration[1] / 1e6).toFixed(2)}ms`)
			console.log(`   Status: ${span.status.code === SpanStatusCode.OK ? "✅ OK" : "❌ ERROR"}`)

			const attrs = span.attributes
			if (attrs["mcp.task_id"]) {
				console.log(`   Task ID: ${attrs["mcp.task_id"]}`)
			}
			if (attrs["mcp.source"]) {
				console.log(`   Source: ${attrs["mcp.source"]}`)
			}
			if (attrs["mcp.request"]) {
				console.log(`   Request: ${attrs["mcp.request"]}`)
			}
			if (attrs["mcp.response"]) {
				console.log(`   Response: ${attrs["mcp.response"]}`)
			}
		}
	}

	async shutdown(): Promise<void> {
		console.log(`\n📈 Total spans processed: ${this.spans.length}`)
		console.log(`   MCP spans: ${this.spans.filter((s) => s.name.startsWith("mcp.")).length}`)
	}

	async forceFlush(): Promise<void> {
		// No-op
	}

	getProcessedSpans(): ReadableSpan[] {
		return this.spans
	}
}

/**
 * Initialize telemetry without database
 */
export async function initializeTelemetryWithoutDb(
	options: {
		debug?: boolean
		serviceName?: string
	} = {},
) {
	console.log("🚀 Initializing Telemetry (No Database Mode)...\n")

	const debug = options.debug ?? true

	// Create base resource
	const resource = new Resource({
		[SEMRESATTRS_SERVICE_NAME]: options.serviceName || "telemetry-test",
		[SEMRESATTRS_SERVICE_VERSION]: "1.0.0",
		"deployment.environment": "test",
		"test.mode": "no-database",
	})

	// Create mock MCP processor
	const mcpProcessor = new MockMcpBenchmarkProcessor()

	// Initialize plugin manager
	const pluginManager = new TelemetryPluginManager(resource, debug)

	// Register built-in providers
	builtInProviders.forEach((factory, type) => {
		pluginManager.registerFactory(type, factory)
	})

	// Simple test configuration with console output
	const telemetryConfig = {
		providers: [
			{
				id: "console",
				name: "Console Debug",
				enabled: true,
				options: {
					prettyPrint: true,
					useBatch: false,
				},
			},
		],
		debug,
	}

	// Initialize providers
	await pluginManager.initialize(telemetryConfig)

	// Get all processors
	const spanProcessors = [mcpProcessor, ...pluginManager.getSpanProcessors()]

	// Create SDK
	const sdk = new NodeSDK({
		resource: pluginManager.getMergedResourceAttributes(),
		spanProcessors,
	})

	sdk.start()

	console.log("✅ Telemetry initialized successfully\n")

	return {
		sdk,
		mcpProcessor,
		pluginManager,
		shutdown: async () => {
			await pluginManager.shutdown()
			await sdk.shutdown()
		},
	}
}

/**
 * Run test scenarios
 */
async function runTests() {
	const { sdk, mcpProcessor, shutdown } = await initializeTelemetryWithoutDb()

	// Get tracer
	const tracer = trace.getTracer("telemetry-test", "1.0.0")

	console.log("=== Running Test Scenarios ===\n")

	// Test 1: Basic span
	console.log("📍 Test 1: Basic operation span")
	const basicSpan = tracer.startSpan("test.basic-operation")
	basicSpan.setAttribute("test.scenario", "basic")
	basicSpan.addEvent("Operation started")
	await new Promise((resolve) => setTimeout(resolve, 50))
	basicSpan.addEvent("Operation completed")
	basicSpan.end()

	// Test 2: MCP tool call span
	console.log("\n📍 Test 2: MCP tool call")
	const mcpToolSpan = tracer.startSpan("mcp.test-server.search", {
		kind: SpanKind.CLIENT,
		attributes: {
			"rpc.system": "mcp",
			"rpc.service": "test-server",
			"rpc.method": "search",
			"mcp.task_id": `task-${Date.now()}`,
			"mcp.source": "test-harness",
			"mcp.has_arguments": true,
			"mcp.request": JSON.stringify({
				query: "test search query",
				filters: { language: "javascript" },
				limit: 10,
			}),
		},
	})

	// Simulate processing time
	await new Promise((resolve) => setTimeout(resolve, 150))

	// Add response
	mcpToolSpan.setAttributes({
		"mcp.response": JSON.stringify({
			results: [
				{ id: 1, title: "Result 1" },
				{ id: 2, title: "Result 2" },
			],
			total: 2,
		}),
		"mcp.response_size_bytes": 512,
		"mcp.duration_ms": 150,
	})

	mcpToolSpan.setStatus({ code: SpanStatusCode.OK })
	mcpToolSpan.end()

	// Test 3: Nested MCP operations
	console.log("\n📍 Test 3: Nested MCP operations")
	const parentSpan = tracer.startSpan("mcp.workflow.complex-task")

	// Child operation 1
	const childSpan1 = tracer.startSpan("mcp.test-server.fetch-data", {
		attributes: {
			"rpc.system": "mcp",
			"rpc.service": "test-server",
			"rpc.method": "fetch-data",
			"mcp.task_id": `task-${Date.now()}-1`,
		},
	})
	await new Promise((resolve) => setTimeout(resolve, 75))
	childSpan1.end()

	// Child operation 2
	const childSpan2 = tracer.startSpan("mcp.test-server.process-data", {
		attributes: {
			"rpc.system": "mcp",
			"rpc.service": "test-server",
			"rpc.method": "process-data",
			"mcp.task_id": `task-${Date.now()}-2`,
		},
	})
	await new Promise((resolve) => setTimeout(resolve, 100))
	childSpan2.end()

	parentSpan.end()

	// Test 4: Error scenario
	console.log("\n📍 Test 4: MCP error scenario")
	const errorSpan = tracer.startSpan("mcp.test-server.failing-operation", {
		kind: SpanKind.CLIENT,
		attributes: {
			"rpc.system": "mcp",
			"rpc.service": "test-server",
			"rpc.method": "failing-operation",
			"mcp.task_id": `task-${Date.now()}-error`,
			"mcp.source": "test-harness",
		},
	})

	const error = new Error("Connection timeout: Unable to reach MCP server")
	errorSpan.recordException(error)
	errorSpan.setStatus({
		code: SpanStatusCode.ERROR,
		message: error.message,
	})
	errorSpan.setAttributes({
		"mcp.error_type": "timeout",
		"mcp.retry_count": 3,
	})
	errorSpan.end()

	// Wait for all spans to be processed
	console.log("\n⏳ Waiting for spans to be processed...")
	await new Promise((resolve) => setTimeout(resolve, 1000))

	// Get statistics
	const processedSpans = (mcpProcessor as MockMcpBenchmarkProcessor).getProcessedSpans()
	const mcpSpans = processedSpans.filter((s) => s.name.startsWith("mcp."))

	console.log("\n=== Test Results ===")
	console.log(`Total spans created: ${processedSpans.length}`)
	console.log(`MCP spans: ${mcpSpans.length}`)
	console.log(`Successful: ${mcpSpans.filter((s) => s.status.code === SpanStatusCode.OK).length}`)
	console.log(`Failed: ${mcpSpans.filter((s) => s.status.code === SpanStatusCode.ERROR).length}`)

	// Shutdown
	console.log("\n🔄 Shutting down telemetry...")
	await shutdown()
	console.log("✅ Shutdown complete\n")

	console.log("🎉 All tests completed!")
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runTests().catch((error) => {
		console.error("❌ Test failed:", error)
		process.exit(1)
	})
}
