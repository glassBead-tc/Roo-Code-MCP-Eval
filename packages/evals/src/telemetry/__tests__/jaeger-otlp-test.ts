#!/usr/bin/env node

/**
 * Test the updated Jaeger provider that uses OTLP HTTP
 */

import { initializeTelemetryWithoutDb } from "../test-without-db.js"
import { trace, SpanKind } from "@opentelemetry/api"

async function testJaegerProvider() {
	console.log("🧪 Testing Jaeger Provider with OTLP HTTP\n")

	// Initialize telemetry with Jaeger provider
	const { shutdown } = await initializeTelemetryWithoutDb({
		debug: true,
		serviceName: "jaeger-otlp-test",
	})

	// Override the config to use Jaeger provider
	const telemetryConfig = {
		providers: [
			{
				id: "jaeger",
				name: "Jaeger (OTLP)",
				enabled: true,
				options: {
					endpoint: "http://localhost:4318/v1/traces",
					headers: {
						"X-Test-Header": "jaeger-test",
					},
					timeout: 5000,
					forceFlush: true,
					batch: {
						maxQueueSize: 100,
						maxExportBatchSize: 10,
						scheduledDelayMillis: 500,
					},
				},
			},
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
	}

	console.log("📋 Jaeger Provider Configuration:")
	console.log(`   Endpoint: ${telemetryConfig.providers[0].options.endpoint}`)
	console.log(`   Headers: ${JSON.stringify(telemetryConfig.providers[0].options.headers)}`)
	console.log(`   Batch Size: ${telemetryConfig.providers[0].options.batch.maxExportBatchSize}`)
	console.log("")

	// Get a tracer
	const tracer = trace.getTracer("jaeger-test", "1.0.0")

	// Create test spans
	console.log("Creating test spans for Jaeger...\n")

	// Test 1: Simple span
	const span1 = tracer.startSpan("jaeger.test.simple-operation", {
		kind: SpanKind.INTERNAL,
		attributes: {
			"test.type": "jaeger-otlp",
			"jaeger.endpoint": "http://localhost:4318/v1/traces",
		},
	})

	await new Promise((resolve) => setTimeout(resolve, 50))
	span1.addEvent("Jaeger test event")
	span1.end()

	// Test 2: MCP-style span for Jaeger
	const mcpSpan = tracer.startSpan("mcp.jaeger-test.query", {
		kind: SpanKind.CLIENT,
		attributes: {
			"rpc.system": "mcp",
			"rpc.service": "jaeger-test",
			"rpc.method": "query",
			"mcp.task_id": `jaeger-task-${Date.now()}`,
			"mcp.source": "jaeger-test",
			"mcp.request": JSON.stringify({
				query: "test query for Jaeger",
				exporter: "otlp-http",
			}),
		},
	})

	await new Promise((resolve) => setTimeout(resolve, 100))

	mcpSpan.setAttributes({
		"mcp.response": JSON.stringify({
			status: "success",
			message: "Jaeger received via OTLP",
		}),
		"mcp.duration_ms": 100,
	})

	mcpSpan.end()

	// Wait for batch processing
	console.log("\n⏳ Waiting for batch processing...")
	await new Promise((resolve) => setTimeout(resolve, 1000))

	// Note about Jaeger
	console.log("\n📝 Note: The Jaeger provider now uses OTLP HTTP protocol.")
	console.log("   - Make sure Jaeger is running with OTLP receiver enabled")
	console.log("   - Default OTLP HTTP port is 4318")
	console.log("   - Traces will appear in Jaeger UI at http://localhost:16686")

	// Shutdown
	console.log("\n🔄 Shutting down...")
	await shutdown()

	console.log("\n✅ Jaeger OTLP test completed!")
	console.log("\n💡 To verify traces were sent:")
	console.log("   1. Start Jaeger: docker run -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one")
	console.log("   2. Open Jaeger UI: http://localhost:16686")
	console.log('   3. Search for service: "jaeger-otlp-test"')
}

// Run the test
testJaegerProvider().catch(console.error)
