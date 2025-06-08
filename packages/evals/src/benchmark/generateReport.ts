import { eq, inArray, and } from "drizzle-orm"
import { type DatabaseOrTransaction as Database } from "../db/db.js"
import { mcpRetrievalBenchmarks, mcpRetrievalCalls, tasks, runs } from "../db/schema.js"

export interface ServerStats {
	total: number
	success: number
	errors: number
	steps: number
	successRate: number
	avgErrors: number
	avgSteps: number
}

export interface BenchmarkReport {
	serverComparison: Record<string, ServerStats>
	exerciseComparison: Record<string, Record<string, ServerStats>>
	totalBenchmarks: number
	runIds: number[]
}

/**
 * Generate a comparison report for MCP retrieval benchmarks across multiple runs
 */
export async function generateServerComparisonReport(
	db: Database,
	runIds: number[]
): Promise<BenchmarkReport> {
	// Fetch all benchmarks for the specified runs
	const benchmarks = await db
		.select()
		.from(mcpRetrievalBenchmarks)
		.where(inArray(mcpRetrievalBenchmarks.runId, runIds))

	// Fetch related tasks to get exercise information
	const taskIds = [...new Set(benchmarks.map(b => b.taskId))]
	const tasksData = await db
		.select()
		.from(tasks)
		.where(inArray(tasks.id, taskIds))

	// Create a map of taskId to exercise name
	const taskExerciseMap = new Map<number, string>()
	tasksData.forEach(task => {
		taskExerciseMap.set(task.id, `${task.language}/${task.exercise}`)
	})

	// Initialize report structure
	const report: BenchmarkReport = {
		serverComparison: {},
		exerciseComparison: {},
		totalBenchmarks: benchmarks.length,
		runIds,
	}

	// Process benchmarks
	benchmarks.forEach((benchmark) => {
		const serverName = benchmark.mcpServerName
		const exerciseName = taskExerciseMap.get(benchmark.taskId) || "unknown"

		// Update server-level stats
		if (!report.serverComparison[serverName]) {
			report.serverComparison[serverName] = {
				total: 0,
				success: 0,
				errors: 0,
				steps: 0,
				successRate: 0,
				avgErrors: 0,
				avgSteps: 0,
			}
		}

		const serverStats = report.serverComparison[serverName]!
		serverStats.total++
		if (benchmark.codeExecutionSuccess) {
			serverStats.success++
		}
		serverStats.errors += benchmark.errorCount || 0
		serverStats.steps += benchmark.totalSteps

		// Update exercise-level stats
		if (!report.exerciseComparison[exerciseName]) {
			report.exerciseComparison[exerciseName] = {}
		}
		if (!report.exerciseComparison[exerciseName][serverName]) {
			report.exerciseComparison[exerciseName][serverName] = {
				total: 0,
				success: 0,
				errors: 0,
				steps: 0,
				successRate: 0,
				avgErrors: 0,
				avgSteps: 0,
			}
		}

		const exerciseStats = report.exerciseComparison[exerciseName]![serverName]!
		exerciseStats.total++
		if (benchmark.codeExecutionSuccess) {
			exerciseStats.success++
		}
		exerciseStats.errors += benchmark.errorCount || 0
		exerciseStats.steps += benchmark.totalSteps
	})

	// Calculate averages and rates
	for (const serverName in report.serverComparison) {
		const stats = report.serverComparison[serverName]!
		stats.successRate = stats.total > 0 ? stats.success / stats.total : 0
		stats.avgErrors = stats.total > 0 ? stats.errors / stats.total : 0
		stats.avgSteps = stats.total > 0 ? stats.steps / stats.total : 0
	}

	for (const exerciseName in report.exerciseComparison) {
		const exerciseServers = report.exerciseComparison[exerciseName]!
		for (const serverName in exerciseServers) {
			const stats = exerciseServers[serverName]!
			stats.successRate = stats.total > 0 ? stats.success / stats.total : 0
			stats.avgErrors = stats.total > 0 ? stats.errors / stats.total : 0
			stats.avgSteps = stats.total > 0 ? stats.steps / stats.total : 0
		}
	}

	return report
}

/**
 * Print a formatted report to console
 */
export function printBenchmarkReport(report: BenchmarkReport): void {
	console.log("\n=== MCP Retrieval Benchmark Report ===")
	console.log(`Total benchmarks analyzed: ${report.totalBenchmarks}`)
	console.log(`Run IDs: ${report.runIds.join(", ")}`)

	console.log("\n--- Overall Server Comparison ---")
	console.log("Server Name | Success Rate | Avg Steps | Avg Errors")
	console.log("------------|-------------|-----------|------------")
	
	for (const [serverName, stats] of Object.entries(report.serverComparison)) {
		console.log(
			`${serverName.padEnd(11)} | ${(stats.successRate * 100).toFixed(1)}%`.padEnd(12) +
			` | ${stats.avgSteps.toFixed(1).padEnd(9)} | ${stats.avgErrors.toFixed(1)}`
		)
	}

	console.log("\n--- Per-Exercise Breakdown ---")
	for (const [exerciseName, servers] of Object.entries(report.exerciseComparison)) {
		console.log(`\n${exerciseName}:`)
		for (const [serverName, stats] of Object.entries(servers)) {
			console.log(
				`  ${serverName}: ${(stats.successRate * 100).toFixed(1)}% success, ` +
				`${stats.avgSteps.toFixed(1)} steps, ${stats.avgErrors.toFixed(1)} errors`
			)
		}
	}
}

/**
 * Export report as JSON
 */
export function exportReportAsJson(report: BenchmarkReport, filename: string): void {
	const fs = require("fs")
	fs.writeFileSync(filename, JSON.stringify(report, null, 2))
	console.log(`Report exported to ${filename}`)
}