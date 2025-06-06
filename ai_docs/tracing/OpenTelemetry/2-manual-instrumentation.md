# OpenTelemetry Manual Instrumentation Patterns

This document covers manual instrumentation patterns for creating spans, adding attributes, events, and managing span lifecycle in TypeScript.

## Creating Spans

### Active Span Pattern (Recommended)

```typescript
import { trace, Span } from "@opentelemetry/api"

export function rollTheDice(rolls: number, min: number, max: number) {
	// Create a span. A span must be closed.
	return tracer.startActiveSpan("rollTheDice", (span: Span) => {
		const result: number[] = []
		for (let i = 0; i < rolls; i++) {
			result.push(rollOnce(min, max))
		}
		// Be sure to end the span!
		span.end()
		return result
	})
}
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_16`

### Manual Span Creation

```typescript
span = tracer.startSpan(`HTTP ${method}`, {
	root: true,
	kind: SpanKind.SERVER,
	links: [{ context: syntheticSpan.spanContext() }],
	attributes: {
		"app.synthetic_request": true,
		[SEMATTRS_HTTP_TARGET]: target,
		[SEMATTRS_HTTP_STATUS_CODE]: response.statusCode,
		[SEMATTRS_HTTP_METHOD]: method,
		[SEMATTRS_HTTP_USER_AGENT]: headers["user-agent"] || "",
		[SEMATTRS_HTTP_URL]: `${headers.host}${url}`,
		[SEMATTRS_HTTP_FLAVOR]: httpVersion,
	},
})
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/demo/services/frontend.md#_snippet_3`

## Nested Spans

```typescript
function rollOnce(i: number, min: number, max: number) {
	return tracer.startActiveSpan(`rollOnce:${i}`, (span: Span) => {
		const result = Math.floor(Math.random() * (max - min + 1) + min)
		span.end()
		return result
	})
}

export function rollTheDice(rolls: number, min: number, max: number) {
	return tracer.startActiveSpan("rollTheDice", (parentSpan: Span) => {
		const result: number[] = []
		for (let i = 0; i < rolls; i++) {
			result.push(rollOnce(i, min, max))
		}
		parentSpan.end()
		return result
	})
}
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_20`

## Adding Attributes

### Setting Attributes After Creation

```typescript
function rollOnce(i: number, min: number, max: number) {
	return tracer.startActiveSpan(`rollOnce:${i}`, (span: Span) => {
		const result = Math.floor(Math.random() * (max - min + 1) + min)

		// Add an attribute to the span
		span.setAttribute("dicelib.rolled", result.toString())

		span.end()
		return result
	})
}
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_26`

### Setting Attributes During Creation

```typescript
function rollTheDice(rolls: number, min: number, max: number) {
	return tracer.startActiveSpan(
		"rollTheDice",
		{ attributes: { "dicelib.rolls": rolls.toString() } },
		(span: Span) => {
			/* ... */
		},
	)
}
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_28`

## Adding Events

### Simple Events

```javascript
span.addEvent("Doing something")
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_32`

### Events with Attributes

```javascript
span.addEvent("some log", {
	"log.severity": "error",
	"log.message": "Data not found",
	"request.id": requestId,
})
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_33`

## Error Handling

### Recording Exceptions

```typescript
import opentelemetry, { SpanStatusCode } from "@opentelemetry/api"

try {
	doWork()
} catch (ex) {
	if (ex instanceof Error) {
		span.recordException(ex)
	}
	span.setStatus({ code: SpanStatusCode.ERROR })
}
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_37`

### Setting Span Status

```typescript
tracer.startActiveSpan("app.doWork", (span) => {
	for (let i = 0; i <= Math.floor(Math.random() * 40000000); i += 1) {
		if (i > 10000) {
			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: "Error",
			})
		}
	}
	span.end()
})
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_35`

## Semantic Conventions

```typescript
import { SEMATTRS_CODE_FUNCTION, SEMATTRS_CODE_FILEPATH } from "@opentelemetry/semantic-conventions"
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_30`
