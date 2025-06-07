import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { AlwaysOnSampler } from "@opentelemetry/sdk-trace-base"
import { trace } from "@opentelemetry/api"
import * as vscode from "vscode"
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "./semconv"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { McpInstrumentation } from "../instrumentation/McpInstrumentation"
// @ts-ignore TS6059: File is not under 'rootDir'. 'rootDir' is expected to contain all source files.
import { McpBenchmarkProcessor } from "@evals/benchmark/McpBenchmarkProcessor.js"
import { client as dbClient } from "@evals/db/db.js"

let sdk: NodeSDK | undefined

export function initializeMcpTracing(config: vscode.WorkspaceConfiguration, version: string): void {
	// 🔍 DEBUG: Log function entry and configuration
	console.log("🔍 [DEBUG] initializeMcpTracing called with config:", {
		enabled: config.get<boolean>("telemetry.mcp.enabled", false),
		useConsoleExporter: config.get<boolean>("telemetry.mcp.useConsoleExporter", false),
		endpoint: config.get<string>("telemetry.mcp.endpoint", "http://localhost:4318/v1/traces"),
		version,
	})

	// Check if tracing is enabled (TEMPORARILY FORCED ON FOR TESTING)
	const enabled = config.get<boolean>("telemetry.mcp.enabled", false) || true // FORCE ON FOR TESTING
	if (!enabled) {
		console.log("🔍 [DEBUG] MCP tracing is disabled, returning early")
		return
	}
	console.log("🔍 [DEBUG] MCP tracing is ENABLED - continuing with initialization")

	// Clean up existing SDK if any
	if (sdk) {
		console.log("🔍 [DEBUG] Shutting down existing SDK")
		sdk.shutdown()
	}

	const endpoint = config.get<string>("telemetry.mcp.endpoint", "http://localhost:4318/v1/traces")
	const useConsoleExporter = config.get<boolean>("telemetry.mcp.useConsoleExporter", false)

	// Create resource with semantic conventions
	const resource = resourceFromAttributes({
		[ATTR_SERVICE_NAME]: "roo-code-mcp",
		[ATTR_SERVICE_VERSION]: version,
	})

	// Create exporter based on configuration
	const traceExporter = useConsoleExporter
		? new ConsoleSpanExporter()
		: new OTLPTraceExporter({
				url: endpoint,
				headers: {},
			})

	console.log(
		"🔍 [DEBUG] Created exporter:",
		useConsoleExporter ? "ConsoleSpanExporter" : `OTLPTraceExporter(${endpoint})`,
	)

	// Create SDK with MCP instrumentation
	sdk = new NodeSDK({
		resource,
		traceExporter,
		sampler: new AlwaysOnSampler(), // Explicitly sample all spans
		spanProcessors: [new SimpleSpanProcessor(traceExporter), new McpBenchmarkProcessor(dbClient)], // Use spanProcessors (plural) to avoid deprecation
		instrumentations: [new McpInstrumentation()], // Auto-instrument MCP calls
	})

	console.log("🔍 [DEBUG] Created NodeSDK with AlwaysOnSampler and SimpleSpanProcessor")

	// Initialize the SDK
	try {
		sdk.start()
		console.log("🔍 [DEBUG] NodeSDK started successfully")

		// 🧪 TEST: Create a manual test trace to verify OpenTelemetry is working
		setTimeout(() => {
			try {
				console.log("🔍 [DEBUG] Creating manual test trace...")
				const tracer = trace.getTracer("mcp-debug-test", "1.0.0")
				console.log("🔍 [DEBUG] Test tracer type:", tracer.constructor.name)
				console.log("🔍 [DEBUG] Test tracer:", tracer)

				const span = tracer.startSpan("manual-test-span", {
					attributes: {
						"test.type": "manual",
						"test.purpose": "verify-opentelemetry-setup",
					},
				})
				console.log("🔍 [DEBUG] Test span type:", span.constructor.name)
				console.log("🔍 [DEBUG] Test span:", span)

				span.addEvent("Manual test event")
				span.end()
				console.log("🔍 [DEBUG] Manual test trace created and ended")
			} catch (error) {
				console.error("🔍 [DEBUG] Error creating manual test trace:", error)
			}
		}, 1000) // Wait 1 second for SDK to fully initialize
	} catch (error) {
		console.error("🔍 [DEBUG] Error starting NodeSDK:", error)
	}

	console.log("MCP OpenTelemetry tracing initialized")
}

export async function shutdownMcpTracing(): Promise<void> {
	if (sdk) {
		try {
			console.log("🔍 [DEBUG] Shutting down MCP OpenTelemetry tracing...")
			await sdk.shutdown()
			console.log("MCP OpenTelemetry tracing shut down")
		} catch (error) {
			console.error("Error shutting down MCP OpenTelemetry tracing:", error)
		}
	}
}
