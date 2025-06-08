#!/usr/bin/env node

/**
 * Simple example of using telemetry without database
 * This demonstrates how to create a basic telemetry test configuration
 */

import { initializeTelemetryWithoutDb } from "../test-without-db.js"
import { trace, SpanKind } from "@opentelemetry/api"

async function runSimpleTest() {
	console.log("🧪 Running Simple Telemetry Test\n")

	// Initialize telemetry
	const { shutdown } = await initializeTelemetryWithoutDb({
		debug: true,
		serviceName: "my-test-service",
	})

	// Get a tracer
	const tracer = trace.getTracer("simple-test", "1.0.0")

	// Create a simple span
	console.log("Creating test spans...\n")

	const span = tracer.startSpan("my-operation", {
		kind: SpanKind.INTERNAL,
		attributes: {
			"user.id": "12345",
			"operation.type": "test",
		},
	})

	// Do some work
	await new Promise((resolve) => setTimeout(resolve, 100))

	// Add an event
	span.addEvent("Processing completed", {
		"items.processed": 42,
	})

	// End the span
	span.end()

	// Create an MCP-style span
	const mcpSpan = tracer.startSpan("mcp.my-server.my-tool", {
		kind: SpanKind.CLIENT,
		attributes: {
			"rpc.system": "mcp",
			"rpc.service": "my-server",
			"rpc.method": "my-tool",
			"mcp.request": JSON.stringify({ action: "test" }),
		},
	})

	await new Promise((resolve) => setTimeout(resolve, 50))

	mcpSpan.setAttributes({
		"mcp.response": JSON.stringify({ status: "success" }),
	})

	mcpSpan.end()

	// Wait a bit for processing
	await new Promise((resolve) => setTimeout(resolve, 500))

	// Shutdown
	console.log("\nShutting down...")
	await shutdown()

	console.log("\n✅ Test completed successfully!")
}

// Run the test
runSimpleTest().catch(console.error)
