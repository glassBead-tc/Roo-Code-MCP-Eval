# Parallel Task Version Execution

## Variables

PLAN_TO_EXECUTE: $ARGUMENTS
NUMBER_OF_PARALLEL_WORKTREES: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to packages/evals
RUN `find src -type f -not -path "*/\.*" | sort`
RUN `mkdir -p trees && find trees -type d -maxdepth 3 | sort`
READ: PLAN_TO_EXECUTE

## Instructions

We're going to create NUMBER_OF_PARALLEL_WORKTREES new subagents that use the Task tool to create N versions of the same feature in parallel.

This enables use to concurrently build the same feature in parallel so we
test and validate each subagent's changes in isolation then pick the best
changes.

The first agent will run in trees/effect-refactor-1/
The second agent will run in trees/effect-refactor-2/
...
The last agent will run in trees/effect-refactor-«NUMBER_OF_PARALLEL_WORKTREES>/

The code in trees/effect-refactor-<i>/ will be identical to the code in the current branch. It will be setup and ready for you to build the feature end to end.

Each agent will independently implement the engineering plan detailed in PLAN_TO_EXECUTE

When the subagent completes it's work, have the subagent to report their final changes made in a comprehensive `RESULTS.md` file at the root of their respective workspace.

Make sure agents don't start the server - focus on the code changes only.
