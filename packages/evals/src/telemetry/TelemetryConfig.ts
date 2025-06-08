import { z } from "zod"

/**
 * Schema for OTLP provider configuration
 */
export const OtlpProviderOptionsSchema = z.object({
	endpoint: z.string().url().optional(),
	headers: z.record(z.string()).optional(),
	timeout: z.number().positive().optional(),
	concurrencyLimit: z.number().positive().optional(),
	batch: z
		.object({
			maxQueueSize: z.number().positive().optional(),
			maxExportBatchSize: z.number().positive().optional(),
			scheduledDelayMillis: z.number().positive().optional(),
			exportTimeoutMillis: z.number().positive().optional(),
		})
		.optional(),
})

/**
 * Schema for Jaeger provider configuration
 */
export const JaegerProviderOptionsSchema = z.object({
	host: z.string().optional(),
	port: z.number().int().min(1).max(65535).optional(),
	forceFlush: z.boolean().optional(),
	maxPacketSize: z.number().positive().optional(),
	batch: z
		.object({
			maxQueueSize: z.number().positive().optional(),
			maxExportBatchSize: z.number().positive().optional(),
			scheduledDelayMillis: z.number().positive().optional(),
		})
		.optional(),
})

/**
 * Schema for Console provider configuration
 */
export const ConsoleProviderOptionsSchema = z.object({
	useBatch: z.boolean().optional(),
	prettyPrint: z.boolean().optional(),
	batch: z
		.object({
			maxQueueSize: z.number().positive().optional(),
			maxExportBatchSize: z.number().positive().optional(),
			scheduledDelayMillis: z.number().positive().optional(),
		})
		.optional(),
})

/**
 * Schema for provider configuration
 */
export const TelemetryProviderConfigSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	enabled: z.boolean().optional(),
	options: z.record(z.unknown()).optional(),
})

/**
 * Schema for telemetry configuration
 */
export const TelemetryConfigSchema = z.object({
	providers: z.array(TelemetryProviderConfigSchema),
	debug: z.boolean().optional(),
	customFactories: z.record(z.any()).optional(),
})

/**
 * Type exports
 */
export type OtlpProviderOptions = z.infer<typeof OtlpProviderOptionsSchema>
export type JaegerProviderOptions = z.infer<typeof JaegerProviderOptionsSchema>
export type ConsoleProviderOptions = z.infer<typeof ConsoleProviderOptionsSchema>
export type TelemetryProviderConfig = z.infer<typeof TelemetryProviderConfigSchema>
export type TelemetryConfig = z.infer<typeof TelemetryConfigSchema>

/**
 * Validate telemetry configuration
 */
export function validateTelemetryConfig(config: unknown): TelemetryConfig {
	return TelemetryConfigSchema.parse(config)
}

/**
 * Default telemetry configuration
 */
export const defaultTelemetryConfig: TelemetryConfig = {
	providers: [
		{
			id: "otlp",
			name: "OpenTelemetry Protocol",
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
		},
	],
	debug: false,
}
