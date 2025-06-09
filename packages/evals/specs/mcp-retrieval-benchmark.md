# MCP Retrieval Benchmark Specification

## Overview

This specification describes the end-state architecture for evaluating the effectiveness of different retrieval strategies (MCP servers like Exa and Firecrawl) in the Roo Code agent. The benchmark will measure how effectively different retrieval methods impact generated code quality, focusing on measuring essential workflow metrics and execution success.

## Core Objectives

1. Compare different retrieval methods (e.g., Exa vs. Firecrawl vs. others) on their impact on:

    - Time-to-completion
    - Generated code quality
    - Error rates in generated code

2. Provide actionable insights on:
    - When to use which retrieval method
    - Optimal timing for making retrieval calls
    - How to formulate effective retrieval queries

## End-State Architecture

### 1. Database Schema Extensions

#### New Tables

**`mcpRetrievalBenchmarks`**

```typescript
export const mcpRetrievalBenchmarks = pgTable("mcpRetrievalBenchmarks", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	runId: integer("run_id")
		.references(() => runs.id)
		.notNull(),
	taskId: integer("task_id")
		.references(() => tasks.id)
		.notNull(),
	userIntent: text().notNull(), // The prompt/exercise being evaluated
	totalSteps: integer().notNull(), // Total steps from start to completion
	codeExecutionSuccess: boolean(), // Whether final code runs successfully
	testsPassedCount: integer(), // Number of tests passing (if applicable)
	testsTotalCount: integer(), // Total number of tests (if applicable)
	createdAt: timestamp("created_at").notNull(),
})
```

**`mcpRetrievalCalls`**

```typescript
export const mcpRetrievalCalls = pgTable("mcpRetrievalCalls", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	benchmarkId: integer("benchmark_id")
		.references(() => mcpRetrievalBenchmarks.id)
		.notNull(),
	mcpServerName: text().notNull(), // e.g., "exa", "firecrawl"
	stepNumber: integer().notNull(), // Which step in the process this call occurred
	callTimestamp: timestamp("call_timestamp").notNull(),
	request: jsonb("request").notNull(), // The query sent to the MCP server
	response: jsonb("response").notNull(), // The response received
	responseSize: integer().notNull(), // Size of response in bytes
	nextActionAfterCall: text(), // The action agent took after receiving response
	stepsToCompletion: integer(), // Steps from this call to task completion
	createdAt: timestamp("created_at").notNull(),
})
```

**`codeQualityMetrics`**

```typescript
// Code quality metrics are simplified and incorporated directly in the benchmark table
// No separate table needed for the simplified metrics approach
```

#### Type Definitions

```typescript
export type McpRetrievalBenchmark = typeof mcpRetrievalBenchmarks.$inferSelect
export type InsertMcpRetrievalBenchmark = Omit<typeof mcpRetrievalBenchmarks.$inferInsert, "id" | "createdAt">

export type McpRetrievalCall = typeof mcpRetrievalCalls.$inferSelect
export type InsertMcpRetrievalCall = Omit<typeof mcpRetrievalCalls.$inferInsert, "id" | "createdAt">
```

### 2. Tracing System

The end state will include an enhanced tracing system that intercepts and records MCP retrieval calls. This will build on the existing `McpTraceManager` to capture timing and context around retrieval operations.

```typescript
export class McpBenchmarkTracer {
	// Tracks active benchmark sessions by task ID
	private activeBenchmarks = new Map<number, McpRetrievalBenchmark>()

	// Tracks steps for each benchmark
	private benchmarkSteps = new Map<number, number>()

	// Hooks into McpHub to trace calls
	constructor(
		private mcpHub: McpHub,
		private db: Database,
	) {
		// Intercept MCP events via the event emitter
		mcpHub.on("mcp:tool:start", this.handleToolStart.bind(this))
		mcpHub.on("mcp:tool:success", this.handleToolSuccess.bind(this))
		mcpHub.on("mcp:tool:error", this.handleToolError.bind(this))
	}

	// Methods to start, update, and finish benchmarks
	startBenchmark(runId: number, taskId: number, userIntent: string): Promise<McpRetrievalBenchmark>
	incrementSteps(taskId: number): void
	recordRetrievalCall(taskId: number, serverName: string, request: any, response: any): Promise<McpRetrievalCall>
	finishBenchmark(
		taskId: number,
		executionSuccess: boolean,
		testResults?: { passed: number; total: number },
	): Promise<void>
}
```

### 3. MCP Server Integration

The system will integrate with any MCP server by enhancing the existing McpHub with specific instrumentation for benchmarking:

```typescript
// Enhanced version of McpHub.callTool with benchmark instrumentation
async callTool(
  serverName: string,
  toolName: string,
  toolArguments?: Record<string, unknown>,
  source: "global" | "project" = "global",
  taskId?: number // New parameter to associate with benchmark
): Promise<unknown> {
  // Original timing metrics
  const startTime = Date.now();

  // Record step number if benchmarking
  if (taskId && this.benchmarkTracer && ["exa", "firecrawl", "context7"].includes(serverName)) {
    await this.benchmarkTracer.preCallHook(taskId, serverName, toolName, toolArguments);
  }

  try {
    // Original tool call logic
    const result = await this._callTool(serverName, toolName, toolArguments, source);

    // Benchmarking post-call success
    if (taskId && this.benchmarkTracer && ["exa", "firecrawl", "context7"].includes(serverName)) {
      const duration = Date.now() - startTime;
      const responseSize = JSON.stringify(result).length;

      await this.benchmarkTracer.postCallSuccessHook(
        taskId,
        serverName,
        toolName,
        toolArguments,
        result,
        duration,
        responseSize
      );
    }

    return result;
  } catch (error) {
    // Benchmarking post-call error
    if (taskId && this.benchmarkTracer && ["exa", "firecrawl", "context7"].includes(serverName)) {
      const duration = Date.now() - startTime;
      await this.benchmarkTracer.postCallErrorHook(
        taskId,
        serverName,
        toolName,
        toolArguments,
        error,
        duration
      );
    }

    throw error;
  }
}
```

### 4. Evaluation Runner Extensions

The evaluation runner will be extended to support MCP retrieval benchmarking:

```typescript
// Enhanced version of runExercise to include MCP benchmarking
const runExercise = async ({
	run,
	task,
	server,
	benchmarkMcp = true, // New parameter to enable MCP benchmarking
}: {
	run: Run
	task: Task
	server: IpcServer
	benchmarkMcp?: boolean
}): TaskPromise => {
	// Original task setup

	// Start MCP benchmark if enabled
	if (benchmarkMcp) {
		const prompt = fs.readFileSync(path.resolve(exercisesPath, `prompts/${language}.md`), "utf-8")
		await mcpBenchmarkTracer.startBenchmark(run.id, task.id, prompt)

		// Setup step counter
		server.on("message", (message) => {
			// Only increment for certain message types that indicate agent steps
			if (message.type === IpcMessageType.TaskEvent) {
				mcpBenchmarkTracer.incrementSteps(task.id)
			}
		})
	}

	// Original task execution

	// Capture code quality at the end
	if (benchmarkMcp) {
		const codeQuality = await assessCodeQuality(workspacePath)
		await mcpBenchmarkTracer.finishBenchmark(task.id, codeQuality)
	}
}
```

### 5. Code Quality Assessment

The end state will include tools to evaluate generated code quality:

```typescript
// Function to assess simplified code quality metrics
async function assessCodeQuality(
	workspacePath: string,
): Promise<{ executionSuccess: boolean; testResults?: { passed: number; total: number } }> {
	// Check if code runs successfully
	const executionSuccess = await testCodeExecution(workspacePath)

	// Run unit tests if available
	const testResults = await runUnitTests(workspacePath)

	return {
		executionSuccess,
		testResults: testResults
			? {
					passed: testResults.passed,
					total: testResults.passed + testResults.failed,
				}
			: undefined,
	}
}
```

### 6. CLI Interface Extensions

The command-line interface will be extended to support MCP benchmarking:

```typescript
const main = async () => {
	const result = await run(
		command({
			name: "cli",
			description: "Execute evaluation runs for Roo Code.",
			version: "0.0.0",
			args: {
				// Original args
				runId: option({
					type: number,
					long: "run-id",
					short: "r",
					description: "Existing run ID to execute",
				}),
				// New args for MCP benchmarking
				mcpBenchmark: option({
					type: boolean,
					long: "mcp-benchmark",
					short: "b",
					description: "Enable MCP retrieval benchmarking",
				}),
				mcpServers: option({
					type: string,
					long: "mcp-servers",
					short: "s",
					description: "Comma-separated list of MCP servers to benchmark",
				}),
				handler: async (args) => {
					// Update task runner to include MCP benchmarking options
				},
			},
		}),
	)
}
```

### 7. Result Analysis & Visualization

The end state will include tools to analyze and visualize benchmark results:

```typescript
// Functions to analyze benchmark results
async function analyzeBenchmarkResults(runId: number): Promise<BenchmarkSummary> {
	// Query all benchmark data for the run
	const benchmarks = await db.query.mcpRetrievalBenchmarks.findMany({
		where: (b, { eq }) => eq(b.runId, runId),
		with: {
			calls: true,
			codeQuality: true,
		},
	})

	// Calculate key metrics
	return {
		totalBenchmarks: benchmarks.length,
		averageStepsBeforeRetrieval: calculateAverage(benchmarks.map((b) => b.stepsBeforeRetrieval)),
		averageStepsToCompletion: calculateAverage(benchmarks.map((b) => b.totalSteps)),
		successRate: calculateSuccessRate(benchmarks),
		serverPerformance: calculateServerPerformance(benchmarks),
		correlationMetrics: calculateCorrelations(benchmarks),
	}
}

// Generate simple visualizations
function generateBenchmarkVisualizations(summary: BenchmarkSummary): ReportData {
	// Generate success rate charts by MCP server
	// Create timing analysis graphs
	// Show step counts before/after retrieval
}
```

## Data Collection Points

The end-state architecture will capture the following data points for each MCP retrieval call:

1. **User Intent Context**

    - The prompt/exercise being worked on
    - Current step in the agent's workflow

2. **Pre-Retrieval State**

    - Number of steps taken before retrieval

3. **Retrieval Call Details**

    - Target MCP server name
    - Query/request contents
    - Timestamp of call

4. **Post-Retrieval Impact**

    - Response content and size
    - Agent's next action after retrieval
    - Number of steps to task completion

5. **Code Quality Assessment**
    - Execution success (does the code run?)
    - Test pass/fail metrics (when applicable)

## Reporting & Analysis

The end-state architecture will include focused reporting capabilities:

1. **Per-Run Reports**

    - Summary of all benchmarks in a run
    - Comparative analysis between different MCP servers
    - Success rate by retrieval strategy

2. **Timing Analysis**

    - Relationship between step number when retrieval occurs and success rate
    - Steps-to-completion after retrieval by server type
    - Impact of retrieval timing on execution success

3. **Server Comparison**
    - Success rates by MCP server type
    - Query characteristics by server type
    - Best-performing server by task type

## Implementation Considerations

While not providing an implementation plan, the following aspects will need to be addressed in the final solution:

1. **Non-Intrusive Instrumentation**

    - The benchmark system should not affect agent performance
    - Tracing should happen in parallel to normal operation

2. **Simplified Configuration**

    - Straightforward options to enable/disable MCP benchmarking
    - Command-line parameters to select which MCP servers to benchmark

3. **Focused Analysis**
    - Clear visualization of success rates by server
    - Comparison of timing metrics between servers
4. **Performance Considerations**
    - Storage of potentially large response payloads
    - Balance between detail and storage efficiency

## Conclusion

This end-state architecture provides a focused framework for evaluating and comparing MCP retrieval strategies in Roo Code. The system captures essential metrics about when retrieval happens, what's retrieved, and how it impacts task completion and code execution success. This simplified approach enables clear, actionable insights into the effectiveness of different MCP servers without unnecessary complexity.
