import { NodeSDK } from "@opentelemetry/sdk-node"
import { Resource } from "@opentelemetry/resources"
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from "@opentelemetry/semantic-conventions"
import { McpBenchmarkProcessor } from "../benchmark/McpBenchmarkProcessor.js"
import { client as dbClient } from "../db/db.js"
import { TelemetryPluginManager } from "./TelemetryPluginManager.js"
import { TelemetryPluginConfig } from "./TelemetryPluginManager.js"
import { builtInProviders } from "./providers/index.js"
import * as net from "net"

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort: number = 4318): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer()
		server.listen(startPort, () => {
			const port = (server.address() as net.AddressInfo).port
			server.close(() => resolve(port))
		})
		server.on("error", () => {
			// Port in use, try next one
			resolve(findAvailablePort(startPort + 1))
		})
	})
}

/**
 * Initialize OpenTelemetry configuration
 */
export interface InitializeOtelOptions {
	/**
	 * Port for OTLP HTTP receiver
	 */
	port?: number

	/**
	 * Enable debug mode
	 */
	debug?: boolean

	/**
	 * Custom telemetry configuration
	 */
	telemetryConfig?: TelemetryPluginConfig

	/**
	 * Environment-specific configuration
	 */
	env?: "development" | "production" | "test"
}

/**
 * Initialize OpenTelemetry with plugin support
 */
export async function initializeOpenTelemetry(options: InitializeOtelOptions = {}) {
	const port = options.port || (await findAvailablePort(4318))
	const debug = options.debug || process.env.OTEL_LOG_LEVEL === "debug"

	// Create base resource
	const resource = new Resource({
		[SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "roo-code-evals",
		[SEMRESATTRS_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || "1.0.0",
		"deployment.environment": options.env || process.env.NODE_ENV || "development",
	})

	// Create MCP benchmark processor
	const mcpProcessor = new McpBenchmarkProcessor(dbClient)

	// Initialize plugin manager
	const pluginManager = new TelemetryPluginManager(resource, debug)

	// Register built-in providers
	builtInProviders.forEach((factory, type) => {
		pluginManager.registerFactory(type, factory)
	})

	// Default configuration if none provided
	const telemetryConfig: TelemetryPluginConfig = options.telemetryConfig || {
		providers: [
			{
				id: "otlp",
				name: "OpenTelemetry Protocol",
				enabled: true,
				options: {
					endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || `http://localhost:${port}/v1/traces`,
					headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
						? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
						: {},
				},
			},
			{
				id: "console",
				name: "Console Debug",
				enabled: debug,
				options: {
					prettyPrint: true,
				},
			},
		],
		debug,
	}

	// Initialize providers
	await pluginManager.initialize(telemetryConfig)

	// Get all processors including MCP processor
	const spanProcessors = [mcpProcessor, ...pluginManager.getSpanProcessors()]

	// Create SDK with merged resources and processors
	const sdk = new NodeSDK({
		resource: pluginManager.getMergedResourceAttributes(),
		spanProcessors,
	})

	sdk.start()

	return {
		sdk,
		port,
		mcpProcessor,
		pluginManager,
		shutdown: async () => {
			await pluginManager.shutdown()
			await sdk.shutdown()
		},
	}
}
