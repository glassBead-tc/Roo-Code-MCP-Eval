import * as fs from "fs/promises"
import * as path from "path"
import { TelemetryConfig, validateTelemetryConfig, defaultTelemetryConfig } from "./TelemetryConfig.js"

/**
 * Supported configuration file formats
 */
export enum ConfigFormat {
	JSON = "json",
	JS = "js",
	TS = "ts",
}

/**
 * Options for loading telemetry configuration
 */
export interface LoadConfigOptions {
	/**
	 * Custom config file path
	 */
	configPath?: string

	/**
	 * Search paths for config files
	 */
	searchPaths?: string[]

	/**
	 * Config file names to search for
	 */
	configNames?: string[]

	/**
	 * Whether to use default config if no file found
	 */
	useDefault?: boolean

	/**
	 * Environment-specific config suffix (e.g., 'production', 'test')
	 */
	env?: string
}

/**
 * Loads telemetry configuration from various sources
 */
export class TelemetryConfigLoader {
	private static readonly DEFAULT_CONFIG_NAMES = [
		"telemetry.config.json",
		"telemetry.config.js",
		".telemetryrc.json",
		".telemetryrc.js",
	]

	private static readonly DEFAULT_SEARCH_PATHS = [
		process.cwd(),
		path.join(process.cwd(), "config"),
		path.join(process.cwd(), ".roo"),
	]

	/**
	 * Load configuration from file or defaults
	 */
	static async load(options: LoadConfigOptions = {}): Promise<TelemetryConfig> {
		// If explicit config path provided, use it
		if (options.configPath) {
			return this.loadFromFile(options.configPath)
		}

		// Search for config file
		const configPath = await this.findConfigFile(options)

		if (configPath) {
			console.log(`Loading telemetry config from: ${configPath}`)
			return this.loadFromFile(configPath)
		}

		// No config file found
		if (options.useDefault !== false) {
			console.log("No telemetry config found, using defaults")
			return defaultTelemetryConfig
		}

		throw new Error("No telemetry configuration file found")
	}

	/**
	 * Find configuration file in search paths
	 */
	private static async findConfigFile(options: LoadConfigOptions): Promise<string | null> {
		const searchPaths = options.searchPaths || this.DEFAULT_SEARCH_PATHS
		const configNames = options.configNames || this.DEFAULT_CONFIG_NAMES

		// Add environment-specific config names if env specified
		const envConfigNames = options.env
			? configNames.flatMap((name) => {
					const ext = path.extname(name)
					const base = path.basename(name, ext)
					return [`${base}.${options.env}${ext}`, name]
				})
			: configNames

		// Search for config file
		for (const searchPath of searchPaths) {
			for (const configName of envConfigNames) {
				const configPath = path.join(searchPath, configName)
				try {
					await fs.access(configPath)
					return configPath
				} catch {
					// File doesn't exist, continue searching
				}
			}
		}

		return null
	}

	/**
	 * Load configuration from a specific file
	 */
	private static async loadFromFile(configPath: string): Promise<TelemetryConfig> {
		const ext = path.extname(configPath).toLowerCase()

		switch (ext) {
			case ".json":
				return this.loadJsonConfig(configPath)
			case ".js":
			case ".mjs":
			case ".cjs":
				return this.loadJsConfig(configPath)
			case ".ts":
				throw new Error("TypeScript config files require compilation. Use compiled .js files instead.")
			default:
				throw new Error(`Unsupported config file format: ${ext}`)
		}
	}

	/**
	 * Load JSON configuration
	 */
	private static async loadJsonConfig(configPath: string): Promise<TelemetryConfig> {
		const content = await fs.readFile(configPath, "utf-8")
		const config = JSON.parse(content)
		return validateTelemetryConfig(config)
	}

	/**
	 * Load JavaScript configuration
	 */
	private static async loadJsConfig(configPath: string): Promise<TelemetryConfig> {
		const absolutePath = path.resolve(configPath)
		const module = await import(absolutePath)
		const config = module.default || module
		return validateTelemetryConfig(config)
	}

	/**
	 * Merge configurations with priority
	 */
	static merge(...configs: Partial<TelemetryConfig>[]): TelemetryConfig {
		const merged: any = {
			providers: [],
			debug: false,
		}

		for (const config of configs) {
			if (config.debug !== undefined) {
				merged.debug = config.debug
			}

			if (config.providers) {
				// Merge providers by ID
				const providerMap = new Map(merged.providers.map((p: any) => [p.id, p]))

				for (const provider of config.providers) {
					providerMap.set(provider.id, provider)
				}

				merged.providers = Array.from(providerMap.values())
			}

			if (config.customFactories) {
				merged.customFactories = {
					...merged.customFactories,
					...config.customFactories,
				}
			}
		}

		return validateTelemetryConfig(merged)
	}
}
