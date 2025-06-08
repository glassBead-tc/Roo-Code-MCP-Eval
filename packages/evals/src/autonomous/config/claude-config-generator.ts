import { OperatingMode, SessionConfiguration, OperatingConstraints } from '../types.js';

export interface ClaudeConfigOptions {
  mode: OperatingMode;
  sessionConfig: SessionConfiguration;
  constraints: OperatingConstraints;
  projectPath: string;
  telemetryServer?: {
    host: string;
    port: number;
    apiKey?: string;
  };
}

export class ClaudeConfigGenerator {
  generateConfig(options: ClaudeConfigOptions): string {
    return `# Claude Code Autonomous Analysis Configuration

## Mission Statement
You are operating as an autonomous analysis agent for the Roo Code MCP evaluation system. Your primary goal is to analyze telemetry data from MCP server evaluations and identify opportunities to improve code quality and performance.

## Operating Mode: ${options.mode}
${this.getModeDescription(options.mode)}

## Session Configuration
- Max iterations: ${options.sessionConfig.maxIterations}${options.mode === 'CONTINUOUS_REFINEMENT' ? ' (for CONTINUOUS_REFINEMENT mode)' : ''}
- Session timeout: ${Math.floor(options.sessionConfig.sessionTimeout / (1000 * 60 * 60))} hours
- Human trigger required: ${options.sessionConfig.humanTriggerRequired ? 'Yes (no 24/7 autonomous operation)' : 'No'}

## Operating Constraints

### 1. Scope Limitations

#### Allowed Operations
${options.constraints.allowedOperations.map(op => `- ${op}`).join('\n')}

#### Prohibited Operations
${options.constraints.prohibitedOperations.map(op => `- ${op}`).join('\n')}

### 2. File Access Patterns

#### Read-Only Access (Both Modes)
${options.constraints.fileAccess.readOnly.map(path => `- ${path}`).join('\n')}

#### Write Access (Mode-Dependent)

**ANALYSIS_ONLY Mode:**
- packages/evals/reports/*.md
- packages/evals/reports/data/*.json
- packages/evals/reports/visualizations/*.png

**CONTINUOUS_REFINEMENT Mode:**
- All ANALYSIS_ONLY write access
${options.mode === 'CONTINUOUS_REFINEMENT' ? options.constraints.fileAccess.writeAllowed.map(path => `- ${path}`).join('\n') : ''}

#### Prohibited Access
${options.constraints.fileAccess.prohibited.map(path => `- ${path}`).join('\n')}

### 3. Code Modification Rules${options.mode === 'CONTINUOUS_REFINEMENT' ? ' (CONTINUOUS_REFINEMENT Mode)' : ' (Not Applicable in ANALYSIS_ONLY Mode)'}

${this.getCodeModificationRules(options.mode)}

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

### 5. Pull Request Guidelines${options.mode === 'ANALYSIS_ONLY' ? ' (Not Applicable in ANALYSIS_ONLY Mode)' : ''}

${this.getPullRequestGuidelines(options.mode)}

### 6. Iteration Control

#### Per-Iteration Limits
- Analyze maximum 1000 telemetry records
- Generate maximum 5 optimization proposals
${options.mode === 'CONTINUOUS_REFINEMENT' ? '- Implement maximum 3 optimizations' : ''}
${options.mode === 'CONTINUOUS_REFINEMENT' ? '- Create maximum 1 pull request' : ''}

#### Session Termination Conditions
- Reached maximum iterations (${options.sessionConfig.maxIterations})
- No more optimizations found
- Critical error encountered
- Session timeout (${Math.floor(options.sessionConfig.sessionTimeout / (1000 * 60 * 60))} hours)
${options.mode === 'CONTINUOUS_REFINEMENT' ? '- All proposed optimizations implemented' : ''}

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

${options.telemetryServer ? this.getTelemetryServerConfig(options.telemetryServer) : ''}

#### Sensitive Data Handling
- No PII in reports
- Sanitize error messages
- Aggregate user-specific metrics
- Follow data retention policies

### 10. Git Operations${options.mode === 'ANALYSIS_ONLY' ? ' (Not Applicable in ANALYSIS_ONLY Mode)' : ''}

${this.getGitOperations(options.mode)}

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
- Maximum ${options.constraints.resourceLimits.maxMemoryMB}MB memory usage
- Maximum ${options.constraints.resourceLimits.maxCpuPercent}% CPU utilization
- Maximum ${options.constraints.resourceLimits.maxDiskSpaceMB}MB disk space for reports
- Maximum ${options.constraints.resourceLimits.maxApiCallsPerMinute} API calls per minute

#### Optimization Targets
- Reduce MCP call latency by >10%
- Improve error handling coverage
- Reduce code complexity scores
- Increase test coverage

## Mode-Specific Behaviors

### ${options.mode} Mode Workflow
${this.getModeWorkflow(options.mode)}

## Project-Specific Configuration

### Project Path
\`${options.projectPath}\`

### Evaluation Framework
This analysis targets the Roo Code MCP evaluation system located in \`packages/evals\`. 

### Key Components to Analyze
- MCP retrieval strategies (\`packages/evals/src/benchmark/strategies/*.ts\`)
- Scoring algorithms (\`packages/evals/src/benchmark/scoring/*.ts\`)
- Task execution patterns (\`packages/evals/src/benchmark/\`)

### Success Metrics
- MCP call latency reduction >10%
- Error rate reduction >15%
- Test coverage increase >5%
- Code quality score improvement >10%

---

*This configuration file was generated automatically. Do not modify manually.*
*Last updated: ${new Date().toISOString()}*
`;
  }

  private getModeDescription(mode: OperatingMode): string {
    switch (mode) {
      case 'ANALYSIS_ONLY':
        return 'Claude performs data analysis and generates reports without making any code changes. This mode is ideal for regular monitoring and insights generation.';
      case 'CONTINUOUS_REFINEMENT':
        return 'Claude performs iterative analysis and code improvements with strict safety constraints, limited to a maximum number of iterations per session.';
    }
  }

  private getCodeModificationRules(mode: OperatingMode): string {
    if (mode === 'ANALYSIS_ONLY') {
      return `Not applicable in ANALYSIS_ONLY mode. No code modifications are allowed.`;
    }

    return `#### Allowed Modifications
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
- New code must follow existing patterns`;
  }

  private getPullRequestGuidelines(mode: OperatingMode): string {
    if (mode === 'ANALYSIS_ONLY') {
      return 'Not applicable in ANALYSIS_ONLY mode. No pull requests are created.';
    }

    return `#### PR Creation Rules
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
- Must show before/after metrics`;
  }

  private getGitOperations(mode: OperatingMode): string {
    if (mode === 'ANALYSIS_ONLY') {
      return 'Not applicable in ANALYSIS_ONLY mode. No git operations are performed.';
    }

    return `#### Allowed Git Commands
- git checkout -b (new branches only)
- git add (modified files only)
- git commit
- git push (to feature branches)
- git status
- git diff

#### Branch Naming Convention
- autonomous-analysis/[date]/[optimization-type]
- Example: autonomous-analysis/2024-01-15/performance-optimization`;
  }

  private getModeWorkflow(mode: OperatingMode): string {
    switch (mode) {
      case 'ANALYSIS_ONLY':
        return `1. Connect to telemetry data source
2. Query recent evaluation data
3. Perform statistical analysis
4. Identify patterns and anomalies
5. Generate comprehensive report
6. Save report and visualizations
7. Terminate session`;

      case 'CONTINUOUS_REFINEMENT':
        return `1. Execute ANALYSIS_ONLY workflow
2. Prioritize optimization opportunities
3. For each optimization (up to max iterations):
   a. Create feature branch
   b. Implement changes
   c. Run tests
   d. Measure impact
   e. Create pull request
   f. Update progress report
4. Generate final summary report`;
    }
  }

  private getTelemetryServerConfig(server: { host: string; port: number; apiKey?: string }): string {
    return `
#### Telemetry Server Configuration
- Host: ${server.host}
- Port: ${server.port}
${server.apiKey ? '- Authentication: API Key (configured)' : '- Authentication: None'}
- Connection timeout: 30 seconds
- Retry attempts: 3`;
  }
}

export function createDefaultConstraints(): OperatingConstraints {
  return {
    allowedOperations: [
      'Read telemetry data via MCP server',
      'Analyze patterns and performance metrics',
      'Generate reports and visualizations',
      'Identify optimization opportunities',
      'Run existing tests',
    ],
    prohibitedOperations: [
      'Modify configuration files (*.config.*, *.env, package.json)',
      'Delete any files',
      'Modify test files (can only run them)',
      'Access production databases directly',
      'Make changes outside the packages/evals directory',
      'Install new dependencies without explicit approval',
    ],
    fileAccess: {
      readOnly: [
        'All telemetry data via MCP server',
        'Source code for analysis',
        'Test results and logs',
        'Previous analysis reports',
        'packages/evals/src/**/*.ts (for analysis)',
        'packages/evals/src/**/*.js (for analysis)',
      ],
      writeAllowed: [
        'packages/evals/src/**/*.ts (excluding tests)',
        'packages/evals/src/**/*.js (excluding tests)',
        '.github/workflows/autonomous-analysis-*.yml (for PR creation)',
      ],
      prohibited: [
        'packages/evals/src/**/*.test.ts',
        'packages/evals/src/**/*.spec.ts',
        '*.config.*',
        '*.env*',
        'package.json',
        'package-lock.json',
        'node_modules/**',
      ],
    },
    resourceLimits: {
      maxMemoryMB: 4096,
      maxCpuPercent: 50,
      maxDiskSpaceMB: 1024,
      maxApiCallsPerMinute: 100,
    },
  };
}

export function createDefaultSessionConfig(mode: OperatingMode): SessionConfiguration {
  return {
    mode,
    maxIterations: mode === 'CONTINUOUS_REFINEMENT' ? 5 : 1,
    sessionTimeout: 2 * 60 * 60 * 1000, // 2 hours
    humanTriggerRequired: true,
  };
} 