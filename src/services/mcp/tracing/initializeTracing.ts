import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"
import { trace } from "@opentelemetry/api"
import * as vscode from "vscode"

let sdk: NodeSDK | undefined

export function initializeMcpTracing(config: vscode.WorkspaceConfiguration, version: string): void {
	// 🔍 DEBUG: Log function entry and configuration
	console.log("🔍 [DEBUG] initializeMcpTracing called with config:", {
		enabled: config.get<boolean>("telemetry.mcp.enabled", false),
		useConsoleExporter: config.get<boolean>("telemetry.mcp.useConsoleExporter", false),
		endpoint: config.get<string>("telemetry.mcp.endpoint", "http://localhost:4318/v1/traces"),
		version,
	})

	// Check if tracing is enabled
	if (!config.get<boolean>("telemetry.mcp.enabled", false)) {
		console.log("🔍 [DEBUG] MCP tracing is disabled, returning early")
		return
	}

	// Clean up existing SDK if any
	if (sdk) {
		console.log("🔍 [DEBUG] Shutting down existing SDK")
		sdk.shutdown()
	}

	const endpoint = config.get<string>("telemetry.mcp.endpoint", "http://localhost:4318/v1/traces")
	const useConsoleExporter = config.get<boolean>("telemetry.mcp.useConsoleExporter", false)

	// Set environment variables for resource attributes (simpler approach)
	process.env.OTEL_SERVICE_NAME = "roo-code-mcp"
	process.env.OTEL_SERVICE_VERSION = version
	console.log("🔍 [DEBUG] Set environment variables:", {
		OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
		OTEL_SERVICE_VERSION: process.env.OTEL_SERVICE_VERSION,
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

	// Create SDK - it will automatically pick up resource attributes from environment variables
	sdk = new NodeSDK({
		traceExporter,
	})

	console.log("🔍 [DEBUG] Created NodeSDK")

	// Initialize the SDK
	try {
		sdk.start()
		console.log("🔍 [DEBUG] NodeSDK started successfully")

		// 🧪 TEST: Create a manual test trace to verify OpenTelemetry is working
		setTimeout(() => {
			try {
				console.log("🔍 [DEBUG] Creating manual test trace...")
				const tracer = trace.getTracer("mcp-debug-test")
				const span = tracer.startSpan("manual-test-span", {
					attributes: {
						"test.type": "manual",
						"test.purpose": "verify-opentelemetry-setup",
					},
				})
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
