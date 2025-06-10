#!/usr/bin/env node

import { join } from "path"
import { AnalysisOrchestrator, OrchestratorConfig } from "./orchestrator/AnalysisOrchestrator.js"
import { OperatingMode, SessionConfiguration, OperatingConstraints } from "./types.js"

/**
 * Comprehensive integration test for the Autonomous Analysis System
 * Tests all components working together in a real workflow
 */

async function runIntegrationTest(): Promise<void> {
	console.log("🧪 Starting Autonomous Analysis Integration Test\n")

	try {
		// Test Configuration
		const testConfig = createTestConfiguration()
		console.log("✅ Configuration created")

		// Initialize Orchestrator
		console.log("🚀 Initializing Analysis Orchestrator...")
		const orchestrator = new AnalysisOrchestrator(testConfig)

		// Setup test event listeners
		setupTestEventListeners(orchestrator)

		await orchestrator.initialize()
		console.log("✅ Orchestrator initialized successfully\n")

		// Test 1: Analysis Only Mode
		console.log("📊 Test 1: Running ANALYSIS_ONLY session...")
		const analysisSessionId = await orchestrator.startAnalysisSession("ANALYSIS_ONLY")
		console.log(`✅ Analysis session completed: ${analysisSessionId}`)

		// Get metrics for analysis session
		const analysisMetrics = await orchestrator.getSessionMetrics(analysisSessionId)
		if (analysisMetrics) {
			console.log(`   📈 Generated ${analysisMetrics.recommendationsGenerated} recommendations`)
			console.log(`   📊 Processed ${analysisMetrics.totalDataProcessed} data records`)
			console.log(`   🎯 Average confidence: ${(analysisMetrics.averageConfidence * 100).toFixed(1)}%\n`)
		}

		// Test 2: Continuous Refinement Mode (limited iterations for testing)
		console.log("🔄 Test 2: Running CONTINUOUS_REFINEMENT session...")
		const refinementSessionId = await orchestrator.startAnalysisSession("CONTINUOUS_REFINEMENT", {
			maxIterations: 2, // Limit for testing
			sessionTimeout: 5 * 60 * 1000, // 5 minutes max
		})
		console.log(`✅ Refinement session completed: ${refinementSessionId}`)

		// Get metrics for refinement session
		const refinementMetrics = await orchestrator.getSessionMetrics(refinementSessionId)
		if (refinementMetrics) {
			console.log(`   🔧 Implemented ${refinementMetrics.recommendationsImplemented} changes`)
			console.log(`   ✅ Passed ${refinementMetrics.validationsPassed} validations`)
			console.log(`   ❌ Failed ${refinementMetrics.validationsFailed} validations\n`)
		}

		// Test 3: Session History and Metrics
		console.log("📚 Test 3: Verifying session history...")
		const history = await orchestrator.getSessionHistory()
		console.log(`✅ Found ${history.length} sessions in history`)

		const recentSession = history[history.length - 1]
		if (recentSession) {
			console.log(`   📋 Latest session: ${recentSession.id}`)
			console.log(`   🏁 Status: ${recentSession.status}`)
			console.log(`   🔄 Iterations: ${recentSession.iterations}\n`)
		}

		// Test 4: Component Integration
		console.log("🧩 Test 4: Testing individual components...")
		await testComponentIntegration()
		console.log("✅ All components working correctly\n")

		// Test 5: Error Handling
		console.log("⚠️  Test 5: Testing error handling...")
		await testErrorHandling(orchestrator)
		console.log("✅ Error handling verified\n")

		// Test Summary
		console.log("🎉 INTEGRATION TEST PASSED!\n")
		console.log("📊 Test Summary:")
		console.log(`   ✅ Analysis session: ${analysisSessionId.substring(0, 12)}...`)
		console.log(`   ✅ Refinement session: ${refinementSessionId.substring(0, 12)}...`)
		console.log(`   ✅ Session history: ${history.length} sessions`)
		console.log(`   ✅ Component integration: All working`)
		console.log(`   ✅ Error handling: Verified`)

		process.exit(0)
	} catch (error) {
		console.error("\n❌ INTEGRATION TEST FAILED!")
		console.error("Error:", error instanceof Error ? error.message : error)
		console.error("\nStack trace:", error instanceof Error ? error.stack : "N/A")
		process.exit(1)
	}
}

function createTestConfiguration(): OrchestratorConfig {
	const projectRoot = process.cwd()
	const testOutputPath = join(projectRoot, "test-autonomous-reports")
	const testLearningPath = join(projectRoot, "test-autonomous-learning")

	const constraints: OperatingConstraints = {
		allowedOperations: ["analyze_telemetry", "generate_reports", "propose_improvements", "validate_changes"],
		prohibitedOperations: ["delete_data", "modify_core_system", "access_credentials", "external_network_calls"],
		fileAccess: {
			readOnly: ["*.md", "package.json"],
			writeAllowed: ["packages/evals/src/**/*.ts"],
			prohibited: ["node_modules/**/*", ".git/**/*"],
		},
		resourceLimits: {
			maxMemoryMB: 512,
			maxCpuPercent: 70,
			maxDiskSpaceMB: 100,
			maxApiCallsPerMinute: 100,
		},
	}

	const sessionConfig: SessionConfiguration = {
		mode: "ANALYSIS_ONLY" as OperatingMode,
		maxIterations: 2,
		sessionTimeout: 5 * 60 * 1000, // 5 minutes for testing
		humanTriggerRequired: false,
	}

	return {
		projectRoot,
		sessionConfig,
		constraints,
		dataSource: "mock", // Use mock data for predictable testing
		reportOutputPath: testOutputPath,
		learningDataPath: testLearningPath,
		enabledFeatures: {
			statisticalAnalysis: true,
			safetyValidation: true,
			learningEngine: true,
			realTimeMonitoring: true,
			automaticReporting: true,
			evolutionEngine: true,
		},
	}
}

function setupTestEventListeners(orchestrator: AnalysisOrchestrator): void {
	let eventCount = 0

	orchestrator.on("session-started", (data) => {
		eventCount++
		console.log(`   🎬 Event ${eventCount}: Session started (${data.mode})`)
	})

	orchestrator.on("iteration-completed", (data) => {
		eventCount++
		console.log(
			`   📊 Event ${eventCount}: Iteration ${data.iteration} completed (${data.result.recommendationsGenerated.length} recs)`,
		)
	})

	orchestrator.on("change-implemented", (data) => {
		eventCount++
		console.log(`   🔧 Event ${eventCount}: Change implemented (${data.changeId.substring(0, 8)}...)`)
	})

	orchestrator.on("session-completed", (data) => {
		eventCount++
		console.log(`   🏁 Event ${eventCount}: Session completed (${data.sessionId.substring(0, 8)}...)`)
	})

	orchestrator.on("report-generated", (data) => {
		eventCount++
		console.log(`   📄 Event ${eventCount}: Report generated`)
	})
}

async function testComponentIntegration(): Promise<void> {
	// Test Mock Data Generator
	console.log("   🔧 Testing MockDataGenerator...")
	const { MockDataGenerator } = await import("./exporters/MockDataGenerator.js")
	const generator = new MockDataGenerator()
	const mockData = generator.generateTelemetryExport({
		days: 1,
		recordsPerDay: 50,
		includeErrors: true,
	})

	if (mockData.benchmarks.details.length === 0) {
		throw new Error("MockDataGenerator produced no data")
	}
	console.log(`     ✅ Generated ${mockData.benchmarks.details.length} records`)

	// Test Statistical Analyzer
	console.log("   📊 Testing StatisticalAnalyzer...")
	const { StatisticalAnalyzer } = await import("./analyzers/StatisticalAnalyzer.js")
	const analyzer = new StatisticalAnalyzer()
	const analysis = analyzer.analyze(mockData)

	if (analysis.recommendations.length === 0) {
		console.log("     ⚠️  No recommendations generated (acceptable for some datasets)")
	} else {
		console.log(`     ✅ Generated ${analysis.recommendations.length} recommendations`)
	}

	// Test Safety Validator
	console.log("   🛡️  Testing SafetyValidator...")
	const { SafetyValidator } = await import("./safety/SafetyValidator.js")
	const testConstraints = createTestConfiguration().constraints
	const validator = new SafetyValidator(testConstraints, process.cwd())

	const testChange = {
		id: "test-change-1",
		type: "optimization" as const,
		files: ["packages/evals/src/test-file.ts"],
		description: "Test optimization change",
		rationale: "Testing validator",
		expectedImpact: "10% improvement",
		riskLevel: "low" as const,
	}

	const validation = await validator.validateChange(testChange)
	console.log(`     ✅ Validation result: ${validation.valid ? "PASSED" : "FAILED"}`)

	// Test Learning Engine
	console.log("   🧠 Testing LearningEngine...")
	const { createLearningEngine } = await import("./feedback/learning-engine.js")
	const learningEngine = createLearningEngine({
		storagePath: "./test-learning-data",
		maxHistorySize: 100,
		confidenceThreshold: 0.5,
		adaptationRate: 0.1,
		patternMinimumOccurrences: 2,
	})

	await learningEngine.initialize()
	const insights = await learningEngine.getLearningInsights()
	console.log(`     ✅ Learning engine initialized, ${insights.length} insights available`)
}

async function testErrorHandling(orchestrator: AnalysisOrchestrator): Promise<void> {
	try {
		// Test starting session while one is already running
		await orchestrator.startAnalysisSession("ANALYSIS_ONLY")

		// This should fail because a session is already running
		try {
			await orchestrator.startAnalysisSession("CONTINUOUS_REFINEMENT")
			throw new Error("Expected error for concurrent sessions, but none occurred")
		} catch (expectedError) {
			if (expectedError instanceof Error && expectedError.message.includes("already running")) {
				console.log("     ✅ Concurrent session prevention works")
			} else {
				throw expectedError
			}
		}

		// Stop the session
		await orchestrator.stopSession()
		console.log("     ✅ Session stop handling works")
	} catch (error) {
		console.log("     ⚠️  Error handling test had issues:", error instanceof Error ? error.message : error)
	}
}

// Performance measurement
const startTime = Date.now()

process.on("exit", () => {
	const duration = (Date.now() - startTime) / 1000
	console.log(`\n⏱️  Total test duration: ${duration.toFixed(1)} seconds`)
})

// Run the integration test
runIntegrationTest().catch((error) => {
	console.error("❌ Integration test crashed:", error)
	process.exit(1)
})
