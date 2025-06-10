import { pgTable, text, timestamp, integer, real, boolean, jsonb, uniqueIndex, serial } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

import type { RooCodeSettings, ToolName, ToolUsage } from "@roo-code/types"

import type { ExerciseLanguage } from "../exercises/index.js"

/**
 * runs
 */

export const runs = pgTable("runs", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	taskMetricsId: integer("task_metrics_id").references(() => taskMetrics.id),
	model: text().notNull(),
	mcpServer: text("mcp_server"),
	description: text(),
	settings: jsonb().$type<RooCodeSettings>(),
	pid: integer(),
	socketPath: text("socket_path").notNull(),
	concurrency: integer().default(2).notNull(),
	passed: integer().default(0).notNull(),
	failed: integer().default(0).notNull(),
	createdAt: timestamp("created_at").notNull(),
})

export const runsRelations = relations(runs, ({ one }) => ({
	taskMetrics: one(taskMetrics, { fields: [runs.taskMetricsId], references: [taskMetrics.id] }),
}))

export type Run = typeof runs.$inferSelect

export type InsertRun = Omit<typeof runs.$inferInsert, "id" | "createdAt">

export type UpdateRun = Partial<Omit<Run, "id" | "createdAt">>

/**
 * tasks
 */

export const tasks = pgTable(
	"tasks",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		runId: integer("run_id")
			.references(() => runs.id)
			.notNull(),
		taskMetricsId: integer("task_metrics_id").references(() => taskMetrics.id),
		language: text().notNull().$type<ExerciseLanguage>(),
		exercise: text().notNull(),
		passed: boolean(),
		startedAt: timestamp("started_at"),
		finishedAt: timestamp("finished_at"),
		createdAt: timestamp("created_at").notNull(),
	},
	(table) => [uniqueIndex("tasks_language_exercise_idx").on(table.runId, table.language, table.exercise)],
)

export const tasksRelations = relations(tasks, ({ one }) => ({
	run: one(runs, { fields: [tasks.runId], references: [runs.id] }),
	taskMetrics: one(taskMetrics, { fields: [tasks.taskMetricsId], references: [taskMetrics.id] }),
}))

export type Task = typeof tasks.$inferSelect

export type InsertTask = Omit<typeof tasks.$inferInsert, "id" | "createdAt">

export type UpdateTask = Partial<Omit<Task, "id" | "createdAt">>

/**
 * taskMetrics
 */

export const taskMetrics = pgTable("taskMetrics", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	tokensIn: integer("tokens_in").notNull(),
	tokensOut: integer("tokens_out").notNull(),
	tokensContext: integer("tokens_context").notNull(),
	cacheWrites: integer("cache_writes").notNull(),
	cacheReads: integer("cache_reads").notNull(),
	cost: real().notNull(),
	duration: integer().notNull(),
	toolUsage: jsonb("tool_usage").$type<ToolUsage>(),
	createdAt: timestamp("created_at").notNull(),
})

export type TaskMetrics = typeof taskMetrics.$inferSelect

export type InsertTaskMetrics = Omit<typeof taskMetrics.$inferInsert, "id" | "createdAt">

export type UpdateTaskMetrics = Partial<Omit<TaskMetrics, "id" | "createdAt">>

/**
 * toolErrors
 */

export const toolErrors = pgTable("toolErrors", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	runId: integer("run_id").references(() => runs.id),
	taskId: integer("task_id").references(() => tasks.id),
	toolName: text("tool_name").notNull().$type<ToolName>(),
	error: text().notNull(),
	createdAt: timestamp("created_at").notNull(),
})

export const toolErrorsRelations = relations(toolErrors, ({ one }) => ({
	run: one(runs, { fields: [toolErrors.runId], references: [runs.id] }),
	task: one(tasks, { fields: [toolErrors.taskId], references: [tasks.id] }),
}))

export type ToolError = typeof toolErrors.$inferSelect

export type InsertToolError = Omit<typeof toolErrors.$inferInsert, "id" | "createdAt">

export type UpdateToolError = Partial<Omit<ToolError, "id" | "createdAt">>

/**
 * schema
 */

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
	duration: integer("duration_ms"),
	errorMessage: text("error_message"),
	source: text("source"), // 'global' or 'project'
	timeout: integer("timeout_ms"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
})

/**
 * MCP connection events
 */
export const mcpConnectionEvents = pgTable("mcp_connection_events", {
	id: serial("id").primaryKey(),
	runId: integer("run_id")
		.references(() => runs.id)
		.notNull(),
	taskId: integer("task_id").references(() => tasks.id),
	serverName: text("server_name").notNull(),
	eventType: text("event_type").notNull(), // 'start', 'established', 'error'
	source: text("source"), // 'global' or 'project'
	transport: text("transport"), // transport type used
	duration: integer("duration_ms"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
})

/**
 * MCP resource access events
 */
export const mcpResourceEvents = pgTable("mcp_resource_events", {
	id: serial("id").primaryKey(),
	runId: integer("run_id")
		.references(() => runs.id)
		.notNull(),
	taskId: integer("task_id").references(() => tasks.id),
	serverName: text("server_name").notNull(),
	uri: text("uri").notNull(),
	eventType: text("event_type").notNull(), // 'start', 'success', 'error'
	source: text("source"), // 'global' or 'project'
	duration: integer("duration_ms"),
	responseSize: integer("response_size"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
})

/**
 * AI-generated insights table
 */
export const aiInsights = pgTable("ai_insights", {
	id: serial("id").primaryKey(),
	runId: integer("run_id")
		.references(() => runs.id)
		.notNull(),
	taskId: integer("task_id").references(() => tasks.id),
	category: text("category").notNull(), // 'performance', 'quality', 'efficiency', 'reliability'
	title: text("title").notNull(),
	description: text("description").notNull(),
	confidence: real("confidence").notNull(), // 0.0 to 1.0
	severity: text("severity").notNull(), // 'info', 'warning', 'error', 'critical'
	evidence: jsonb("evidence").$type<string[]>().notNull(),
	recommendations: jsonb("recommendations").$type<string[]>().notNull(),
	contextSnapshot: jsonb("context_snapshot"),
	detectedAt: timestamp("detected_at").notNull().defaultNow(),
	acknowledgedAt: timestamp("acknowledged_at"),
	actionTaken: text("action_taken"),
})

/**
 * AI steering recommendations table
 */
export const aiSteeringRecommendations = pgTable("ai_steering_recommendations", {
	id: serial("id").primaryKey(),
	runId: integer("run_id")
		.references(() => runs.id)
		.notNull(),
	taskId: integer("task_id").references(() => tasks.id),
	type: text("type").notNull(), // 'pause_task', 'adjust_concurrency', 'switch_server', etc.
	priority: text("priority").notNull(), // 'low', 'medium', 'high', 'critical'
	description: text("description").notNull(),
	expectedImpact: text("expected_impact").notNull(),
	confidence: real("confidence").notNull(),
	parameters: jsonb("parameters"),
	status: text("status").notNull().default("pending"), // 'pending', 'applied', 'ignored', 'failed'
	appliedAt: timestamp("applied_at"),
	appliedBy: text("applied_by"), // 'human', 'auto'
	outcome: text("outcome"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
})

/**
 * AI anomaly detections table
 */
export const aiAnomalies = pgTable("ai_anomalies", {
	id: serial("id").primaryKey(),
	runId: integer("run_id")
		.references(() => runs.id)
		.notNull(),
	taskId: integer("task_id").references(() => tasks.id),
	type: text("type").notNull(), // 'performance', 'error', 'resource', 'pattern'
	severity: text("severity").notNull(), // 'low', 'medium', 'high', 'critical'
	description: text("description").notNull(),
	confidence: real("confidence").notNull(),
	detectedValue: real("detected_value"),
	expectedValue: real("expected_value"),
	threshold: real("threshold"),
	context: jsonb("context"),
	suggestedAction: text("suggested_action"),
	resolved: boolean("resolved").default(false),
	resolvedAt: timestamp("resolved_at"),
	resolutionNote: text("resolution_note"),
	detectedAt: timestamp("detected_at").notNull().defaultNow(),
})

/**
 * AI observer sessions table
 */
export const aiObserverSessions = pgTable("ai_observer_sessions", {
	id: serial("id").primaryKey(),
	runId: integer("run_id")
		.references(() => runs.id)
		.notNull(),
	observerLevel: text("observer_level").notNull(), // 'basic', 'full', 'autonomous'
	steeringMode: text("steering_mode"), // 'monitor-only', 'suggest', 'auto'
	insightsConfig: text("insights_config"), // 'store', 'export', 'realtime'
	configuration: jsonb("configuration"),
	startedAt: timestamp("started_at").notNull().defaultNow(),
	endedAt: timestamp("ended_at"),
	status: text("status").notNull().default("active"), // 'active', 'completed', 'failed'
	totalInsights: integer("total_insights").default(0),
	totalAnomalies: integer("total_anomalies").default(0),
	totalRecommendations: integer("total_recommendations").default(0),
	averageConfidence: real("average_confidence"),
})

/**
 * Relations for AI tables
 */
export const aiInsightsRelations = relations(aiInsights, ({ one }) => ({
	run: one(runs, { fields: [aiInsights.runId], references: [runs.id] }),
	task: one(tasks, { fields: [aiInsights.taskId], references: [tasks.id] }),
}))

export const aiSteeringRecommendationsRelations = relations(aiSteeringRecommendations, ({ one }) => ({
	run: one(runs, { fields: [aiSteeringRecommendations.runId], references: [runs.id] }),
	task: one(tasks, { fields: [aiSteeringRecommendations.taskId], references: [tasks.id] }),
}))

export const aiAnomaliesRelations = relations(aiAnomalies, ({ one }) => ({
	run: one(runs, { fields: [aiAnomalies.runId], references: [runs.id] }),
	task: one(tasks, { fields: [aiAnomalies.taskId], references: [tasks.id] }),
}))

export const aiObserverSessionsRelations = relations(aiObserverSessions, ({ one }) => ({
	run: one(runs, { fields: [aiObserverSessions.runId], references: [runs.id] }),
}))

export const schema = {
	runs,
	runsRelations,
	tasks,
	tasksRelations,
	taskMetrics,
	toolErrors,
	toolErrorsRelations,
	mcpRetrievalBenchmarks,
	mcpRetrievalCalls,
	mcpConnectionEvents,
	mcpResourceEvents,
	aiInsights,
	aiInsightsRelations,
	aiSteeringRecommendations,
	aiSteeringRecommendationsRelations,
	aiAnomalies,
	aiAnomaliesRelations,
	aiObserverSessions,
	aiObserverSessionsRelations,
}
