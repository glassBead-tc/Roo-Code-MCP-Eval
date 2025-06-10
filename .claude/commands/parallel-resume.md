# Parallel Resume

Resume interrupted parallel development by analyzing progress and launching agents to continue work.

## Variables

PLAN_PATH: $ARGUMENTS
CONTEXT: $ARGUMENTS (optional)

## Execute

### Phase 1: Recovery Analysis

1. SCAN for worktrees in current directory and `trees/`
2. CHECK git status in each worktree
3. READ the plan file
4. GENERATE/UPDATE PROGRESS.md files in each worktree

### Phase 2: Resume Work

5. COUNT number of worktrees found
6. LAUNCH parallel Task agents (one per worktree)
7. Each agent CONTINUES work based on:
    - Original plan
    - PROGRESS.md in their worktree
    - Any provided context

## Workflow

### 1. Discover and Analyze Worktrees

```bash
# Find all worktrees
find trees/ -maxdepth 1 -type d -name "*-[0-9]" | sort

# For each worktree:
- git status --short
- Check for PROGRESS.md
- Analyze implementation state
```

### 2. Generate/Update PROGRESS.md

Each PROGRESS.md contains:

```markdown
# Progress Report - [Worktree Name]

## Completed ✅

[Based on git status and file analysis]

## In Progress 🚧

[Partially completed work]

## Remaining TODOs 📋

[From original plan, filtered by completion]

## Resume Instructions

[Specific guidance for the agent]

## Context

[Any crash context or additional info]
```

### 3. Launch Parallel Agents

```
For each worktree:
  Launch Task agent with prompt:
  - "Continue implementation in [worktree path]"
  - "Follow the plan at [PLAN_PATH]"
  - "Resume from PROGRESS.md in your worktree"
  - "Focus on Remaining TODOs section"
  - "Create RESULTS.md when complete"
  - "Do not start any servers"
```

## Agent Instructions Template

Each agent receives:

```
You are resuming work on an interrupted implementation.

Workspace: trees/[worktree-name]/
Original Plan: [PLAN_PATH]
Progress Report: PROGRESS.md (in your workspace)

Instructions:
1. Read PROGRESS.md to understand current state
2. Continue with "Remaining TODOs" section
3. Follow the implementation approach already started
4. Maintain consistency with existing code style
5. Run tests to verify changes
6. Update PROGRESS.md as you complete tasks
7. Create RESULTS.md with final summary when done

Context: [any provided context]

Do not start servers or long-running processes.
Focus only on code implementation and testing.
```

## Usage Examples

```bash
# Basic resume - finds worktrees and continues
/parallel-resume "packages/evals/specs/OTel/opentelemetry-integration-plan.md"

# Resume with context about the interruption
/parallel-resume "packages/evals/specs/OTel/opentelemetry-integration-plan.md" "Crashed during IPC message type implementation"

# Resume with detailed context file
/parallel-resume "packages/evals/specs/OTel/opentelemetry-integration-plan.md" "recovery-notes.md"
```

## Features

### Smart Recovery

- Detects partially implemented functions
- Identifies which approach each worktree was taking
- Preserves implementation strategy per worktree

### Parallel Execution

- Launches all agents simultaneously
- Each works independently in their worktree
- No conflicts between parallel implementations

### Progress Tracking

- Agents update PROGRESS.md as they work
- Can check progress with: `tail -f trees/*/PROGRESS.md`
- Final RESULTS.md in each worktree

### Safety Features

- Agents work in isolated worktrees
- No server starts or long-running processes
- Automatic progress checkpoints

## Example Output

```
Found 3 worktrees to resume:
- trees/opentelemetry-integration-plan-1/ (40% complete)
- trees/opentelemetry-integration-plan-2/ (15% complete)
- trees/opentelemetry-integration-plan-3/ (60% complete)

Generating/updating PROGRESS.md files...
✓ Updated trees/opentelemetry-integration-plan-1/PROGRESS.md
✓ Updated trees/opentelemetry-integration-plan-2/PROGRESS.md
✓ Updated trees/opentelemetry-integration-plan-3/PROGRESS.md

Launching 3 parallel agents to resume work...
✓ Agent 1 started in trees/opentelemetry-integration-plan-1/
✓ Agent 2 started in trees/opentelemetry-integration-plan-2/
✓ Agent 3 started in trees/opentelemetry-integration-plan-3/

Agents are now working. Check progress with:
  tail -f trees/*/PROGRESS.md
```

## Advanced Options

```bash
# Resume specific worktrees only
/parallel-resume "plan.md" --worktrees="1,3"

# Resume with different strategies
/parallel-resume "plan.md" --strategy="conservative"

# Dry run - only generate PROGRESS.md
/parallel-resume "plan.md" --dry-run
```
