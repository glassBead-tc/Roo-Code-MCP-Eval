import { SpanProcessor } from "@opentelemetry/sdk-trace-base"
import { Resource } from "@opentelemetry/resources"
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api"
import {
	TelemetryProvider,
	TelemetryProviderConfig,
	TelemetryProviderFactory,
	TelemetryProviderInitResult,
} from "./providers/TelemetryProvider.js"

/**
 * Configuration for the telemetry plugin system
 */
export interface TelemetryPluginConfig {
	/**
	 * List of provider configurations
	 */
	providers: TelemetryProviderConfig[]

	/**
	 * Enable debug logging
	 */
	debug?: boolean

	/**
	 * Custom provider factories
	 */
	customFactories?: Map<string, TelemetryProviderFactory>
}

/**
 * Manages telemetry providers and their lifecycle
 */
export class TelemetryPluginManager {
	private providers: Map<string, TelemetryProvider> = new Map()
	private factories: Map<string, TelemetryProviderFactory> = new Map()
	private initializedProviders: Map<string, TelemetryProviderInitResult> = new Map()
	private resource: Resource
	private debug: boolean

	constructor(resource: Resource, debug = false) {
		this.resource = resource
		this.debug = debug

		if (debug) {
			diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG)
		}
	}

	/**
	 * Register a provider factory
	 */
	registerFactory(type: string, factory: TelemetryProviderFactory): void {
		this.factories.set(type, factory)
		this.log(`Registered provider factory: ${type}`)
	}

	/**
	 * Register multiple factories at once
	 */
	registerFactories(factories: Map<string, TelemetryProviderFactory>): void {
		factories.forEach((factory, type) => {
			this.registerFactory(type, factory)
		})
	}

	/**
	 * Initialize providers from configuration
	 */
	async initialize(config: TelemetryPluginConfig): Promise<void> {
		// Register custom factories if provided
		if (config.customFactories) {
			this.registerFactories(config.customFactories)
		}

		// Initialize each provider
		for (const providerConfig of config.providers) {
			if (!providerConfig.enabled && providerConfig.enabled !== undefined) {
				this.log(`Skipping disabled provider: ${providerConfig.id}`)
				continue
			}

			try {
				await this.initializeProvider(providerConfig)
			} catch (error) {
				console.error(`Failed to initialize provider ${providerConfig.id}:`, error)
				if (this.debug) {
					throw error
				}
			}
		}
	}

	/**
	 * Initialize a single provider
	 */
	private async initializeProvider(config: TelemetryProviderConfig): Promise<void> {
		const factory = this.factories.get(config.id)
		if (!factory) {
			throw new Error(`No factory registered for provider type: ${config.id}`)
		}

		const provider = factory.create()

		// Validate configuration
		const validationResult = provider.validate(config)
		if (validationResult !== true) {
			throw new Error(`Invalid configuration for provider ${config.id}: ${validationResult}`)
		}

		// Initialize the provider
		const initResult = await provider.initialize(config, this.resource)

		this.providers.set(config.id, provider)
		this.initializedProviders.set(config.id, initResult)

		this.log(`Initialized provider: ${config.id}`)
	}

	/**
	 * Get all span processors from initialized providers
	 */
	getSpanProcessors(): SpanProcessor[] {
		const processors: SpanProcessor[] = []

		this.initializedProviders.forEach((result, providerId) => {
			if (result.spanProcessors) {
				processors.push(...result.spanProcessors)
				this.log(`Added ${result.spanProcessors.length} processors from provider: ${providerId}`)
			}
		})

		return processors
	}

	/**
	 * Get merged resource attributes from all providers
	 */
	getMergedResourceAttributes(): Resource {
		let mergedResource = this.resource

		this.initializedProviders.forEach((result, providerId) => {
			if (result.resourceAttributes) {
				mergedResource = mergedResource.merge(new Resource(result.resourceAttributes))
				this.log(`Merged resource attributes from provider: ${providerId}`)
			}
		})

		return mergedResource
	}

	/**
	 * Shutdown all providers
	 */
	async shutdown(): Promise<void> {
		const shutdownPromises: Promise<void>[] = []

		this.initializedProviders.forEach((result, providerId) => {
			if (result.shutdown) {
				this.log(`Shutting down provider: ${providerId}`)
				shutdownPromises.push(
					result.shutdown().catch((error) => {
						console.error(`Error shutting down provider ${providerId}:`, error)
					}),
				)
			}
		})

		await Promise.all(shutdownPromises)

		this.providers.clear()
		this.initializedProviders.clear()
	}

	/**
	 * Get a specific provider by ID
	 */
	getProvider(id: string): TelemetryProvider | undefined {
		return this.providers.get(id)
	}

	/**
	 * Get all registered provider IDs
	 */
	getProviderIds(): string[] {
		return Array.from(this.providers.keys())
	}

	/**
	 * Enable or disable debug logging
	 */
	setDebug(enabled: boolean): void {
		this.debug = enabled
		if (enabled) {
			diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG)
		} else {
			diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR)
		}
	}

	private log(message: string): void {
		if (this.debug) {
			console.log(`[TelemetryPluginManager] ${message}`)
		}
	}
}
