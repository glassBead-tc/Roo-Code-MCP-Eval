// Core types for the autonomous analysis system

export interface TelemetryExport {
	metadata: {
		exportDate: string
		timeRange: { start: Date; end: Date }
		version: string
		dataQuality: {
			completeness: number // 0-1
			sampleSize: number
			missingDataPoints: string[]
		}
	}

	benchmarks: {
		summary: BenchmarkSummary
		details: BenchmarkDetail[]
		trends: TrendAnalysis[]
	}

	performance: {
		byServer: ServerPerformance[]
		byTaskType: TaskTypePerformance[]
		byTimeWindow: TimeWindowPerformance[]
	}

	errors: {
		patterns: ErrorPattern[]
		frequency: ErrorFrequency[]
		impact: ErrorImpact[]
	}

	recommendations: {
		immediate: Recommendation[]
		longTerm: Recommendation[]
	}
}

export interface BenchmarkDetail {
	id: number
	mcpServer: string
	taskType: string
	duration: number
	tokenUsage: {
		input: number
		output: number
		total: number
	}
	success: boolean
	errorDetails?: string
	retrievalCalls: {
		count: number
		totalDuration: number
		avgResponseSize: number
	}
}

export interface BenchmarkSummary {
	totalBenchmarks: number
	successRate: number
	avgDuration: number
	medianDuration: number
	p95Duration: number
	avgTokenUsage: number
	timeRange: { start: Date; end: Date }
}

export interface TrendAnalysis {
	metric: string
	direction: "improving" | "degrading" | "stable"
	changePercent: number
	significance: number // p-value
	dataPoints: { timestamp: Date; value: number }[]
}

export interface ServerPerformance {
	serverName: string
	totalCalls: number
	avgResponseTime: number
	errorRate: number
	throughput: number
	reliability: number
}

export interface TaskTypePerformance {
	taskType: string
	count: number
	successRate: number
	avgDuration: number
	tokenEfficiency: number
}

export interface TimeWindowPerformance {
	window: string // '1h', '24h', '7d'
	avgDuration: number
	errorRate: number
	throughput: number
	trend: "improving" | "degrading" | "stable"
}

export interface ErrorPattern {
	pattern: string
	frequency: number
	severity: "low" | "medium" | "high" | "critical"
	impact: string
	suggestedFix?: string
}

export interface ErrorFrequency {
	errorType: string
	count: number
	firstSeen: Date
	lastSeen: Date
	trend: "increasing" | "decreasing" | "stable"
}

export interface ErrorImpact {
	errorType: string
	performanceImpact: number
	userImpact: number
	systemImpact: number
}

export interface Recommendation {
	id: string
	title: string
	description: string
	priority: "low" | "medium" | "high" | "critical"
	expectedImpact: string
	effort: "low" | "medium" | "high"
	confidence: number // 0-1
	implementationHint?: string
}

// Operating modes for Claude Code
export type OperatingMode = "ANALYSIS_ONLY" | "CONTINUOUS_REFINEMENT"

export interface SessionConfiguration {
	mode: OperatingMode
	maxIterations: number
	sessionTimeout: number // in milliseconds
	humanTriggerRequired: boolean
}

export interface OperatingConstraints {
	allowedOperations: string[]
	prohibitedOperations: string[]
	fileAccess: {
		readOnly: string[]
		writeAllowed: string[]
		prohibited: string[]
	}
	resourceLimits: {
		maxMemoryMB: number
		maxCpuPercent: number
		maxDiskSpaceMB: number
		maxApiCallsPerMinute: number
	}
}

export interface ValidationResult {
	valid: boolean
	reason?: string
	testResults?: TestValidation
	performanceResults?: BenchmarkResult
	codeQualityResults?: CodeQualityReport
}

export interface TestValidation {
	unitTests: {
		passed: number
		failed: number
		coverage: number
		duration: number
	}
	integrationTests: {
		passed: number
		failed: number
		scenarios: string[]
	}
	e2eTests?: {
		passed: number
		failed: number
		criticalPaths: string[]
	}
}

export interface BenchmarkResult {
	passed: boolean
	benchmarks: PerformanceBenchmark[]
	regressions: PerformanceBenchmark[]
}

export interface PerformanceBenchmark {
	metric: string
	baseline: number
	current: number
	change: number
	threshold: number
}

export interface CodeQualityReport {
	passed: boolean
	metrics: CodeQualityMetrics
	issues: string[]
}

export interface CodeQualityMetrics {
	complexity: {
		cyclomatic: number
		cognitive: number
	}
	maintainability: {
		index: number
		grade: string
	}
	duplication: {
		percentage: number
		blocks: number
	}
	security: {
		vulnerabilities: number
		severity: string[]
	}
}

export interface ProposedChange {
	id: string
	type: "optimization" | "bug_fix" | "refactor" | "feature"
	files: string[]
	description: string
	rationale: string
	expectedImpact: string
	riskLevel: "low" | "medium" | "high"
}

export interface AnalysisSession {
	id: string
	startTime: Date
	endTime?: Date
	mode: OperatingMode
	configuration: SessionConfiguration
	status: "initializing" | "running" | "paused" | "completed" | "failed" | "timeout"
	iterations: number
	results: AnalysisResult[]
	error?: string
}

export interface AnalysisResult {
	iteration: number
	timestamp: Date
	dataAnalyzed: number
	patternsFound: string[]
	recommendationsGenerated: Recommendation[]
	changesProposed: ProposedChange[]
	validationResults?: ValidationResult[]
}

// MCP Server related types
export interface McpServerMetrics {
	serverName: string
	status: "connected" | "disconnected" | "error"
	responseTime: number
	errorRate: number
	requestCount: number
	lastError?: string
}

export interface TelemetryQueryParams {
	queryType: "benchmarks" | "calls" | "metrics" | "aggregated"
	limit?: number
	offset?: number
	filters?: {
		startDate?: string
		endDate?: string
		mcpServer?: string
		minDuration?: number
		maxDuration?: number
	}
	aggregation?: {
		groupBy?: string[]
		metrics?: ("avg" | "min" | "max" | "p50" | "p95" | "p99")[]
	}
}

export interface ExportFormat {
	type: "json" | "csv" | "parquet"
	compression?: boolean
	includeMetadata?: boolean
}
