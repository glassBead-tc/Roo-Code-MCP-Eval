/**
 * Stream B: State Inspection Debug Utilities
 *
 * This module provides efficient state inspection tools for debugging
 * AI agent premature completion issues in the Roo Code extension.
 *
 * Focus: Performance and efficiency - minimal overhead inspection tools
 */

export interface TaskStateSnapshot {
	// Task Identification
	taskId: string
	instanceId: string
	timestamp: number

	// Phase Information
	currentPhase: string
	isInitialized: boolean
	isPaused: boolean
	isStreaming: boolean

	// Conversation State
	apiConversationLength: number
	clineMessagesLength: number
	lastMessageType?: string
	lastMessageTs?: number

	// Tool Use State
	assistantMessageContentLength: number
	currentStreamingContentIndex: number
	didCompleteReadingStream: boolean
	userMessageContentReady: boolean
	didRejectTool: boolean
	didAlreadyUseTool: boolean

	// Completion State
	consecutiveMistakeCount: number
	consecutiveMistakeLimit: number
	toolUsage: Record<string, any>

	// File System Context
	workspacePath: string
	fileContextSize: number

	// Decision Context
	lastToolName?: string
	lastToolPartial?: boolean
	presentAssistantMessageLocked: boolean
	presentAssistantMessageHasPendingUpdates: boolean
}

export interface CompletionDecisionContext {
	trigger: string
	reason: string
	hasImplementation: boolean
	hasTestsPassed: boolean
	hasValidOutput: boolean
	fileChanges: string[]
	toolsUsed: string[]
	phaseTransition: string
}

export class StateInspector {
	private breakpoints: Set<string> = new Set()
	private snapshots: TaskStateSnapshot[] = []
	private completionDecisions: CompletionDecisionContext[] = []

	constructor(private enabled: boolean = true) {}

	/**
	 * Capture a comprehensive state snapshot with minimal performance impact
	 */
	captureStateSnapshot(task: any, context: string): TaskStateSnapshot {
		if (!this.enabled) return {} as TaskStateSnapshot

		// Store current task reference for logging
		;(this as any).currentTask = task

		const snapshot: TaskStateSnapshot = {
			taskId: task.taskId,
			instanceId: task.instanceId,
			timestamp: Date.now(),

			// Phase Information
			currentPhase: this.detectCurrentPhase(task),
			isInitialized: task.isInitialized,
			isPaused: task.isPaused,
			isStreaming: task.isStreaming,

			// Conversation State
			apiConversationLength: task.apiConversationHistory?.length || 0,
			clineMessagesLength: task.clineMessages?.length || 0,
			lastMessageType: task.clineMessages?.at(-1)?.type,
			lastMessageTs: task.lastMessageTs,

			// Tool Use State
			assistantMessageContentLength: task.assistantMessageContent?.length || 0,
			currentStreamingContentIndex: task.currentStreamingContentIndex,
			didCompleteReadingStream: task.didCompleteReadingStream,
			userMessageContentReady: task.userMessageContentReady,
			didRejectTool: task.didRejectTool,
			didAlreadyUseTool: task.didAlreadyUseTool,

			// Completion State
			consecutiveMistakeCount: task.consecutiveMistakeCount,
			consecutiveMistakeLimit: task.consecutiveMistakeLimit,
			toolUsage: task.toolUsage || {},

			// File System Context
			workspacePath: task.workspacePath,
			fileContextSize: task.fileContextTracker?.getTrackedFiles()?.length || 0,

			// Decision Context
			lastToolName: this.getLastToolName(task),
			lastToolPartial: this.getLastToolPartial(task),
			presentAssistantMessageLocked: task.presentAssistantMessageLocked,
			presentAssistantMessageHasPendingUpdates: task.presentAssistantMessageHasPendingUpdates,
		}

		this.snapshots.push(snapshot)
		this.logStateSnapshot(snapshot, context)

		return snapshot
	}

	/**
	 * Set a breakpoint for state inspection
	 */
	setBreakpoint(name: string): void {
		this.breakpoints.add(name)
		console.log(`[STATE-INSPECTOR] Breakpoint set: ${name}`)
	}

	/**
	 * Check if execution should pause at a breakpoint
	 */
	shouldBreak(name: string): boolean {
		return this.breakpoints.has(name)
	}

	/**
	 * Log completion decision with context
	 */
	logCompletionDecision(context: CompletionDecisionContext): void {
		if (!this.enabled) return

		this.completionDecisions.push(context)

		const logMessages = [
			`[COMPLETION-DEBUG] Decision: trigger=${context.trigger}, reason=${context.reason}, hasImplementation=${context.hasImplementation}`,
			`[COMPLETION-DEBUG] Context: toolsUsed=[${context.toolsUsed.join(", ")}], fileChanges=[${context.fileChanges.join(", ")}]`,
			`[COMPLETION-DEBUG] Phase: ${context.phaseTransition}`,
		]

		logMessages.forEach((msg) => {
			console.log(msg)
			// Try to get provider logger from task if available
			const task = (this as any).currentTask
			if (task?.providerRef?.deref()?.log) {
				task.providerRef.deref().log(msg)
			}
		})
	}

	/**
	 * Efficient detection of current task phase
	 */
	private detectCurrentPhase(task: any): string {
		if (!task.isInitialized) return "initializing"
		if (task.isPaused) return "paused"
		if (task.isStreaming) return "streaming"
		if (task.didCompleteReadingStream && !task.userMessageContentReady) return "processing"
		if (task.userMessageContentReady) return "ready"

		// Analyze last messages to determine phase
		const lastMessages = task.clineMessages?.slice(-3) || []
		const hasAnalysisMessages = lastMessages.some(
			(msg: any) =>
				msg.text?.includes("analyzing") ||
				msg.text?.includes("understanding") ||
				msg.text?.includes("examining"),
		)

		const hasImplementationMessages = lastMessages.some(
			(msg: any) =>
				msg.text?.includes("writing") || msg.text?.includes("creating") || msg.text?.includes("implementing"),
		)

		if (hasImplementationMessages) return "implementation"
		if (hasAnalysisMessages) return "analysis"

		return "unknown"
	}

	/**
	 * Extract last tool name from assistant message content
	 */
	private getLastToolName(task: any): string | undefined {
		const content = task.assistantMessageContent
		if (!content || content.length === 0) return undefined

		for (let i = content.length - 1; i >= 0; i--) {
			if (content[i].type === "tool_use") {
				return content[i].name
			}
		}
		return undefined
	}

	/**
	 * Check if last tool is partial
	 */
	private getLastToolPartial(task: any): boolean | undefined {
		const content = task.assistantMessageContent
		if (!content || content.length === 0) return undefined

		for (let i = content.length - 1; i >= 0; i--) {
			if (content[i].type === "tool_use") {
				return content[i].partial
			}
		}
		return undefined
	}

	/**
	 * Log state snapshot with structured output
	 */
	private logStateSnapshot(snapshot: TaskStateSnapshot, context: string): void {
		const logMessages = [
			`[STATE-SNAPSHOT] Context: ${context}`,
			`[STATE-SNAPSHOT] Task: ${snapshot.taskId}.${snapshot.instanceId}`,
			`[STATE-SNAPSHOT] Phase: ${snapshot.currentPhase}`,
			`[STATE-SNAPSHOT] Streaming: index=${snapshot.currentStreamingContentIndex}/${snapshot.assistantMessageContentLength}, completed=${snapshot.didCompleteReadingStream}, ready=${snapshot.userMessageContentReady}`,
			`[STATE-SNAPSHOT] Messages: api=${snapshot.apiConversationLength}, cline=${snapshot.clineMessagesLength}`,
			`[STATE-SNAPSHOT] Tools: lastTool=${snapshot.lastToolName}, partial=${snapshot.lastToolPartial}, rejected=${snapshot.didRejectTool}, alreadyUsed=${snapshot.didAlreadyUseTool}`,
			`[STATE-SNAPSHOT] Mistakes: ${snapshot.consecutiveMistakeCount}/${snapshot.consecutiveMistakeLimit}`,
		]

		logMessages.forEach((msg) => {
			console.log(msg)
			// Try to get provider logger from task if available
			const task = (this as any).currentTask
			if (task?.providerRef?.deref()?.log) {
				task.providerRef.deref().log(msg)
			}
		})
	}

	/**
	 * Get all snapshots for analysis
	 */
	getSnapshots(): TaskStateSnapshot[] {
		return [...this.snapshots]
	}

	/**
	 * Get completion decisions for analysis
	 */
	getCompletionDecisions(): CompletionDecisionContext[] {
		return [...this.completionDecisions]
	}

	/**
	 * Generate analysis report
	 */
	generateAnalysisReport(): string {
		const report = []

		report.push("# State Inspection Analysis Report")
		report.push("")
		report.push(`## Summary`)
		report.push(`- Total snapshots: ${this.snapshots.length}`)
		report.push(`- Completion decisions: ${this.completionDecisions.length}`)
		report.push("")

		// Phase progression analysis
		if (this.snapshots.length > 0) {
			report.push("## Phase Progression")
			const phases = this.snapshots.map((s) => s.currentPhase)
			const uniquePhases = [...new Set(phases)]
			report.push(`- Phases observed: ${uniquePhases.join(" → ")}`)
			report.push("")
		}

		// Completion decision analysis
		if (this.completionDecisions.length > 0) {
			report.push("## Completion Decisions")
			this.completionDecisions.forEach((decision, i) => {
				report.push(`### Decision ${i + 1}`)
				report.push(`- Trigger: ${decision.trigger}`)
				report.push(`- Reason: ${decision.reason}`)
				report.push(`- Has implementation: ${decision.hasImplementation}`)
				report.push(`- Tools used: ${decision.toolsUsed.join(", ")}`)
				report.push(`- File changes: ${decision.fileChanges.join(", ")}`)
				report.push("")
			})
		}

		return report.join("\n")
	}

	/**
	 * Clear all collected data
	 */
	clear(): void {
		this.snapshots.length = 0
		this.completionDecisions.length = 0
		this.breakpoints.clear()
	}
}

// Global state inspector instance
export const stateInspector = new StateInspector(true)

// Debugging utilities for injecting into key workflow points
export const debugUtils = {
	/**
	 * Inject at task loop entry
	 */
	onTaskLoopStart(task: any): void {
		stateInspector.captureStateSnapshot(task, "task_loop_start")

		if (stateInspector.shouldBreak("task_loop_start")) {
			console.log("[DEBUG-BREAK] Task loop start - inspect state")
			// In a real debugging session, this would trigger a debugger breakpoint
		}
	},

	/**
	 * Inject at completion decision points
	 */
	onCompletionCheck(task: any, reason: string): void {
		const context: CompletionDecisionContext = {
			trigger: "completion_check",
			reason,
			hasImplementation: debugUtils.checkHasImplementation(task),
			hasTestsPassed: debugUtils.checkTestsPassed(task),
			hasValidOutput: debugUtils.checkValidOutput(task),
			fileChanges: debugUtils.getFileChanges(task),
			toolsUsed: debugUtils.getToolsUsed(task),
			phaseTransition: debugUtils.getPhaseTransition(task),
		}

		stateInspector.logCompletionDecision(context)
		stateInspector.captureStateSnapshot(task, `completion_check: ${reason}`)
	},

	/**
	 * Inject at tool execution points
	 */
	onToolExecution(task: any, toolName: string, params: any): void {
		const debugMessage = `[TOOL-DEBUG] Executing: ${toolName} with params: ${JSON.stringify(params, null, 2)}`
		console.log(debugMessage)
		task?.providerRef?.deref()?.log(debugMessage)

		stateInspector.captureStateSnapshot(task, `tool_execution: ${toolName}`)

		if (stateInspector.shouldBreak("tool_execution")) {
			const breakMessage = `[DEBUG-BREAK] Tool execution: ${toolName} - inspect state`
			console.log(breakMessage)
			task?.providerRef?.deref()?.log(breakMessage)
		}
	},

	/**
	 * Inject at phase transitions
	 */
	onPhaseTransition(task: any, fromPhase: string, toPhase: string): void {
		const debugMessage = `[PHASE-DEBUG] Transition: ${fromPhase} → ${toPhase}`
		console.log(debugMessage)
		task?.providerRef?.deref()?.log(debugMessage)
		stateInspector.captureStateSnapshot(task, `phase_transition: ${fromPhase}_to_${toPhase}`)
	},

	// Helper methods for analyzing completion context
	checkHasImplementation(task: any): boolean {
		const fileChanges = this.getFileChanges(task)
		return fileChanges.some((file) => file.endsWith(".js") || file.endsWith(".ts") || file.endsWith(".py"))
	},

	checkTestsPassed(task: any): boolean {
		// Check recent messages for test results
		const recentMessages = task.clineMessages?.slice(-5) || []
		return recentMessages.some(
			(msg: any) =>
				msg.text?.includes("tests pass") || msg.text?.includes("all tests") || msg.text?.includes("✓"),
		)
	},

	checkValidOutput(task: any): boolean {
		// Check if there's been recent command output
		const recentMessages = task.clineMessages?.slice(-3) || []
		return recentMessages.some((msg: any) => msg.type === "say" && msg.say === "command_output")
	},

	getFileChanges(task: any): string[] {
		// Get files that have been tracked/modified
		const tracked = task.fileContextTracker?.getTrackedFiles() || []
		return tracked.map((file: any) => file.path || file).slice(0, 10) // Limit for performance
	},

	getToolsUsed(task: any): string[] {
		return Object.keys(task.toolUsage || {})
	},

	getPhaseTransition(task: any): string {
		const currentPhase = stateInspector.captureStateSnapshot(task, "temp").currentPhase
		return `current_${currentPhase}`
	},
}
