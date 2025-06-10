# Repository Guide: AI Agent Debugging Investigation

## Quick Start for External Review

This repository contains a comprehensive investigation into an AI agent task execution issue. Start here to understand the work completed and current status.

### Essential Documents (Read First)

1. **[INVESTIGATION_NARRATIVE.md](./INVESTIGATION_NARRATIVE.md)** - Complete investigation story and methodology
2. **[DEBUGGING_SUMMARY.md](./DEBUGGING_SUMMARY.md)** - Technical summary of all debugging phases
3. **[REMAINING_CHALLENGES.md](./REMAINING_CHALLENGES.md)** - Outstanding issues and investigation areas
4. **[AI-Agent-Completion-Debugging-Spec.md](./AI-Agent-Completion-Debugging-Spec.md)** - Original formal debugging specification

## Repository Structure

### 📋 Documentation Hub

```
/
├── INVESTIGATION_NARRATIVE.md          # Main investigation story
├── DEBUGGING_SUMMARY.md                # Technical debugging summary
├── REMAINING_CHALLENGES.md             # Outstanding issues
├── AI-Agent-Completion-Debugging-Spec.md  # Original debugging spec
├── MCP_TELEMETRY_SUMMARY.md           # Telemetry system documentation
└── REPOSITORY_GUIDE.md                # This guide
```

### 🔧 Core Implementation

```
/src/
├── core/
│   ├── task/Task.ts                   # Task orchestration (instrumented)
│   ├── assistant-message/presentAssistantMessage.ts  # Message handling (instrumented)
│   ├── tools/attemptCompletionTool.ts # Completion logic (instrumented)
│   └── state-inspector.ts            # State debugging utilities
├── extension/api.ts                   # Extension API and MCP telemetry enablement
└── extension.ts                       # Main extension entry point
```

### 🧪 Evaluation System

```
/packages/evals/
├── src/cli/index.ts                   # Evaluation CLI with debugging support
├── docker-compose.yml                 # Container orchestration
└── RooVeterinaryInc.roo-cline:debug  # Sample evaluation workspace
```

### 📊 Investigation Artifacts

```
/debugging/                            # Systematic debugging methodology docs
├── debug-printf.md                   # Printf debugging approach
├── debug-interactive.md              # Interactive debugging guide
├── debug-reproduce.md                # Reproduction test methodology
└── [12 other debugging approaches]

/stress-test-results/                  # Evaluation analysis
├── mcp-evaluation-stress-test-summary.md
└── project-completion-strategy.md

/trees/                               # Historical investigation snapshots
├── AI-Agent-Completion-Debugging-Spec.md-1/  # Phase 1 snapshot
├── AI-Agent-Completion-Debugging-Spec.md-2/  # Phase 2 snapshot
└── AI-Agent-Completion-Debugging-Spec.md-3/  # Phase 3 snapshot
```

### 🌐 Supporting Systems

```
/system-specifications/               # Architecture documentation
├── CLI_SYSTEM.md                    # Command-line interface specs
├── DATABASE_SCHEMA.md               # Telemetry database design
├── DOCKER_INFRASTRUCTURE.md        # Container architecture
├── INTEGRATION_ARCHITECTURE.md     # System integration design
├── MCP_EVALUATION_SYSTEM.md        # MCP evaluation framework
└── TELEMETRY_INFRASTRUCTURE.md     # Monitoring system design
```

## Investigation Branches

The debugging work was conducted across multiple git branches, each focusing on specific aspects:

```bash
# Infrastructure and Environment
step-1-trace-api-key-propagation      # API key environment debugging
step-2-fix-docker-env-vars            # Container configuration fixes
step-3-test-full-evaluation-run       # End-to-end evaluation testing

# Communication and Integration
step-4-test-ipc-command-flow          # IPC communication verification
step-5-bypass-container-extension-loading  # Extension activation fixes

# Core Workflow Analysis
step-6-debug-printf                   # Current: AI agent workflow debugging
step-6-resume-checkpoint-1            # Investigation checkpoint
```

**Current Active Branch:** `step-6-debug-printf` - AI agent workflow decision logic investigation

## Key Findings Summary

### ✅ Resolved Issues

1. **API Key Propagation** - Environment variables now properly reach containerized evaluation system
2. **Extension Activation** - VS Code extension reliably activates in container environments
3. **IPC Communication** - End-to-end message flow verified from evaluation system to AI agent
4. **MCP Telemetry** - Complete monitoring pipeline operational with automatic enablement
5. **Container Integration** - Robust containerized development and debugging environment

### ❌ Outstanding Issues

1. **Primary:** AI agent stops at analysis phase instead of proceeding to implementation
2. **Secondary:** Webview integration may have communication gaps
3. **Tertiary:** Evaluation system completion validation needs enhancement

### 🔍 Current Investigation

**Focus:** AI agent workflow state machine and completion criteria logic  
**Method:** Systematic instrumentation of decision points in task execution flow  
**Status:** Printf debugging phase in progress, interactive debugging phase planned

## How to Contribute

### For Debugging the Core Issue

1. **Review Current Instrumentation:** Check `/src/core/` files for existing debug logging
2. **Run Evaluation Test:** Use `cd packages/evals && pnpm cli --model claude-3-5-haiku-20241022`
3. **Analyze Logs:** Examine output for completion decision patterns
4. **Add Targeted Instrumentation:** Focus on workflow transition logic

### For System Enhancement

1. **MCP Integration:** Extend telemetry system with additional metrics
2. **Evaluation Framework:** Improve completion criteria validation
3. **Documentation:** Enhance system architecture documentation
4. **Testing:** Add comprehensive test coverage for resolved components

### For External Review

1. **Architecture Analysis:** Review system design and component interactions
2. **Methodology Evaluation:** Assess debugging approach and effectiveness
3. **Knowledge Transfer:** Suggest improvements to documentation and organization
4. **Alternative Approaches:** Propose different investigation or solution strategies

## Testing and Reproduction

### Quick Test

```bash
# Run single evaluation to reproduce issue
cd packages/evals
pnpm cli --model claude-3-5-haiku-20241022

# Check results - should show analysis but no implementation
ls RooVeterinaryInc.roo-cline:debug/
```

### Full Development Setup

```bash
# Install dependencies
pnpm install

# Build extension
pnpm build

# Run with debugging
pnpm watch:bundle  # In one terminal
# F5 in VS Code to launch Extension Development Host
```

### Telemetry Verification

```bash
# Check MCP telemetry (requires PostgreSQL)
PGPASSWORD=password psql -U postgres -d evals_test -h localhost -p 5432 \
  -c "SELECT * FROM mcp_retrieval_calls;"
```

## Contact and Collaboration

This investigation represents weeks of systematic debugging work. The repository is structured to enable:

- **External technical review** of approach and findings
- **Collaborative debugging** of the remaining core issue
- **Knowledge transfer** to other teams or contributors
- **Future development** building on established foundation

The work demonstrates that complex system debugging benefits from systematic methodology, comprehensive documentation, and preserved investigation history. While the core issue remains unresolved, the foundation is solid and the path forward is clear.

## Next Steps for Resolution

1. **Complete Printf Analysis** - Examine current instrumentation output
2. **Interactive Debugging Session** - Set breakpoints in critical workflow areas
3. **Minimal Reproduction** - Create deterministic test case
4. **Solution Implementation** - Apply findings to fix workflow transition
5. **Validation Testing** - Verify fix with comprehensive test suite

The systematic approach ensures that when the fix is implemented, it will be based on solid understanding rather than trial-and-error.
