# OpenTelemetry Context Propagation

This document covers context management and propagation patterns in OpenTelemetry for TypeScript/Node.js, essential for distributed tracing across async operations and service boundaries.

## Context Basics

### Getting Active Context

```typescript
import * as api from "@opentelemetry/api"

// Returns the active context
// If no context is active, the ROOT_CONTEXT is returned
const ctx = api.context.active()
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/context.md#_snippet_5`

### Creating Context Keys

```typescript
import * as api from "@opentelemetry/api"

const key1 = api.createContextKey("My first key")
const key2 = api.createContextKey("My second key")
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/context.md#_snippet_1`

### Setting and Getting Values

```typescript
import * as api from "@opentelemetry/api"

const key = api.createContextKey("some key")
const ctx = api.ROOT_CONTEXT

// add a new entry
const ctx2 = ctx.setValue(key, "context 2")

// ctx2 contains the new entry
console.log(ctx2.getValue(key)) // "context 2"

// ctx is unchanged (immutable)
console.log(ctx.getValue(key)) // undefined
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/context.md#_snippet_3`

## Async Context Management

### Registering Context Manager

```typescript
import * as api from "@opentelemetry/api"
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks"

const contextManager = new AsyncHooksContextManager()
contextManager.enable()
api.context.setGlobalContextManager(contextManager)
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/context.md#_snippet_0`

### Using Context with Callbacks

```typescript
import * as api from "@opentelemetry/api"

const key = api.createContextKey("Key to store a value")
const ctx = api.context.active()

api.context.with(ctx.setValue(key, "context 2"), async () => {
	// "context 2" is active
	console.log(api.context.active().getValue(key)) // "context 2"
})
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/context.md#_snippet_6`

## Cross-Service Propagation

### Injecting Context (Sending Service)

```typescript
import { context, propagation, trace } from "@opentelemetry/api"

interface Carrier {
	traceparent?: string
	tracestate?: string
}

const output: Carrier = {}

// Serialize the traceparent and tracestate from context
propagation.inject(context.active(), output)

const { traceparent, tracestate } = output
// Pass traceparent and tracestate to downstream service
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/propagation.md#_snippet_2`

### Extracting Context (Receiving Service)

```typescript
import { type Context, propagation, trace, Span, context } from "@opentelemetry/api"

interface Carrier {
	traceparent?: string
	tracestate?: string
}

const input: Carrier = {} // Contains traceparent & tracestate from upstream

// Extract context
let activeContext: Context = propagation.extract(context.active(), input)

let tracer = trace.getTracer("app-name")

// Start span with extracted context
let span: Span = tracer.startSpan(
	spanName,
	{
		attributes: {},
	},
	activeContext,
)

// Set the created span as active in the deserialized context
trace.setSpan(activeContext, span)
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/propagation.md#_snippet_3`

## Nested Context Scopes

```typescript
import * as api from "@opentelemetry/api"

const key = api.createContextKey("Key to store a value")
const ctx = api.context.active()

api.context.with(ctx.setValue(key, "context 2"), () => {
	// "context 2" is active
	console.log(api.context.active().getValue(key)) // "context 2"

	api.context.with(ctx.setValue(key, "context 3"), () => {
		// "context 3" is active
		console.log(api.context.active().getValue(key)) // "context 3"
	})

	// "context 2" is active again
	console.log(api.context.active().getValue(key)) // "context 2"
})

// No context is active
console.log(api.context.active().getValue(key)) // undefined
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/context.md#_snippet_8`

## Manual Span Context Management (sdk-trace-base)

```javascript
const mainWork = () => {
	const parentSpan = tracer.startSpan("main")

	for (let i = 0; i < 3; i += 1) {
		doWork(parentSpan, i)
	}

	parentSpan.end()
}

const doWork = (parent, i) => {
	// Manually set parent span in context
	const ctx = opentelemetry.trace.setSpan(opentelemetry.context.active(), parent)
	const span = tracer.startSpan(`doWork:${i}`, undefined, ctx)

	// do work...

	span.end()
}
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_41`

## Getting Span from Context

```javascript
const ctx = getContextFromSomewhere()
const span = opentelemetry.trace.getSpan(ctx)
```

**Citation**: Context7 Library ID: `/open-telemetry/opentelemetry.io`  
**Source**: `content/en/docs/languages/js/instrumentation.md#_snippet_25`
