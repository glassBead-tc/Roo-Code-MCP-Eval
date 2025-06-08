import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { Resource } from "@opentelemetry/resources"
import {
	TelemetryProvider,
	TelemetryProviderConfig,
	TelemetryProviderInitResult,
	TelemetryProviderFactory,
} from "./TelemetryProvider.js"

/**
 * Jaeger-specific configuration options
 *
 * @deprecated The native Jaeger exporter is deprecated. This provider now uses OTLP HTTP
 * which is natively supported by Jaeger 1.35+. The configuration has been updated to
 * support OTLP endpoints while maintaining backward compatibility.
 */
export interface JaegerProviderOptions {
	/**
	 * Jaeger OTLP endpoint URL
	 * Default: http://localhost:4318/v1/traces (Jaeger's OTLP HTTP endpoint)
	 *
	 * For Jaeger All-in-One: http://localhost:4318/v1/traces
	 * For Jaeger Collector: http://<collector-host>:4318/v1/traces
	 */
	endpoint?: string

	/**
	 * @deprecated Use endpoint instead. Host is no longer used with OTLP.
	 */
	host?: string

	/**
	 * @deprecated Use endpoint instead. Port is included in the endpoint URL.
	 */
	port?: number

	/**
	 * Custom headers for OTLP requests
	 */
	headers?: Record<string, string>

	/**
	 * Timeout for OTLP requests in milliseconds
	 */
	timeout?: number

	/**
	 * Force flush on shutdown
	 */
	forceFlush?: boolean

	/**
	 * @deprecated Max packet size is not applicable to OTLP HTTP
	 */
	maxPacketSize?: number

	/**
	 * Batch processor configuration
	 */
	batch?: {
		maxQueueSize?: number
		maxExportBatchSize?: number
		scheduledDelayMillis?: number
		exportTimeoutMillis?: number
	}
}

/**
 * Jaeger telemetry provider implementation using OTLP HTTP
 *
 * This provider exports traces to Jaeger using the OpenTelemetry Protocol (OTLP) over HTTP,
 * which is the recommended approach since Jaeger 1.35+ supports OTLP natively.
 *
 * @see https://www.jaegertracing.io/docs/1.41/apis/#opentelemetry-protocol-stable
 */
export class JaegerProvider implements TelemetryProvider {
	readonly id = "jaeger"
	readonly name = "Jaeger (via OTLP)"
	readonly description = "Exports traces to Jaeger using OTLP HTTP protocol"

	async initialize(config: TelemetryProviderConfig, _resource: Resource): Promise<TelemetryProviderInitResult> {
		const options = (config.options as JaegerProviderOptions) || {}

		// Handle backward compatibility: construct endpoint from host/port if provided
		let endpoint = options.endpoint
		if (!endpoint && options.host) {
			// Default Jaeger OTLP HTTP port is 4318
			const port = 4318
			endpoint = `http://${options.host}:${port}/v1/traces`
			console.warn(
				`[JaegerProvider] Using deprecated host/port configuration. ` +
					`Please update to use endpoint: "${endpoint}"`,
			)
		}

		// Create OTLP exporter for Jaeger
		const exporter = new OTLPTraceExporter({
			url: endpoint || "http://localhost:4318/v1/traces",
			headers: {
				"Content-Type": "application/json",
				...options.headers,
			},
			// Note: timeout is configured at the batch processor level, not exporter
		})

		// Create batch processor
		const batchProcessor = new BatchSpanProcessor(exporter, {
			maxQueueSize: options.batch?.maxQueueSize || 2048,
			maxExportBatchSize: options.batch?.maxExportBatchSize || 512,
			scheduledDelayMillis: options.batch?.scheduledDelayMillis || 5000,
			exportTimeoutMillis: options.batch?.exportTimeoutMillis || 30000,
		})

		return {
			spanProcessors: [batchProcessor],
			spanExporters: [exporter],
			resourceAttributes: {
				"telemetry.exporter": "jaeger-otlp",
			},
			shutdown: async () => {
				if (options.forceFlush !== false) {
					await batchProcessor.forceFlush()
				}
				await batchProcessor.shutdown()
			},
		}
	}

	validate(config: TelemetryProviderConfig): true | string {
		const options = config.options as JaegerProviderOptions

		if (options?.endpoint) {
			try {
				new URL(options.endpoint)
			} catch (error) {
				return `Invalid endpoint URL: ${options.endpoint}`
			}
		}

		if (options?.port && (options.port <= 0 || options.port > 65535)) {
			return "Port must be between 1 and 65535"
		}

		if (options?.timeout && options.timeout <= 0) {
			return "Timeout must be a positive number"
		}

		if (options?.host && options.port) {
			console.warn(
				"[JaegerProvider] The host and port options are deprecated. " +
					"Please use the endpoint option instead.",
			)
		}

		return true
	}

	getDefaultConfig(): Partial<TelemetryProviderConfig> {
		return {
			enabled: false,
			options: {
				endpoint: "http://localhost:4318/v1/traces",
				headers: {},
				timeout: 10000,
				forceFlush: true,
				batch: {
					maxQueueSize: 2048,
					maxExportBatchSize: 512,
					scheduledDelayMillis: 5000,
					exportTimeoutMillis: 30000,
				},
			},
		}
	}
}

/**
 * Factory for creating Jaeger providers
 */
export class JaegerProviderFactory implements TelemetryProviderFactory {
	readonly type = "jaeger"

	create(): TelemetryProvider {
		return new JaegerProvider()
	}
}
