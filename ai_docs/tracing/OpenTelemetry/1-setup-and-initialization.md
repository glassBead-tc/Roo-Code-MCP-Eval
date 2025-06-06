# OpenTelemetry Setup and Initialization for TypeScript/Node.js

This document covers the setup and initialization patterns for OpenTelemetry in TypeScript/Node.js applications, relevant to implementing MCP tracing.

## Basic SDK Initialization

### Node.js SDK Setup

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node"
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from "@opentelemetry/sdk-metrics"

const sdk = new NodeSDK({
	traceExporter: new ConsoleSpanExporter(),
	metricReader: new PeriodicExportingMetricReader({
		exporter: new ConsoleMetricExporter(),
	}),
	instrumentations: [getNodeAutoInstrumentations()],
})

sdk.start()
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/getting-started/nodejs.md#_snippet_0`

### Manual Tracer Provider Setup (sdk-trace-base)

```typescript
import opentelemetry from "@opentelemetry/api"
import { CompositePropagator, W3CTraceContextPropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import { BasicTracerProvider, BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"

opentelemetry.trace.setGlobalTracerProvider(
	new BasicTracerProvider({
		spanProcessors: [new BatchSpanProcessor(new ConsoleSpanExporter())],
	}),
)

opentelemetry.propagation.setGlobalPropagator(
	new CompositePropagator({
		propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
	}),
)

const tracer = opentelemetry.trace.getTracer("example-basic-tracer-node")
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_39`

## Acquiring a Tracer

```typescript
import { trace } from "@opentelemetry/api"

const tracer = trace.getTracer("instrumentation-scope-name", "0.1.0")
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_13`

## Custom Instrumentation Registration

```typescript
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http"
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express"

const sdk = new NodeSDK({
	instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
})

sdk.start()
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/libraries.md#_snippet_5`

## OTLP Exporter Configuration

```typescript
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto"
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"

const sdk = new NodeSDK({
	traceExporter: new OTLPTraceExporter({
		url: "<your-otlp-endpoint>/v1/traces",
		headers: {}, // custom headers
	}),
	metricReader: new PeriodicExportingMetricReader({
		exporter: new OTLPMetricExporter({
			url: "<your-otlp-endpoint>/v1/metrics",
			headers: {},
		}),
	}),
	instrumentations: [getNodeAutoInstrumentations()],
})
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/exporters.md#_snippet_3`

## Resource Configuration

```typescript
import { resourceFromAttributes } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions"

const sdk = new NodeSDK({
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: "yourServiceName",
		[ATTR_SERVICE_VERSION]: "1.0",
	}),
	traceExporter: new ConsoleSpanExporter(),
})
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_7`

## Running with Instrumentation

```bash
npx ts-node --require ./instrumentation.ts app.ts
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_9`
