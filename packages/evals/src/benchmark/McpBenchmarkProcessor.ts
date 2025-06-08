import { Span, SpanProcessor, ReadableSpan } from "@opentelemetry/sdk-trace-base"
import { SpanKind, Context } from "@opentelemetry/api"
import { type DatabaseOrTransaction as Database } from "../db/db.js" // Actual DB client type
import { mcpRetrievalBenchmarks, mcpRetrievalCalls } from "../db/schema.js"
import { eq } from "drizzle-orm"

export class McpBenchmarkProcessor implements SpanProcessor {
	private activeTaskBenchmarks = new Map<number, number>() // taskId -> benchmarkId
	private stepCounts = new Map<number, number>() // taskId -> currentStep
	private taskIdMapping = new Map<string, number>() // rooTaskId (string) -> dbTaskId (number)

	constructor(private db: Database) {}

	async onEnd(span: ReadableSpan): Promise<void> {
		// Only process client spans for MCP services we care about
		if (span.kind !== SpanKind.CLIENT || span.attributes["rpc.system"] !== "mcp") return
		const serverName = span.attributes["rpc.service"] as string
		// Ensure we only capture spans from specified MCP servers (e.g., exa, firecrawl, context7)
		// This list can be made configurable if needed
		if (!["exa", "firecrawl", "context7", "perplexity-ask"].includes(serverName)) return

		// Handle both string and number task IDs
		const taskIdAttr = span.attributes["mcp.task_id"]
		if (taskIdAttr === undefined) {
			// console.warn('McpBenchmarkProcessor: mcp.task_id attribute missing on span', span.name);
			return
		}

		// Convert string taskId to number if we have a mapping
		let taskId: number | undefined
		if (typeof taskIdAttr === "string") {
			taskId = this.taskIdMapping.get(taskIdAttr)
			if (taskId === undefined) {
				// console.warn(`McpBenchmarkProcessor: No mapping found for string taskId: ${taskIdAttr}`);
				return
			}
		} else if (typeof taskIdAttr === "number") {
			taskId = taskIdAttr
		} else {
			// console.warn(`McpBenchmarkProcessor: Invalid taskId type: ${typeof taskIdAttr}`);
			return
		}

		const stepCount = (this.stepCounts.get(taskId) || 0) + 1
		this.stepCounts.set(taskId, stepCount)

		const benchmarkId = this.activeTaskBenchmarks.get(taskId)
		if (benchmarkId === undefined) {
			// console.warn(`McpBenchmarkProcessor: No active benchmarkId found for taskId: ${taskId}`);
			return
		}

		const request = span.attributes["mcp.request"] ? JSON.parse(span.attributes["mcp.request"] as string) : {}
		const response = span.attributes["mcp.response"] ? JSON.parse(span.attributes["mcp.response"] as string) : {}
		const responseSize = (span.attributes["mcp.response_size_bytes"] as number) || 0

		try {
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
		} catch (error) {
			console.error("McpBenchmarkProcessor: Failed to insert mcpRetrievalCall", error)
		}
	}

	registerTaskIdMapping(rooTaskId: string, dbTaskId: number): void {
		this.taskIdMapping.set(rooTaskId, dbTaskId)
	}

	async startTaskBenchmark(taskId: number, runId: number, mcpServerName: string, userIntent: string): Promise<void> {
		try {
			const results = await this.db
				.insert(mcpRetrievalBenchmarks)
				.values({
					runId,
					taskId,
					mcpServerName,
					userIntent,
					totalSteps: 0, // Placeholder, will be updated on finish
				})
				.returning({ id: mcpRetrievalBenchmarks.id })
				.execute()

			if (results && results.length > 0) {
				const benchmarkRow = results[0]
				if (benchmarkRow) {
					this.activeTaskBenchmarks.set(taskId, benchmarkRow.id)
					this.stepCounts.set(taskId, 0)
				} else {
					console.error("McpBenchmarkProcessor: First benchmark result row was undefined")
				}
			} else {
				console.error(
					"McpBenchmarkProcessor: Failed to retrieve benchmark id after insert, no results returned",
				)
			}
		} catch (error) {
			console.error("McpBenchmarkProcessor: Failed to start task benchmark", error)
		}
	}

	async finishTaskBenchmark(taskId: number, executionSuccess: boolean, errorCount: number): Promise<void> {
		const benchmarkId = this.activeTaskBenchmarks.get(taskId)
		if (benchmarkId === undefined) {
			// console.warn(`McpBenchmarkProcessor: No active benchmarkId to finish for taskId: ${taskId}`);
			return
		}

		const totalSteps = this.stepCounts.get(taskId) || 0
		try {
			await this.db
				.update(mcpRetrievalBenchmarks)
				.set({ totalSteps, codeExecutionSuccess: executionSuccess, errorCount })
				.where(eq(mcpRetrievalBenchmarks.id, benchmarkId))
				.execute()
		} catch (error) {
			console.error("McpBenchmarkProcessor: Failed to finish task benchmark", error)
		}

		this.activeTaskBenchmarks.delete(taskId)
		this.stepCounts.delete(taskId)
	}

	// Required SpanProcessor methods
	onStart(_span: Span, _parentContext: Context): void {}
	shutdown(): Promise<void> {
		return Promise.resolve()
	}
	forceFlush(): Promise<void> {
		return Promise.resolve()
	}
}
