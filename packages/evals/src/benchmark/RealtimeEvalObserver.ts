import { ReadableSpan } from "@opentelemetry/sdk-trace-base"
import { Task, Run } from "../db/schema.js"

export interface SpanObservationData {
	span: ReadableSpan
	taskContext: TaskContext
	performanceMetrics: PerformanceMetrics
	recentTrends: TrendData[]
	systemHealth: SystemHealth
}

export interface TaskContext {
	taskId: number
	runId: number
	mcpServer: string
	userIntent: string
	startTime: Date
	currentStep: number
	totalSteps: number
}

export interface PerformanceMetrics {
	duration: number
	responseSize: number
	errorCount: number
	stepLatency: number
	resourceUsage: {
		memory: number
		cpu: number
		network: number
	}
}

export interface TrendData {
	metric: string
	value: number
	timestamp: Date
	direction: "increasing" | "decreasing" | "stable"
}

export interface SystemHealth {
	cpuUsage: number
	memoryUsage: number
	networkLatency: number
	storageIO: number
	containerHealth: ContainerStatus[]
}

export interface ContainerStatus {
	name: string
	status: "running" | "stopped" | "error"
	resourceUsage: {
		cpu: number
		memory: number
		network: number
	}
}

export interface AnomalyDetection {
	id: string
	type: "performance" | "error" | "resource" | "pattern"
	severity: "low" | "medium" | "high" | "critical"
	description: string
	confidence: number
	detectedAt: Date
	context: any
	suggestedAction?: string
}

export interface SteeringRecommendation {
	id: string
	type: "pause_task" | "adjust_concurrency" | "switch_server" | "inject_debug" | "optimize_resources"
	priority: "low" | "medium" | "high" | "critical"
	description: string
	expectedImpact: string
	confidence: number
	targetTaskId?: number
	parameters?: Record<string, any>
}

export interface AnalysisInsight {
	id: string
	category: "performance" | "quality" | "efficiency" | "reliability"
	title: string
	description: string
	evidence: string[]
	confidence: number
	severity: "info" | "warning" | "error" | "critical"
	actionable: boolean
	recommendations: string[]
}

export interface ObservationResult {
	anomalies: AnomalyDetection[]
	steeringRecommendations: SteeringRecommendation[]
	insights: AnalysisInsight[]
	contextUpdate: Partial<TaskContext>
}

/**
 * Real-time evaluation observer that provides AI-native observation capabilities
 * for MCP evaluation runs. This observer can be optionally integrated into the
 * evaluation pipeline to provide enhanced insights and steering capabilities.
 */
export interface RealtimeEvalObserver {
	/**
	 * Initialize the observer with configuration
	 */
	initialize(config: ObserverConfig): Promise<void>

	/**
	 * Process a span observation with full context
	 */
	processSpan(data: SpanObservationData): Promise<ObservationResult>

	/**
	 * Update the observer with new task context
	 */
	updateTaskContext(taskId: number, context: Partial<TaskContext>): void

	/**
	 * Get current insights for a specific task
	 */
	getTaskInsights(taskId: number): AnalysisInsight[]

	/**
	 * Get all active steering recommendations
	 */
	getSteeringRecommendations(): SteeringRecommendation[]

	/**
	 * Mark a steering recommendation as implemented
	 */
	markRecommendationImplemented(
		recommendationId: string,
		outcome: {
			successful: boolean
			impact: string
			feedback?: string
		},
	): void

	/**
	 * Get system health overview
	 */
	getSystemHealth(): SystemHealth

	/**
	 * Shutdown the observer and cleanup resources
	 */
	shutdown(): Promise<void>
}

export interface ObserverConfig {
	/**
	 * Enable/disable different observation capabilities
	 */
	features: {
		anomalyDetection: boolean
		steeringRecommendations: boolean
		performanceAnalysis: boolean
		systemHealthMonitoring: boolean
		patternRecognition: boolean
	}

	/**
	 * Thresholds for anomaly detection
	 */
	thresholds: {
		performanceThreshold: number // milliseconds
		errorRateThreshold: number // percentage
		resourceUsageThreshold: number // percentage
		confidenceThreshold: number // 0-1
	}

	/**
	 * Analysis configuration
	 */
	analysis: {
		windowSize: number // number of spans to consider for trends
		batchSize: number // number of spans to process together
		updateInterval: number // milliseconds between context updates
	}

	/**
	 * Integration settings
	 */
	integration: {
		persistInsights: boolean // whether to persist insights to database
		enableSteering: boolean // whether to enable active steering
		autoImplementRecommendations: boolean // whether to auto-implement low-risk recommendations
	}

	/**
	 * External service configurations
	 */
	services?: {
		anthropicApiKey?: string
		otlpEndpoint?: string
		databaseUrl?: string
	}
}

/**
 * Default observer configuration
 */
export const defaultObserverConfig: ObserverConfig = {
	features: {
		anomalyDetection: true,
		steeringRecommendations: false, // Conservative default
		performanceAnalysis: true,
		systemHealthMonitoring: true,
		patternRecognition: true,
	},
	thresholds: {
		performanceThreshold: 5000, // 5 seconds
		errorRateThreshold: 10, // 10%
		resourceUsageThreshold: 80, // 80%
		confidenceThreshold: 0.7, // 70%
	},
	analysis: {
		windowSize: 50, // Last 50 spans
		batchSize: 10, // Process 10 spans at a time
		updateInterval: 5000, // 5 seconds
	},
	integration: {
		persistInsights: true,
		enableSteering: false, // Conservative default
		autoImplementRecommendations: false, // Manual approval required
	},
}

/**
 * Null implementation of RealtimeEvalObserver for when AI features are disabled
 */
export class NullEvalObserver implements RealtimeEvalObserver {
	async initialize(_config: ObserverConfig): Promise<void> {
		// No-op
	}

	async processSpan(_data: SpanObservationData): Promise<ObservationResult> {
		return {
			anomalies: [],
			steeringRecommendations: [],
			insights: [],
			contextUpdate: {},
		}
	}

	updateTaskContext(_taskId: number, _context: Partial<TaskContext>): void {
		// No-op
	}

	getTaskInsights(_taskId: number): AnalysisInsight[] {
		return []
	}

	getSteeringRecommendations(): SteeringRecommendation[] {
		return []
	}

	markRecommendationImplemented(_recommendationId: string, _outcome: any): void {
		// No-op
	}

	getSystemHealth(): SystemHealth {
		return {
			cpuUsage: 0,
			memoryUsage: 0,
			networkLatency: 0,
			storageIO: 0,
			containerHealth: [],
		}
	}

	async shutdown(): Promise<void> {
		// No-op
	}
}
