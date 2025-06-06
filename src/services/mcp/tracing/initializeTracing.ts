import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"
import * as vscode from "vscode"

let sdk: NodeSDK | undefined

export function initializeMcpTracing(config: vscode.WorkspaceConfiguration, version: string): void {
	// Check if tracing is enabled
	if (!config.get<boolean>("telemetry.mcp.enabled", false)) {
		return
	}

	// Clean up existing SDK if any
	if (sdk) {
		sdk.shutdown()
	}

	const endpoint = config.get<string>("telemetry.mcp.endpoint", "http://localhost:4318/v1/traces")
	const useConsoleExporter = config.get<boolean>("telemetry.mcp.useConsoleExporter", false)

	// Set environment variables for resource attributes (simpler approach)
	process.env.OTEL_SERVICE_NAME = "roo-code-mcp"
	process.env.OTEL_SERVICE_VERSION = version

	// Create exporter based on configuration
	const traceExporter = useConsoleExporter
		? new ConsoleSpanExporter()
		: new OTLPTraceExporter({
				url: endpoint,
				headers: {},
			})

	// Create SDK - it will automatically pick up resource attributes from environment variables
	sdk = new NodeSDK({
		traceExporter,
	})

	// Initialize the SDK
	sdk.start()
	console.log("MCP OpenTelemetry tracing initialized")
}

export async function shutdownMcpTracing(): Promise<void> {
	if (sdk) {
		try {
			await sdk.shutdown()
			console.log("MCP OpenTelemetry tracing shut down")
		} catch (error) {
			console.error("Error shutting down MCP OpenTelemetry tracing:", error)
		}
	}
}
