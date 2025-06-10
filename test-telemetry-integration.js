#!/usr/bin/env node

/**
 * Test script to verify telemetry integration with MCP benchmark processor
 */

import { initializeOpenTelemetry } from "./packages/evals/src/telemetry/initializeOtel.js"
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api"

console.log("🚀 Testing Telemetry Integration with MCP Benchmark Processor...\n")

async function runTest() {
	try {
		// Initialize OpenTelemetry with debug mode
		console.log("📡 Initializing OpenTelemetry...")
		const { sdk, port, mcpProcessor, pluginManager, shutdown } = await initializeOpenTelemetry({
			debug: true,
			env: "test",
			telemetryConfig: {
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
				debug: true,
			},
		})

		console.log(`✅ OpenTelemetry initialized on port ${port}\n`)

		// Get tracer
		const tracer = trace.getTracer("telemetry-test", "1.0.0")

		// Test 1: Create a basic span
		console.log("📍 Test 1: Creating basic span...")
		const basicSpan = tracer.startSpan("test-basic-operation")
		basicSpan.setAttribute("test.type", "integration")
		basicSpan.addEvent("Test event triggered")
		basicSpan.end()
		console.log("✅ Basic span created\n")

		// Test 2: Create MCP-like span
		console.log("📍 Test 2: Creating MCP tool span...")
		const mcpSpan = tracer.startSpan("mcp.test-server.test-tool", {
			kind: SpanKind.CLIENT,
			attributes: {
				"rpc.system": "mcp",
				"rpc.service": "test-server",
				"rpc.method": "test-tool",
				"mcp.task_id": "test-task-" + Date.now(),
				"mcp.source": "test",
				"mcp.has_arguments": true,
				"mcp.request": JSON.stringify({
					query: "test query",
					params: { limit: 10 },
				}),
			},
		})

		// Simulate processing
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Add response data
		mcpSpan.setAttributes({
			"mcp.response": JSON.stringify({
				results: ["result1", "result2"],
				count: 2,
			}),
			"mcp.response_size_bytes": 256,
			"mcp.duration_ms": 100,
		})

		mcpSpan.setStatus({ code: SpanStatusCode.OK })
		mcpSpan.end()
		console.log("✅ MCP tool span created\n")

		// Test 3: Create error span
		console.log("📍 Test 3: Creating error span...")
		const errorSpan = tracer.startSpan("mcp.test-server.failing-tool", {
			kind: SpanKind.CLIENT,
			attributes: {
				"rpc.system": "mcp",
				"rpc.service": "test-server",
				"rpc.method": "failing-tool",
				"mcp.source": "test",
			},
		})

		const testError = new Error("Simulated MCP tool error")
		errorSpan.recordException(testError)
		errorSpan.setStatus({
			code: SpanStatusCode.ERROR,
			message: testError.message,
		})
		errorSpan.end()
		console.log("✅ Error span created\n")

		// Wait for spans to be processed
		console.log("⏳ Waiting for spans to be processed...")
		await new Promise((resolve) => setTimeout(resolve, 2000))

		// Check if MCP processor received spans
		console.log("\n📊 MCP Processor Statistics:")
		console.log(`   - Processor type: ${mcpProcessor.constructor.name}`)
		console.log(`   - Plugin Manager providers: ${pluginManager.getProviderIds().join(", ")}\n`)

		// Shutdown
		console.log("🔄 Shutting down telemetry...")
		await shutdown()
		console.log("✅ Telemetry shut down successfully\n")

		console.log("🎉 All tests completed successfully!")
	} catch (error) {
		console.error("❌ Test failed:", error)
		process.exit(1)
	}
}

// Run the test
runTest().catch(console.error)
