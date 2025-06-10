import { EventEmitter } from "events"
import {
	RealtimeEvalObserver,
	ObserverConfig,
	defaultObserverConfig,
	NullEvalObserver,
} from "./RealtimeEvalObserver.js"
import { AnalysisOrchestrator } from "../autonomous/orchestrator/AnalysisOrchestrator.js"
import { Task, Run } from "../db/schema.js"
import { client as db } from "../db/db.js"
import { eq } from "drizzle-orm"
import {
	createAIInsight,
	createAISteeringRecommendation,
	createAIAnomaly,
	createAIObserverSession,
	updateAIObserverSessionStats,
	finishAIObserverSession,
	getAIInsightsSummary,
	getAIAnomaliesByType,
	getAIRecommendationEffectiveness,
	type InsertAIInsight,
	type InsertAISteeringRecommendation,
	type InsertAIAnomaly,
	type InsertAIObserverSession,
} from "../db/index.js"

export interface EvalObserverIntegrationConfig {
	enabled: boolean
	observerConfig?: Partial<ObserverConfig>
	orchestratorConfig?: {
		enableAutonomousAnalysis: boolean
		enableSteeringRecommendations: boolean
		enableContinuousLearning: boolean
		dataExportInterval: number // minutes
	}
	persistenceConfig?: {
		enableInsightStorage: boolean
		enableRecommendationTracking: boolean
		batchInsertSize: number
	}
}

export interface SteeringAction {
	id: string
	type: "pause_task" | "resume_task" | "adjust_concurrency" | "switch_server" | "terminate_task"
	taskId?: number
	runId?: number
	parameters: Record<string, any>
	requestedAt: Date
	status: "pending" | "applied" | "failed" | "ignored"
	result?: string
}

export interface InsightRecord {
	id: string
	runId: number
	taskId?: number
	category: string
	title: string
	description: string
	confidence: number
	severity: string
	evidence: string[]
	recommendations: string[]
	detectedAt: Date
	contextSnapshot: any
}

/**
 * Integration adapter that bridges the AI observer system with the existing
 * MCP evaluation CLI infrastructure. Provides optional AI-native capabilities
 * while maintaining full backward compatibility.
 */
export class EvalObserverIntegration extends EventEmitter {
	private config: EvalObserverIntegrationConfig
	private observer: RealtimeEvalObserver
	private orchestrator?: AnalysisOrchestrator
	private activeInsights: Map<number, InsightRecord[]> = new Map() // taskId -> insights
	private pendingActions: Map<string, SteeringAction> = new Map()
	private isInitialized = false
	private sessionId?: number
	private currentRunId?: number

	constructor(config: EvalObserverIntegrationConfig) {
		super()
		this.config = config

		if (config.enabled) {
			// Initialize with actual observer implementation when available
			// For now, we'll use a sophisticated null implementation
			this.observer = new NullEvalObserver()
		} else {
			this.observer = new NullEvalObserver()
		}
	}

	/**
	 * Initialize the AI observer integration
	 */
	async initialize(): Promise<void> {
		if (!this.config.enabled) {
			console.log("AI observer integration disabled")
			this.isInitialized = true
			return
		}

		console.log("Initializing AI observer integration...")

		// Initialize the observer
		const observerConfig = {
			...defaultObserverConfig,
			...this.config.observerConfig,
		}

		await this.observer.initialize(observerConfig)

		// Initialize orchestrator if autonomous analysis is enabled
		if (this.config.orchestratorConfig?.enableAutonomousAnalysis) {
			await this.initializeOrchestrator()
		}

		// Set up periodic data export if configured
		if (this.config.orchestratorConfig?.dataExportInterval) {
			this.setupDataExport(this.config.orchestratorConfig.dataExportInterval)
		}

		this.isInitialized = true
		this.emit("integration-initialized")
		console.log("AI observer integration initialized successfully")
	}

	/**
	 * Start an AI observer session for a specific run
	 */
	async startObserverSession(
		runId: number,
		observerLevel: string,
		steeringMode?: string,
		insightsConfig?: string,
	): Promise<void> {
		if (!this.config.enabled) return

		this.currentRunId = runId

		try {
			const sessionData: InsertAIObserverSession = {
				runId,
				observerLevel,
				steeringMode,
				insightsConfig,
				configuration: this.config,
			}

			const session = await createAIObserverSession(sessionData)
			this.sessionId = session.id

			this.emit("session-started", {
				sessionId: session.id,
				runId,
				observerLevel,
				steeringMode,
				insightsConfig,
			})
		} catch (error) {
			console.error("Failed to create AI observer session:", error)
		}
	}

	/**
	 * Check if AI observation is enabled and initialized
	 */
	isEnabled(): boolean {
		return this.config.enabled && this.isInitialized
	}

	/**
	 * Get the observer instance (null implementation if disabled)
	 */
	getObserver(): RealtimeEvalObserver {
		return this.observer
	}

	/**
	 * Process evaluation insights and optionally store them
	 */
	async processInsights(taskId: number, runId: number): Promise<void> {
		if (!this.isEnabled()) return

		const insights = this.observer.getTaskInsights(taskId)

		if (insights.length > 0) {
			// Convert to insight records
			const insightRecords: InsightRecord[] = insights.map((insight) => ({
				id: `insight_${taskId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				runId,
				taskId,
				category: insight.category,
				title: insight.title,
				description: insight.description,
				confidence: insight.confidence,
				severity: insight.severity,
				evidence: insight.evidence,
				recommendations: insight.recommendations,
				detectedAt: new Date(),
				contextSnapshot: {
					taskId,
					runId,
					timestamp: new Date(),
				},
			}))

			// Store insights locally
			this.activeInsights.set(taskId, insightRecords)

			// Persist to database if configured
			if (this.config.persistenceConfig?.enableInsightStorage) {
				await this.persistInsights(insightRecords)
			}

			// Emit insights for external consumption
			this.emit("insights-generated", {
				taskId,
				runId,
				insights: insightRecords,
			})
		}
	}

	/**
	 * Get active steering recommendations
	 */
	getActiveRecommendations(): any[] {
		if (!this.isEnabled()) return []
		return this.observer.getSteeringRecommendations()
	}

	/**
	 * Request a steering action (pause, resume, etc.)
	 */
	async requestSteeringAction(action: Omit<SteeringAction, "id" | "requestedAt" | "status">): Promise<string> {
		if (!this.isEnabled()) {
			throw new Error("AI observer integration is not enabled")
		}

		if (!this.config.orchestratorConfig?.enableSteeringRecommendations) {
			throw new Error("Steering recommendations are not enabled")
		}

		const steeringAction: SteeringAction = {
			...action,
			id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			requestedAt: new Date(),
			status: "pending",
		}

		this.pendingActions.set(steeringAction.id, steeringAction)

		// Emit for CLI to handle
		this.emit("steering-action-requested", steeringAction)

		return steeringAction.id
	}

	/**
	 * Mark a steering action as applied with result
	 */
	markActionApplied(actionId: string, success: boolean, result?: string): void {
		const action = this.pendingActions.get(actionId)
		if (action) {
			action.status = success ? "applied" : "failed"
			action.result = result
			this.emit("steering-action-completed", action)
		}
	}

	/**
	 * Get insights for a specific task
	 */
	getTaskInsights(taskId: number): InsightRecord[] {
		return this.activeInsights.get(taskId) || []
	}

	/**
	 * Get insights for all tasks in a run
	 */
	getRunInsights(runId: number): InsightRecord[] {
		const insights: InsightRecord[] = []
		for (const taskInsights of this.activeInsights.values()) {
			insights.push(...taskInsights.filter((i) => i.runId === runId))
		}
		return insights
	}

	/**
	 * Get system health overview
	 */
	getSystemHealth(): any {
		if (!this.isEnabled()) return null
		return this.observer.getSystemHealth()
	}

	/**
	 * Generate comprehensive evaluation report with AI insights
	 */
	async generateAIReport(runId: number): Promise<{
		summary: any
		insights: InsightRecord[]
		recommendations: any[]
		anomalies: any[]
		systemHealth: any
	}> {
		if (!this.isEnabled()) {
			return {
				summary: { message: "AI observation not enabled" },
				insights: [],
				recommendations: [],
				anomalies: [],
				systemHealth: null,
			}
		}

		try {
			// Get data from database if persistence is enabled, otherwise use in-memory data
			let insights: InsightRecord[] = []
			let summary: any = {}
			let anomalies: any[] = []
			let recommendationStats: any = {}

			if (this.config.persistenceConfig?.enableInsightStorage) {
				// Get from database
				const [insightsSummary, anomaliesByType, recEffectiveness] = await Promise.all([
					getAIInsightsSummary(runId),
					getAIAnomaliesByType(runId),
					getAIRecommendationEffectiveness(runId),
				])

				summary = {
					totalInsights: insightsSummary.totalInsights,
					averageConfidence: insightsSummary.avgConfidence,
					criticalIssues: insightsSummary.criticalInsights,
					warningIssues: insightsSummary.warningInsights,
					infoIssues: insightsSummary.infoInsights,
					actionableRecommendations:
						recEffectiveness.appliedRecommendations + recEffectiveness.pendingRecommendations,
				}

				anomalies = anomaliesByType
				recommendationStats = recEffectiveness
			} else {
				// Use in-memory data
				insights = this.getRunInsights(runId)
				const recommendations = this.getActiveRecommendations()
				const systemHealth = this.getSystemHealth()

				summary = {
					totalInsights: insights.length,
					insightsByCategory: this.groupInsightsByCategory(insights),
					averageConfidence: this.calculateAverageConfidence(insights),
					criticalIssues: insights.filter((i) => i.severity === "critical").length,
					actionableRecommendations: recommendations.filter(
						(r) => r.priority === "high" || r.priority === "critical",
					).length,
				}
			}

			const recommendations = this.getActiveRecommendations()
			const systemHealth = this.getSystemHealth()

			return {
				summary,
				insights,
				recommendations,
				anomalies,
				systemHealth,
			}
		} catch (error) {
			console.error("Failed to generate AI report:", error)
			return {
				summary: {
					error: "Failed to generate AI report",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				insights: [],
				recommendations: [],
				anomalies: [],
				systemHealth: null,
			}
		}
	}

	/**
	 * Cleanup and shutdown
	 */
	async shutdown(): Promise<void> {
		// Finish observer session if one exists
		if (this.sessionId) {
			try {
				await finishAIObserverSession(this.sessionId, "completed")
				this.emit("session-finished", { sessionId: this.sessionId, status: "completed" })
			} catch (error) {
				console.error("Failed to finish AI observer session:", error)
			}
		}

		if (this.orchestrator) {
			await this.orchestrator.shutdown()
		}

		if (this.observer) {
			await this.observer.shutdown()
		}

		this.emit("integration-shutdown")
	}

	// Private methods

	private async initializeOrchestrator(): Promise<void> {
		// TODO: Initialize orchestrator with proper configuration
		// This would integrate with the existing AnalysisOrchestrator
		console.log("Orchestrator initialization not yet implemented")
	}

	private setupDataExport(intervalMinutes: number): void {
		setInterval(
			async () => {
				if (this.orchestrator) {
					// TODO: Export data for analysis
					console.log("Periodic data export not yet implemented")
				}
			},
			intervalMinutes * 60 * 1000,
		)
	}

	private async persistInsights(insights: InsightRecord[]): Promise<void> {
		if (!this.config.persistenceConfig?.enableInsightStorage) return

		try {
			const batchSize = this.config.persistenceConfig?.batchInsertSize || 100

			// Process insights in batches
			for (let i = 0; i < insights.length; i += batchSize) {
				const batch = insights.slice(i, i + batchSize)

				const promises = batch.map(async (insight) => {
					const insightData: InsertAIInsight = {
						runId: insight.runId,
						taskId: insight.taskId,
						category: insight.category,
						title: insight.title,
						description: insight.description,
						confidence: insight.confidence,
						severity: insight.severity,
						evidence: insight.evidence,
						recommendations: insight.recommendations,
						contextSnapshot: insight.contextSnapshot,
					}

					return createAIInsight(insightData)
				})

				await Promise.all(promises)
			}

			// Update session statistics if session exists
			if (this.sessionId && this.currentRunId) {
				const summary = await getAIInsightsSummary(this.currentRunId)
				await updateAIObserverSessionStats(this.sessionId, {
					totalInsights: summary.totalInsights,
					averageConfidence: summary.avgConfidence,
				})
			}

			console.log(`Persisted ${insights.length} AI insights to database`)
		} catch (error) {
			console.error("Failed to persist AI insights:", error)
		}
	}

	private groupInsightsByCategory(insights: InsightRecord[]): Record<string, number> {
		return insights.reduce(
			(acc, insight) => {
				acc[insight.category] = (acc[insight.category] || 0) + 1
				return acc
			},
			{} as Record<string, number>,
		)
	}

	private calculateAverageConfidence(insights: InsightRecord[]): number {
		if (insights.length === 0) return 0
		return insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length
	}
}

/**
 * Factory function to create the integration based on configuration
 */
export function createEvalObserverIntegration(config: EvalObserverIntegrationConfig): EvalObserverIntegration {
	return new EvalObserverIntegration(config)
}

/**
 * Default configuration for AI observer integration
 */
export const defaultIntegrationConfig: EvalObserverIntegrationConfig = {
	enabled: false, // Conservative default - must be explicitly enabled
	observerConfig: {
		features: {
			anomalyDetection: true,
			steeringRecommendations: false,
			performanceAnalysis: true,
			systemHealthMonitoring: true,
			patternRecognition: true,
		},
		integration: {
			persistInsights: true,
			enableSteering: false,
			autoImplementRecommendations: false,
		},
	},
	orchestratorConfig: {
		enableAutonomousAnalysis: false,
		enableSteeringRecommendations: false,
		enableContinuousLearning: false,
		dataExportInterval: 30, // 30 minutes
	},
	persistenceConfig: {
		enableInsightStorage: true,
		enableRecommendationTracking: true,
		batchInsertSize: 100,
	},
}
