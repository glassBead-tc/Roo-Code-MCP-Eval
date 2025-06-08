#!/usr/bin/env node

import { Command } from 'commander';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ClaudeConfigGenerator, createDefaultConstraints, createDefaultSessionConfig } from '../config/claude-config-generator.js';
import { MockDataGenerator } from '../exporters/MockDataGenerator.js';
import { SafetyValidator } from '../safety/SafetyValidator.js';
import { OperatingMode, ProposedChange } from '../types.js';

const program = new Command();

program
  .name('autonomous-analysis')
  .description('Autonomous MCP analysis system CLI')
  .version('1.0.0');

program
  .command('generate-config')
  .description('Generate Claude.md configuration file')
  .option('-m, --mode <mode>', 'Operating mode', 'ANALYSIS_ONLY')
  .option('-o, --output <path>', 'Output file path', './CLAUDE.md')
  .option('--project-path <path>', 'Project root path', process.cwd())
  .action(async (options) => {
    try {
      const mode = options.mode as OperatingMode;
      const generator = new ClaudeConfigGenerator();
      
      const config = generator.generateConfig({
        mode,
        sessionConfig: createDefaultSessionConfig(mode),
        constraints: createDefaultConstraints(),
        projectPath: options.projectPath,
        telemetryServer: {
          host: 'localhost',
          port: 3000
        }
      });

      await fs.writeFile(options.output, config);
      console.log(`✅ Claude configuration generated: ${options.output}`);
      console.log(`📋 Mode: ${mode}`);
      console.log(`🏠 Project: ${options.projectPath}`);
    } catch (error) {
      console.error('❌ Error generating config:', error);
      process.exit(1);
    }
  });

program
  .command('generate-mock-data')
  .description('Generate mock telemetry data for testing')
  .option('-d, --days <days>', 'Number of days of data', '7')
  .option('-r, --records <records>', 'Records per day', '200')
  .option('-e, --errors', 'Include error data', false)
  .option('-o, --output <path>', 'Output file path', './mock-telemetry.json')
  .action(async (options) => {
    try {
      const generator = new MockDataGenerator();
      const data = generator.generateTelemetryExport({
        days: parseInt(options.days),
        recordsPerDay: parseInt(options.records),
        includeErrors: options.errors
      });

      await fs.writeFile(options.output, JSON.stringify(data, null, 2));
      console.log(`✅ Mock data generated: ${options.output}`);
      console.log(`📊 Records: ${data.benchmarks.details.length}`);
      console.log(`📈 Success rate: ${(data.benchmarks.summary.successRate * 100).toFixed(1)}%`);
      console.log(`⏱️  Avg duration: ${data.benchmarks.summary.avgDuration.toFixed(0)}ms`);
    } catch (error) {
      console.error('❌ Error generating mock data:', error);
      process.exit(1);
    }
  });

program
  .command('validate-change')
  .description('Test the safety validation system')
  .option('-f, --files <files>', 'Comma-separated list of files', 'packages/evals/src/benchmark/test.ts')
  .option('-t, --type <type>', 'Change type', 'optimization')
  .option('-r, --risk <risk>', 'Risk level', 'low')
  .action(async (options) => {
    try {
      const constraints = createDefaultConstraints();
      const validator = new SafetyValidator(constraints, process.cwd());
      
      const change: ProposedChange = {
        id: 'test-change-001',
        type: options.type as any,
        files: options.files.split(',').map((f: string) => f.trim()),
        description: 'Test change for validation',
        rationale: 'Testing the safety validation system',
        expectedImpact: 'Improved test coverage',
        riskLevel: options.risk as any
      };

      console.log('🔍 Validating change...');
      console.log(`📁 Files: ${change.files.join(', ')}`);
      console.log(`🔧 Type: ${change.type}`);
      console.log(`⚠️  Risk: ${change.riskLevel}`);
      console.log('');

      const result = await validator.validateChange(change);
      
      if (result.valid) {
        console.log('✅ Validation passed!');
        if (result.testResults) {
          console.log(`🧪 Tests: ${result.testResults.unitTests.passed} passed, ${result.testResults.unitTests.failed} failed`);
          console.log(`📊 Coverage: ${result.testResults.unitTests.coverage}%`);
        }
        if (result.performanceResults) {
          console.log(`⚡ Performance: ${result.performanceResults.regressions.length} regressions`);
        }
      } else {
        console.log('❌ Validation failed!');
        console.log(`🚫 Reason: ${result.reason}`);
      }
    } catch (error) {
      console.error('❌ Error validating change:', error);
      process.exit(1);
    }
  });

program
  .command('analyze-mock-data')
  .description('Run analysis on mock telemetry data')
  .option('-i, --input <path>', 'Input JSON file', './mock-telemetry.json')
  .option('-o, --output <path>', 'Output report path', './analysis-report.md')
  .action(async (options) => {
    try {
      console.log('📊 Loading telemetry data...');
      const dataFile = await fs.readFile(options.input, 'utf-8');
      const telemetryData = JSON.parse(dataFile);
      
      console.log('🔍 Analyzing data...');
      const report = generateAnalysisReport(telemetryData);
      
      await fs.writeFile(options.output, report);
      console.log(`✅ Analysis report generated: ${options.output}`);
      
      // Print summary to console
      const summary = extractSummary(telemetryData);
      console.log('\n📋 Summary:');
      console.log(`• Total benchmarks: ${summary.totalBenchmarks}`);
      console.log(`• Success rate: ${summary.successRate}%`);
      console.log(`• Avg response time: ${summary.avgResponseTime}ms`);
      console.log(`• Recommendations: ${summary.recommendationCount}`);
      
    } catch (error) {
      console.error('❌ Error analyzing data:', error);
      process.exit(1);
    }
  });

program
  .command('test-workflow')
  .description('Test the complete autonomous analysis workflow')
  .option('-m, --mode <mode>', 'Operating mode', 'ANALYSIS_ONLY')
  .action(async (options) => {
    try {
      const mode = options.mode as OperatingMode;
      console.log(`🚀 Testing autonomous analysis workflow in ${mode} mode...\n`);
      
      // Step 1: Generate configuration
      console.log('1️⃣  Generating Claude configuration...');
      const generator = new ClaudeConfigGenerator();
      const config = generator.generateConfig({
        mode,
        sessionConfig: createDefaultSessionConfig(mode),
        constraints: createDefaultConstraints(),
        projectPath: process.cwd()
      });
      await fs.writeFile('./test-CLAUDE.md', config);
      console.log('✅ Configuration generated\n');
      
      // Step 2: Generate mock data
      console.log('2️⃣  Generating mock telemetry data...');
      const mockGenerator = new MockDataGenerator();
      const telemetryData = mockGenerator.generateTelemetryExport({
        days: 3,
        recordsPerDay: 100,
        includeErrors: true
      });
      await fs.writeFile('./test-telemetry.json', JSON.stringify(telemetryData, null, 2));
      console.log('✅ Mock data generated\n');
      
      // Step 3: Analyze data
      console.log('3️⃣  Analyzing telemetry data...');
      const report = generateAnalysisReport(telemetryData);
      await fs.writeFile('./test-analysis-report.md', report);
      console.log('✅ Analysis completed\n');
      
      // Step 4: Test safety validation
      console.log('4️⃣  Testing safety validation...');
      const validator = new SafetyValidator(createDefaultConstraints(), process.cwd());
      const testChange: ProposedChange = {
        id: 'workflow-test-001',
        type: 'optimization',
        files: ['packages/evals/src/benchmark/example.ts'],
        description: 'Test optimization from workflow',
        rationale: 'Based on telemetry analysis showing slow performance',
        expectedImpact: '15% performance improvement',
        riskLevel: 'low'
      };
      
      const validationResult = await validator.validateChange(testChange);
      console.log(`✅ Safety validation: ${validationResult.valid ? 'PASSED' : 'FAILED'}\n`);
      
      // Summary
      console.log('🎉 Workflow test completed!');
      console.log('\nGenerated files:');
      console.log('• test-CLAUDE.md - Claude configuration');
      console.log('• test-telemetry.json - Mock telemetry data');
      console.log('• test-analysis-report.md - Analysis report');
      
      const summary = extractSummary(telemetryData);
      console.log('\n📊 Analysis Summary:');
      console.log(`• Processed ${summary.totalBenchmarks} benchmarks`);
      console.log(`• Found ${summary.recommendationCount} optimization opportunities`);
      console.log(`• System ready for ${mode} mode`);
      
    } catch (error) {
      console.error('❌ Error in workflow test:', error);
      process.exit(1);
    }
  });

program
  .command('orchestrate')
  .description('Run full orchestrated autonomous analysis session')
  .option('-m, --mode <mode>', 'Operating mode (ANALYSIS_ONLY or CONTINUOUS_REFINEMENT)', 'ANALYSIS_ONLY')
  .option('-i, --iterations <number>', 'Maximum iterations', '3')
  .option('-t, --timeout <minutes>', 'Session timeout in minutes', '30')
  .option('--data-source <source>', 'Data source (mock, mcp, database)', 'mock')
  .option('--output <path>', 'Report output directory')
  .option('--learning-path <path>', 'Learning data storage path')
  .option('--verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      console.log('🚀 Starting Orchestrated Autonomous Analysis...\n');
      
      // Import the orchestrator directly instead of using execSync
      const { AnalysisOrchestrator } = await import('../orchestrator/AnalysisOrchestrator.js');
      const { createDefaultConstraints, createDefaultSessionConfig } = await import('../config/claude-config-generator.js');
      
      // Create orchestrator configuration
      const projectRoot = process.cwd();
      const mode = options.mode as OperatingMode;
      
      const config = {
        projectRoot,
        sessionConfig: {
          ...createDefaultSessionConfig(mode),
          mode,
          maxIterations: parseInt(options.iterations),
          sessionTimeout: parseInt(options.timeout) * 60 * 1000
        },
        constraints: createDefaultConstraints(),
        dataSource: options.dataSource || 'mock',
        reportOutputPath: options.output || join(projectRoot, 'autonomous-reports'),
        learningDataPath: options.learningPath || join(projectRoot, 'autonomous-learning'),
        enabledFeatures: {
          statisticalAnalysis: true,
          safetyValidation: true,
          learningEngine: true,
          realTimeMonitoring: true,
          automaticReporting: true,
          evolutionEngine: true
        },
        evolutionConfig: {
          enableRecommendationEvolution: true,
          enableThresholdLearning: true,
          enablePatternDiscovery: true,
          evolutionInterval: 24, // Daily evolution
          performanceEvaluationWindow: 168 // Weekly evaluation
        }
      };
      
      const orchestrator = new AnalysisOrchestrator(config);
      
      // Setup event listeners
      if (options.verbose) {
        orchestrator.on('session-started', (data) => {
          console.log(`🎬 Session started: ${data.sessionId} (${data.mode})`);
        });
        
        orchestrator.on('iteration-completed', (data) => {
          console.log(`📊 Iteration ${data.iteration} completed - ${data.result.recommendationsGenerated.length} recommendations`);
        });
        
        orchestrator.on('session-completed', (data) => {
          console.log(`🏁 Session completed: ${data.sessionId}`);
        });
      } else {
        orchestrator.on('iteration-completed', (data) => {
          console.log(`Progress... Iteration ${data.iteration} completed (${data.result.recommendationsGenerated.length} recommendations)`);
        });
      }
      
      await orchestrator.initialize();
      console.log('✅ Orchestrator initialized\n');
      
      const sessionId = await orchestrator.startAnalysisSession(mode);
      console.log(`\n🎉 Analysis session completed successfully!`);
      console.log(`📊 Session ID: ${sessionId}`);
      
      // Display final metrics
      const metrics = await orchestrator.getSessionMetrics();
      if (metrics) {
        console.log('\n📈 Final Metrics:');
        console.log(`   Data Processed: ${metrics.totalDataProcessed} records`);
        console.log(`   Patterns Found: ${metrics.analysisPatterns}`);
        console.log(`   Recommendations: ${metrics.recommendationsGenerated} generated`);
        console.log(`   Changes: ${metrics.recommendationsImplemented} implemented`);
        console.log(`   Average Confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%`);
      }
      
    } catch (error) {
      console.error('❌ Orchestration failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('test-integration')
  .description('Run comprehensive integration test of all components')
  .action(async (options) => {
    try {
      console.log('🧪 Running Comprehensive Integration Test...\n');
      
      // Import and run the integration test directly
      const { AnalysisOrchestrator } = await import('../orchestrator/AnalysisOrchestrator.js');
      const { createDefaultConstraints, createDefaultSessionConfig } = await import('../config/claude-config-generator.js');
      
      // Create test configuration
      const projectRoot = process.cwd();
      const testConfig = {
        projectRoot,
        sessionConfig: {
          ...createDefaultSessionConfig('ANALYSIS_ONLY'),
          maxIterations: 2,
          sessionTimeout: 5 * 60 * 1000 // 5 minutes for testing
        },
        constraints: createDefaultConstraints(),
        dataSource: 'mock' as const,
        reportOutputPath: join(projectRoot, 'test-autonomous-reports'),
        learningDataPath: join(projectRoot, 'test-autonomous-learning'),
        enabledFeatures: {
          statisticalAnalysis: true,
          safetyValidation: true,
          learningEngine: true,
          realTimeMonitoring: true,
          automaticReporting: true
        }
      };

      console.log('🚀 Initializing test orchestrator...');
      const orchestrator = new AnalysisOrchestrator(testConfig);
      
      // Setup event listeners for test feedback
      let eventCount = 0;
      orchestrator.on('session-started', (data) => {
        eventCount++;
        console.log(`   Event ${eventCount}: Session started (${data.mode})`);
      });
      
      orchestrator.on('iteration-completed', (data) => {
        eventCount++;
        console.log(`   Event ${eventCount}: Iteration ${data.iteration} completed (${data.result.recommendationsGenerated.length} recs)`);
      });
      
      await orchestrator.initialize();
      console.log('✅ Test orchestrator initialized\n');

      // Test 1: Analysis Only Mode
      console.log('📊 Test 1: Running ANALYSIS_ONLY session...');
      const analysisSessionId = await orchestrator.startAnalysisSession('ANALYSIS_ONLY');
      console.log(`✅ Analysis session completed: ${analysisSessionId.substring(0, 12)}...`);
      
      // Get metrics
      const metrics = await orchestrator.getSessionMetrics(analysisSessionId);
      if (metrics) {
        console.log(`   📈 Generated ${metrics.recommendationsGenerated} recommendations`);
        console.log(`   📊 Processed ${metrics.totalDataProcessed} data records\n`);
      }

      // Test 2: Session History
      console.log('📚 Test 2: Verifying session history...');
      const history = await orchestrator.getSessionHistory();
      console.log(`✅ Found ${history.length} sessions in history\n`);

      // Test 3: Component Integration
      console.log('🧩 Test 3: Testing individual components...');
      
      // Test Mock Data Generator
      console.log('   🔧 Testing MockDataGenerator...');
      const generator = new MockDataGenerator();
      const mockData = generator.generateTelemetryExport({
        days: 1,
        recordsPerDay: 50,
        includeErrors: true
      });
      console.log(`     ✅ Generated ${mockData.benchmarks.details.length} records`);
      
      // Test Safety Validator
      console.log('   🛡️  Testing SafetyValidator...');
      const validator = new SafetyValidator(testConfig.constraints, projectRoot);
      const testChange: ProposedChange = {
        id: 'test-change-1',
        type: 'optimization',
        files: ['packages/evals/src/test-file.ts'],
        description: 'Test optimization change',
        rationale: 'Testing validator',
        expectedImpact: '10% improvement',
        riskLevel: 'low'
      };
      const validation = await validator.validateChange(testChange);
      console.log(`     ✅ Validation result: ${validation.valid ? 'PASSED' : 'FAILED'}`);

      console.log('\n🎉 INTEGRATION TEST PASSED!\n');
      console.log('📊 Test Summary:');
      console.log(`   ✅ Analysis session: ${analysisSessionId.substring(0, 12)}...`);
      console.log(`   ✅ Session history: ${history.length} sessions`);
      console.log(`   ✅ Component integration: All working`);
      console.log(`   ✅ Events received: ${eventCount}`);
      
    } catch (error) {
      console.error('\n❌ INTEGRATION TEST FAILED!');
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

function generateAnalysisReport(telemetryData: any): string {
  const { benchmarks, performance, errors, recommendations } = telemetryData;
  
  return `# Autonomous Analysis Report

Generated: ${new Date().toISOString()}

## Executive Summary

This report analyzes ${benchmarks.details.length} MCP server benchmarks over the period from ${telemetryData.metadata.timeRange.start} to ${telemetryData.metadata.timeRange.end}.

### Key Findings

- **Overall Success Rate**: ${(benchmarks.summary.successRate * 100).toFixed(1)}%
- **Average Response Time**: ${benchmarks.summary.avgDuration.toFixed(0)}ms
- **P95 Response Time**: ${benchmarks.summary.p95Duration.toFixed(0)}ms
- **Average Token Usage**: ${benchmarks.summary.avgTokenUsage.toFixed(0)} tokens

## Performance Analysis

### By Server
${performance.byServer.map((server: any) => `
- **${server.serverName}**: ${server.totalCalls} calls, ${server.avgResponseTime.toFixed(0)}ms avg, ${(server.errorRate * 100).toFixed(1)}% error rate`).join('')}

### By Task Type
${performance.byTaskType.map((task: any) => `
- **${task.taskType}**: ${task.count} executions, ${(task.successRate * 100).toFixed(1)}% success rate`).join('')}

## Error Analysis

### Error Patterns
${errors.patterns.map((pattern: any) => `
- **${pattern.pattern}**: ${pattern.frequency} occurrences (${pattern.severity} severity)
  - Impact: ${pattern.impact}
  - Suggested fix: ${pattern.suggestedFix || 'No specific fix available'}`).join('')}

## Recommendations

### Immediate Actions
${recommendations.immediate.map((rec: any) => `
- **${rec.title}** (${rec.priority} priority)
  - ${rec.description}
  - Expected impact: ${rec.expectedImpact}
  - Effort: ${rec.effort}
  - Confidence: ${(rec.confidence * 100).toFixed(0)}%`).join('')}

### Long-term Improvements
${recommendations.longTerm.map((rec: any) => `
- **${rec.title}** (${rec.priority} priority)
  - ${rec.description}
  - Expected impact: ${rec.expectedImpact}
  - Effort: ${rec.effort}
  - Confidence: ${(rec.confidence * 100).toFixed(0)}%`).join('')}

## Data Quality Assessment

- **Completeness**: ${(telemetryData.metadata.dataQuality.completeness * 100).toFixed(1)}%
- **Sample Size**: ${telemetryData.metadata.dataQuality.sampleSize} records
- **Missing Data Points**: ${telemetryData.metadata.dataQuality.missingDataPoints.join(', ') || 'None'}

---

*This report was generated automatically by the Autonomous Analysis System.*
`;
}

function extractSummary(telemetryData: any) {
  return {
    totalBenchmarks: telemetryData.benchmarks.details.length,
    successRate: (telemetryData.benchmarks.summary.successRate * 100).toFixed(1),
    avgResponseTime: telemetryData.benchmarks.summary.avgDuration.toFixed(0),
    recommendationCount: telemetryData.recommendations.immediate.length + telemetryData.recommendations.longTerm.length
  };
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

program.parse(); 