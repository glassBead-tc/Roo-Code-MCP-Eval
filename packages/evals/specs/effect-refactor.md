# Effect-based Evaluation System Refactoring Specification

> **API Verification Status**: APIs verified against Effect examples and documentation (January 2025)

## Overview

The Roo Code evaluation system will be transformed using Effect-ts to address key architectural challenges around concurrency management, error handling, and resource lifecycle. This refactoring will provide type-safe error handling, structured concurrency, and automatic resource management while maintaining the existing functionality.

## Architecture

### Core Components

#### 1. Effect-based CLI Foundation with Custom Runtime

```typescript
// Main entry point using ManagedRuntime for proper lifecycle management
import { Effect, Layer, Config, Queue, Fiber, Schedule, ManagedRuntime } from "effect"

// Define the main program
const program = Effect.gen(function* () {
	// Configuration loaded through Effect's config system
	const config = yield* EvalConfig

	// Create run with automatic resource management
	const run = yield* createEvalRun(config)

	// Execute tasks with structured concurrency
	yield* executeTasks(run).pipe(Effect.withConcurrency(config.concurrency), Effect.timeout(config.globalTimeout))
})

// Create a managed runtime with our application layer
const runtime = ManagedRuntime.make(MainLayer)

// Entry point with proper cleanup
async function main() {
	try {
		// Run the program with automatic resource management
		const result = await runtime.runPromise(
			program.pipe(
				Effect.tapErrorCause(Effect.logError),
				Effect.catchAllCause((cause) =>
					Effect.gen(function* () {
						yield* Effect.logError("Fatal error in evaluation system", cause)
						yield* Effect.sync(() => process.exit(1))
					}),
				),
			),
		)

		console.log("Evaluation completed successfully", result)
	} finally {
		// Ensure all resources are properly disposed
		await runtime.dispose()
	}
}

// Handle process signals gracefully
process.on("SIGINT", async () => {
	console.log("\nGracefully shutting down...")
	await runtime.dispose()
	process.exit(0)
})

process.on("SIGTERM", async () => {
	console.log("\nReceived SIGTERM, shutting down...")
	await runtime.dispose()
	process.exit(0)
})
```

#### 2. Layered Architecture

Dependencies organized into composable layers:

```typescript
// Database Layer
const DatabaseLayer = Layer.effect(
	Database,
	Effect.gen(function* () {
		const pool = yield* Effect.acquireRelease(createPool(databaseUrl), (pool) => Effect.sync(() => pool.end()))

		return {
			query: (sql: string) =>
				Effect.tryPromise({
					try: () => pool.query(sql),
					catch: (e) => new DatabaseError({ cause: e }),
				}),
		}
	}),
)

// IPC Layer
const IpcLayer = Layer.effect(
	IpcService,
	Effect.gen(function* () {
		const socketPath = yield* Config.string("socketPath")

		const server = yield* Effect.acquireRelease(
			Effect.sync(() => new IpcServer(socketPath)),
			(server) => Effect.sync(() => server.close()),
		)

		return {
			broadcast: (msg) => Effect.sync(() => server.broadcast(msg)),
			onMessage: Queue.unbounded<IpcMessage>(),
		}
	}),
)

// Main application layer
const MainLayer = Layer.mergeAll(DatabaseLayer, IpcLayer, ProcessManagerLayer, MetricsLayer)
```

#### 3. Structured Task Execution

Replace promise-based concurrency with Effect's structured approach:

```typescript
interface TaskExecution {
	readonly task: Task
	readonly fiber: Fiber.Fiber<TaskResult, TaskError>
	readonly startTime: number
}

const executeTasks = (run: Run) =>
	Effect.gen(function* () {
		const tasks = yield* getTasks(run.id)
		const queue = yield* Queue.bounded<Task>(run.concurrency)
		const executions = yield* Ref.make<Map<number, TaskExecution>>(new Map())

		// Worker fibers that process tasks
		const workers = yield* Effect.forkAll(
			Array.from({ length: run.concurrency }, () => processTaskWorker(queue, executions, run)),
		)

		// Enqueue all tasks with delays
		yield* Effect.forEach(
			tasks,
			(task, index) => Effect.delay(queue.offer(task), Duration.seconds(index * TASK_START_DELAY)),
			{ concurrency: "unbounded" },
		)

		// Wait for all tasks to complete
		yield* Fiber.join(workers)
	})

const processTaskWorker = (queue: Queue.Queue<Task>, executions: Ref<Map<number, TaskExecution>>, run: Run) =>
	Effect.gen(function* () {
		while (true) {
			const task = yield* queue.take

			const fiber = yield* Effect.fork(
				runTask(task, run).pipe(
					Effect.timeout(TASK_TIMEOUT),
					Effect.tapError((error) => createToolError({ taskId: task.id, error })),
				),
			)

			yield* executions.update((map) => map.set(task.id, { task, fiber, startTime: Date.now() }))

			yield* Fiber.join(fiber)
		}
	}).pipe(Effect.repeatWhile(() => true))
```

### Key Features

#### 1. Type-Safe Error Handling

All errors are typed and handled explicitly:

```typescript
// Error types with full context
class TaskError extends Data.TaggedError("TaskError")<{
	taskId: number
	language: ExerciseLanguage
	exercise: string
	cause: unknown
}> {}

class ProcessError extends Data.TaggedError("ProcessError")<{
	command: string
	exitCode: number
	stderr: string
}> {}

class IpcError extends Data.TaggedError("IpcError")<{
	operation: "connect" | "send" | "receive"
	socketPath: string
	cause: unknown
}> {}

// Unified error type for the system
type EvalError = TaskError | ProcessError | IpcError | DatabaseError

// Error recovery strategies with Effect's short-circuiting
const runTaskWithRecovery = (task: Task) =>
	runTask(task).pipe(
		Effect.retry(
			Schedule.exponential(Duration.seconds(1)).pipe(
				Schedule.jittered,
				Schedule.whileOutput(Duration.lessThanOrEqualTo(Duration.seconds(30))),
			),
		),
		// Effect automatically short-circuits on errors - subsequent operations won't run
		Effect.catchTag("ProcessError", (error) =>
			error.exitCode === 124 // timeout
				? Effect.succeed({ success: false, timedOut: true })
				: Effect.fail(error),
		),
	)

// Short-circuiting example: if any task fails, remaining tasks are skipped
const runMultipleTasks = Effect.gen(function* () {
	yield* runTask(task1) // If this fails...
	yield* runTask(task2) // ...this won't execute
	yield* runTask(task3) // ...and neither will this
})
```

#### 2. Resource-Safe Process Management

Automatic cleanup of VS Code processes and subprocesses:

```typescript
// Option 1: Using @effect/platform Command API
import { Command } from "@effect/platform"
import { NodeContext, NodeRuntime } from "@effect/platform-node"

const runVSCodeProcess = (workspacePath: string) =>
	Effect.gen(function* () {
		const command = Command.make("code", [workspacePath, "--no-sandbox"]).pipe(
			Command.env({
				ELECTRON_RUN_AS_NODE: "1",
				NODE_ENV: "test",
			}),
			Command.stdout("pipe"),
			Command.stderr("pipe"),
		)

		// Start the process and get handle
		const process = yield* Command.start(command)

		// Return process with cleanup
		return yield* Effect.acquireRelease(
			Effect.succeed(process),
			(process) =>
				// Command API handles process cleanup automatically
				Effect.unit,
		)
	})

// Option 2: Custom implementation with execa
class ProcessManager {
	spawn(command: string, args: string[], options: ProcessOptions) {
		return Effect.gen(function* () {
			const controller = new AbortController()

			const process = yield* Effect.acquireRelease(
				Effect.sync(() =>
					execa(command, args, {
						...options,
						signal: controller.signal,
					}),
				),
				(subprocess) =>
					Effect.gen(function* () {
						// Kill process tree
						const descendants = yield* getProcessTree(subprocess.pid)
						yield* Effect.forEach(descendants, (pid) => Effect.ignore(killProcess(pid)))
						controller.abort()
					}),
			)

			return process
		})
	}
}
```

#### 3. Metrics and Observability

Built-in metrics collection using Effect's metrics system:

```typescript
import { Metric, MetricBoundaries } from "effect"

const TaskMetrics = {
	// ✅ VERIFIED: Correct histogram API with MetricBoundaries
	duration: Metric.histogram(
		"task.duration",
		MetricBoundaries.linear({ start: 0, width: 5000, count: 12 }),
		"Task execution duration in milliseconds",
	),

	// ✅ VERIFIED: Correct counter API
	success: Metric.counter("task.success", {
		description: "Successful task completions",
	}),
	failure: Metric.counter("task.failure", {
		description: "Failed task executions",
	}),

	// Note: Tags are applied when using the metric, not in creation
	tokenUsage: Metric.counter("task.tokens", {
		description: "Token usage across all tasks",
	}),
}

const trackTaskExecution = (task: Task) =>
	Effect.gen(function* () {
		const startTime = yield* Clock.currentTimeMillis

		const result = yield* runTask(task).pipe(
			// ✅ VERIFIED: Metrics are applied by calling them with an Effect
			Effect.tap(() => TaskMetrics.success(Effect.succeed(1))),
			Effect.tapError(() => TaskMetrics.failure(Effect.succeed(1))),
			Effect.ensuring(
				Effect.gen(function* () {
					const endTime = yield* Clock.currentTimeMillis
					yield* TaskMetrics.duration(Effect.succeed(endTime - startTime))
				}),
			),
		)

		return result
	})

// For tagged metrics, use Metric.tagged
const taggedTokenMetric = TaskMetrics.tokenUsage.pipe(Metric.tagged("type", "input"))
```

#### 4. Stream-Based IPC Communication

Replace event emitters with Effect streams:

```typescript
const createIpcStream = (client: IpcClient) =>
	Stream.async<IpcMessage>((emit) => {
		const handler = (msg: IpcMessage) => emit(Effect.succeed(Chunk.of(msg)))

		client.on("message", handler)

		return Effect.sync(() => {
			client.off("message", handler)
			client.disconnect()
		})
	})

const processTaskEvents = (client: IpcClient, task: Task) =>
	createIpcStream(client).pipe(
		Stream.tap((msg) =>
			Effect.when(msg.type === IpcMessageType.TaskEvent, () => updateTaskMetrics(task.id, msg.data)),
		),
		Stream.takeUntil(
			(msg) =>
				msg.data.eventName === RooCodeEventName.TaskCompleted ||
				msg.data.eventName === RooCodeEventName.TaskAborted,
		),
		Stream.runDrain,
	)
```

#### 5. Configuration as Code

Type-safe configuration using Effect's Config module:

```typescript
const EvalConfig = Config.all({
	model: Config.string("model").pipe(Config.withDefault("claude-3-5-haiku-20241022")),

	concurrency: Config.integer("concurrency").pipe(
		Config.withDefault(2),
		Config.validate((n) => n > 0 && n <= 10),
	),

	languages: Config.array(Config.string("languages")).pipe(
		Config.map((langs) => langs.filter((l): l is ExerciseLanguage => exerciseLanguages.includes(l as any))),
	),

	timeouts: Config.all({
		task: Config.duration("TASK_TIMEOUT").pipe(Config.withDefault(Duration.minutes(5))),
		unitTest: Config.duration("UNIT_TEST_TIMEOUT").pipe(Config.withDefault(Duration.minutes(2))),
	}),

	database: Config.secret("DATABASE_URL"),

	openRouterKey: Config.secret("OPENROUTER_API_KEY"),
})
```

### Performance Optimizations

#### 1. Batched Database Operations

```typescript
const batchedTaskUpdates = Queue.unbounded<TaskUpdate>().pipe(
	Stream.fromQueue,
	Stream.groupedWithin(100, Duration.seconds(1)),
	Stream.mapEffect((updates) =>
		Effect.forEach(updates, (update) => updateTask(update.id, update.data), { concurrency: 1, batching: true }),
	),
)
```

#### 2. Lazy Task Loading

```typescript
const getTasksLazy = (runId: number) =>
	Stream.paginateEffect(0, (offset) =>
		Effect.gen(function* () {
			const tasks = yield* getTasksPaginated(runId, offset, 50)
			return [tasks, tasks.length === 50 ? Option.some(offset + 50) : Option.none()]
		}),
	)
```

#### 3. Resilient External API Calls

```typescript
// Effect provides built-in patterns for resilient API calls
// Using retry with exponential backoff and timeout:
const resilientApiCall = (url: string) =>
	Effect.tryPromise({
		try: () => fetch(url),
		catch: () => new ApiError({ url }),
	}).pipe(
		Effect.retry({
			times: 5,
			schedule: Schedule.exponential(Duration.seconds(1)),
		}),
		Effect.timeout(Duration.seconds(30)),
	)

// For circuit breaker pattern, consider implementing with Ref:
const createCircuitBreaker = <A, E>(maxFailures: number, resetTimeout: Duration.Duration) => {
	return Effect.gen(function* () {
		const state = yield* Ref.make<"closed" | "open" | "half-open">("closed")
		const failures = yield* Ref.make(0)

		// Implementation would track failures and state transitions
		return {
			call: (effect: Effect.Effect<A, E>) =>
				Effect.gen(function* () {
					const currentState = yield* Ref.get(state)
					if (currentState === "open") {
						return yield* Effect.fail(new CircuitBreakerOpenError())
					}
					// ... rest of implementation
				}),
		}
	})
}
```

#### Unit Test Execution with Command API

```typescript
const runUnitTests = (language: ExerciseLanguage, projectPath: string) =>
	Effect.gen(function* () {
		const testCommands = {
			javascript: Command.make("npm", ["test"]),
			python: Command.make("python", ["-m", "pytest"]),
			go: Command.make("go", ["test", "-v", "./..."]),
			rust: Command.make("cargo", ["test"]),
			java: Command.make("gradle", ["test"]),
		}

		const command = testCommands[language].pipe(
			Command.workingDirectory(projectPath),
			Command.stdout("inherit"),
			Command.stderr("pipe"),
		)

		// Run with timeout
		const exitCode = yield* Command.exitCode(command).pipe(
			Effect.timeout(UNIT_TEST_TIMEOUT),
			Effect.catchTag(
				"TimeoutException",
				() => Effect.succeed(124), // timeout exit code
			),
		)

		return { success: exitCode === 0, exitCode }
	})
```

### Runtime Management

#### Custom Runtime for Testing

Enable different runtime configurations for testing vs production:

```typescript
// Test runtime with mocked services
const TestRuntime = ManagedRuntime.make(
	Layer.mergeAll(MockDatabaseLayer, MockIpcLayer, TestProcessManagerLayer, ConsoleMetricsLayer),
)

// Production runtime with real services
const ProductionRuntime = ManagedRuntime.make(MainLayer)

// Runtime selection based on environment
const runtime = process.env.NODE_ENV === "test" ? TestRuntime : ProductionRuntime
```

#### Runtime Context Propagation

Ensure context is properly propagated across async boundaries:

```typescript
const runWithRuntime = <A, E>(effect: Effect.Effect<A, E, AppContext>) => {
	// Store the runtime for use in callbacks
	const rt = runtime

	return {
		// Run as promise
		runPromise: () => rt.runPromise(effect),

		// Run with callback
		runCallback: (cb: (exit: Exit<A, E>) => void) => rt.runCallback(effect, cb),

		// Run in fork for background tasks
		runFork: () => rt.runFork(effect),

		// Run sync for CLI commands
		runSync: () => rt.runSync(effect),
	}
}
```

### Migration Path

#### Phase 1: Core Infrastructure

1. Replace promise-based database operations with Effect
2. Implement layered architecture
3. Add structured logging and metrics

#### Phase 2: Task Execution

1. Convert task execution to Effect fibers
2. Implement proper process lifecycle management
3. Add retry and timeout policies

#### Phase 3: IPC Communication

1. Replace event emitters with streams
2. Implement backpressure handling
3. Add message validation

#### Phase 4: Optimizations

1. Implement batching and caching
2. Add circuit breakers
3. Optimize concurrent execution

## Benefits

1. **Type Safety**: All errors are typed and handled at compile time
2. **Resource Safety**: Automatic cleanup of processes, connections, and file handles
3. **Observability**: Built-in metrics, tracing, and structured logging
4. **Testability**: Pure functions and dependency injection via layers
5. **Performance**: Better concurrency control and resource utilization
6. **Maintainability**: Clear separation of concerns and composable architecture
7. **Reliability**: Automatic retries, timeouts, and circuit breakers

## Configuration Example

```typescript
// .env
MODEL=claude-3-5-sonnet-20241022
CONCURRENCY=4
TASK_TIMEOUT=5m
UNIT_TEST_TIMEOUT=2m
DATABASE_URL=postgresql://user:pass@localhost:5432/evals
OPENROUTER_API_KEY=sk-or-v1-...

// src/cli/index.ts - Complete CLI implementation
import { Effect, ManagedRuntime, Console, Exit } from "effect"
import { MainLayer, EvalConfig, runEvaluation } from "./app"

// Create the runtime
const runtime = ManagedRuntime.make(MainLayer)

// Main program
const program = Effect.gen(function* () {
  const config = yield* EvalConfig

  yield* Console.log(`Running with model: ${config.model}`)
  yield* Console.log(`Concurrency: ${config.concurrency}`)

  return yield* runEvaluation(config)
})

// CLI entry point with proper error handling
async function main() {
  const exit = await runtime.runPromiseExit(program)

  if (Exit.isFailure(exit)) {
    console.error("Evaluation failed:", exit.cause)
    await runtime.dispose()
    process.exit(1)
  }

  console.log("Evaluation completed successfully")
  await runtime.dispose()
}

// Handle uncaught errors
process.on("unhandledRejection", async (error) => {
  console.error("Unhandled rejection:", error)
  await runtime.dispose()
  process.exit(1)
})

// Run the CLI
main().catch(console.error)
```

This architecture transforms the evaluation system into a robust, type-safe, and maintainable service with superior error handling, resource management, and observability compared to the current promise-based implementation.

## API Verification Summary

### ✅ Verified APIs

- **Data.TaggedError**: Confirmed pattern for creating tagged error types
- **Effect.gen**: Generator syntax for Effect composition verified
- **ManagedRuntime.make/dispose**: Lifecycle management APIs confirmed
- **Effect.acquireRelease**: Resource management pattern verified
- **Effect.catchTag**: Error handling by tag confirmed
- **Layer system**: Layer composition patterns verified
- **Effect.tapError**: Error inspection without catching confirmed
- **Metric.counter/histogram**: Correct APIs with MetricBoundaries for histograms
- **Metric usage**: Metrics are applied by calling them with Effects

### ⚠️ APIs Requiring Further Verification

1. **Queue.unbounded()**: The exact syntax for creating unbounded queues needs verification
2. **Layer.effect**: Exact API may vary - consult latest documentation

### 📚 Clarifications

1. **Circuit Breaker vs Short-Circuiting**: Effect's "short-circuiting" refers to automatic error propagation in sequential operations, not the circuit breaker resilience pattern. Circuit breakers would need custom implementation using Ref and state management.
2. **Error Propagation**: Effect automatically short-circuits on errors - when an error occurs in a sequence of operations, remaining operations are skipped.

### 🔧 Platform-Specific APIs (@effect/platform)

The spec could leverage these verified @effect/platform APIs:

- **Command**: ✅ For process management with automatic cleanup, environment variables, and stream handling
- **FileSystem**: For file operations with Effect integration
- **Terminal**: For terminal interactions
- **PlatformLogger**: For structured logging
- **HttpServer/HttpClient**: For HTTP-based communication if needed
- **NodeContext/NodeRuntime**: Required for running platform-specific operations

### 📝 Implementation Notes

1. **Import paths**: All core Effect APIs are imported from "effect" package
2. **Runtime patterns**: Consider using NodeRuntime.runMain for Node.js applications (as seen in examples)
3. **Service definitions**: Effect.Service pattern is the modern way to define services
4. **Error types**: Data.TaggedError creates discriminated union errors with proper typing

### 🔗 References

- Effect documentation: https://effect-ts.github.io/effect/docs/
- Example implementations in: `/examples/examples/http-server/`
- Build tooling patterns in: `/build-utils/`
