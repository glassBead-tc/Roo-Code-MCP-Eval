import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api"
import { BatchSpanProcessor, SpanExporter, SpanProcessor } from "@opentelemetry/sdk-trace-base"
import { trace } from "@opentelemetry/api"

/**
 * Configuration options for OTLP exporter
 */
export interface OtlpExporterConfig {
	/**
	 * OTLP endpoint URL
	 */
	endpoint: string

	/**
	 * Custom headers
	 */
	headers?: Record<string, string>

	/**
	 * Request timeout in milliseconds
	 */
	timeout?: number

	/**
	 * Concurrency limit for requests
	 */
	concurrencyLimit?: number

	/**
	 * Retry configuration
	 */
	retry?: {
		enabled?: boolean
		initialDelay?: number
		maxDelay?: number
		maxAttempts?: number
	}

	/**
	 * Batch processor configuration
	 */
	batch?: {
		maxQueueSize?: number
		maxExportBatchSize?: number
		scheduledDelayMillis?: number
		exportTimeoutMillis?: number
	}

	/**
	 * Enable debug logging
	 */
	debug?: boolean
}

/**
 * Configure OTLP exporter with extensible options
 */
export function configureOtlpExporter(config: string | OtlpExporterConfig) {
	// Handle legacy string parameter
	const options: OtlpExporterConfig = typeof config === "string" ? { endpoint: config } : config

	// Enable OpenTelemetry diagnostics if debug enabled
	if (options.debug) {
		diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG)
	} else {
		diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)
	}

	// Create OTLP exporter with full configuration
	const exporter = new OTLPTraceExporter({
		url: options.endpoint.endsWith("/v1/traces") ? options.endpoint : `${options.endpoint}/v1/traces`,
		headers: {
			"Content-Type": "application/json",
			...options.headers,
		},
		timeout: options.timeout,
		concurrencyLimit: options.concurrencyLimit || 10,
	})

	// Create batch processor with configurable options
	const batchProcessor = new BatchSpanProcessor(exporter, {
		maxQueueSize: options.batch?.maxQueueSize || 2048,
		maxExportBatchSize: options.batch?.maxExportBatchSize || 512,
		scheduledDelayMillis: options.batch?.scheduledDelayMillis || 5000,
		exportTimeoutMillis: options.batch?.exportTimeoutMillis || 30000,
	})

	// Get the active tracer provider and add the processor
	const provider = trace.getTracerProvider()
	if ("addSpanProcessor" in provider) {
		;(provider as any).addSpanProcessor(batchProcessor)
	}

	return {
		exporter,
		processor: batchProcessor,
	}
}

/**
 * Configure multiple exporters for redundancy or load balancing
 */
export function configureMultipleExporters(configs: OtlpExporterConfig[]): {
	exporters: SpanExporter[]
	processors: SpanProcessor[]
} {
	const exporters: SpanExporter[] = []
	const processors: SpanProcessor[] = []

	for (const config of configs) {
		const { exporter, processor } = configureOtlpExporter(config)
		exporters.push(exporter)
		processors.push(processor)
	}

	return { exporters, processors }
}

/**
 * Create a custom exporter configuration for specific environments
 */
export function createEnvironmentConfig(env: "development" | "production" | "test"): OtlpExporterConfig {
	const baseConfig: OtlpExporterConfig = {
		endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318",
		headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS) : {},
	}

	switch (env) {
		case "production":
			return {
				...baseConfig,
				timeout: 30000,
				concurrencyLimit: 20,
				batch: {
					maxQueueSize: 5000,
					maxExportBatchSize: 1000,
					scheduledDelayMillis: 2000,
					exportTimeoutMillis: 60000,
				},
				retry: {
					enabled: true,
					maxAttempts: 5,
					initialDelay: 1000,
					maxDelay: 30000,
				},
			}

		case "development":
			return {
				...baseConfig,
				debug: true,
				timeout: 10000,
				concurrencyLimit: 5,
				batch: {
					maxQueueSize: 1000,
					maxExportBatchSize: 100,
					scheduledDelayMillis: 1000,
				},
			}

		case "test":
			return {
				endpoint: "http://localhost:4318",
				timeout: 5000,
				concurrencyLimit: 1,
				batch: {
					maxQueueSize: 100,
					maxExportBatchSize: 10,
					scheduledDelayMillis: 100,
				},
			}

		default:
			return baseConfig
	}
}
