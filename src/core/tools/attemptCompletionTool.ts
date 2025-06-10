import Anthropic from "@anthropic-ai/sdk"

import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../task/Task"
import {
	ToolResponse,
	ToolUse,
	AskApproval,
	HandleError,
	PushToolResult,
	RemoveClosingTag,
	ToolDescription,
	AskFinishSubTaskApproval,
} from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { type ExecuteCommandOptions, executeCommand } from "./executeCommandTool"

export async function attemptCompletionTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
	toolDescription: ToolDescription,
	askFinishSubTaskApproval: AskFinishSubTaskApproval,
) {
	const result: string | undefined = block.params.result
	const command: string | undefined = block.params.command

	// DEBUG: Log attempt completion decision
	console.debug("[COMPLETION-DEBUG] attemptCompletionTool called", {
		taskId: cline.taskId,
		instanceId: cline.instanceId,
		isPartial: block.partial,
		hasResult: !!result,
		hasCommand: !!command,
		resultPreview: result ? result.slice(0, 200) + "..." : null,
		commandPreview: command ? command.slice(0, 100) + "..." : null,
		parentTask: !!cline.parentTask,
		messageCount: cline.clineMessages.length,
		apiMessageCount: cline.apiConversationHistory.length,
	})

	try {
		const lastMessage = cline.clineMessages.at(-1)

		if (block.partial) {
			if (command) {
				// the attempt_completion text is done, now we're getting command
				// remove the previous partial attempt_completion ask, replace with say, post state to webview, then stream command

				// const secondLastMessage = cline.clineMessages.at(-2)
				if (lastMessage && lastMessage.ask === "command") {
					// update command
					await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				} else {
					// last message is completion_result
					// we have command string, which means we have the result as well, so finish it (doesnt have to exist yet)
					await cline.say("completion_result", removeClosingTag("result", result), undefined, false)

					TelemetryService.instance.captureTaskCompleted(cline.taskId)
					cline.emit("taskCompleted", cline.taskId, cline.getTokenUsage(), cline.toolUsage)

					await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				}
			} else {
				// no command, still outputting partial result
				await cline.say("completion_result", removeClosingTag("result", result), undefined, block.partial)
			}
			return
		} else {
			console.debug("[COMPLETION-DEBUG] Processing non-partial completion", {
				taskId: cline.taskId,
				hasResult: !!result,
				resultLength: result?.length || 0,
			})

			if (!result) {
				console.debug("[COMPLETION-DEBUG] Missing result parameter - treating as mistake", {
					taskId: cline.taskId,
					consecutiveMistakeCount: cline.consecutiveMistakeCount + 1,
				})
				cline.consecutiveMistakeCount++
				cline.recordToolError("attempt_completion")
				pushToolResult(await cline.sayAndCreateMissingParamError("attempt_completion", "result"))
				return
			}

			console.debug("[COMPLETION-DEBUG] Valid completion attempt", {
				taskId: cline.taskId,
				resetMistakeCount: true,
				previousMistakeCount: cline.consecutiveMistakeCount,
			})
			cline.consecutiveMistakeCount = 0

			let commandResult: ToolResponse | undefined

			if (command) {
				if (lastMessage && lastMessage.ask !== "command") {
					// Haven't sent a command message yet so first send completion_result then command.
					console.debug("[COMPLETION-DEBUG] Sending completion_result with command", {
						taskId: cline.taskId,
						result: result,
						command: command,
					})
					await cline.say("completion_result", result, undefined, false)
					console.debug("[COMPLETION-DEBUG] Task marked as completed (with command)", {
						taskId: cline.taskId,
						tokenUsage: cline.getTokenUsage(),
						toolUsage: cline.toolUsage,
					})
					TelemetryService.instance.captureTaskCompleted(cline.taskId)
					cline.emit("taskCompleted", cline.taskId, cline.getTokenUsage(), cline.toolUsage)
				}

				// Complete command message.
				const didApprove = await askApproval("command", command)

				if (!didApprove) {
					return
				}

				const executionId = cline.lastMessageTs?.toString() ?? Date.now().toString()
				const options: ExecuteCommandOptions = { executionId, command }
				const [userRejected, execCommandResult] = await executeCommand(cline, options)

				if (userRejected) {
					cline.didRejectTool = true
					pushToolResult(execCommandResult)
					return
				}

				// User didn't reject, but the command may have output.
				commandResult = execCommandResult
			} else {
				console.debug("[COMPLETION-DEBUG] Sending completion_result without command", {
					taskId: cline.taskId,
					result: result,
				})
				await cline.say("completion_result", result, undefined, false)
				console.debug("[COMPLETION-DEBUG] Task marked as completed (no command)", {
					taskId: cline.taskId,
					tokenUsage: cline.getTokenUsage(),
					toolUsage: cline.toolUsage,
				})
				TelemetryService.instance.captureTaskCompleted(cline.taskId)
				cline.emit("taskCompleted", cline.taskId, cline.getTokenUsage(), cline.toolUsage)
			}

			if (cline.parentTask) {
				console.debug("[COMPLETION-DEBUG] Subtask completion - asking for approval", {
					taskId: cline.taskId,
					parentTaskId: cline.parentTask.taskId,
				})
				const didApprove = await askFinishSubTaskApproval()

				if (!didApprove) {
					console.debug("[COMPLETION-DEBUG] Subtask completion denied by user", {
						taskId: cline.taskId,
					})
					return
				}

				console.debug("[COMPLETION-DEBUG] Subtask approved - finishing subtask", {
					taskId: cline.taskId,
					parentTaskId: cline.parentTask.taskId,
					result: result,
				})
				// tell the provider to remove the current subtask and resume the previous task in the stack
				await cline.providerRef.deref()?.finishSubTask(result)
				return
			}

			// We already sent completion_result says, an
			// empty string asks relinquishes control over
			// button and field.
			console.debug("[COMPLETION-DEBUG] Main task completion - asking user for final approval", {
				taskId: cline.taskId,
				result: result,
			})
			const { response, text, images } = await cline.ask("completion_result", "", false)

			// Signals to recursive loop to stop (for now
			// cline never happens since yesButtonClicked
			// will trigger a new task).
			if (response === "yesButtonClicked") {
				console.debug("[COMPLETION-DEBUG] User approved completion - task ending", {
					taskId: cline.taskId,
					finalResponse: "yesButtonClicked",
				})
				pushToolResult("")
				return
			}

			console.debug("[COMPLETION-DEBUG] User provided feedback instead of approval", {
				taskId: cline.taskId,
				response: response,
				feedbackText: text,
			})

			await cline.say("user_feedback", text ?? "", images)
			const toolResults: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []

			if (commandResult) {
				if (typeof commandResult === "string") {
					toolResults.push({ type: "text", text: commandResult })
				} else if (Array.isArray(commandResult)) {
					toolResults.push(...commandResult)
				}
			}

			toolResults.push({
				type: "text",
				text: `The user has provided feedback on the results. Consider their input to continue the task, and then attempt completion again.\n<feedback>\n${text}\n</feedback>`,
			})

			toolResults.push(...formatResponse.imageBlocks(images))
			cline.userMessageContent.push({ type: "text", text: `${toolDescription()} Result:` })
			cline.userMessageContent.push(...toolResults)

			return
		}
	} catch (error) {
		await handleError("inspecting site", error)
		return
	}
}
