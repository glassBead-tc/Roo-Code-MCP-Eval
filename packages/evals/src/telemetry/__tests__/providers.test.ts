import { describe, it, expect } from "vitest"
import { Resource } from "@opentelemetry/resources"
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { OtlpProvider, OtlpProviderFactory } from "../providers/OtlpProvider"
import { JaegerProvider, JaegerProviderFactory } from "../providers/JaegerProvider"
import { ConsoleProvider, ConsoleProviderFactory } from "../providers/ConsoleProvider"
import { TelemetryProviderConfig } from "../providers/TelemetryProvider"

describe("Telemetry Providers", () => {
	const resource = new Resource({
		[SEMRESATTRS_SERVICE_NAME]: "test-service",
	})

	describe("OtlpProvider", () => {
		let provider: OtlpProvider

		beforeEach(() => {
			provider = new OtlpProvider()
		})

		it("should have correct metadata", () => {
			expect(provider.id).toBe("otlp")
			expect(provider.name).toBe("OpenTelemetry Protocol (OTLP)")
			expect(provider.description).toBeDefined()
		})

		it("should validate valid configuration", () => {
			const config: TelemetryProviderConfig = {
				id: "otlp",
				name: "OTLP",
				options: {
					endpoint: "http://localhost:4318/v1/traces",
					timeout: 5000,
					concurrencyLimit: 10,
				},
			}

			expect(provider.validate(config)).toBe(true)
		})

		it("should reject invalid endpoint URL", () => {
			const config: TelemetryProviderConfig = {
				id: "otlp",
				name: "OTLP",
				options: {
					endpoint: "not-a-url",
				},
			}

			const result = provider.validate(config)
			expect(result).toContain("Invalid endpoint URL")
		})

		it("should reject invalid timeout", () => {
			const config: TelemetryProviderConfig = {
				id: "otlp",
				name: "OTLP",
				options: {
					timeout: -1,
				},
			}

			const result = provider.validate(config)
			expect(result).toContain("Timeout must be a positive number")
		})

		it("should initialize with default configuration", async () => {
			const config: TelemetryProviderConfig = {
				id: "otlp",
				name: "OTLP",
			}

			const result = await provider.initialize(config, resource)

			expect(result.spanProcessors).toHaveLength(1)
			expect(result.spanExporters).toHaveLength(1)
			expect(result.shutdown).toBeDefined()
		})

		it("should provide default configuration", () => {
			const defaultConfig = provider.getDefaultConfig()

			expect(defaultConfig.enabled).toBe(true)
			expect(defaultConfig.options).toBeDefined()
			expect(defaultConfig.options.endpoint).toBe("http://localhost:4318/v1/traces")
		})
	})

	describe("JaegerProvider", () => {
		let provider: JaegerProvider

		beforeEach(() => {
			provider = new JaegerProvider()
		})

		it("should have correct metadata", () => {
			expect(provider.id).toBe("jaeger")
			expect(provider.name).toBe("Jaeger")
			expect(provider.description).toBeDefined()
		})

		it("should validate port range", () => {
			const invalidConfig: TelemetryProviderConfig = {
				id: "jaeger",
				name: "Jaeger",
				options: {
					port: 70000,
				},
			}

			const result = provider.validate(invalidConfig)
			expect(result).toContain("Port must be between 1 and 65535")
		})

		it("should initialize with custom options", async () => {
			const config: TelemetryProviderConfig = {
				id: "jaeger",
				name: "Jaeger",
				options: {
					host: "jaeger.local",
					port: 6832,
					forceFlush: false,
				},
			}

			const result = await provider.initialize(config, resource)

			expect(result.spanProcessors).toHaveLength(1)
			expect(result.spanExporters).toHaveLength(1)
			expect(result.shutdown).toBeDefined()
		})
	})

	describe("ConsoleProvider", () => {
		let provider: ConsoleProvider

		beforeEach(() => {
			provider = new ConsoleProvider()
		})

		it("should have correct metadata", () => {
			expect(provider.id).toBe("console")
			expect(provider.name).toBe("Console")
			expect(provider.description).toBeDefined()
		})

		it("should validate any configuration", () => {
			const config: TelemetryProviderConfig = {
				id: "console",
				name: "Console",
				options: {
					useBatch: true,
					prettyPrint: false,
				},
			}

			expect(provider.validate(config)).toBe(true)
		})

		it("should use simple processor by default", async () => {
			const config: TelemetryProviderConfig = {
				id: "console",
				name: "Console",
			}

			const result = await provider.initialize(config, resource)

			expect(result.spanProcessors).toHaveLength(1)
			expect(result.shutdown).toBeDefined()
		})

		it("should use batch processor when configured", async () => {
			const config: TelemetryProviderConfig = {
				id: "console",
				name: "Console",
				options: {
					useBatch: true,
					batch: {
						maxQueueSize: 1000,
					},
				},
			}

			const result = await provider.initialize(config, resource)

			expect(result.spanProcessors).toHaveLength(1)
			expect(result.shutdown).toBeDefined()
		})
	})

	describe("Provider Factories", () => {
		it("should create OTLP provider", () => {
			const factory = new OtlpProviderFactory()
			expect(factory.type).toBe("otlp")

			const provider = factory.create()
			expect(provider.id).toBe("otlp")
		})

		it("should create Jaeger provider", () => {
			const factory = new JaegerProviderFactory()
			expect(factory.type).toBe("jaeger")

			const provider = factory.create()
			expect(provider.id).toBe("jaeger")
		})

		it("should create Console provider", () => {
			const factory = new ConsoleProviderFactory()
			expect(factory.type).toBe("console")

			const provider = factory.create()
			expect(provider.id).toBe("console")
		})
	})
})
