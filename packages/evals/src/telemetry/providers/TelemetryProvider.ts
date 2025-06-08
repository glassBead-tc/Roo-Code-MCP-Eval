import { SpanProcessor, SpanExporter } from "@opentelemetry/sdk-trace-base"
import { Resource } from "@opentelemetry/resources"
import { Attributes } from "@opentelemetry/api"

/**
 * Configuration for a telemetry provider
 */
export interface TelemetryProviderConfig {
	/**
	 * Unique identifier for this provider
	 */
	id: string

	/**
	 * Display name for this provider
	 */
	name: string

	/**
	 * Description of what this provider does
	 */
	description?: string

	/**
	 * Whether this provider is enabled by default
	 */
	enabled?: boolean

	/**
	 * Provider-specific configuration
	 */
	options?: Record<string, unknown>
}

/**
 * Result of provider initialization
 */
export interface TelemetryProviderInitResult {
	/**
	 * Span processors created by this provider
	 */
	spanProcessors?: SpanProcessor[]

	/**
	 * Span exporters created by this provider (if direct access needed)
	 */
	spanExporters?: SpanExporter[]

	/**
	 * Additional resource attributes to merge
	 */
	resourceAttributes?: Attributes

	/**
	 * Cleanup function to call on shutdown
	 */
	shutdown?: () => Promise<void>
}

/**
 * Base interface for telemetry providers
 * Allows extensible telemetry configuration and processing
 */
export interface TelemetryProvider {
	/**
	 * Provider metadata
	 */
	readonly id: string
	readonly name: string
	readonly description?: string

	/**
	 * Initialize the provider with configuration
	 * @param config Provider configuration
	 * @param resource Base resource for the SDK
	 * @returns Processors, exporters, and cleanup functions
	 */
	initialize(config: TelemetryProviderConfig, resource: Resource): Promise<TelemetryProviderInitResult>

	/**
	 * Validate provider configuration
	 * @param config Configuration to validate
	 * @returns True if valid, error message if not
	 */
	validate(config: TelemetryProviderConfig): true | string

	/**
	 * Get default configuration for this provider
	 */
	getDefaultConfig(): Partial<TelemetryProviderConfig>
}

/**
 * Factory for creating telemetry providers
 */
export interface TelemetryProviderFactory {
	/**
	 * Create a provider instance
	 */
	create(): TelemetryProvider

	/**
	 * Provider type identifier
	 */
	readonly type: string
}
