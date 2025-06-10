import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import { TelemetryConfigLoader } from "../TelemetryConfigLoader"
import { TelemetryConfig } from "../TelemetryConfig"

// Mock fs module
vi.mock("fs/promises", () => ({
	access: vi.fn(),
	readFile: vi.fn(),
}))

describe("TelemetryConfigLoader", () => {
	const mockFs = fs as any

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("load", () => {
		it("should load from explicit config path", async () => {
			const configPath = "/path/to/config.json"
			const mockConfig: TelemetryConfig = {
				providers: [
					{
						id: "otlp",
						name: "OTLP",
						enabled: true,
					},
				],
				debug: true,
			}

			mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig))

			const result = await TelemetryConfigLoader.load({ configPath })

			expect(mockFs.readFile).toHaveBeenCalledWith(configPath, "utf-8")
			expect(result).toEqual(mockConfig)
		})

		it("should search for config file in default locations", async () => {
			const mockConfig: TelemetryConfig = {
				providers: [
					{
						id: "console",
						name: "Console",
						enabled: true,
					},
				],
			}

			// Mock file access - first file doesn't exist, second does
			mockFs.access.mockRejectedValueOnce(new Error("Not found")).mockResolvedValueOnce(undefined)

			mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig))

			const result = await TelemetryConfigLoader.load()

			expect(mockFs.access).toHaveBeenCalledTimes(2)
			expect(result).toEqual(mockConfig)
		})

		it("should return default config when no file found", async () => {
			mockFs.access.mockRejectedValue(new Error("Not found"))

			const result = await TelemetryConfigLoader.load({ useDefault: true })

			expect(result.providers).toHaveLength(1)
			expect(result.providers[0].id).toBe("otlp")
		})

		it("should throw when no config found and useDefault is false", async () => {
			mockFs.access.mockRejectedValue(new Error("Not found"))

			await expect(TelemetryConfigLoader.load({ useDefault: false })).rejects.toThrow(
				"No telemetry configuration file found",
			)
		})

		it("should load environment-specific config", async () => {
			const mockConfig: TelemetryConfig = {
				providers: [
					{
						id: "jaeger",
						name: "Jaeger",
						enabled: true,
					},
				],
			}

			mockFs.access.mockResolvedValueOnce(undefined) // telemetry.config.production.json exists

			mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig))

			const result = await TelemetryConfigLoader.load({ env: "production" })

			expect(mockFs.access).toHaveBeenCalledWith(expect.stringContaining("telemetry.config.production.json"))
			expect(result).toEqual(mockConfig)
		})

		it("should validate loaded configuration", async () => {
			const invalidConfig = {
				providers: "not-an-array", // Invalid
			}

			mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig))

			await expect(TelemetryConfigLoader.load({ configPath: "/path/to/invalid.json" })).rejects.toThrow()
		})

		it("should handle JSON parse errors", async () => {
			mockFs.readFile.mockResolvedValue("{ invalid json")

			await expect(TelemetryConfigLoader.load({ configPath: "/path/to/invalid.json" })).rejects.toThrow()
		})

		it("should reject TypeScript config files", async () => {
			await expect(TelemetryConfigLoader.load({ configPath: "/path/to/config.ts" })).rejects.toThrow(
				"TypeScript config files require compilation",
			)
		})

		it("should reject unsupported file formats", async () => {
			await expect(TelemetryConfigLoader.load({ configPath: "/path/to/config.yaml" })).rejects.toThrow(
				"Unsupported config file format: .yaml",
			)
		})
	})

	describe("merge", () => {
		it("should merge multiple configurations", () => {
			const config1: Partial<TelemetryConfig> = {
				providers: [
					{
						id: "otlp",
						name: "OTLP",
						enabled: true,
					},
				],
				debug: false,
			}

			const config2: Partial<TelemetryConfig> = {
				providers: [
					{
						id: "console",
						name: "Console",
						enabled: true,
					},
				],
				debug: true,
			}

			const merged = TelemetryConfigLoader.merge(config1, config2)

			expect(merged.providers).toHaveLength(2)
			expect(merged.providers[0].id).toBe("otlp")
			expect(merged.providers[1].id).toBe("console")
			expect(merged.debug).toBe(true)
		})

		it("should override providers with same ID", () => {
			const config1: Partial<TelemetryConfig> = {
				providers: [
					{
						id: "otlp",
						name: "OTLP Old",
						enabled: false,
					},
				],
			}

			const config2: Partial<TelemetryConfig> = {
				providers: [
					{
						id: "otlp",
						name: "OTLP New",
						enabled: true,
					},
				],
			}

			const merged = TelemetryConfigLoader.merge(config1, config2)

			expect(merged.providers).toHaveLength(1)
			expect(merged.providers[0].name).toBe("OTLP New")
			expect(merged.providers[0].enabled).toBe(true)
		})

		it("should merge custom factories", () => {
			const config1: Partial<TelemetryConfig> = {
				customFactories: {
					custom1: {} as any,
				},
			}

			const config2: Partial<TelemetryConfig> = {
				customFactories: {
					custom2: {} as any,
				},
			}

			const merged = TelemetryConfigLoader.merge(config1, config2)

			expect(merged.customFactories).toBeDefined()
			expect(Object.keys(merged.customFactories!)).toHaveLength(2)
		})
	})
})
