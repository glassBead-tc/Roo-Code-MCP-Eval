# CLAUDE.md Configuration for Safe Autonomous Operation

## Overview

This document defines the rules, constraints, and operational boundaries for Claude Code when operating in autonomous analysis mode. The CLAUDE.md file serves as the primary safety mechanism to ensure Claude operates within well-defined limits while analyzing telemetry data and proposing optimizations.

## Operating Modes

Based on Claude Code's feedback and operational requirements, we define two distinct modes:

### 1. Analysis-Only Mode

Claude performs data analysis and generates reports without making any code changes. This mode is ideal for regular monitoring and insights generation.

### 2. Continuous Refinement Mode

Claude performs iterative analysis and code improvements with strict safety constraints, limited to a maximum number of iterations per session.

## CLAUDE.md Structure

````markdown
# Claude Code Autonomous Analysis Configuration

## Mission Statement

You are operating as an autonomous analysis agent for the Roo Code MCP evaluation system. Your primary goal is to analyze telemetry data from MCP server evaluations and identify opportunities to improve code quality and performance.

## Operating Mode: [ANALYSIS_ONLY | CONTINUOUS_REFINEMENT]

<!-- This will be set when launching Claude Code -->

## Session Configuration

- Max iterations: 5 (for CONTINUOUS_REFINEMENT mode)
- Session timeout: 2 hours
- Human trigger required: Yes (no 24/7 autonomous operation)

## Operating Constraints

### 1. Scope Limitations

#### Allowed Operations

- Read telemetry data via MCP server
- Analyze patterns and performance metrics
- Generate reports and visualizations
- Identify optimization opportunities
- Create pull requests (CONTINUOUS_REFINEMENT mode only)
- Run existing tests (CONTINUOUS_REFINEMENT mode only)

#### Prohibited Operations

- Modify configuration files (_.config._, \*.env, package.json)
- Delete any files
- Modify test files (can only run them)
- Access production databases directly
- Make changes outside the packages/evals directory
- Install new dependencies without explicit approval

### 2. File Access Patterns

#### Read-Only Access (Both Modes)

- All telemetry data via MCP server
- Source code for analysis
- Test results and logs
- Previous analysis reports

#### Write Access (Mode-Dependent)

**ANALYSIS_ONLY Mode:**

- packages/evals/reports/\*.md
- packages/evals/reports/data/\*.json
- packages/evals/reports/visualizations/\*.png

**CONTINUOUS_REFINEMENT Mode:**

- All ANALYSIS_ONLY write access
- packages/evals/src/\*_/_.ts (excluding tests)
- packages/evals/src/\*_/_.js (excluding tests)
- .github/workflows/autonomous-analysis-\*.yml (for PR creation)

### 3. Code Modification Rules (CONTINUOUS_REFINEMENT Mode)

#### Allowed Modifications

1. Performance optimizations in existing functions
2. Adding telemetry instrumentation
3. Improving error handling
4. Refactoring for better maintainability
5. Adding JSDoc comments
6. Fixing identified bugs

#### Modification Constraints

- Maximum 10 files per iteration
- Maximum 500 lines changed per file
- Must maintain backward compatibility
- Cannot change public API signatures
- Must pass all existing tests
- New code must follow existing patterns

### 4. Testing Requirements

#### Before Any PR Creation

1. Run all unit tests in modified packages
2. Run integration tests if available
3. Verify no regression in performance metrics
4. Check for linting errors
5. Ensure type safety (TypeScript)

#### Test Failure Handling

- If tests fail, must fix or revert changes
- Cannot disable or skip failing tests
- Must document why tests were failing

### 5. Pull Request Guidelines

#### PR Creation Rules

- One PR per optimization theme
- Clear, descriptive title
- Detailed description with:
    - Problem identified
    - Solution implemented
    - Performance impact
    - Risk assessment
- Link to telemetry data supporting changes
- Add "autonomous-analysis" label

#### PR Content Limits

- Maximum 20 files per PR
- Maximum 1000 lines total changes
- Must include test results in description
- Must show before/after metrics

### 6. Iteration Control

#### Per-Iteration Limits

- Analyze maximum 1000 telemetry records
- Generate maximum 5 optimization proposals
- Implement maximum 3 optimizations
- Create maximum 1 pull request

#### Session Termination Conditions

- Reached maximum iterations (5)
- No more optimizations found
- Critical error encountered
- Session timeout (2 hours)
- All proposed optimizations implemented

### 7. Error Handling

#### On Error

1. Log detailed error information
2. Attempt graceful recovery
3. If recovery fails, terminate session
4. Generate error report for human review
5. Do not attempt to fix errors autonomously

#### Critical Errors (Immediate Termination)

- Database connection failures
- File system permission errors
- Git operation failures
- Test framework crashes
- Memory limit exceeded

### 8. Reporting Requirements

#### Analysis Reports Must Include

1. Executive summary
2. Data quality assessment
3. Key findings
4. Performance trends
5. Optimization opportunities
6. Risk assessment
7. Recommended actions

#### Report Format

- Markdown for human readability
- JSON for machine processing
- Visualizations as PNG files
- Code snippets with syntax highlighting

### 9. Data Access Patterns

#### Telemetry Query Limits

- Maximum 7 days of historical data per query
- Maximum 10,000 records per query
- Must use pagination for large datasets
- Cache results for repeated queries

#### Sensitive Data Handling

- No PII in reports
- Sanitize error messages
- Aggregate user-specific metrics
- Follow data retention policies

### 10. Git Operations

#### Allowed Git Commands

- git checkout -b (new branches only)
- git add (modified files only)
- git commit
- git push (to feature branches)
- git status
- git diff

#### Branch Naming Convention

- autonomous-analysis/[date]/[optimization-type]
- Example: autonomous-analysis/2024-01-15/performance-optimization

### 11. Communication Protocols

#### Status Updates

- Log progress every 10 minutes
- Update status file: analysis-status.json
- Include percentage complete
- Estimate time remaining

#### Human Notification Triggers

- Session completed successfully
- Critical error encountered
- Unusual patterns detected
- Manual review required

### 12. Performance Constraints

#### Resource Limits

- Maximum 4GB memory usage
- Maximum 50% CPU utilization
- Maximum 1GB disk space for reports
- Maximum 100 API calls per minute

#### Optimization Targets

- Reduce MCP call latency by >10%
- Improve error handling coverage
- Reduce code complexity scores
- Increase test coverage

## Mode-Specific Behaviors

### ANALYSIS_ONLY Mode Workflow

1. Connect to telemetry MCP server
2. Query recent evaluation data
3. Perform statistical analysis
4. Identify patterns and anomalies
5. Generate comprehensive report
6. Save report and visualizations
7. Terminate session

### CONTINUOUS_REFINEMENT Mode Workflow

1. Execute ANALYSIS_ONLY workflow
2. Prioritize optimization opportunities
3. For each optimization (up to max iterations):
   a. Create feature branch
   b. Implement changes
   c. Run tests
   d. Measure impact
   e. Create pull request
   f. Update progress report
4. Generate final summary report
5. Terminate session

## Safety Mechanisms

### Rollback Procedures

- Keep backup of original files
- Ability to revert all changes
- Checkpoint after each iteration
- Restore points for critical operations

### Audit Trail

- Log all file modifications
- Record all decisions made
- Track performance metrics
- Maintain change history

### Human Override

- Emergency stop command
- Ability to pause/resume
- Manual approval gates
- Configuration updates

## Example Launch Commands

### Analysis-Only Mode

```bash
claude-code --mode analysis-only \
  --config ./CLAUDE.md \
  --mcp-config ./telemetry-mcp.json \
  --output ./reports/analysis-$(date +%Y%m%d).md
```
````

### Continuous Refinement Mode

```bash
claude-code --mode continuous-refinement \
  --config ./CLAUDE.md \
  --mcp-config ./telemetry-mcp.json \
  --max-iterations 5 \
  --create-prs \
  --output ./reports/refinement-$(date +%Y%m%d).md
```

## Monitoring and Compliance

### Compliance Checks

- Verify all constraints before operations
- Monitor resource usage continuously
- Check file modification patterns
- Validate PR content

### Metrics to Track

- Number of optimizations identified
- Success rate of implementations
- Test pass rate
- Performance improvements achieved
- Time per iteration
- Resource utilization

## Conclusion

This CLAUDE.md configuration ensures safe, controlled autonomous operation while maximizing the value Claude Code can provide in analyzing and improving the MCP evaluation system. The dual-mode approach allows for both passive monitoring and active improvement, with human oversight maintained throughout the process.

````

## Implementation Considerations

### 1. Session State Management
Since Claude Code sessions are stateless, we need to:
- Store analysis results in the database
- Use file-based checkpoints for iteration tracking
- Pass previous results as context in new sessions

### 2. GitHub Actions Integration
```yaml
# .github/workflows/autonomous-analysis.yml
name: Autonomous Analysis
on:
  workflow_dispatch:
    inputs:
      mode:
        description: 'Analysis mode'
        required: true
        type: choice
        options:
          - analysis-only
          - continuous-refinement

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Claude Code Analysis
        run: |
          npx claude-code \
            --mode ${{ inputs.mode }} \
            --config ./packages/evals/CLAUDE.md \
            --mcp-config ./packages/evals/telemetry-mcp.json
````

### 3. Safety Validation Script

```typescript
// packages/evals/src/autonomous/validate-constraints.ts
export async function validateConstraints(
	mode: "analysis-only" | "continuous-refinement",
	proposedChanges: FileChange[],
): Promise<ValidationResult> {
	// Check file count limits
	if (proposedChanges.length > 10) {
		return { valid: false, reason: "Exceeds file limit" }
	}

	// Check file patterns
	for (const change of proposedChanges) {
		if (isProhibitedFile(change.path)) {
			return { valid: false, reason: `Prohibited file: ${change.path}` }
		}
	}

	// Check line count limits
	// ... additional validations

	return { valid: true }
}
```

### 4. Progress Tracking

```typescript
// packages/evals/src/autonomous/progress-tracker.ts
interface AnalysisProgress {
	sessionId: string
	mode: string
	startTime: Date
	currentIteration: number
	maxIterations: number
	optimizationsFound: number
	optimizationsImplemented: number
	status: "running" | "completed" | "error"
	lastUpdate: Date
}
```

## Next Steps

This CLAUDE.md configuration provides comprehensive safety constraints while enabling valuable autonomous analysis capabilities. The design accommodates both Claude Code's capabilities and limitations, ensuring safe operation with human oversight.
