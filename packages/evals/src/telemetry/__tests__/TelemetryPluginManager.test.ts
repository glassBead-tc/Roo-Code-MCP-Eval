import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Resource } from "@opentelemetry/resources"
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { SpanProcessor } from "@opentelemetry/sdk-trace-base"
import { TelemetryPluginManager } from "../TelemetryPluginManager"
import {
	TelemetryProvider,
	TelemetryProviderConfig,
	TelemetryProviderInitResult,
	TelemetryProviderFactory,
} from "../providers/TelemetryProvider"

// Mock provider implementation for testing
class MockProvider implements TelemetryProvider {
	readonly id = "mock"
	readonly name = "Mock Provider"
	readonly description = "Test provider"

	initializeCalled = false
	validateCalled = false

	async initialize(config: TelemetryProviderConfig, resource: Resource): Promise<TelemetryProviderInitResult> {
		this.initializeCalled = true

		// Mock span processor
		const mockProcessor: SpanProcessor = {
			onStart: vi.fn(),
			onEnd: vi.fn(),
			shutdown: vi.fn().mockResolvedValue(undefined),
			forceFlush: vi.fn().mockResolvedValue(undefined),
		}

		return {
			spanProcessors: [mockProcessor],
			resourceAttributes: {
				"mock.provider": "true",
				"mock.version": "1.0.0",
			},
			shutdown: vi.fn().mockResolvedValue(undefined),
		}
	}

	validate(config: TelemetryProviderConfig): true | string {
		this.validateCalled = true
		if (config.options?.invalid) {
			return "Invalid configuration"
		}
		return true
	}

	getDefaultConfig(): Partial<TelemetryProviderConfig> {
		return {
			enabled: true,
			options: {
				mockOption: "default",
			},
		}
	}
}

class MockProviderFactory implements TelemetryProviderFactory {
	readonly type = "mock"

	create(): TelemetryProvider {
		return new MockProvider()
	}
}

describe("TelemetryPluginManager", () => {
	let manager: TelemetryPluginManager
	let resource: Resource

	beforeEach(() => {
		resource = new Resource({
			[SEMRESATTRS_SERVICE_NAME]: "test-service",
		})
		manager = new TelemetryPluginManager(resource, false)
	})

	afterEach(async () => {
		await manager.shutdown()
	})

	describe("factory registration", () => {
		it("should register a provider factory", () => {
			const factory = new MockProviderFactory()
			manager.registerFactory("mock", factory)

			// Factory should be registered (no direct way to check, but initialization should work)
			expect(() => manager.registerFactory("mock", factory)).not.toThrow()
		})

		it("should register multiple factories at once", () => {
			const factories = new Map([
				["mock1", new MockProviderFactory()],
				["mock2", new MockProviderFactory()],
			])

			manager.registerFactories(factories)

			// Should not throw
			expect(() => manager.registerFactories(factories)).not.toThrow()
		})
	})

	describe("provider initialization", () => {
		beforeEach(() => {
			manager.registerFactory("mock", new MockProviderFactory())
		})

		it("should initialize enabled providers", async () => {
			const config = {
				providers: [
					{
						id: "mock",
						name: "Mock Provider",
						enabled: true,
					},
				],
			}

			await manager.initialize(config)

			const provider = manager.getProvider("mock") as MockProvider
			expect(provider).toBeDefined()
			expect(provider.initializeCalled).toBe(true)
			expect(provider.validateCalled).toBe(true)
		})

		it("should skip disabled providers", async () => {
			const config = {
				providers: [
					{
						id: "mock",
						name: "Mock Provider",
						enabled: false,
					},
				],
			}

			await manager.initialize(config)

			const provider = manager.getProvider("mock")
			expect(provider).toBeUndefined()
		})

		it("should throw on invalid configuration in debug mode", async () => {
			const debugManager = new TelemetryPluginManager(resource, true)
			debugManager.registerFactory("mock", new MockProviderFactory())

			const config = {
				providers: [
					{
						id: "mock",
						name: "Mock Provider",
						enabled: true,
						options: { invalid: true },
					},
				],
				debug: true,
			}

			await expect(debugManager.initialize(config)).rejects.toThrow("Invalid configuration")
		})

		it("should handle missing factory gracefully", async () => {
			const config = {
				providers: [
					{
						id: "nonexistent",
						name: "Nonexistent Provider",
						enabled: true,
					},
				],
			}

			// Should not throw in non-debug mode
			await expect(manager.initialize(config)).resolves.not.toThrow()
		})
	})

	describe("span processors", () => {
		it("should collect span processors from all providers", async () => {
			manager.registerFactory("mock", new MockProviderFactory())

			const config = {
				providers: [
					{
						id: "mock",
						name: "Mock Provider 1",
						enabled: true,
					},
				],
			}

			await manager.initialize(config)

			const processors = manager.getSpanProcessors()
			expect(processors).toHaveLength(1)
			expect(processors[0]).toBeDefined()
		})
	})

	describe("resource attributes", () => {
		it("should merge resource attributes from providers", async () => {
			manager.registerFactory("mock", new MockProviderFactory())

			const config = {
				providers: [
					{
						id: "mock",
						name: "Mock Provider",
						enabled: true,
					},
				],
			}

			await manager.initialize(config)

			const mergedResource = manager.getMergedResourceAttributes()
			const attributes = mergedResource.attributes

			expect(attributes[SEMRESATTRS_SERVICE_NAME]).toBe("test-service")
			expect(attributes["mock.provider"]).toBe("true")
			expect(attributes["mock.version"]).toBe("1.0.0")
		})
	})

	describe("lifecycle management", () => {
		it("should shutdown all providers", async () => {
			manager.registerFactory("mock", new MockProviderFactory())

			const config = {
				providers: [
					{
						id: "mock",
						name: "Mock Provider",
						enabled: true,
					},
				],
			}

			await manager.initialize(config)

			const shutdownSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			await manager.shutdown()

			// Provider should be cleared
			expect(manager.getProvider("mock")).toBeUndefined()
			expect(manager.getProviderIds()).toHaveLength(0)

			shutdownSpy.mockRestore()
		})
	})

	describe("debug mode", () => {
		it("should enable debug logging", () => {
			const debugManager = new TelemetryPluginManager(resource, true)

			const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			debugManager.registerFactory("test", new MockProviderFactory())

			expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Registered provider factory: test"))

			logSpy.mockRestore()
		})

		it("should toggle debug mode", () => {
			manager.setDebug(true)

			const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			manager.registerFactory("test", new MockProviderFactory())

			expect(logSpy).toHaveBeenCalled()

			manager.setDebug(false)
			logSpy.mockClear()

			manager.registerFactory("test2", new MockProviderFactory())

			expect(logSpy).not.toHaveBeenCalled()

			logSpy.mockRestore()
		})
	})
})
