import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from "@opentelemetry/semantic-conventions"
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

	// Create exporter based on configuration
	const traceExporter = useConsoleExporter
		? new ConsoleSpanExporter()
		: new OTLPTraceExporter({
				url: endpoint,
				headers: {},
			})

	// Create SDK with resource attributes
	sdk = new NodeSDK({
		traceExporter,
		serviceName: "roo-code-mcp",
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
