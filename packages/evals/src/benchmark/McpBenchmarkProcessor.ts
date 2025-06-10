import { Span, SpanProcessor, ReadableSpan } from "@opentelemetry/sdk-trace-base"
import { SpanKind, Context } from "@opentelemetry/api"
import { type DatabaseOrTransaction as Database } from "../db/db.js" // Actual DB client type
import { mcpRetrievalBenchmarks, mcpRetrievalCalls, tasks, runs } from "../db/schema.js"
import { eq } from "drizzle-orm"
import { EvalObserverIntegration } from "./EvalObserverIntegration.js"
import {
	SpanObservationData,
	TaskContext,
	PerformanceMetrics,
	SystemHealth,
	TrendData,
} from "./RealtimeEvalObserver.js"

export class McpBenchmarkProcessor implements SpanProcessor {
	private activeTaskBenchmarks = new Map<number, number>() // taskId -> benchmarkId
	private stepCounts = new Map<number, number>() // taskId -> currentStep
	private taskIdMapping = new Map<string, number>() // rooTaskId (string) -> dbTaskId (number)
	private taskContexts = new Map<number, TaskContext>() // taskId -> context
	private spanHistory = new Map<number, ReadableSpan[]>() // taskId -> recent spans
	private aiIntegration?: EvalObserverIntegration

	constructor(
		private db: Database,
		aiIntegration?: EvalObserverIntegration,
	) {
		this.aiIntegration = aiIntegration
	}

	async onEnd(span: ReadableSpan): Promise<void> {
		// Only process client spans for MCP services we care about
		if (span.kind !== SpanKind.CLIENT || span.attributes["rpc.system"] !== "mcp") return
		const serverName = span.attributes["rpc.service"] as string
		// Ensure we only capture spans from specified MCP servers (e.g., exa, firecrawl)
		// This list can be made configurable if needed
		if (!["exa", "firecrawl"].includes(serverName)) return

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

		// Store span in history for AI analysis (keep last 50 spans per task)
		if (!this.spanHistory.has(taskId)) {
			this.spanHistory.set(taskId, [])
		}
		const history = this.spanHistory.get(taskId)!
		history.push(span)
		if (history.length > 50) {
			history.shift() // Remove oldest span
		}

		try {
			// Original database insertion
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

			// AI Observer Integration - process span if enabled
			if (this.aiIntegration?.isEnabled()) {
				await this.processSpanWithAI(span, taskId, serverName, stepCount, responseSize)
			}
		} catch (error) {
			console.error("McpBenchmarkProcessor: Failed to insert mcpRetrievalCall", error)
		}
	}

	registerTaskIdMapping(rooTaskId: string, dbTaskId: number): void {
		this.taskIdMapping.set(rooTaskId, dbTaskId)
	}

	/**
	 * Set task context for AI observation
	 */
	setTaskContext(taskId: number, runId: number, mcpServer: string, userIntent: string): void {
		const context: TaskContext = {
			taskId,
			runId,
			mcpServer,
			userIntent,
			startTime: new Date(),
			currentStep: 0,
			totalSteps: 0,
		}
		this.taskContexts.set(taskId, context)

		// Update AI observer if enabled
		if (this.aiIntegration?.isEnabled()) {
			this.aiIntegration.getObserver().updateTaskContext(taskId, context)
		}
	}

	/**
	 * Get AI integration instance
	 */
	getAIIntegration(): EvalObserverIntegration | undefined {
		return this.aiIntegration
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

					// Set task context for AI observation
					this.setTaskContext(taskId, runId, mcpServerName, userIntent)
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

			// Process final AI insights if enabled
			if (this.aiIntegration?.isEnabled()) {
				const taskContext = this.taskContexts.get(taskId)
				if (taskContext) {
					await this.aiIntegration.processInsights(taskId, taskContext.runId)
				}
			}
		} catch (error) {
			console.error("McpBenchmarkProcessor: Failed to finish task benchmark", error)
		}

		// Cleanup
		this.activeTaskBenchmarks.delete(taskId)
		this.stepCounts.delete(taskId)
		this.taskContexts.delete(taskId)
		this.spanHistory.delete(taskId)
	}

	// Private methods for AI integration

	/**
	 * Process span with AI observer (private method)
	 */
	private async processSpanWithAI(
		span: ReadableSpan,
		taskId: number,
		serverName: string,
		stepCount: number,
		responseSize: number,
	): Promise<void> {
		try {
			const taskContext = this.taskContexts.get(taskId)
			if (!taskContext) {
				console.warn(`McpBenchmarkProcessor: No task context found for taskId: ${taskId}`)
				return
			}

			// Update context with current step
			taskContext.currentStep = stepCount
			taskContext.totalSteps = Math.max(taskContext.totalSteps, stepCount)

			// Calculate performance metrics
			const duration = span.endTimeHrTime[0] * 1000 + span.endTimeHrTime[1] / 1_000_000 // Convert to milliseconds
			const performanceMetrics: PerformanceMetrics = {
				duration,
				responseSize,
				errorCount: span.status.code === 2 ? 1 : 0, // SpanStatusCode.ERROR = 2
				stepLatency: duration,
				resourceUsage: {
					memory: 0, // TODO: Extract from system metrics
					cpu: 0, // TODO: Extract from system metrics
					network: responseSize,
				},
			}

			// Generate trend data from recent spans
			const recentTrends = this.calculateTrends(taskId)

			// Get system health (mock for now)
			const systemHealth: SystemHealth = {
				cpuUsage: 0,
				memoryUsage: 0,
				networkLatency: duration,
				storageIO: 0,
				containerHealth: [],
			}

			// Prepare observation data
			const observationData: SpanObservationData = {
				span,
				taskContext,
				performanceMetrics,
				recentTrends,
				systemHealth,
			}

			// Process with AI observer
			const result = await this.aiIntegration!.getObserver().processSpan(observationData)

			// Handle AI insights
			if (
				result.insights.length > 0 ||
				result.anomalies.length > 0 ||
				result.steeringRecommendations.length > 0
			) {
				// Process insights through integration
				await this.aiIntegration!.processInsights(taskId, taskContext.runId)
			}
		} catch (error) {
			console.error("McpBenchmarkProcessor: AI processing failed:", error)
			// Don't let AI processing failures break the main benchmark processor
		}
	}

	/**
	 * Calculate performance trends from recent spans
	 */
	private calculateTrends(taskId: number): TrendData[] {
		const history = this.spanHistory.get(taskId) || []
		if (history.length < 2) return []

		const trends: TrendData[] = []

		// Calculate duration trend
		const durations = history.slice(-10).map((span) => {
			const duration = span.endTimeHrTime[0] * 1000 + span.endTimeHrTime[1] / 1_000_000
			return duration
		})

		if (durations.length >= 2) {
			const recent = durations.slice(-3).reduce((a, b) => a + b, 0) / 3
			const earlier = durations.slice(0, -3).reduce((a, b) => a + b, 0) / (durations.length - 3)

			trends.push({
				metric: "duration",
				value: recent,
				timestamp: new Date(),
				direction: recent > earlier * 1.1 ? "increasing" : recent < earlier * 0.9 ? "decreasing" : "stable",
			})
		}

		return trends
	}

	// Required SpanProcessor methods
	onStart(_span: Span, _parentContext: Context): void {}

	async shutdown(): Promise<void> {
		// Shutdown AI integration if present
		if (this.aiIntegration) {
			await this.aiIntegration.shutdown()
		}
		return Promise.resolve()
	}

	forceFlush(): Promise<void> {
		return Promise.resolve()
	}
}
