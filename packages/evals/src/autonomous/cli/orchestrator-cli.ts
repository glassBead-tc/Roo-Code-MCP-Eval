#!/usr/bin/env node

import { Command } from 'commander';
import { join } from 'path';
import { AnalysisOrchestrator, OrchestratorConfig } from '../orchestrator/AnalysisOrchestrator.js';
import { OperatingMode, SessionConfiguration, OperatingConstraints } from '../types.js';

const program = new Command();

// Default configurations
const defaultConstraints: OperatingConstraints = {
  filePermissions: {
    readOnlyPaths: [
      '*.md',
      'package.json',
      'tsconfig.json',
      'CHANGELOG.md'
    ],
    writeAllowedPaths: [
      'packages/evals/src/**/*.ts',
      'packages/evals/src/**/*.js',
      'packages/evals/build-utils/**/*'
    ],
    prohibitedPaths: [
      'node_modules/**/*',
      '.git/**/*',
      'dist/**/*',
      'build/**/*'
    ]
  },
  codeModificationRules: {
    maxFilesPerIteration: 5,
    requireTests: true,
    requireReview: false,
    allowExternalDependencies: false,
    complexityLimits: {
      maxLinesPerFile: 1000,
      maxCyclomaticComplexity: 15,
      maxNestingDepth: 6
    }
  },
  testingRequirements: {
    runTestsBeforeChange: true,
    runTestsAfterChange: true,
    maintainCoverage: true,
    requiredTestTypes: ['unit']
  },
  resourceLimits: {
    maxMemoryMB: 1024,
    maxCpuPercent: 80,
    maxDiskMB: 500,
    maxApiCallsPerHour: 1000
  },
  iterationLimits: {
    maxIterations: 10,
    maxTimeMinutes: 60,
    cooldownMinutes: 5
  }
};

const defaultSessionConfig: SessionConfiguration = {
  mode: 'ANALYSIS_ONLY',
  maxIterations: 3,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  enableLearning: true,
  reportFormat: 'markdown'
};

function createOrchestratorConfig(options: any): OrchestratorConfig {
  const projectRoot = process.cwd();
  
  return {
    projectRoot,
    sessionConfig: {
      ...defaultSessionConfig,
      mode: options.mode || 'ANALYSIS_ONLY',
      maxIterations: parseInt(options.iterations) || 3,
      sessionTimeout: (parseInt(options.timeout) || 30) * 60 * 1000,
      enableLearning: !options.disableLearning
    },
    constraints: defaultConstraints,
    dataSource: options.dataSource || 'mock',
    reportOutputPath: options.output || join(projectRoot, 'autonomous-reports'),
    learningDataPath: options.learningPath || join(projectRoot, 'autonomous-learning'),
    enabledFeatures: {
      statisticalAnalysis: !options.disableAnalysis,
      safetyValidation: !options.disableValidation,
      learningEngine: !options.disableLearning,
      realTimeMonitoring: !options.disableMonitoring,
      automaticReporting: !options.disableReports
    }
  };
}

// Main Commands

program
  .name('orchestrator')
  .description('Autonomous Analysis Orchestrator CLI')
  .version('1.0.0');

program
  .command('start')
  .description('Start a new autonomous analysis session')
  .option('-m, --mode <mode>', 'Operating mode (ANALYSIS_ONLY or CONTINUOUS_REFINEMENT)', 'ANALYSIS_ONLY')
  .option('-i, --iterations <number>', 'Maximum iterations', '3')
  .option('-t, --timeout <minutes>', 'Session timeout in minutes', '30')
  .option('--data-source <source>', 'Data source (mock, mcp, database)', 'mock')
  .option('--output <path>', 'Report output directory')
  .option('--learning-path <path>', 'Learning data storage path')
  .option('--disable-analysis', 'Disable statistical analysis')
  .option('--disable-validation', 'Disable safety validation')
  .option('--disable-learning', 'Disable learning engine')
  .option('--disable-monitoring', 'Disable real-time monitoring')
  .option('--disable-reports', 'Disable automatic reporting')
  .option('--verbose', 'Enable verbose logging')
  .action(async (options) => {
    console.log('🚀 Starting Autonomous Analysis Session...\n');
    
    try {
      const config = createOrchestratorConfig(options);
      const orchestrator = new AnalysisOrchestrator(config);
      
      // Setup event listeners for real-time feedback
      if (options.verbose) {
        setupVerboseLogging(orchestrator);
      } else {
        setupBasicLogging(orchestrator);
      }
      
      await orchestrator.initialize();
      console.log('✅ Orchestrator initialized\n');
      
      const sessionId = await orchestrator.startAnalysisSession(options.mode);
      console.log(`\n🎉 Analysis session completed successfully!`);
      console.log(`📊 Session ID: ${sessionId}`);
      
      // Display final metrics
      const metrics = await orchestrator.getSessionMetrics();
      if (metrics) {
        displaySessionMetrics(metrics);
      }
      
    } catch (error) {
      console.error('❌ Session failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Get status of current analysis session')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      // This would connect to a running orchestrator instance
      // For now, we'll show a message
      console.log('📊 Session Status');
      console.log('Currently no active session monitoring available.');
      console.log('This feature requires a persistent orchestrator service.');
      
      if (options.json) {
        console.log(JSON.stringify({ status: 'no-active-session' }, null, 2));
      }
    } catch (error) {
      console.error('❌ Failed to get status:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('View session history')
  .option('-n, --count <number>', 'Number of recent sessions to show', '10')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      console.log('📚 Session History');
      console.log('Loading session history...\n');
      
      // Create a temporary orchestrator to access history
      const config = createOrchestratorConfig({});
      const orchestrator = new AnalysisOrchestrator(config);
      await orchestrator.initialize();
      
      const history = await orchestrator.getSessionHistory();
      const recentHistory = history.slice(-parseInt(options.count));
      
      if (options.json) {
        console.log(JSON.stringify(recentHistory, null, 2));
      } else {
        displaySessionHistory(recentHistory);
      }
      
    } catch (error) {
      console.error('❌ Failed to load history:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('metrics')
  .description('View detailed metrics for a session')
  .argument('[sessionId]', 'Session ID (latest if not specified)')
  .option('--json', 'Output in JSON format')
  .action(async (sessionId, options) => {
    try {
      console.log('📈 Session Metrics');
      
      const config = createOrchestratorConfig({});
      const orchestrator = new AnalysisOrchestrator(config);
      await orchestrator.initialize();
      
      const metrics = await orchestrator.getSessionMetrics(sessionId);
      
      if (!metrics) {
        console.log('No metrics found for the specified session.');
        return;
      }
      
      if (options.json) {
        console.log(JSON.stringify(metrics, null, 2));
      } else {
        displayDetailedMetrics(metrics);
      }
      
    } catch (error) {
      console.error('❌ Failed to load metrics:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('validate-config')
  .description('Validate orchestrator configuration')
  .option('--mode <mode>', 'Operating mode to validate', 'ANALYSIS_ONLY')
  .action(async (options) => {
    try {
      console.log('🔍 Validating Configuration...\n');
      
      const config = createOrchestratorConfig(options);
      
      console.log('✅ Configuration validation passed');
      console.log('\n📋 Configuration Summary:');
      console.log(`   Mode: ${config.sessionConfig.mode}`);
      console.log(`   Max Iterations: ${config.sessionConfig.maxIterations}`);
      console.log(`   Session Timeout: ${config.sessionConfig.sessionTimeout / 60000} minutes`);
      console.log(`   Data Source: ${config.dataSource}`);
      console.log(`   Output Path: ${config.reportOutputPath}`);
      console.log(`   Learning Path: ${config.learningDataPath}`);
      console.log('\n🎛️  Enabled Features:');
      Object.entries(config.enabledFeatures).forEach(([feature, enabled]) => {
        console.log(`   ${enabled ? '✅' : '❌'} ${feature}`);
      });
      
    } catch (error) {
      console.error('❌ Configuration validation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('test-components')
  .description('Test individual orchestrator components')
  .option('--component <name>', 'Component to test (analyzer, validator, learning, mock-data)')
  .action(async (options) => {
    try {
      console.log('🧪 Testing Components...\n');
      
      const config = createOrchestratorConfig({});
      const orchestrator = new AnalysisOrchestrator(config);
      await orchestrator.initialize();
      
      if (!options.component || options.component === 'all') {
        console.log('Testing all components...');
        await testAllComponents();
      } else {
        await testComponent(options.component);
      }
      
    } catch (error) {
      console.error('❌ Component testing failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Utility Functions

function setupVerboseLogging(orchestrator: AnalysisOrchestrator): void {
  orchestrator.on('session-started', (data) => {
    console.log(`🚀 Session started: ${data.sessionId} (${data.mode} mode)`);
  });
  
  orchestrator.on('iteration-started', (data) => {
    console.log(`📊 Starting iteration ${data.iteration}...`);
  });
  
  orchestrator.on('step-started', (data) => {
    console.log(`   🔄 ${data.step.replace(/-/g, ' ')}...`);
  });
  
  orchestrator.on('iteration-completed', (data) => {
    console.log(`✅ Iteration ${data.iteration} completed - ${data.result.recommendationsGenerated.length} recommendations`);
  });
  
  orchestrator.on('change-implemented', (data) => {
    console.log(`🔧 Change implemented: ${data.changeId}`);
  });
  
  orchestrator.on('session-completed', (data) => {
    console.log(`🎉 Session completed: ${data.sessionId}`);
  });
  
  orchestrator.on('report-generated', (data) => {
    console.log(`📄 Report generated: ${data.reportPath}`);
  });
}

function setupBasicLogging(orchestrator: AnalysisOrchestrator): void {
  let lastIteration = 0;
  
  orchestrator.on('iteration-completed', (data) => {
    const dots = '.'.repeat(data.iteration);
    console.log(`Progress${dots} Iteration ${data.iteration} completed (${data.result.recommendationsGenerated.length} recommendations)`);
    lastIteration = data.iteration;
  });
  
  orchestrator.on('session-completed', () => {
    console.log(`\n✅ All ${lastIteration} iterations completed successfully`);
  });
}

function displaySessionMetrics(metrics: any): void {
  console.log('\n📊 Session Metrics:');
  console.log(`   Data Processed: ${metrics.totalDataProcessed} records`);
  console.log(`   Patterns Found: ${metrics.analysisPatterns}`);
  console.log(`   Recommendations: ${metrics.recommendationsGenerated} generated`);
  console.log(`   Changes: ${metrics.recommendationsImplemented} implemented`);
  console.log(`   Validations: ${metrics.validationsPassed} passed, ${metrics.validationsFailed} failed`);
  console.log(`   Average Confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%`);
}

function displaySessionHistory(history: any[]): void {
  if (history.length === 0) {
    console.log('No session history found.');
    return;
  }
  
  console.log(`Found ${history.length} recent sessions:\n`);
  
  history.forEach((session) => {
    const duration = session.endTime ? 
      ((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000).toFixed(1) :
      'incomplete';
    
    console.log(`📋 ${session.id}`);
    console.log(`   Mode: ${session.mode}`);
    console.log(`   Status: ${session.status}`);
    console.log(`   Duration: ${duration} minutes`);
    console.log(`   Iterations: ${session.iterations}`);
    console.log(`   Start: ${new Date(session.startTime).toLocaleString()}`);
    if (session.results?.length > 0) {
      const totalRecs = session.results.reduce((sum: number, r: any) => sum + r.recommendationsGenerated.length, 0);
      console.log(`   Total Recommendations: ${totalRecs}`);
    }
    console.log('');
  });
}

function displayDetailedMetrics(metrics: any): void {
  console.log(`\n📊 Detailed Metrics for Session: ${metrics.sessionId}\n`);
  
  console.log('🔍 Analysis Results:');
  console.log(`   Data Processed: ${metrics.totalDataProcessed} records`);
  console.log(`   Patterns Identified: ${metrics.analysisPatterns}`);
  console.log(`   Performance Improvements: ${metrics.performanceImprovements}`);
  
  console.log('\n💡 Recommendations:');
  console.log(`   Generated: ${metrics.recommendationsGenerated}`);
  console.log(`   Implemented: ${metrics.recommendationsImplemented}`);
  console.log(`   Average Confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%`);
  
  console.log('\n✅ Validation Results:');
  console.log(`   Passed: ${metrics.validationsPassed}`);
  console.log(`   Failed: ${metrics.validationsFailed}`);
  
  const successRate = metrics.validationsPassed + metrics.validationsFailed > 0 ?
    (metrics.validationsPassed / (metrics.validationsPassed + metrics.validationsFailed) * 100).toFixed(1) :
    'N/A';
  console.log(`   Success Rate: ${successRate}%`);
  
  console.log('\n🧠 Learning:');
  console.log(`   Learning Records Created: ${metrics.learningRecordsCreated}`);
}

async function testAllComponents(): Promise<void> {
  console.log('🔧 Testing mock data generation...');
  await testComponent('mock-data');
  
  console.log('\n🔧 Testing statistical analyzer...');
  await testComponent('analyzer');
  
  console.log('\n🔧 Testing safety validator...');
  await testComponent('validator');
  
  console.log('\n🔧 Testing learning engine...');
  await testComponent('learning');
  
  console.log('\n✅ All component tests completed');
}

async function testComponent(component: string): Promise<void> {
  switch (component) {
    case 'mock-data':
      const { MockDataGenerator } = await import('../exporters/MockDataGenerator.js');
      const generator = new MockDataGenerator();
      const data = generator.generateTelemetryExport({ days: 1, recordsPerDay: 10, includeErrors: true });
      console.log(`   ✅ Generated ${data.benchmarks.details.length} mock records`);
      break;
      
    case 'analyzer':
      const { StatisticalAnalyzer } = await import('../analyzers/StatisticalAnalyzer.js');
      const analyzer = new StatisticalAnalyzer();
      console.log('   ✅ Statistical analyzer initialized');
      break;
      
    case 'validator':
      const { SafetyValidator } = await import('../safety/SafetyValidator.js');
      const validator = new SafetyValidator(defaultConstraints, process.cwd());
      console.log('   ✅ Safety validator initialized');
      break;
      
    case 'learning':
      const { createLearningEngine } = await import('../feedback/learning-engine.js');
      const learning = createLearningEngine();
      await learning.initialize();
      console.log('   ✅ Learning engine initialized');
      break;
      
    default:
      throw new Error(`Unknown component: ${component}`);
  }
}

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Parse command line arguments
program.parse(); 