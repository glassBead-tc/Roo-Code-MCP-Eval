# Specification: AI Agent Completion Debugging System

## Problem Statement

The Roo Code AI agent successfully activates via IPC and performs comprehensive task analysis, but prematurely marks subtasks as "completed" without proceeding to the implementation phase. This results in incomplete evaluations that fail to produce working code.

## Current State

**Working Components:**

- ✅ IPC communication (socket creation, connection, message sending)
- ✅ Task delivery (prompt reaches agent successfully)
- ✅ Analysis phase (agent reads docs, understands requirements)
- ✅ Extension UI activation (Roo Code interface appears)

**Failing Component:**

- ❌ Implementation phase (agent stops at analysis, doesn't write code)

## Root Cause Hypothesis

The agent's completion criteria are misaligned - it considers "understanding the task" equivalent to "completing the task", rather than proceeding through the full workflow: Analysis → Implementation → Verification.

## Objective

Create a multi-faceted debugging system that identifies and fixes why the AI agent stops at analysis instead of proceeding to code implementation.

## Architecture: Orchestrated Debugging Approach

### Phase 1: Parallel Investigation Streams

#### Stream A: Decision Point Analysis (debug-printf)

**Objective:** Expose the agent's internal reasoning about task completion

**Target Files:**

- Roo Code extension task orchestration logic
- Completion validation routines
- Subtask management code

**Instrumentation Points:**

```javascript
// Where completion decisions are made
console.debug(
	"[COMPLETION-DEBUG] Decision: task=%s, phase=%s, completed=%s, reason=%s",
	taskId,
	currentPhase,
	isCompleted,
	completionReason,
)

// Where subtasks are marked complete
console.debug(
	"[SUBTASK-DEBUG] Marking complete: id=%s, criteria=%s, hasImplementation=%s",
	subtaskId,
	completionCriteria,
	hasImplementationFile,
)
```

#### Stream B: State Inspection (debug-interactive)

**Objective:** Capture exact agent state at premature completion

**Breakpoint Locations:**

- Task phase transition logic
- Completion validation functions
- File creation/modification checks

#### Stream C: Minimal Reproduction (debug-reproduce)

**Objective:** Create deterministic test that triggers the bug

**Test Case:**

- Minimal affine-cipher exercise
- Single evaluation run
- Clear success/failure criteria

### Phase 2: Workflow State Machine Analysis

#### Current Workflow Investigation

```javascript
// Expected workflow
const ExpectedWorkflow = {
	phases: ["activate", "analyze", "implement", "verify"],
	transitions: {
		"analyze → implement": {
			condition: "hasRequirements && hasAnalysis",
			guard: "!shouldStopEarly()",
		},
	},
}
```

#### Completion Criteria Audit

- What triggers "Subtask Completed"?
- Are there missing implementation requirements?
- Is there a phase transition that's being skipped?

### Phase 3: Instrumentation & Monitoring

#### Real-time Agent Behavior Tracking

```javascript
const AgentMonitor = {
	trackPhaseProgress: (phase, duration, artifacts) => {
		// Log phase completion with artifacts created
	},
	detectPrematureCompletion: (expectedPhases, actualPhases) => {
		// Alert when workflow terminates early
	},
	validateImplementationArtifacts: (workspaceFiles) => {
		// Check for actual code files created
	},
}
```

## Implementation Strategy

### Step 1: Setup Parallel Worktrees

```bash
# Create three investigation branches
git worktree add ../debug-printf-stream step-6-debug-printf
git worktree add ../debug-interactive-stream step-6-debug-interactive
git worktree add ../debug-reproduce-stream step-6-debug-reproduce
```

### Step 2: Stream A - Printf Investigation

**Target:** Add comprehensive logging to Roo Code extension

**Files to Instrument:**

- Task orchestration entry points
- Completion validation logic
- Subtask management routines

**Expected Findings:**

- Exact decision point where completion is triggered
- Completion criteria being evaluated
- Missing transition conditions

### Step 3: Stream B - Interactive Debugging

**Target:** Set breakpoints in critical workflow areas

**Inspection Points:**

- Task state at completion decision
- Available file system context
- Phase transition logic

**Expected Findings:**

- Agent internal state when it decides to stop
- What information is/isn't available to continue
- Workflow state machine current position

### Step 4: Stream C - Reproduction Case

**Target:** Create minimal failing test

**Test Design:**

- Single affine-cipher exercise
- Instrumented CLI execution
- Clear pass/fail criteria (implementation file exists)

**Expected Findings:**

- Reliable reproduction of the issue
- Timing of the premature completion
- Environmental factors that influence the bug

### Step 5: Solution Synthesis

**Combine findings from all streams to:**

- Identify root cause of premature completion
- Design fix for workflow continuation
- Implement completion criteria corrections
- Validate fix with reproduction test

## Success Criteria

**Primary Success:**

- AI agent proceeds from analysis to implementation phase
- Agent creates working affine-cipher.js implementation
- Tests pass after agent completion

**Secondary Success:**

- Reliable reproduction case for testing
- Comprehensive instrumentation for future debugging
- Clear understanding of agent workflow state machine

**Validation:**

- Multiple successful evaluation runs
- Non-zero token usage with actual code generation
- MCP server usage detected in telemetry

## Deliverables

1. **Instrumented Roo Code extension** with comprehensive debugging
2. **Minimal reproduction test case** that reliably triggers the issue
3. **Root cause analysis document** explaining why agent stops early
4. **Workflow fix implementation** that ensures continuation to implementation
5. **Validation test suite** confirming the fix works consistently

## Risk Mitigation

**Risk:** Multiple worktrees become difficult to coordinate  
**Mitigation:** Clear branch naming and regular synchronization points

**Risk:** Instrumentation affects agent behavior  
**Mitigation:** Minimal, targeted logging that doesn't change core logic

**Risk:** Root cause is in upstream dependencies  
**Mitigation:** Include external dependency analysis in investigation scope

## Timeline

- **Phase 1 Setup:** 30 minutes (worktree creation, branch setup)
- **Stream A (Printf):** 60 minutes (instrumentation, test run, analysis)
- **Stream B (Interactive):** 45 minutes (breakpoint setup, debugging session)
- **Stream C (Reproduce):** 30 minutes (minimal test case creation)
- **Synthesis:** 45 minutes (findings analysis, solution design)
- **Implementation:** 60 minutes (fix development and validation)

**Total Estimated Time:** 4.5 hours

## Notes

This specification provides a systematic, multi-angle approach to debugging the AI agent completion issue while maintaining the orchestrated, "swarm mathematics" methodology that Resonance would have employed. The parallel investigation streams allow for comprehensive coverage while the synthesis phase ensures coordinated findings.
