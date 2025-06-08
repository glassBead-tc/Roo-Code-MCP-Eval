export * from "./TelemetryProvider.js"
export * from "./OtlpProvider.js"
export * from "./JaegerProvider.js"
export * from "./ConsoleProvider.js"

import { TelemetryProviderFactory } from "./TelemetryProvider.js"
import { OtlpProviderFactory } from "./OtlpProvider.js"
import { JaegerProviderFactory } from "./JaegerProvider.js"
import { ConsoleProviderFactory } from "./ConsoleProvider.js"

/**
 * Built-in provider factories
 */
export const builtInProviders: Map<string, TelemetryProviderFactory> = new Map<string, TelemetryProviderFactory>([
	["otlp", new OtlpProviderFactory()],
	["jaeger", new JaegerProviderFactory()],
	["console", new ConsoleProviderFactory()],
])
