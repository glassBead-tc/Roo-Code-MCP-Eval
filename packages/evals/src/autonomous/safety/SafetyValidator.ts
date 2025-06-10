import { ProposedChange, ValidationResult, OperatingConstraints, TestValidation, BenchmarkResult, CodeQualityReport } from '../types.js';
import { promises as fs } from 'fs';
import { join, relative } from 'path';

export class SafetyValidator {
  constructor(
    private constraints: OperatingConstraints,
    private projectRoot: string
  ) {}

  async validateChange(change: ProposedChange): Promise<ValidationResult> {
    const validationErrors: string[] = [];

    try {
      // Check file permissions
      const filePermissionResult = await this.checkFilePermissions(change);
      if (!filePermissionResult.valid) {
        validationErrors.push(filePermissionResult.reason!);
      }

      // Check code complexity (basic implementation)
      const complexityResult = await this.checkCodeComplexity(change);
      if (!complexityResult.valid) {
        validationErrors.push(complexityResult.reason!);
      }

      // Check scope limitations
      const scopeResult = this.checkScopeLimitations(change);
      if (!scopeResult.valid) {
        validationErrors.push(scopeResult.reason!);
      }

      // If basic checks pass, run more intensive validations
      if (validationErrors.length === 0) {
        const testResults = await this.runTestValidation(change);
        const performanceResults = await this.runPerformanceBenchmarks(change);
        const codeQualityResults = await this.runCodeQualityChecks(change);

        return {
          valid: testResults.passed && performanceResults.passed && codeQualityResults.passed,
          testResults: testResults.validation,
          performanceResults,
          codeQualityResults,
          reason: this.generateValidationSummary(testResults, performanceResults, codeQualityResults)
        };
      }

      return {
        valid: false,
        reason: validationErrors.join('; ')
      };

    } catch (error) {
      return {
        valid: false,
        reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkFilePermissions(change: ProposedChange): Promise<{ valid: boolean; reason?: string }> {
    const prohibitedPatterns = this.constraints.fileAccess.prohibited;
    const writeAllowedPatterns = this.constraints.fileAccess.writeAllowed;

    for (const file of change.files) {
      const relativePath = relative(this.projectRoot, file);

      // Check if file is in prohibited list
      if (this.matchesAnyPattern(relativePath, prohibitedPatterns)) {
        return {
          valid: false,
          reason: `File ${relativePath} is in prohibited access list`
        };
      }

      // Check if file is in write allowed list (for modifications)
      if (change.type !== 'analysis' && !this.matchesAnyPattern(relativePath, writeAllowedPatterns)) {
        return {
          valid: false,
          reason: `File ${relativePath} is not in write-allowed list`
        };
      }

      // Check if file exists and is accessible
      try {
        await fs.access(file);
      } catch (error) {
        return {
          valid: false,
          reason: `File ${relativePath} is not accessible`
        };
      }
    }

    return { valid: true };
  }

  private async checkCodeComplexity(change: ProposedChange): Promise<{ valid: boolean; reason?: string }> {
    // Basic file count and size checks
    if (change.files.length > 10) {
      return {
        valid: false,
        reason: `Too many files modified (${change.files.length}). Maximum is 10 per change.`
      };
    }

    // Check file sizes (estimate based on content)
    for (const file of change.files) {
      try {
        const stats = await fs.stat(file);
        const estimatedLines = stats.size / 50; // Rough estimate: 50 chars per line
        
        if (estimatedLines > 500) {
          return {
            valid: false,
            reason: `File ${relative(this.projectRoot, file)} is too large (estimated ${Math.round(estimatedLines)} lines). Maximum is 500 lines changed per file.`
          };
        }
      } catch (error) {
        // File might not exist yet (new file), skip size check
        continue;
      }
    }

    return { valid: true };
  }

  private checkScopeLimitations(change: ProposedChange): { valid: boolean; reason?: string } {
    // Check if change type is allowed
    const allowedTypes = ['optimization', 'bug_fix', 'refactor'];
    if (!allowedTypes.includes(change.type)) {
      return {
        valid: false,
        reason: `Change type '${change.type}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`
      };
    }

    // Check risk level
    if (change.riskLevel === 'high') {
      return {
        valid: false,
        reason: 'High-risk changes are not allowed in autonomous mode'
      };
    }

    return { valid: true };
  }

  private async runTestValidation(change: ProposedChange): Promise<{ passed: boolean; validation?: TestValidation }> {
    // Mock test validation - in real implementation, this would run actual tests
    const mockValidation: TestValidation = {
      unitTests: {
        passed: 25,
        failed: 0,
        coverage: 85.5,
        duration: 1200 // ms
      },
      integrationTests: {
        passed: 8,
        failed: 0,
        scenarios: ['mcp-server-connection', 'data-export', 'analysis-pipeline']
      }
    };

    // Simulate test execution based on change
    const hasTestFailures = change.riskLevel === 'medium' && Math.random() < 0.1; // 10% chance of failure for medium risk
    
    if (hasTestFailures) {
      mockValidation.unitTests.failed = 2;
      mockValidation.unitTests.passed = 23;
    }

    return {
      passed: mockValidation.unitTests.failed === 0 && mockValidation.integrationTests.failed === 0,
      validation: mockValidation
    };
  }

  private async runPerformanceBenchmarks(change: ProposedChange): Promise<BenchmarkResult> {
    // Mock performance benchmarking - in real implementation, this would run actual benchmarks
    const benchmarks = [
      {
        metric: 'mcp_response_time_p95',
        baseline: 250,
        current: 240,
        change: -4, // 4% improvement
        threshold: 5 // Allow 5% degradation
      },
      {
        metric: 'memory_usage_avg',
        baseline: 150,
        current: 148,
        change: -1.3, // 1.3% improvement
        threshold: 10
      }
    ];

    const regressions = benchmarks.filter(b => b.change > b.threshold);

    return {
      passed: regressions.length === 0,
      benchmarks,
      regressions
    };
  }

  private async runCodeQualityChecks(change: ProposedChange): Promise<CodeQualityReport> {
    // Mock code quality analysis - in real implementation, this would use ESLint, SonarQube, etc.
    const metrics = {
      complexity: {
        cyclomatic: 8,
        cognitive: 12
      },
      maintainability: {
        index: 75,
        grade: 'B'
      },
      duplication: {
        percentage: 2.5,
        blocks: 3
      },
      security: {
        vulnerabilities: 0,
        severity: []
      }
    };

    const issues: string[] = [];
    
    if (metrics.complexity.cyclomatic > 10) {
      issues.push('High cyclomatic complexity detected');
    }
    
    if (metrics.duplication.percentage > 5) {
      issues.push('Code duplication above threshold');
    }
    
    if (metrics.security.vulnerabilities > 0) {
      issues.push('Security vulnerabilities found');
    }

    return {
      passed: issues.length === 0,
      metrics,
      issues
    };
  }

  private generateValidationSummary(
    testResults: { passed: boolean; validation?: TestValidation },
    performanceResults: BenchmarkResult,
    codeQualityResults: CodeQualityReport
  ): string {
    const summaryParts: string[] = [];

    if (!testResults.passed) {
      summaryParts.push(`Tests failed: ${testResults.validation?.unitTests.failed || 0} unit tests, ${testResults.validation?.integrationTests.failed || 0} integration tests`);
    }

    if (!performanceResults.passed) {
      summaryParts.push(`Performance regressions detected: ${performanceResults.regressions.map(r => r.metric).join(', ')}`);
    }

    if (!codeQualityResults.passed) {
      summaryParts.push(`Code quality issues: ${codeQualityResults.issues.join(', ')}`);
    }

    if (summaryParts.length === 0) {
      return 'All validations passed successfully';
    }

    return summaryParts.join('; ');
  }

  private matchesAnyPattern(path: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      // Convert glob-like pattern to regex
      const regexPattern = pattern
        .replace(/\*\*/g, '.*') // ** matches any path
        .replace(/\*/g, '[^/]*') // * matches any filename
        .replace(/\./g, '\\.'); // Escape dots
      
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(path);
    });
  }
}

export class ResourceMonitor {
  private memoryUsage = 0;
  private cpuUsage = 0;
  private diskUsage = 0;
  private apiCallCount = 0;
  private lastApiCallReset = Date.now();

  constructor(private limits: OperatingConstraints['resourceLimits']) {}

  recordMemoryUsage(usage: number): void {
    this.memoryUsage = usage;
  }

  recordCpuUsage(usage: number): void {
    this.cpuUsage = usage;
  }

  recordDiskUsage(usage: number): void {
    this.diskUsage = usage;
  }

  recordApiCall(): void {
    const now = Date.now();
    
    // Reset counter if a minute has passed
    if (now - this.lastApiCallReset > 60000) {
      this.apiCallCount = 0;
      this.lastApiCallReset = now;
    }
    
    this.apiCallCount++;
  }

  checkResourceLimits(): { withinLimits: boolean; violations: string[] } {
    const violations: string[] = [];

    if (this.memoryUsage > this.limits.maxMemoryMB) {
      violations.push(`Memory usage (${this.memoryUsage}MB) exceeds limit (${this.limits.maxMemoryMB}MB)`);
    }

    if (this.cpuUsage > this.limits.maxCpuPercent) {
      violations.push(`CPU usage (${this.cpuUsage}%) exceeds limit (${this.limits.maxCpuPercent}%)`);
    }

    if (this.diskUsage > this.limits.maxDiskSpaceMB) {
      violations.push(`Disk usage (${this.diskUsage}MB) exceeds limit (${this.limits.maxDiskSpaceMB}MB)`);
    }

    if (this.apiCallCount > this.limits.maxApiCallsPerMinute) {
      violations.push(`API calls (${this.apiCallCount}/min) exceed limit (${this.limits.maxApiCallsPerMinute}/min)`);
    }

    return {
      withinLimits: violations.length === 0,
      violations
    };
  }

  getUsageReport(): {
    memory: { usage: number; limit: number; percentage: number };
    cpu: { usage: number; limit: number; percentage: number };
    disk: { usage: number; limit: number; percentage: number };
    apiCalls: { usage: number; limit: number; percentage: number };
  } {
    return {
      memory: {
        usage: this.memoryUsage,
        limit: this.limits.maxMemoryMB,
        percentage: (this.memoryUsage / this.limits.maxMemoryMB) * 100
      },
      cpu: {
        usage: this.cpuUsage,
        limit: this.limits.maxCpuPercent,
        percentage: (this.cpuUsage / this.limits.maxCpuPercent) * 100
      },
      disk: {
        usage: this.diskUsage,
        limit: this.limits.maxDiskSpaceMB,
        percentage: (this.diskUsage / this.limits.maxDiskSpaceMB) * 100
      },
      apiCalls: {
        usage: this.apiCallCount,
        limit: this.limits.maxApiCallsPerMinute,
        percentage: (this.apiCallCount / this.limits.maxApiCallsPerMinute) * 100
      }
    };
  }
} 