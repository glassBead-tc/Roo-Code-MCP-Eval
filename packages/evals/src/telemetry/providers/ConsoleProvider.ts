import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"
import { SimpleSpanProcessor, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { Resource } from "@opentelemetry/resources"
import {
	TelemetryProvider,
	TelemetryProviderConfig,
	TelemetryProviderInitResult,
	TelemetryProviderFactory,
} from "./TelemetryProvider.js"

/**
 * Console-specific configuration options
 */
export interface ConsoleProviderOptions {
	/**
	 * Use batch processor instead of simple processor
	 */
	useBatch?: boolean

	/**
	 * Pretty print the output
	 */
	prettyPrint?: boolean

	/**
	 * Batch processor configuration (if useBatch is true)
	 */
	batch?: {
		maxQueueSize?: number
		maxExportBatchSize?: number
		scheduledDelayMillis?: number
	}
}

/**
 * Console telemetry provider implementation for debugging
 */
export class ConsoleProvider implements TelemetryProvider {
	readonly id = "console"
	readonly name = "Console"
	readonly description = "Exports traces to console for debugging"

	async initialize(config: TelemetryProviderConfig, resource: Resource): Promise<TelemetryProviderInitResult> {
		const options = (config.options as ConsoleProviderOptions) || {}

		// Create console exporter
		const exporter = new ConsoleSpanExporter()

		// Create processor based on configuration
		const processor = options.useBatch
			? new BatchSpanProcessor(exporter, {
					maxQueueSize: options.batch?.maxQueueSize || 2048,
					maxExportBatchSize: options.batch?.maxExportBatchSize || 512,
					scheduledDelayMillis: options.batch?.scheduledDelayMillis || 5000,
				})
			: new SimpleSpanProcessor(exporter)

		return {
			spanProcessors: [processor],
			spanExporters: [exporter],
			shutdown: async () => {
				await processor.shutdown()
			},
		}
	}

	validate(config: TelemetryProviderConfig): true | string {
		// Console provider has minimal validation needs
		return true
	}

	getDefaultConfig(): Partial<TelemetryProviderConfig> {
		return {
			enabled: false,
			options: {
				useBatch: false,
				prettyPrint: true,
				batch: {
					maxQueueSize: 2048,
					maxExportBatchSize: 512,
					scheduledDelayMillis: 5000,
				},
			},
		}
	}
}

/**
 * Factory for creating Console providers
 */
export class ConsoleProviderFactory implements TelemetryProviderFactory {
	readonly type = "console"

	create(): TelemetryProvider {
		return new ConsoleProvider()
	}
}
