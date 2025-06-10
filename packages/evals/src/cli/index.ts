import * as fs from "fs"
import * as path from "path"

import pWaitFor from "p-wait-for"
import { execa, parseCommandString } from "execa"
import { command, run, number, option, string, optional } from "cmd-ts"
import psTree from "ps-tree"

import {
	RooCodeEventName,
	IpcOrigin,
	IpcMessageType,
	TaskCommandName,
	TaskContextConfirmationMessage,
} from "@roo-code/types"
import { IpcServer, IpcClient } from "@roo-code/ipc"
import { v4 as uuidv4 } from "uuid"

import {
	type Run,
	type Task,
	findRun,
	createRun,
	finishRun,
	getTasks,
	createTask,
	updateTask,
	createTaskMetrics,
	updateTaskMetrics,
	createToolError,
} from "../db/index.js"
import { type ExerciseLanguage, exerciseLanguages, exercisesPath, getExercisesForLanguage } from "../exercises/index.js"
import { initializeOpenTelemetry } from "../telemetry/initializeOtel.js"
import {
	EvalObserverIntegration,
	createEvalObserverIntegration,
	defaultIntegrationConfig,
} from "../benchmark/EvalObserverIntegration.js"

type TaskResult = { success: boolean }
type TaskPromise = Promise<TaskResult>

interface AIConfig {
	observer?: string
	steering?: string
	insights?: string
	configPath?: string
}

/**
 * Create AI observer integration configuration from CLI arguments
 */
function createAIConfig(args: AIConfig): any {
	const config = { ...defaultIntegrationConfig }

	// Parse AI observer level
	if (args.observer) {
		config.enabled = true
		switch (args.observer.toLowerCase()) {
			case "basic":
				config.observerConfig!.features!.anomalyDetection = true
				config.observerConfig!.features!.performanceAnalysis = true
				config.observerConfig!.features!.systemHealthMonitoring = true
				config.observerConfig!.features!.steeringRecommendations = false
				config.observerConfig!.features!.patternRecognition = false
				break
			case "full":
				config.observerConfig!.features!.anomalyDetection = true
				config.observerConfig!.features!.performanceAnalysis = true
				config.observerConfig!.features!.systemHealthMonitoring = true
				config.observerConfig!.features!.steeringRecommendations = true
				config.observerConfig!.features!.patternRecognition = true
				break
			case "autonomous":
				config.observerConfig!.features!.anomalyDetection = true
				config.observerConfig!.features!.performanceAnalysis = true
				config.observerConfig!.features!.systemHealthMonitoring = true
				config.observerConfig!.features!.steeringRecommendations = true
				config.observerConfig!.features!.patternRecognition = true
				config.orchestratorConfig!.enableAutonomousAnalysis = true
				config.orchestratorConfig!.enableContinuousLearning = true
				break
			default:
				console.warn(`Unknown AI observer level: ${args.observer}. Using 'basic'.`)
				config.observerConfig!.features!.anomalyDetection = true
				config.observerConfig!.features!.performanceAnalysis = true
				break
		}
	}

	// Parse AI steering level
	if (args.steering) {
		config.enabled = true
		switch (args.steering.toLowerCase()) {
			case "monitor-only":
				config.orchestratorConfig!.enableSteeringRecommendations = false
				config.observerConfig!.integration!.enableSteering = false
				break
			case "suggest":
				config.orchestratorConfig!.enableSteeringRecommendations = true
				config.observerConfig!.integration!.enableSteering = false
				break
			case "auto":
				config.orchestratorConfig!.enableSteeringRecommendations = true
				config.observerConfig!.integration!.enableSteering = true
				config.observerConfig!.integration!.autoImplementRecommendations = true
				break
			default:
				console.warn(`Unknown AI steering level: ${args.steering}. Using 'monitor-only'.`)
				break
		}
	}

	// Parse AI insights configuration
	if (args.insights) {
		config.enabled = true
		switch (args.insights.toLowerCase()) {
			case "store":
				config.persistenceConfig!.enableInsightStorage = true
				config.persistenceConfig!.enableRecommendationTracking = true
				break
			case "export":
				config.persistenceConfig!.enableInsightStorage = true
				config.orchestratorConfig!.dataExportInterval = 15 // 15 minutes
				break
			case "realtime":
				config.persistenceConfig!.enableInsightStorage = false
				config.orchestratorConfig!.dataExportInterval = 5 // 5 minutes
				break
			default:
				console.warn(`Unknown AI insights mode: ${args.insights}. Using 'store'.`)
				config.persistenceConfig!.enableInsightStorage = true
				break
		}
	}

	// Load custom configuration if provided
	if (args.configPath) {
		try {
			const customConfig = JSON.parse(fs.readFileSync(args.configPath, "utf-8"))
			Object.assign(config, customConfig)
			console.log(`Loaded AI configuration from: ${args.configPath}`)
		} catch (error) {
			console.warn(`Failed to load AI configuration from ${args.configPath}:`, error)
		}
	}

	return config
}

const TASK_START_DELAY = 10 * 1_000
const TASK_TIMEOUT = 5 * 60 * 1_000
const UNIT_TEST_TIMEOUT = 2 * 60 * 1_000

async function setTaskContextWithConfirmation(
	task: Task,
	rooTaskId: string,
	client: IpcClient,
	run: Run,
	otel: Awaited<ReturnType<typeof initializeOpenTelemetry>>,
): Promise<boolean> {
	return new Promise((resolve) => {
		const timeout = setTimeout(() => {
			console.error(`Timeout waiting for task context confirmation for task ${task.id}`)
			resolve(false)
		}, 5000)

		// Set up one-time listener for confirmation
		const confirmationHandler = (message: TaskContextConfirmationMessage) => {
			if (message.taskId === task.id && message.rooTaskId === rooTaskId) {
				clearTimeout(timeout)
				client.off(IpcMessageType.TaskContextConfirmation, confirmationHandler)
				resolve(message.success)
			}
		}

		client.on(IpcMessageType.TaskContextConfirmation, confirmationHandler)

		// Register the task ID mapping in McpBenchmarkProcessor
		otel.mcpProcessor.registerTaskIdMapping(rooTaskId, task.id)

		// Send SetTaskContext command
		client.sendMessage({
			type: IpcMessageType.TaskCommand,
			origin: IpcOrigin.Client,
			clientId: client.clientId!,
			data: {
				commandName: TaskCommandName.SetTaskContext,
				data: {
					taskId: task.id, // Database integer ID
					rooTaskId: rooTaskId, // Roo's string ID
					runId: task.runId,
					mcpServer: run.mcpServer || "unknown",
					userIntent: task.exercise,
					otlpEndpoint: `http://localhost:${otel.port}`,
				},
			},
		})
	})
}

const testCommands: Record<ExerciseLanguage, { commands: string[]; timeout?: number; cwd?: string }> = {
	go: { commands: ["go test"] }, // timeout 15s bash -c "cd '$dir' && go test > /dev/null 2>&1"
	java: { commands: ["./gradlew test"] }, // timeout --foreground 15s bash -c "cd '$dir' && ./gradlew test > /dev/null 2>&1"
	javascript: { commands: ["pnpm install --ignore-workspace", "pnpm test"] }, // timeout 15s bash -c "cd '$dir' && pnpm install >/dev/null 2>&1 && pnpm test >/dev/null 2>&1"
	python: { commands: ["uv run python3 -m pytest -o markers=task *_test.py"] }, // timeout 15s bash -c "cd '$dir' && uv run python3 -m pytest -o markers=task *_test.py"
	rust: { commands: ["cargo test"] }, // timeout 15s bash -c "cd '$dir' && cargo test > /dev/null 2>&1"
}

const runEvals = async (id: number, aiConfig?: any) => {
	// Initialize AI observer integration if enabled
	let aiIntegration: EvalObserverIntegration | undefined
	if (aiConfig?.enabled) {
		console.log("Initializing AI observer integration...")
		aiIntegration = createEvalObserverIntegration(aiConfig)
		await aiIntegration.initialize()
		console.log("AI observer integration initialized")
	}

	// Initialize OpenTelemetry with extensible configuration
	const otel = await initializeOpenTelemetry({
		debug: process.env.OTEL_LOG_LEVEL === "debug",
		env: (process.env.NODE_ENV as "development" | "production" | "test") || "development",
	})

	// Create enhanced benchmark processor with AI integration
	const mcpBenchmarkProcessor = otel.mcpProcessor
	if (aiIntegration && mcpBenchmarkProcessor) {
		// Replace the processor with AI-enhanced version
		const { McpBenchmarkProcessor } = await import("../benchmark/McpBenchmarkProcessor.js")
		const enhancedProcessor = new McpBenchmarkProcessor((mcpBenchmarkProcessor as any).db, aiIntegration)
		otel.mcpProcessor = enhancedProcessor
	}

	const run = await findRun(id)
	const tasks = await getTasks(run.id)

	// Start AI observer session if enabled
	if (aiIntegration?.isEnabled()) {
		const observerLevel = aiConfig.observerConfig?.features?.anomalyDetection
			? aiConfig.orchestratorConfig?.enableAutonomousAnalysis
				? "autonomous"
				: "full"
			: "basic"
		const steeringMode = aiConfig.orchestratorConfig?.enableSteeringRecommendations
			? aiConfig.observerConfig?.integration?.enableSteering
				? "auto"
				: "suggest"
			: "monitor-only"
		const insightsConfig = aiConfig.persistenceConfig?.enableInsightStorage ? "store" : "realtime"

		await aiIntegration.startObserverSession(run.id, observerLevel, steeringMode, insightsConfig)
	}

	if (!tasks[0]) {
		throw new Error("No tasks found.")
	}

	await execa({ cwd: exercisesPath })`git config user.name "Roo Code"`
	await execa({ cwd: exercisesPath })`git config user.email "support@roocode.com"`
	await execa({ cwd: exercisesPath })`git checkout -f`
	await execa({ cwd: exercisesPath })`git clean -fd`
	await execa({ cwd: exercisesPath })`git checkout -b runs/${run.id}-${crypto.randomUUID().slice(0, 8)} main`

	const server = new IpcServer(run.socketPath, () => {})
	server.listen()

	const runningPromises: TaskPromise[] = []

	const processTask = async (runId: number, task: Task, delay = 0) => {
		await mcpBenchmarkProcessor.startTaskBenchmark(task.id, runId, run.mcpServer || "unknown", task.exercise)
		if (task.finishedAt === null) {
			await new Promise((resolve) => setTimeout(resolve, delay))
			await runExercise({ run, task, server, otel })
		}

		if (task.passed === null) {
			const passed = await runUnitTest({ task })
			await updateTask(task.id, { passed })

			server.broadcast({
				type: IpcMessageType.TaskEvent,
				origin: IpcOrigin.Server,
				data: { eventName: passed ? RooCodeEventName.EvalPass : RooCodeEventName.EvalFail, taskId: task.id },
			})

			return { success: passed }
		} else {
			await mcpBenchmarkProcessor.finishTaskBenchmark(task.id, task.passed ?? false, 0)
			return { success: task.passed }
		}
	}

	const processTaskResult = async (_task: Task, promise: TaskPromise) => {
		const index = runningPromises.indexOf(promise)

		if (index > -1) {
			runningPromises.splice(index, 1)
		}
	}

	let delay = TASK_START_DELAY

	for (const task of tasks) {
		const promise = processTask(run.id, task, delay)
		delay = delay + TASK_START_DELAY
		runningPromises.push(promise)
		promise.then(() => processTaskResult(task, promise))

		if (runningPromises.length >= run.concurrency) {
			delay = 0
			await Promise.race(runningPromises)
		}
	}

	await Promise.all(runningPromises)

	const result = await finishRun(run.id)
	console.log(`${Date.now()} [cli#run]`, result)

	await execa({ cwd: exercisesPath })`git add .`
	await execa({ cwd: exercisesPath })`git commit -m ${`Run #${run.id}`} --no-verify`

	// Generate AI report if enabled
	if (aiIntegration?.isEnabled()) {
		try {
			const aiReport = await aiIntegration.generateAIReport(run.id)
			console.log("AI Evaluation Report:")
			console.log("===================")
			console.log(`Total Insights: ${aiReport.summary.totalInsights}`)
			console.log(`Average Confidence: ${(aiReport.summary.averageConfidence * 100).toFixed(1)}%`)
			console.log(`Critical Issues: ${aiReport.summary.criticalIssues}`)
			console.log(`Actionable Recommendations: ${aiReport.summary.actionableRecommendations}`)

			if (aiReport.insights.length > 0) {
				console.log("\nKey Insights:")
				aiReport.insights.slice(0, 5).forEach((insight, i) => {
					console.log(
						`${i + 1}. ${insight.title} (${insight.category}, ${(insight.confidence * 100).toFixed(0)}% confidence)`,
					)
					console.log(`   ${insight.description}`)
				})
			}
		} catch (error) {
			console.warn("Failed to generate AI report:", error)
		}
	}

	// Shutdown AI integration
	if (aiIntegration) {
		await aiIntegration.shutdown()
	}

	// Shutdown OpenTelemetry
	await otel.shutdown()
}

const runExercise = async ({
	run,
	task,
	server,
	otel,
}: {
	run: Run
	task: Task
	server: IpcServer
	otel: Awaited<ReturnType<typeof initializeOpenTelemetry>>
}): TaskPromise => {
	const { language, exercise } = task
	const prompt = fs.readFileSync(path.resolve(exercisesPath, `prompts/${language}.md`), "utf-8")
	const dirname = path.dirname(run.socketPath)
	const workspacePath = path.resolve(exercisesPath, language, exercise)
	// Use the run's main socket path instead of creating task-specific ones
	const taskSocketPath = run.socketPath

	// Inject foot gun system prompt if present
	if (process.env.FOOTGUN_SYSTEM_PROMPT) {
		const rooDir = path.join(workspacePath, ".roo")
		if (!fs.existsSync(rooDir)) {
			fs.mkdirSync(rooDir, { recursive: true })
		}
		fs.writeFileSync(path.join(rooDir, "system-prompt-code"), process.env.FOOTGUN_SYSTEM_PROMPT)
	}

	// If debugging:
	// Use --wait --log trace or --verbose.
	// Don't await execa and store result as subprocess.
	// subprocess.stdout.pipe(process.stdout)

	console.log(`${Date.now()} [cli#runExercise] Starting VS Code with xvfb at ${workspacePath}`)

	const controller = new AbortController()
	const cancelSignal = controller.signal

	// Run VS Code with virtual display in Docker containers, directly on macOS
	const vscodeCommand = process.env.VSCODE_PATH || "code"
	
	// Add VS Code logging flags to capture extension debug output
	const logDir = path.join(dirname, "vscode-logs")
	const debugFlags = `--log debug RooVeterinaryInc.roo-cline:debug --verbose --logsPath "${logDir}"`
	
	// Detect if we're running in Docker (Linux) or on macOS
	const isDocker = process.platform === "linux"
	const codeCommand = isDocker 
		? `xvfb-run -a env ROO_CODE_IPC_SOCKET_PATH="${taskSocketPath}" ${vscodeCommand} ${debugFlags} --disable-workspace-trust "${workspacePath}"`
		: `env ROO_CODE_IPC_SOCKET_PATH="${taskSocketPath}" ${vscodeCommand} ${debugFlags} --disable-workspace-trust "${workspacePath}"`

	console.log(`${Date.now()} [cli#runExercise] Running command: ${codeCommand}`)
	console.log(`${Date.now()} [cli#runExercise] Socket path: ${taskSocketPath}`)

	const subprocess = execa({
		env: {
			ROO_CODE_IPC_SOCKET_PATH: taskSocketPath,
		},
		shell: "/bin/bash",
		cancelSignal,
	})`${codeCommand}`

	// For debugging VS Code output:
	subprocess.stdout.pipe(process.stdout)
	subprocess.stderr.pipe(process.stderr)

	// Monitor VS Code log files for extension debug output
	setTimeout(async () => {
		console.log(`${Date.now()} [cli#runExercise] Setting up VS Code log monitoring for extension debug output...`)
		
		try {
			const fs = await import("fs")
			const { spawn } = await import("child_process")
			
			// Create log directory if it doesn't exist
			if (!fs.existsSync(logDir)) {
				fs.mkdirSync(logDir, { recursive: true })
			}
			
			// Monitor the log directory for extension log files
			setTimeout(() => {
				try {
					if (fs.existsSync(logDir)) {
						const logFiles = fs.readdirSync(logDir)
						console.log(`${Date.now()} [cli#runExercise] VS Code log files found:`, logFiles)
						
						// Look for extension-specific log files
						const extensionLogFiles = logFiles.filter(file => 
							file.includes('roo-cline') || 
							file.includes('extension') ||
							file.includes('console') ||
							file.includes('main')
						)
						
						extensionLogFiles.forEach(logFile => {
							const logPath = path.join(logDir, logFile)
							console.log(`${Date.now()} [cli#runExercise] Monitoring extension log: ${logPath}`)
							
							// Use tail -f to follow the log file
							const tailProcess = spawn('tail', ['-f', logPath], { 
								stdio: ['ignore', 'pipe', 'pipe'] 
							})
							
							tailProcess.stdout.on('data', (data) => {
								const logLine = data.toString().trim()
								// Filter for our debug prefixes
								if (logLine.includes('[TASK-LOOP-DEBUG]') || 
									logLine.includes('[STATE-SNAPSHOT]') || 
									logLine.includes('[PRESENT-MESSAGE-DEBUG]') ||
									logLine.includes('[COMPLETION-DEBUG]') ||
									logLine.includes('[TOOL-DEBUG]') ||
									logLine.includes('[PHASE-DEBUG]')) {
									console.log(`${Date.now()} [VS-CODE-EXT-LOG] ${logLine}`)
								}
							})
							
							// Clean up tail process when main process exits
							subprocess.on('exit', () => {
								tailProcess.kill()
							})
						})
					}
				} catch (logError) {
					console.log(`${Date.now()} [cli#runExercise] Error setting up log monitoring: ${logError.message}`)
				}
			}, 5000) // Wait 5 seconds for VS Code to create log files
			
		} catch (error) {
			console.log(`${Date.now()} [cli#runExercise] Failed to set up VS Code log monitoring: ${error.message}`)
		}
	}, 2000)

	// Check if environment variable is being set
	console.log(`${Date.now()} [cli#runExercise] Environment variables:`)
	console.log(`ROO_CODE_IPC_SOCKET_PATH=${process.env.ROO_CODE_IPC_SOCKET_PATH}`)
	console.log(`DISPLAY=${process.env.DISPLAY}`)

	// Check if VS Code process is actually running
	setTimeout(async () => {
		console.log(`${Date.now()} [cli#runExercise] Checking if VS Code process exists...`)
		try {
			const { execSync } = await import("child_process")
			const processes = execSync("ps aux | grep code | grep -v grep", { encoding: "utf8" })
			console.log(`${Date.now()} [cli#runExercise] VS Code processes:`)
			console.log(processes)
		} catch (err: any) {
			console.log(`${Date.now()} [cli#runExercise] No VS Code processes found: ${err.message}`)
		}

		// Test if VS Code command works at all
		console.log(`${Date.now()} [cli#runExercise] Testing VS Code command directly...`)
		try {
			const { execSync } = await import("child_process")
			const result = execSync("code --version", { encoding: "utf8", timeout: 5000 })
			console.log(`${Date.now()} [cli#runExercise] VS Code version: ${result}`)
		} catch (err: any) {
			console.log(`${Date.now()} [cli#runExercise] VS Code command failed: ${err.message}`)
		}
	}, 1000)

	// Check if socket file is created
	setTimeout(() => {
		console.log(`${Date.now()} [cli#runExercise] Checking if socket exists: ${taskSocketPath}`)
		import("fs").then((fs) => {
			fs.access(taskSocketPath, (err: any) => {
				if (err) {
					console.log(`${Date.now()} [cli#runExercise] Socket file does not exist: ${err.message}`)
				} else {
					console.log(`${Date.now()} [cli#runExercise] Socket file exists!`)
				}
			})
		})
	}, 2000)

	// Give VSCode some time to spawn before connecting to its unix socket.
	await new Promise((resolve) => setTimeout(resolve, 3_000))
	console.log(`${Date.now()} [cli#runExercise] Connecting to ${taskSocketPath}`)
	const client = new IpcClient(taskSocketPath)

	try {
		await pWaitFor(() => client.isReady, { interval: 250, timeout: 30_000 })
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (error) {
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] unable to connect`)
		client.disconnect()
		return { success: false }
	}

	let taskStartedAt = Date.now()
	let taskFinishedAt: number | undefined
	let taskMetricsId: number | undefined
	let rooTaskId: string | undefined
	let isClientDisconnected = false

	const ignoreEvents: Record<"broadcast" | "log", RooCodeEventName[]> = {
		broadcast: [RooCodeEventName.Message],
		log: [RooCodeEventName.Message, RooCodeEventName.TaskTokenUsageUpdated, RooCodeEventName.TaskAskResponded],
	}

	client.on(IpcMessageType.TaskEvent, async (taskEvent) => {
		const { eventName, payload } = taskEvent

		if (!ignoreEvents.broadcast.includes(eventName)) {
			server.broadcast({
				type: IpcMessageType.TaskEvent,
				origin: IpcOrigin.Server,
				relayClientId: client.clientId!,
				data: { ...taskEvent, taskId: task.id },
			})
		}

		if (!ignoreEvents.log.includes(eventName)) {
			console.log(
				`${Date.now()} [cli#runExercise | ${language} / ${exercise}] taskEvent -> ${eventName}`,
				payload,
			)
		}

		if (eventName === RooCodeEventName.TaskStarted) {
			console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] 🎉 TASK STARTED! AI agent activated successfully`)
			console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] 🆔 Roo Task ID from payload: ${payload[0]}`)
			taskStartedAt = Date.now()

			const taskMetrics = await createTaskMetrics({
				cost: 0,
				tokensIn: 0,
				tokensOut: 0,
				tokensContext: 0,
				duration: 0,
				cacheWrites: 0,
				cacheReads: 0,
			})

			await updateTask(task.id, { taskMetricsId: taskMetrics.id, startedAt: new Date() })

			taskStartedAt = Date.now()
			taskMetricsId = taskMetrics.id
			rooTaskId = payload[0]
			console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] 📊 Task metrics initialized, ID: ${taskMetrics.id}`)
		}

		if (eventName === RooCodeEventName.TaskToolFailed) {
			const [_taskId, toolName, error] = payload
			await createToolError({ taskId: task.id, toolName, error })
		}

		if (
			(eventName === RooCodeEventName.TaskTokenUsageUpdated || eventName === RooCodeEventName.TaskCompleted) &&
			taskMetricsId
		) {
			const duration = Date.now() - taskStartedAt

			const { totalCost, totalTokensIn, totalTokensOut, contextTokens, totalCacheWrites, totalCacheReads } =
				payload[1]

			await updateTaskMetrics(taskMetricsId, {
				cost: totalCost,
				tokensIn: totalTokensIn,
				tokensOut: totalTokensOut,
				tokensContext: contextTokens,
				duration,
				cacheWrites: totalCacheWrites ?? 0,
				cacheReads: totalCacheReads ?? 0,
			})
		}

		if (eventName === RooCodeEventName.TaskCompleted && taskMetricsId) {
			const toolUsage = payload[2]
			await updateTaskMetrics(taskMetricsId, { toolUsage })
		}

		if (eventName === RooCodeEventName.TaskAborted || eventName === RooCodeEventName.TaskCompleted) {
			taskFinishedAt = Date.now()
			await updateTask(task.id, { finishedAt: new Date() })
		}
	})

	client.on(IpcMessageType.Disconnect, async () => {
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] disconnect`)
		isClientDisconnected = true
	})

	console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] starting task`)

	if (client.isReady) {
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] ✅ IPC CLIENT READY - Starting task activation sequence`)
		
		// Generate Roo's internal task ID
		const generatedRooTaskId = uuidv4()
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] 🔑 Generated Roo Task ID: ${generatedRooTaskId}`)

		// Set task context and wait for confirmation
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] 📝 Setting task context...`)
		
		// BYPASS: Extension doesn't respond to context confirmation - protocol mismatch
		// Register the task ID mapping in McpBenchmarkProcessor anyway
		otel.mcpProcessor.registerTaskIdMapping(generatedRooTaskId, task.id)
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] ✅ Task context bypassed - trying direct StartNewTask`)

		// Verify API key before sending
		const apiKey = process.env.OPENROUTER_API_KEY
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] 🔐 API Key status: ${apiKey ? `Present (${apiKey.slice(0, 8)}...)` : '❌ MISSING'}`)
		
		// Log the prompt being sent
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] 📄 Prompt length: ${prompt.length} characters`)
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] 📄 Prompt preview: "${prompt.slice(0, 100)}..."`)

		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] 🚀 SENDING StartNewTask command...`)
		client.sendMessage({
			type: IpcMessageType.TaskCommand,
			origin: IpcOrigin.Client,
			clientId: client.clientId!,
			data: {
				commandName: TaskCommandName.StartNewTask,
				data: {
					configuration: {
						openRouterApiKey: process.env.OPENROUTER_API_KEY!,
						...run.settings,
					},
					text: prompt,
					newTab: true,
				},
			},
		})
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] ✅ StartNewTask command sent successfully`)
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] ⏳ Waiting for AI agent activation...`)
	} else {
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] ❌ IPC CLIENT NOT READY - unable to connect`)
		client.disconnect()
		taskFinishedAt = Date.now()
		isClientDisconnected = true
	}

	try {
		await pWaitFor(() => !!taskFinishedAt || isClientDisconnected, { interval: 1_000, timeout: TASK_TIMEOUT })
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (error) {
		console.log(`${Date.now()} [cli#runExercise | ${language} / ${exercise}] time limit reached`)

		// Cancel the task.
		if (rooTaskId && !isClientDisconnected) {
			client.sendMessage({
				type: IpcMessageType.TaskCommand,
				origin: IpcOrigin.Client,
				clientId: client.clientId!,
				data: { commandName: TaskCommandName.CancelTask, data: rooTaskId },
			})

			// Allow some time for the task to cancel.
			await new Promise((resolve) => setTimeout(resolve, 5_000))
		}

		await updateTask(task.id, { finishedAt: new Date() })
	}

	if (!isClientDisconnected) {
		if (rooTaskId) {
			client.sendMessage({
				type: IpcMessageType.TaskCommand,
				origin: IpcOrigin.Client,
				clientId: client.clientId!,
				data: { commandName: TaskCommandName.CloseTask, data: rooTaskId },
			})

			// Allow some time for the window to close.
			await new Promise((resolve) => setTimeout(resolve, 2_000))
		}

		client.disconnect()
	}

	controller.abort()
	await subprocess

	return { success: !!taskFinishedAt }
}

const runUnitTest = async ({ task }: { task: Task }) => {
	const cmd = testCommands[task.language]
	const exercisePath = path.resolve(exercisesPath, task.language, task.exercise)
	const cwd = cmd.cwd ? path.resolve(exercisePath, cmd.cwd) : exercisePath
	const commands = cmd.commands.map((cs) => parseCommandString(cs))

	let passed = true

	for (const command of commands) {
		try {
			console.log(
				`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] running "${command.join(" ")}"`,
			)

			const subprocess = execa({ cwd, shell: true, reject: false })`${command}`

			const timeout = setTimeout(async () => {
				const descendants = await new Promise<number[]>((resolve, reject) => {
					psTree(subprocess.pid!, (err, children) => {
						if (err) {
							reject(err)
						}

						resolve(children.map((p) => parseInt(p.PID)))
					})
				})

				console.log(
					`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] "${command.join(" ")}": unit tests timed out, killing ${subprocess.pid} + ${JSON.stringify(descendants)}`,
				)

				if (descendants.length > 0) {
					for (const descendant of descendants) {
						try {
							console.log(
								`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] killing ${descendant}`,
							)

							await execa`kill -9 ${descendant}`
						} catch (error) {
							console.error(
								`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] Error killing descendant processes:`,
								error,
							)
						}
					}
				}

				console.log(
					`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] killing ${subprocess.pid}`,
				)

				try {
					await execa`kill -9 ${subprocess.pid!}`
				} catch (error) {
					console.error(
						`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] Error killing process:`,
						error,
					)
				}
			}, UNIT_TEST_TIMEOUT)

			const result = await subprocess

			console.log(
				`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}] "${command.join(" ")}" result -> ${JSON.stringify(result)}`,
			)

			clearTimeout(timeout)

			if (result.failed) {
				passed = false
				break
			}
		} catch (error) {
			console.log(`${Date.now()} [cli#runUnitTest | ${task.language} / ${task.exercise}]`, error)
			passed = false
			break
		}
	}

	return passed
}

const createAndRunEvals = async (args: {
	model?: string
	include?: string
	exclude?: string
	exercise?: string
	concurrent?: number
	description?: string
	aiObserver?: string
	aiSteering?: string
	aiInsights?: string
	aiConfig?: string
}) => {
	const model = args.model || "anthropic/claude-3-5-haiku-20241025"
	const concurrency = args.concurrent || 1
	const includeLanguages = args.include ? (args.include.split(",") as ExerciseLanguage[]) : [...exerciseLanguages]
	const excludeLanguages = args.exclude ? (args.exclude.split(",") as ExerciseLanguage[]) : []

	// Create AI configuration from CLI arguments
	const aiConfig = createAIConfig({
		observer: args.aiObserver,
		steering: args.aiSteering,
		insights: args.aiInsights,
		configPath: args.aiConfig,
	})

	// Log AI configuration if enabled
	if (aiConfig.enabled) {
		console.log("AI-Native Evaluation Features Enabled:")
		console.log("=====================================")
		if (args.aiObserver) console.log(`• Observer Level: ${args.aiObserver}`)
		if (args.aiSteering) console.log(`• Steering Mode: ${args.aiSteering}`)
		if (args.aiInsights) console.log(`• Insights Config: ${args.aiInsights}`)
		if (args.aiConfig) console.log(`• Custom Config: ${args.aiConfig}`)
		console.log("")
	}

	// Validate languages
	for (const lang of includeLanguages) {
		if (!exerciseLanguages.includes(lang as ExerciseLanguage)) {
			throw new Error(`Invalid language: ${lang}. Valid languages are: ${exerciseLanguages.join(", ")}`)
		}
	}

	const languages = includeLanguages.filter((lang) => !excludeLanguages.includes(lang))

	if (languages.length === 0) {
		throw new Error("No languages selected for evaluation.")
	}

	// Create socket path
	const pid = process.pid
	const socketPath = `/tmp/roo-code-ipc-${pid}.sock`

	// Create run
	const run = await createRun({
		model,
		description: args.description,
		socketPath,
		pid,
		concurrency,
		passed: 0,
		failed: 0,
		settings: {
			apiProvider: "openrouter",
			openRouterModelId: model,
		},
	})

	console.log(`Created run #${run.id} with model ${model}`)
	console.log(`Testing languages: ${languages.join(", ")}`)

	// Create tasks for each language/exercise combination
	if (args.exercise) {
		// Single exercise mode
		const exerciseName = args.exercise
		let taskCreated = false

		for (const language of languages) {
			const exercises = await getExercisesForLanguage(language)
			if (exercises.includes(exerciseName)) {
				await createTask({
					runId: run.id,
					language,
					exercise: exerciseName,
				})
				console.log(`Created 1 task for ${language}/${exerciseName}`)
				taskCreated = true
			}
		}

		if (!taskCreated) {
			throw new Error(`Exercise "${exerciseName}" not found in languages: ${languages.join(", ")}`)
		}
	} else {
		// Multi exercise mode (original behavior)
		for (const language of languages) {
			const exercises = await getExercisesForLanguage(language)
			for (const exercise of exercises) {
				await createTask({
					runId: run.id,
					language,
					exercise,
				})
			}
			console.log(`Created ${exercises.length} tasks for ${language}`)
		}
	}

	// Run the evaluation with AI configuration
	return runEvals(run.id, aiConfig)
}

const main = async () => {
	const result = await run(
		command({
			name: "cli",
			description: "Execute evaluation runs for Roo Code.",
			version: "0.0.0",
			args: {
				runId: option({
					type: optional(number),
					long: "run-id",
					short: "r",
					description: "Existing run ID to execute",
				}),
				model: option({
					type: optional(string),
					long: "model",
					short: "m",
					description: "Model to use (default: anthropic/claude-3-5-haiku-20241022)",
				}),
				include: option({
					type: optional(string),
					long: "include",
					short: "i",
					description: "Comma-separated list of languages to include",
				}),
				exclude: option({
					type: optional(string),
					long: "exclude",
					short: "e",
					description: "Comma-separated list of languages to exclude",
				}),
				exercise: option({
					type: optional(string),
					long: "exercise",
					short: "x",
					description: "Run only this specific exercise name (e.g., 'two-fer')",
				}),
				concurrent: option({
					type: optional(number),
					long: "concurrent",
					short: "c",
					description: "Number of concurrent tasks (default: 2)",
				}),
				description: option({
					type: optional(string),
					long: "description",
					short: "d",
					description: "Description for the run",
				}),
				// AI Observer flags
				aiObserver: option({
					type: optional(string),
					long: "ai-observer",
					description:
						"Enable AI observation with level: 'basic', 'full', or 'autonomous' (default: disabled)",
				}),
				aiSteering: option({
					type: optional(string),
					long: "ai-steering",
					description:
						"Enable AI steering capabilities: 'monitor-only', 'suggest', or 'auto' (default: disabled)",
				}),
				aiInsights: option({
					type: optional(string),
					long: "ai-insights",
					description: "AI insights configuration: 'store', 'export', or 'realtime' (default: disabled)",
				}),
				aiConfig: option({
					type: optional(string),
					long: "ai-config",
					description: "Path to AI observer configuration file",
				}),
			},
			handler: async (args) => {
				// Create AI configuration from CLI arguments (for both new and existing runs)
				const aiConfig = createAIConfig({
					observer: args.aiObserver,
					steering: args.aiSteering,
					insights: args.aiInsights,
					configPath: args.aiConfig,
				})

				// If runId is provided, just run the existing evaluation with AI config
				if (args.runId !== undefined) {
					if (aiConfig.enabled) {
						console.log("AI features enabled for existing run", args.runId)
					}
					return runEvals(args.runId, aiConfig)
				}

				// Otherwise, create a new run with the provided options
				return createAndRunEvals(args)
			},
		}),
		process.argv.slice(2),
	)

	console.log(result)
	process.exit(0)
}

if (!fs.existsSync(exercisesPath)) {
	console.error(
		`Exercises do not exist at ${exercisesPath}. Please run "git clone https://github.com/RooCodeInc/Roo-Code-Evals.git evals".`,
	)
	process.exit(1)
}

main()
