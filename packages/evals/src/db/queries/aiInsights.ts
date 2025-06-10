import { desc, eq, and, gte, lte, sql } from "drizzle-orm"
import { RecordNotFoundError, RecordNotCreatedError } from "./errors.js"
import { aiInsights, aiSteeringRecommendations, aiAnomalies, aiObserverSessions } from "../schema.js"
import { client as db } from "../db.js"

// AI Insights queries

export interface InsertAIInsight {
	runId: number
	taskId?: number
	category: string
	title: string
	description: string
	confidence: number
	severity: string
	evidence: string[]
	recommendations: string[]
	contextSnapshot?: any
}

export const createAIInsight = async (data: InsertAIInsight) => {
	const records = await db
		.insert(aiInsights)
		.values({
			...data,
			detectedAt: new Date(),
		})
		.returning()

	const record = records[0]
	if (!record) {
		throw new RecordNotCreatedError()
	}

	return record
}

export const getAIInsights = async (runId: number, taskId?: number) => {
	const whereCondition = taskId
		? and(eq(aiInsights.runId, runId), eq(aiInsights.taskId, taskId))
		: eq(aiInsights.runId, runId)

	return db.query.aiInsights.findMany({
		where: whereCondition,
		orderBy: desc(aiInsights.detectedAt),
	})
}

export const acknowledgeAIInsight = async (insightId: number, actionTaken?: string) => {
	const records = await db
		.update(aiInsights)
		.set({
			acknowledgedAt: new Date(),
			actionTaken,
		})
		.where(eq(aiInsights.id, insightId))
		.returning()

	const record = records[0]
	if (!record) {
		throw new RecordNotFoundError()
	}

	return record
}

// AI Steering Recommendations queries

export interface InsertAISteeringRecommendation {
	runId: number
	taskId?: number
	type: string
	priority: string
	description: string
	expectedImpact: string
	confidence: number
	parameters?: any
}

export const createAISteeringRecommendation = async (data: InsertAISteeringRecommendation) => {
	const records = await db
		.insert(aiSteeringRecommendations)
		.values({
			...data,
			status: "pending",
			createdAt: new Date(),
		})
		.returning()

	const record = records[0]
	if (!record) {
		throw new RecordNotCreatedError()
	}

	return record
}

export const getAISteeringRecommendations = async (runId: number, status?: string) => {
	const whereCondition = status
		? and(eq(aiSteeringRecommendations.runId, runId), eq(aiSteeringRecommendations.status, status))
		: eq(aiSteeringRecommendations.runId, runId)

	return db.query.aiSteeringRecommendations.findMany({
		where: whereCondition,
		orderBy: desc(aiSteeringRecommendations.createdAt),
	})
}

export const applyAISteeringRecommendation = async (
	recommendationId: number,
	appliedBy: "human" | "auto",
	outcome?: string,
) => {
	const records = await db
		.update(aiSteeringRecommendations)
		.set({
			status: "applied",
			appliedAt: new Date(),
			appliedBy,
			outcome,
		})
		.where(eq(aiSteeringRecommendations.id, recommendationId))
		.returning()

	const record = records[0]
	if (!record) {
		throw new RecordNotFoundError()
	}

	return record
}

export const ignoreAISteeringRecommendation = async (recommendationId: number, reason?: string) => {
	const records = await db
		.update(aiSteeringRecommendations)
		.set({
			status: "ignored",
			outcome: reason,
		})
		.where(eq(aiSteeringRecommendations.id, recommendationId))
		.returning()

	const record = records[0]
	if (!record) {
		throw new RecordNotFoundError()
	}

	return record
}

// AI Anomalies queries

export interface InsertAIAnomaly {
	runId: number
	taskId?: number
	type: string
	severity: string
	description: string
	confidence: number
	detectedValue?: number
	expectedValue?: number
	threshold?: number
	context?: any
	suggestedAction?: string
}

export const createAIAnomaly = async (data: InsertAIAnomaly) => {
	const records = await db
		.insert(aiAnomalies)
		.values({
			...data,
			resolved: false,
			detectedAt: new Date(),
		})
		.returning()

	const record = records[0]
	if (!record) {
		throw new RecordNotCreatedError()
	}

	return record
}

export const getAIAnomalies = async (runId: number, resolved?: boolean) => {
	const whereCondition =
		resolved !== undefined
			? and(eq(aiAnomalies.runId, runId), eq(aiAnomalies.resolved, resolved))
			: eq(aiAnomalies.runId, runId)

	return db.query.aiAnomalies.findMany({
		where: whereCondition,
		orderBy: desc(aiAnomalies.detectedAt),
	})
}

export const resolveAIAnomaly = async (anomalyId: number, resolutionNote?: string) => {
	const records = await db
		.update(aiAnomalies)
		.set({
			resolved: true,
			resolvedAt: new Date(),
			resolutionNote,
		})
		.where(eq(aiAnomalies.id, anomalyId))
		.returning()

	const record = records[0]
	if (!record) {
		throw new RecordNotFoundError()
	}

	return record
}

// AI Observer Sessions queries

export interface InsertAIObserverSession {
	runId: number
	observerLevel: string
	steeringMode?: string
	insightsConfig?: string
	configuration?: any
}

export const createAIObserverSession = async (data: InsertAIObserverSession) => {
	const records = await db
		.insert(aiObserverSessions)
		.values({
			...data,
			status: "active",
			totalInsights: 0,
			totalAnomalies: 0,
			totalRecommendations: 0,
			startedAt: new Date(),
		})
		.returning()

	const record = records[0]
	if (!record) {
		throw new RecordNotCreatedError()
	}

	return record
}

export const updateAIObserverSessionStats = async (
	sessionId: number,
	stats: {
		totalInsights?: number
		totalAnomalies?: number
		totalRecommendations?: number
		averageConfidence?: number
	},
) => {
	const records = await db
		.update(aiObserverSessions)
		.set(stats)
		.where(eq(aiObserverSessions.id, sessionId))
		.returning()

	const record = records[0]
	if (!record) {
		throw new RecordNotFoundError()
	}

	return record
}

export const finishAIObserverSession = async (sessionId: number, status: "completed" | "failed") => {
	const records = await db
		.update(aiObserverSessions)
		.set({
			status,
			endedAt: new Date(),
		})
		.where(eq(aiObserverSessions.id, sessionId))
		.returning()

	const record = records[0]
	if (!record) {
		throw new RecordNotFoundError()
	}

	return record
}

export const getAIObserverSession = async (runId: number) => {
	return db.query.aiObserverSessions.findFirst({
		where: eq(aiObserverSessions.runId, runId),
		orderBy: desc(aiObserverSessions.startedAt),
	})
}

// Analytics queries

export const getAIInsightsSummary = async (runId: number) => {
	const [stats] = await db
		.select({
			totalInsights: sql<number>`count(*)`,
			avgConfidence: sql<number>`avg(${aiInsights.confidence})`,
			criticalInsights: sql<number>`sum(case when ${aiInsights.severity} = 'critical' then 1 else 0 end)`,
			warningInsights: sql<number>`sum(case when ${aiInsights.severity} = 'warning' then 1 else 0 end)`,
			infoInsights: sql<number>`sum(case when ${aiInsights.severity} = 'info' then 1 else 0 end)`,
		})
		.from(aiInsights)
		.where(eq(aiInsights.runId, runId))

	return {
		totalInsights: Number(stats?.totalInsights || 0),
		avgConfidence: Number(stats?.avgConfidence || 0),
		criticalInsights: Number(stats?.criticalInsights || 0),
		warningInsights: Number(stats?.warningInsights || 0),
		infoInsights: Number(stats?.infoInsights || 0),
	}
}

export const getAIAnomaliesByType = async (runId: number) => {
	return db
		.select({
			type: aiAnomalies.type,
			count: sql<number>`count(*)`,
			avgSeverity: sql<number>`avg(case 
				when ${aiAnomalies.severity} = 'critical' then 4
				when ${aiAnomalies.severity} = 'high' then 3
				when ${aiAnomalies.severity} = 'medium' then 2
				else 1 end)`,
		})
		.from(aiAnomalies)
		.where(eq(aiAnomalies.runId, runId))
		.groupBy(aiAnomalies.type)
}

export const getAIRecommendationEffectiveness = async (runId: number) => {
	const [stats] = await db
		.select({
			totalRecommendations: sql<number>`count(*)`,
			appliedRecommendations: sql<number>`sum(case when ${aiSteeringRecommendations.status} = 'applied' then 1 else 0 end)`,
			ignoredRecommendations: sql<number>`sum(case when ${aiSteeringRecommendations.status} = 'ignored' then 1 else 0 end)`,
			pendingRecommendations: sql<number>`sum(case when ${aiSteeringRecommendations.status} = 'pending' then 1 else 0 end)`,
			avgConfidence: sql<number>`avg(${aiSteeringRecommendations.confidence})`,
		})
		.from(aiSteeringRecommendations)
		.where(eq(aiSteeringRecommendations.runId, runId))

	return {
		totalRecommendations: Number(stats?.totalRecommendations || 0),
		appliedRecommendations: Number(stats?.appliedRecommendations || 0),
		ignoredRecommendations: Number(stats?.ignoredRecommendations || 0),
		pendingRecommendations: Number(stats?.pendingRecommendations || 0),
		avgConfidence: Number(stats?.avgConfidence || 0),
		effectivenessRate: stats?.totalRecommendations
			? Number(stats.appliedRecommendations) / Number(stats.totalRecommendations)
			: 0,
	}
}
