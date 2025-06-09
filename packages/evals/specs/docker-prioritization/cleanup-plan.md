# Docker Prioritization: Documentation Cleanup Plan

## Problem Statement

The packages/evals documentation contains extensive references to non-functional headless execution modes that mislead users and create maintenance overhead. Specifically:

1. **ROO_HEADLESS environment variable** is documented but not implemented in the codebase
2. **Local Headless Mode with Xvfb** is documented as a viable option but doesn't work on macOS and isn't properly implemented
3. **Standard GUI Mode** spawns multiple VSCode windows, causing system instability
4. **Three-mode execution model** confuses users with non-working options

## Current State Analysis

### Documented Execution Modes

- **Docker Mode**: ✅ Actually works, uses containerized Xvfb
- **Local Headless Mode**: ❌ Documented but `ROO_HEADLESS` not implemented in code
- **Standard Mode**: ❌ Problematic window spawning

### Implementation Reality Check

- `packages/evals/src/cli/index.ts` line 217: Always runs `code --disable-workspace-trust` regardless of environment variables
- No code checks for `ROO_HEADLESS` environment variable anywhere
- Xvfb is installed in Docker container but not used in local execution

## Files Requiring Cleanup

### High Priority Documentation Files

1. **specs/run-evaluation/README.md**

    - Lines 21, 104, 137: Remove ROO_HEADLESS references
    - Lines 108, 137: Remove Xvfb mentions
    - Line 136: Remove "VS Code windows flashing" references
    - Restructure to Docker-first approach

2. **specs/run-evaluation/00-overview.md**

    - Lines 44-70: Remove entire "Local Headless Mode" section
    - Lines 45, 51, 54: Remove Xvfb references
    - Simplify to two modes: Docker (recommended) and Sequential (debugging)

3. **specs/run-evaluation/04-environment-setup.md**
    - Lines 59-60, 119, 152, 201: Remove ROO_HEADLESS documentation
    - Line 59: Remove Xvfb requirement mention

### Medium Priority Files

4. **EVALS.md**

    - Line 199: Remove "separate VS Code window" references

5. **Dockerfile**
    - Lines 22-23: Remove Xvfb installation (redundant in container context)

## Cleanup Strategy

### Phase 1: Remove Non-Functional Features

- [ ] Remove all ROO_HEADLESS environment variable references
- [ ] Remove Local Headless Mode documentation sections
- [ ] Remove Xvfb installation and setup instructions for local use

### Phase 2: Simplify Execution Models

- [ ] Restructure documentation around two modes:
    - **Docker Mode (Recommended)**: Containerized, stable, production-ready
    - **Sequential Mode (Debug)**: `--concurrent 1` for local debugging only
- [ ] Remove confusing three-mode paradigm

### Phase 3: Update Quick Start Guides

- [ ] Make Docker mode the primary quick start approach
- [ ] Remove headless mode from quick start sections
- [ ] Simplify prerequisites to Docker + API keys only

### Phase 4: Clean Container Configuration

- [ ] Remove unnecessary Xvfb from Dockerfile (container handles display automatically)
- [ ] Streamline Docker build process

## Proposed New Documentation Structure

### Single Execution Paradigm

```bash
# Primary approach - Docker containerized
docker run --rm \
  --network=evals_default \
  -e OPENROUTER_API_KEY=$OPENROUTER_API_KEY \
  -e ROO_EVAL_MODE=true \
  -e DATABASE_URL=postgres://postgres:password@postgres:5432/evals_development \
  roo-code-evals pnpm cli --model claude-3-5-haiku

# Debug approach - Sequential local execution (when needed)
pnpm cli --model claude-3-5-haiku --concurrent 1
```

### Benefits of Docker-First Approach

- **Stability**: No GUI window management issues
- **Consistency**: Same environment every time
- **Scalability**: Easy to run on CI/CD systems
- **Isolation**: Clean separation from host system
- **Performance**: Optimized resource usage

## Implementation Notes

### What This Cleanup Achieves

1. **Eliminates user confusion** from documented but non-functional features
2. **Reduces maintenance burden** of documenting fake functionality
3. **Focuses users on working solutions** (Docker containerization)
4. **Improves reliability** by removing problematic GUI spawning approaches

### What This Cleanup Avoids

- Implementing the missing ROO_HEADLESS functionality (unnecessary complexity)
- Supporting multiple execution paradigms (maintenance overhead)
- Platform-specific solutions (macOS vs Linux Xvfb differences)

## Success Criteria

- [ ] Documentation mentions only working execution modes
- [ ] No references to ROO_HEADLESS environment variable
- [ ] No mentions of local Xvfb setup or installation
- [ ] Docker mode is positioned as primary recommended approach
- [ ] Quick start guides focus on Docker workflow
- [ ] Prerequisites simplified to essential components only

## Timeline

This cleanup can be completed in a single session as it involves only documentation changes and minor Dockerfile adjustments. No code implementation changes are required since we're removing documented features that were never actually implemented.
