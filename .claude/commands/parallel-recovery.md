# Parallel Recovery

Quick recovery tool for interrupted parallel development work.

## Variables

PLAN_PATH: $ARGUMENTS
CONTEXT: $ARGUMENTS (optional)

## Quick Execute

### Phase 1: Analysis

1. SCAN for worktrees in current directory and `trees/`
2. CHECK git status in each worktree
3. READ the plan file
4. GENERATE PROGRESS.md files where missing
5. UPDATE existing PROGRESS.md files with current status

### Phase 2: Resume Work

6. LAUNCH Task agents to continue work in each worktree
7. Agents use PROGRESS.md and original plan to resume

## Minimal Workflow

For each worktree found:

```
1. Run: git status --short
2. Check: ls PROGRESS.md
3. Analyze: What was being implemented
4. Generate: PROGRESS.md with current state
```

## PROGRESS.md Template

```markdown
# [Worktree Name] Progress

## Status Summary

- Started: [files with modifications]
- Completed: [files that appear done]
- Not Started: [plan items with no corresponding changes]

## Git Status

[output of git status]

## Next Steps

1. [Highest priority based on plan]
2. [Next item]
3. [Following item]

## Notes

[Any context provided or detected issues]
```

## Usage

```bash
# Simple recovery and resume
/parallel-recovery packages/evals/specs/OTel/opentelemetry-integration-plan.md

# With context
/parallel-recovery packages/evals/specs/OTel/opentelemetry-integration-plan.md "crashed during IPC implementation"
```

## What Happens

1. **Finds all worktrees** and analyzes their state
2. **Generates PROGRESS.md** with current status and remaining work
3. **Launches agents** to continue implementation in parallel
4. Each agent works independently in their worktree
5. Agents create **RESULTS.md** when complete

The agents will:

- Read their worktree's PROGRESS.md
- Continue with the "Next Steps" section
- Follow the original plan
- Maintain the implementation style already started
- Update PROGRESS.md as they work
