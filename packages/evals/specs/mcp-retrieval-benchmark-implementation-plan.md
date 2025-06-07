# MCP Retrieval Benchmark Implementation Plan

This plan outlines the steps to integrate MCP retrieval benchmarking into Roo Code's evaluation framework.

## 1. Database Schema & Migrations

**a. Define Schema (`packages/evals/src/db/schema.ts`):**

```typescript
import { pgTable, serial, integer, text, jsonb, boolean, timestamp } from "drizzle-orm/pg-core"
import { runs, tasks } from "./schema" // Assuming these are your existing tables

export const mcpRetrievalBenchmarks = pgTable("mcp_retrieval_benchmarks", {
	id: serial("id").primaryKey(),
	runId: integer("run_id")
		.references(() => runs.id)
		.notNull(),
	taskId: integer("task_id")
		.references(() => tasks.id)
		.notNull(),
	mcpServerName: text("mcp_server_name").notNull(),
	userIntent: text("user_intent").notNull(),
	totalSteps: integer("total_steps").notNull(),
	codeExecutionSuccess: boolean("code_execution_success"),
	errorCount: integer("error_count").default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const mcpRetrievalCalls = pgTable("mcp_retrieval_calls", {
	id: serial("id").primaryKey(),
	benchmarkId: integer("benchmark_id")
		.references(() => mcpRetrievalBenchmarks.id)
		.notNull(),
	stepNumber: integer("step_number").notNull(),
	request: jsonb("request").notNull(),
	response: jsonb("response").notNull(),
	responseSize: integer("response_size").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
})
```

**b. Configure Drizzle (`packages/evals/drizzle.config.ts`):**

Create this file if it doesn't exist:

```typescript
import { defineConfig } from "drizzle-kit"

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	// Add your dbCredentials if not using environment variables
	// dbCredentials: {
	//   url: process.env.DATABASE_URL!,
	// },
})
```

**c. Generate Migrations:**

Run from the `packages/evals` directory (or adjust paths accordingly if run from root):

```bash
npx drizzle-kit generate --config=./drizzle.config.ts
```

Then apply migrations as per your project's setup (e.g., `npx drizzle-kit migrate`).

## 2. Custom Span Processor

Create `packages/evals/src/benchmark/McpBenchmarkProcessor.ts`:

```typescript
import { Span, SpanProcessor, SpanKind, ReadableSpan, Context } from "@opentelemetry/sdk-trace-base"
import { Database } from "../db" // Adjust path to your DB instance/types
import { mcpRetrievalBenchmarks, mcpRetrievalCalls } from "../db/schema"

export class McpBenchmarkProcessor implements SpanProcessor {
	private activeTaskBenchmarks = new Map<number, number>() // taskId -> benchmarkId
	private stepCounts = new Map<number, number>() // taskId -> currentStep

	constructor(private db: Database) {}

	async onEnd(span: ReadableSpan): Promise<void> {
		if (span.kind !== SpanKind.CLIENT || span.attributes["rpc.system"] !== "mcp") return
		const serverName = span.attributes["rpc.service"] as string
		if (!["exa", "firecrawl", "context7"].includes(serverName)) return

		const taskId = span.attributes["mcp.task_id"] as number
		if (!taskId) return

		let stepCount = (this.stepCounts.get(taskId) || 0) + 1
		this.stepCounts.set(taskId, stepCount)

		const benchmarkId = this.activeTaskBenchmarks.get(taskId)
		if (!benchmarkId) return

		const request = span.attributes["mcp.request"] ? JSON.parse(span.attributes["mcp.request"] as string) : {}
		const response = span.attributes["mcp.response"] ? JSON.parse(span.attributes["mcp.response"] as string) : {}
		const responseSize = (span.attributes["mcp.response_size_bytes"] as number) || 0

		await this.db
			.insert(mcpRetrievalCalls)
			.values({
				benchmarkId,
				stepNumber: stepCount,
				request,
				response,
				responseSize,
			})
			.execute()
	}

	async startTaskBenchmark(taskId: number, runId: number, mcpServerName: string, userIntent: string): Promise<void> {
		const [benchmark] = await this.db
			.insert(mcpRetrievalBenchmarks)
			.values({
				runId,
				taskId,
				mcpServerName,
				userIntent,
				totalSteps: 0, // Placeholder, will be updated
			})
			.returning({ id: mcpRetrievalBenchmarks.id })
			.execute()

		this.activeTaskBenchmarks.set(taskId, benchmark.id)
		this.stepCounts.set(taskId, 0)
	}

	async finishTaskBenchmark(taskId: number, executionSuccess: boolean, errorCount: number): Promise<void> {
		const benchmarkId = this.activeTaskBenchmarks.get(taskId)
		if (!benchmarkId) return

		const totalSteps = this.stepCounts.get(taskId) || 0
		await this.db
			.update(mcpRetrievalBenchmarks)
			.set({ totalSteps, codeExecutionSuccess: executionSuccess, errorCount })
			.where("id", "=", benchmarkId)
			.execute()

		this.activeTaskBenchmarks.delete(taskId)
		this.stepCounts.delete(taskId)
	}

	onStart(span: Span, parentContext: Context): void {}
	shutdown(): Promise<void> {
		return Promise.resolve()
	}
	forceFlush(): Promise<void> {
		return Promise.resolve()
	}
}
```

## 3. Integrate Span Processor

Modify your OpenTelemetry setup (likely in `src/services/mcp/tracing/initializeTracing.ts` or similar):

```typescript
// ... existing imports
import { McpBenchmarkProcessor } from "../../../packages/evals/src/benchmark/McpBenchmarkProcessor" // Adjust path
import { db } from "../../../packages/evals/src/db" // Adjust path to your DB instance

// ... in your SDK initialization
const mcpBenchmarkProcessor = new McpBenchmarkProcessor(db)

sdk = new NodeSDK({
	// ... other configurations
	spanProcessors: [
		new SimpleSpanProcessor(traceExporter), // Your existing processor
		mcpBenchmarkProcessor, // Add the new processor
	],
})
```

## 4. Update Evaluation Runner

Modify `packages/evals/src/cli/index.ts` (or wherever `runExercise` is defined):

**a. Instantiate Processor (if not globally available):**
Ensure `mcpBenchmarkProcessor` is accessible or passed to `runExercise`.

**b. Modify `runExercise`:**

```typescript
// Assuming mcpBenchmarkProcessor is available in this scope
async function runExercise({ run, task, server, mcpServerToUse }: RunExerciseParams): Promise<void> {
	// Add mcpServerToUse
	// ... existing setup

	// Start benchmark
	await mcpBenchmarkProcessor.startTaskBenchmark(task.id, run.id, mcpServerToUse, task.prompt)

	// Ensure taskId is added to MCP call spans (in McpHub.callTool or similar):
	// if (activeSpan && params.taskId) { // params.taskId should come from runExercise
	//   activeSpan.setAttribute('mcp.task_id', params.taskId);
	// }

	// ... rest of task execution ...

	// After task completion & code quality assessment:
	const { executionSuccess, errorCount } = await assessCodeQuality(/* taskDir */)
	await mcpBenchmarkProcessor.finishTaskBenchmark(task.id, executionSuccess, errorCount)

	// ... existing cleanup
}
```

## 5. CLI Updates

Modify `packages/evals/src/cli/index.ts`:

```typescript
// ... existing imports

const evalsRunCommand = command({
	name: "run",
	// ... existing args
	args: {
		// ... existing args
		mcpServer: option({
			type: string,
			long: "mcp-server",
			description: "MCP server to use for benchmark (e.g., exa, firecrawl)",
			optional: true, // Make it optional if benchmarking is not always on
		}),
	},
	async handler({ /*...,*/ mcpServer }) {
		// ... existing handler logic
		// When calling runExercise, pass mcpServer:
		// await runExercise({ /*...,*/ mcpServerToUse: mcpServer });
	},
})
```

## 6. Code Quality Assessment

Create `packages/evals/src/benchmark/assessQuality.ts`:

```typescript
import { execa } from "execa"
import * as fs from "fs/promises"
import * as path from "path"

async function assessCodeQuality(taskDirectory: string): Promise<{ executionSuccess: boolean; errorCount: number }> {
	let executionSuccess = false
	let errorCount = 0

	// Simplified: Check if a main file (e.g., index.js, main.py) exists and try to run it.
	// This needs to be adapted based on your exercise structure.
	const mainJs = path.join(taskDirectory, "index.js")
	const mainPy = path.join(taskDirectory, "main.py")

	try {
		if (await fs.stat(mainJs).catch(() => false)) {
			await execa("node", [mainJs], { cwd: taskDirectory, timeout: 5000 })
			executionSuccess = true
			// Basic linting for JS/TS with ESLint (example)
			// const { stdout } = await execa('npx', ['eslint', '.', '--format', 'json'], { cwd: taskDirectory, reject: false });
			// const lintResults = JSON.parse(stdout);
			// errorCount = lintResults.reduce((sum, file) => sum + file.errorCount, 0);
		} else if (await fs.stat(mainPy).catch(() => false)) {
			await execa("python3", [mainPy], { cwd: taskDirectory, timeout: 5000 })
			executionSuccess = true
			// Basic linting for Python with Pylint (example)
			// const { stdout } = await execa('pylint', ['.', '--output-format=json'], { cwd: taskDirectory, reject: false });
			// const lintResults = JSON.parse(stdout);
			// errorCount = lintResults.filter(r => r.type === 'error').length;
		}
	} catch (e) {
		executionSuccess = false
		// errorCount might be derived from stderr if needed
	}
	// For now, errorCount remains basic. Implement robust linting as a separate step if needed.
	return { executionSuccess, errorCount }
}

export { assessCodeQuality }
```

## 7. Reporting

Create `packages/evals/src/benchmark/generateReport.ts`:

```typescript
import { Database } from "../db" // Adjust path
import { mcpRetrievalBenchmarks, tasks as dbTasks, runs as dbRuns, exercises as dbExercises } from "../db/schema"
import { inArray, eq } from "drizzle-orm"

export async function generateServerComparisonReport(db: Database, runIds: number[]): Promise<any> {
	const benchmarks = await db
		.select()
		.from(mcpRetrievalBenchmarks)
		.where(inArray(mcpRetrievalBenchmarks.runId, runIds))

	const report = { serverComparison: {}, exerciseComparison: {} }

	// Overall Server Comparison
	benchmarks.forEach((b) => {
		if (!report.serverComparison[b.mcpServerName]) {
			report.serverComparison[b.mcpServerName] = { total: 0, success: 0, errors: 0, steps: 0 }
		}
		const s = report.serverComparison[b.mcpServerName]
		s.total++
		if (b.codeExecutionSuccess) s.success++
		s.errors += b.errorCount
		s.steps += b.totalSteps
	})
	for (const server in report.serverComparison) {
		const s = report.serverComparison[server]
		s.successRate = s.total > 0 ? s.success / s.total : 0
		s.avgErrors = s.total > 0 ? s.errors / s.total : 0
		s.avgSteps = s.total > 0 ? s.steps / s.total : 0
	}

	// Per-Exercise Comparison (simplified)
	// This requires joining with tasks and exercises tables to get exercise names.
	// For brevity, this part is conceptual. You'd fetch task details, group by exerciseId,
	// then aggregate results for each server within each exercise.

	return report
}
```

This plan provides a solid foundation. Remember to adjust paths and specific logic to fit your existing Roo Code structure.
