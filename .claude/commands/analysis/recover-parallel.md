# Recover Parallel Work

Recover from interrupted parallel development by analyzing progress and generating PROGRESS.md files.

## Variables

PLAN_FILE: $ARGUMENTS[0]
ADDITIONAL_INFO: $ARGUMENTS[1] (optional - can be comments or path to .md file)

## Execute

1. FIND all worktree directories (usually in `trees/` or project root)
2. ANALYZE git status in each worktree to determine progress
3. READ the original plan file to understand objectives
4. CHECK for existing PROGRESS.md files
5. GENERATE or UPDATE PROGRESS.md in each worktree
6. INCORPORATE additional info if provided

## Workflow

### 1. Discover Worktrees

```bash
# Find all git worktrees
git worktree list

# Or find by directory pattern
find . -name "trees" -type d
find trees/ -maxdepth 1 -type d
```

### 2. Analyze Each Worktree

For each worktree:

- Check git status for modified/new files
- Diff against base branch to see changes
- Identify which parts of plan were implemented
- Detect any partial implementations

### 3. Generate PROGRESS.md

Each PROGRESS.md will contain:

- **Completed Tasks** - Based on git status and file analysis
- **In Progress** - Partially modified files
- **Remaining TODOs** - From original plan minus completed
- **Worktree-Specific Notes** - Unique approach/issues
- **Next Steps** - Prioritized actions

### 4. Handle Additional Info

If ADDITIONAL_INFO provided:

- If it's a file path (ends with .md), read and incorporate
- Otherwise treat as inline comments
- Add to "Recovery Context" section in PROGRESS.md

## Output Format

```markdown
# Progress Recovery Report - [Worktree Name]

Generated: [timestamp]

## Recovery Context

[Any additional info provided]

## Original Plan

Source: [PLAN_FILE]
Objective: [extracted from plan]

## Completed Tasks ✅

- [Detected completed items]

## In Progress 🚧

- [Partially complete items]

## Remaining TODOs 📋

- [Items from plan not yet started]

## Code Analysis

### Modified Files

- `path/to/file` - [what appears to be done]

### New Files

- `path/to/file` - [purpose/content]

### Potential Issues

- [Any detected problems]

## Implementation Strategy

[Specific to this worktree's approach]

## Next Priority Actions

1. [Most important next step]
2. [Second priority]
3. [Third priority]
```

## Usage Examples

```bash
# Basic recovery with just the plan
/recover-parallel "specs/feature-plan.md"

# With inline comments
/recover-parallel "specs/feature-plan.md" "The CLI was having auth issues"

# With additional context file
/recover-parallel "specs/feature-plan.md" "notes/crash-context.md"

# For specific directory structure
/recover-parallel "packages/evals/specs/OTel/opentelemetry-integration-plan.md" "Editor crashed during parallel execution"
```

## Features

### Smart Detection

- Identifies incomplete function implementations
- Detects TODO comments in code
- Finds test files to determine coverage
- Recognizes common implementation patterns

### Cross-Worktree Analysis

- Compares progress across worktrees
- Identifies which approach is furthest along
- Suggests merging strategies

### Recovery Assistance

- Prioritizes remaining work
- Identifies blockers
- Suggests next steps for each worktree

## Advanced Options

```bash
# Include code snippets in analysis
/recover-parallel plan.md --include-code

# Compare against specific branch
/recover-parallel plan.md --base-branch=main

# Generate unified report
/recover-parallel plan.md --unified-report
```
