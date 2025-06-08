import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { BatchSpanProcessor, SpanProcessor } from "@opentelemetry/sdk-trace-base"
import { Resource } from "@opentelemetry/resources"
import {
	TelemetryProvider,
	TelemetryProviderConfig,
	TelemetryProviderInitResult,
	TelemetryProviderFactory,
} from "./TelemetryProvider.js"

/**
 * OTLP-specific configuration options
 */
export interface OtlpProviderOptions {
	/**
	 * OTLP endpoint URL
	 */
	endpoint?: string

	/**
	 * Custom headers for OTLP requests
	 */
	headers?: Record<string, string>

	/**
	 * Timeout for OTLP requests in milliseconds
	 */
	timeout?: number

	/**
	 * Concurrency limit for OTLP requests
	 */
	concurrencyLimit?: number

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
 * OTLP telemetry provider implementation
 */
export class OtlpProvider implements TelemetryProvider {
	readonly id = "otlp"
	readonly name = "OpenTelemetry Protocol (OTLP)"
	readonly description = "Exports traces using OTLP over HTTP"

	async initialize(config: TelemetryProviderConfig, resource: Resource): Promise<TelemetryProviderInitResult> {
		const options = (config.options as OtlpProviderOptions) || {}

		// Create OTLP exporter
		const exporter = new OTLPTraceExporter({
			url: options.endpoint || `http://localhost:4318/v1/traces`,
			headers: {
				"Content-Type": "application/json",
				...options.headers,
			},
			// Note: timeout and concurrencyLimit are not part of OTLPExporterNodeConfigBase
			// These should be configured at the batch processor or HTTP client level
		})

		// Create batch processor with configurable options
		const batchProcessor = new BatchSpanProcessor(exporter, {
			maxQueueSize: options.batch?.maxQueueSize || 2048,
			maxExportBatchSize: options.batch?.maxExportBatchSize || 512,
			scheduledDelayMillis: options.batch?.scheduledDelayMillis || 5000,
			exportTimeoutMillis: options.batch?.exportTimeoutMillis || 30000,
		})

		return {
			spanProcessors: [batchProcessor],
			spanExporters: [exporter],
			shutdown: async () => {
				await batchProcessor.shutdown()
			},
		}
	}

	validate(config: TelemetryProviderConfig): true | string {
		const options = config.options as OtlpProviderOptions

		if (options?.endpoint) {
			try {
				new URL(options.endpoint)
			} catch (error) {
				return `Invalid endpoint URL: ${options.endpoint}`
			}
		}

		if (options?.timeout && options.timeout <= 0) {
			return "Timeout must be a positive number"
		}

		if (options?.concurrencyLimit && options.concurrencyLimit <= 0) {
			return "Concurrency limit must be a positive number"
		}

		return true
	}

	getDefaultConfig(): Partial<TelemetryProviderConfig> {
		return {
			enabled: true,
			options: {
				endpoint: "http://localhost:4318/v1/traces",
				headers: {},
				timeout: 10000,
				concurrencyLimit: 10,
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
 * Factory for creating OTLP providers
 */
export class OtlpProviderFactory implements TelemetryProviderFactory {
	readonly type = "otlp"

	create(): TelemetryProvider {
		return new OtlpProvider()
	}
}
