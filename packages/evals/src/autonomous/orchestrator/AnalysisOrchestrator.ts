import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';
import { 
  AnalysisSession,
  AnalysisResult,
  OperatingMode,
  SessionConfiguration,
  OperatingConstraints,
  ProposedChange,
  ValidationResult,
  Recommendation,
  TelemetryExport
} from '../types.js';
import { StatisticalAnalyzer, AnalysisResults } from '../analyzers/StatisticalAnalyzer.js';
import { SafetyValidator, ResourceMonitor } from '../safety/SafetyValidator.js';
import { LearningEngine, AnalysisContext } from '../feedback/learning-engine.js';
import { MockDataGenerator } from '../exporters/MockDataGenerator.js';
import { EvolutionIntegration, EvolutionConfig, EvolutionMetrics } from '../evolution/EvolutionIntegration.js';

export interface OrchestratorConfig {
  projectRoot: string;
  sessionConfig: SessionConfiguration;
  constraints: OperatingConstraints;
  dataSource: 'mock' | 'mcp' | 'database';
  reportOutputPath: string;
  learningDataPath: string;
  enabledFeatures: {
    statisticalAnalysis: boolean;
    safetyValidation: boolean;
    learningEngine: boolean;
    realTimeMonitoring: boolean;
    automaticReporting: boolean;
    evolutionEngine: boolean;
  };
  evolutionConfig?: Partial<EvolutionConfig>;
}

export interface SessionStatus {
  sessionId: string;
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'timeout';
  currentIteration: number;
  maxIterations: number;
  startTime: Date;
  estimatedCompletion?: Date;
  progress: {
    dataAnalysisComplete: boolean;
    recommendationsGenerated: boolean;
    validationComplete: boolean;
    changesImplemented: number;
    reportsGenerated: boolean;
  };
  resourceUsage: {
    memory: number;
    cpu: number;
    disk: number;
    apiCalls: number;
  };
  lastActivity: string;
  warnings: string[];
  errors: string[];
}

export interface AnalysisMetrics {
  sessionId: string;
  totalDataProcessed: number;
  analysisPatterns: number;
  recommendationsGenerated: number;
  recommendationsImplemented: number;
  validationsPassed: number;
  validationsFailed: number;
  performanceImprovements: number;
  averageConfidence: number;
  learningRecordsCreated: number;
  evolutionMetrics?: EvolutionMetrics;
}

export class AnalysisOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private currentSession: AnalysisSession | null = null;
  private statisticalAnalyzer: StatisticalAnalyzer;
  private safetyValidator: SafetyValidator;
  private learningEngine: LearningEngine;
  private resourceMonitor: ResourceMonitor;
  private mockDataGenerator: MockDataGenerator;
  private evolutionEngine: EvolutionIntegration;
  private sessionHistory: AnalysisSession[] = [];

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    
    // Initialize components
    this.statisticalAnalyzer = new StatisticalAnalyzer();
    this.safetyValidator = new SafetyValidator(config.constraints, config.projectRoot);
    this.learningEngine = new LearningEngine({
      storagePath: config.learningDataPath,
      maxHistorySize: 1000,
      confidenceThreshold: 0.6,
      adaptationRate: 0.1,
      patternMinimumOccurrences: 3
    });
    this.resourceMonitor = new ResourceMonitor(config.constraints.resourceLimits);
    this.mockDataGenerator = new MockDataGenerator();
    this.evolutionEngine = new EvolutionIntegration(config.evolutionConfig);

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    // Initialize learning engine
    if (this.config.enabledFeatures.learningEngine) {
      await this.learningEngine.initialize();
      this.emit('component-initialized', { component: 'learning-engine' });
    }

    // Initialize evolution engine
    if (this.config.enabledFeatures.evolutionEngine) {
      await this.evolutionEngine.initialize();
      this.emit('component-initialized', { component: 'evolution-engine' });
    }

    // Load session history
    await this.loadSessionHistory();
    
    // Ensure output directories exist
    await this.ensureDirectories();
    
    this.emit('orchestrator-ready');
  }

  async startAnalysisSession(
    mode?: OperatingMode,
    customConfig?: Partial<SessionConfiguration>
  ): Promise<string> {
    if (this.currentSession && this.currentSession.status === 'running') {
      throw new Error('Analysis session already running');
    }

    // Create new session
    const sessionConfig = { ...this.config.sessionConfig, ...customConfig };
    if (mode) sessionConfig.mode = mode;

    const session: AnalysisSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: new Date(),
      mode: sessionConfig.mode,
      configuration: sessionConfig,
      status: 'initializing',
      iterations: 0,
      results: []
    };

    this.currentSession = session;
    this.emit('session-started', { sessionId: session.id, mode: session.mode });

    try {
      await this.executeSession(session);
      return session.id;
    } catch (error) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('session-failed', { sessionId: session.id, error: session.error });
      throw error;
    }
  }

  async pauseSession(): Promise<void> {
    if (!this.currentSession || this.currentSession.status !== 'running') {
      throw new Error('No running session to pause');
    }

    this.currentSession.status = 'paused';
    this.emit('session-paused', { sessionId: this.currentSession.id });
  }

  async resumeSession(): Promise<void> {
    if (!this.currentSession || this.currentSession.status !== 'paused') {
      throw new Error('No paused session to resume');
    }

    this.currentSession.status = 'running';
    this.emit('session-resumed', { sessionId: this.currentSession.id });
    
    try {
      await this.executeSession(this.currentSession);
    } catch (error) {
      this.currentSession.status = 'failed';
      this.currentSession.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  async stopSession(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No session to stop');
    }

    this.currentSession.status = 'completed';
    this.currentSession.endTime = new Date();
    await this.finalizeSession(this.currentSession);
    
    this.emit('session-stopped', { sessionId: this.currentSession.id });
  }

  getSessionStatus(): SessionStatus | null {
    if (!this.currentSession) return null;

    const resourceUsage = this.resourceMonitor.getUsageReport();
    
    return {
      sessionId: this.currentSession.id,
      status: this.currentSession.status,
      currentIteration: this.currentSession.iterations,
      maxIterations: this.currentSession.configuration.maxIterations,
      startTime: this.currentSession.startTime,
      estimatedCompletion: this.estimateCompletion(),
      progress: this.calculateProgress(),
      resourceUsage: {
        memory: resourceUsage.memory.usage,
        cpu: resourceUsage.cpu.usage,
        disk: resourceUsage.disk.usage,
        apiCalls: resourceUsage.apiCalls.usage
      },
      lastActivity: this.getLastActivity(),
      warnings: this.getSessionWarnings(),
      errors: this.getSessionErrors()
    };
  }

  async getSessionMetrics(sessionId?: string): Promise<AnalysisMetrics | null> {
    const session = sessionId ? 
      this.sessionHistory.find(s => s.id === sessionId) || this.currentSession :
      this.currentSession;

    if (!session) return null;

    const metrics: AnalysisMetrics = {
      sessionId: session.id,
      totalDataProcessed: session.results.reduce((sum, result) => sum + result.dataAnalyzed, 0),
      analysisPatterns: session.results.reduce((sum, result) => sum + result.patternsFound.length, 0),
      recommendationsGenerated: session.results.reduce((sum, result) => sum + result.recommendationsGenerated.length, 0),
      recommendationsImplemented: session.results.reduce((sum, result) => sum + result.changesProposed.length, 0),
      validationsPassed: session.results.reduce((sum, result) => 
        sum + (result.validationResults?.filter(v => v.valid).length || 0), 0),
      validationsFailed: session.results.reduce((sum, result) => 
        sum + (result.validationResults?.filter(v => !v.valid).length || 0), 0),
      performanceImprovements: session.results.filter(result => 
        result.changesProposed.some(change => change.type === 'optimization')).length,
      averageConfidence: this.calculateAverageConfidence(session),
      learningRecordsCreated: session.results.reduce((sum, result) => 
        sum + result.recommendationsGenerated.length, 0), // Each recommendation becomes a learning record
      evolutionMetrics: this.config.enabledFeatures.evolutionEngine ? 
        await this.evolutionEngine.getEvolutionMetrics() : undefined
    };

    return metrics;
  }

  async getSessionHistory(): Promise<AnalysisSession[]> {
    return [...this.sessionHistory];
  }

  // Evolution integration methods
  recordRecommendationOutcome(
    recommendationId: string,
    outcome: {
      implemented: boolean;
      successful: boolean;
      userFeedback?: string;
    }
  ): void {
    if (!this.config.enabledFeatures.evolutionEngine) return;

    // Find the recommendation in current session results
    const currentSession = this.currentSession;
    if (!currentSession) return;

    for (const result of currentSession.results) {
      const recommendation = result.recommendationsGenerated.find(r => r.id === recommendationId);
      if (recommendation) {
        // Extract template ID from recommendation metadata (if available)
        const templateId = (recommendation as any).templateId || 'default-template';
        
        this.evolutionEngine.recordRecommendationOutcome(
          recommendationId,
          templateId,
          outcome
        );
        break;
      }
    }
  }

  recordAnomalyDetectionOutcome(
    context: string,
    detectedIndices: number[],
    actualAnomalies: number[]
  ): void {
    if (!this.config.enabledFeatures.evolutionEngine) return;

    // Find the pattern ID used for this context in the current session
    const currentSession = this.currentSession;
    if (!currentSession) return;

    // For now, use a simple pattern ID based on context
    const patternId = `pattern-${context}-${currentSession.id}`;
    
    this.evolutionEngine.recordAnomalyDetectionOutcome(
      patternId,
      context,
      detectedIndices,
      actualAnomalies
    );
  }

  async getEvolutionMetrics(): Promise<EvolutionMetrics | null> {
    if (!this.config.enabledFeatures.evolutionEngine) return null;
    return await this.evolutionEngine.getEvolutionMetrics();
  }

  exportEvolutionConfigurations(): any {
    if (!this.config.enabledFeatures.evolutionEngine) return null;
    return this.evolutionEngine.exportBestConfigurations();
  }

  async shutdown(): Promise<void> {
    // Stop any running sessions
    if (this.currentSession && this.currentSession.status === 'running') {
      await this.pauseSession();
    }

    // Shutdown evolution engine
    if (this.config.enabledFeatures.evolutionEngine) {
      await this.evolutionEngine.shutdown();
    }

    this.emit('orchestrator-shutdown');
  }

  // Private methods

  private async executeSession(session: AnalysisSession): Promise<void> {
    session.status = 'running';
    this.emit('session-execution-started', { sessionId: session.id });

    const startTime = Date.now();
    const timeout = session.configuration.sessionTimeout;

    while (
      session.iterations < session.configuration.maxIterations &&
      session.status === 'running' &&
      (Date.now() - startTime) < timeout
    ) {
      // Check resource limits
      const resourceCheck = this.resourceMonitor.checkResourceLimits();
      if (!resourceCheck.withinLimits) {
        throw new Error(`Resource limits exceeded: ${resourceCheck.violations.join(', ')}`);
      }

      session.iterations++;
      this.emit('iteration-started', { sessionId: session.id, iteration: session.iterations });

      try {
        const iterationResult = await this.executeIteration(session);
        session.results.push(iterationResult);
        
        this.emit('iteration-completed', { 
          sessionId: session.id, 
          iteration: session.iterations,
          result: iterationResult
        });

        // Check if we should continue
        if (session.configuration.mode === 'ANALYSIS_ONLY') {
          break; // Analysis only mode runs once
        }

        // For CONTINUOUS_REFINEMENT mode, check if we have optimizations to implement
        if (iterationResult.changesProposed.length === 0) {
          console.log('No more optimizations found, ending session');
          break;
        }

      } catch (error) {
        this.emit('iteration-failed', { 
          sessionId: session.id, 
          iteration: session.iterations,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Decide whether to continue or fail the session
        if (error instanceof Error && error.message.includes('Resource limits exceeded')) {
          throw error; // Fatal error
        }
        
        // Log error but continue with next iteration
        console.error(`Iteration ${session.iterations} failed:`, error);
      }
    }

    // Check why we exited the loop
    if ((Date.now() - startTime) >= timeout) {
      session.status = 'timeout';
      this.emit('session-timeout', { sessionId: session.id });
    } else {
      session.status = 'completed';
      session.endTime = new Date();
    }

    await this.finalizeSession(session);
  }

  private async executeIteration(session: AnalysisSession): Promise<AnalysisResult> {
    const iterationStart = new Date();
    
    // Step 1: Gather telemetry data
    this.emit('step-started', { step: 'data-gathering', sessionId: session.id });
    const telemetryData = await this.gatherTelemetryData();
    this.resourceMonitor.recordApiCall();
    
    // Step 2: Perform statistical analysis
    this.emit('step-started', { step: 'statistical-analysis', sessionId: session.id });
    let analysisResults = this.config.enabledFeatures.statisticalAnalysis ?
      this.statisticalAnalyzer.analyze(telemetryData) :
      { anomalies: [], patterns: [], insights: [], recommendations: [], statisticalSummary: null as any };

    // Step 2.5: Enhance anomaly detection with evolution
    if (this.config.enabledFeatures.evolutionEngine && this.config.enabledFeatures.statisticalAnalysis) {
      this.emit('step-started', { step: 'evolution-anomaly-detection', sessionId: session.id });
      
      try {
        // Extract numerical data for anomaly detection
        const performanceData = telemetryData.benchmarks.details.map(d => d.duration);
        const tokenData = telemetryData.benchmarks.details.map(d => d.tokenUsage.total);
        
        // Use evolution-based anomaly detection
        const performanceAnomalies = await this.evolutionEngine.detectAnomalies(
          performanceData, 
          'performance',
          { sessionId: session.id, iteration: session.iterations }
        );
        
        const tokenAnomalies = await this.evolutionEngine.detectAnomalies(
          tokenData,
          'token_usage',
          { sessionId: session.id, iteration: session.iterations }
        );

        // Merge evolution-detected anomalies with statistical analysis
        const evolutionAnomalies = [
          ...performanceAnomalies.anomalies.map((a, idx) => ({
            id: `evolution-perf-${session.id}-${idx}`,
            type: 'performance' as 'performance',
            severity: (a.confidence > 0.8 ? 'high' : a.confidence > 0.6 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
            description: `Performance anomaly detected at index ${a.index} with value ${a.value.toFixed(2)}ms`,
            affectedComponents: ['performance-monitoring'],
            confidence: a.confidence,
            detectionMethod: `Evolution Pattern: ${performanceAnomalies.patternUsed}`,
            suggestedInvestigation: 'Review performance patterns and system load during anomalous periods'
          })),
          ...tokenAnomalies.anomalies.map((a, idx) => ({
            id: `evolution-token-${session.id}-${idx}`,
            type: 'usage' as 'usage',
            severity: (a.confidence > 0.8 ? 'high' : a.confidence > 0.6 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
            description: `Token usage anomaly detected at index ${a.index} with value ${a.value} tokens`,
            affectedComponents: ['token-usage-system'],
            confidence: a.confidence,
            detectionMethod: `Evolution Pattern: ${tokenAnomalies.patternUsed}`,
            suggestedInvestigation: 'Analyze queries causing unusual token consumption patterns'
          }))
        ];

        const evolutionPatterns = [
          {
            id: `evolution-perf-pattern-${session.id}`,
            name: `evolution_performance_${performanceAnomalies.patternUsed}`,
            description: `Performance pattern detected using evolution-based analysis`,
            frequency: performanceAnomalies.anomalies.length,
            significance: 0.05,
            examples: performanceAnomalies.anomalies.slice(0, 3).map(a => `Index ${a.index}: ${a.value.toFixed(2)}ms`),
            actionable: true
          },
          {
            id: `evolution-token-pattern-${session.id}`,
            name: `evolution_tokens_${tokenAnomalies.patternUsed}`,
            description: `Token usage pattern detected using evolution-based analysis`,
            frequency: tokenAnomalies.anomalies.length,
            significance: 0.05,
            examples: tokenAnomalies.anomalies.slice(0, 3).map(a => `Index ${a.index}: ${a.value} tokens`),
            actionable: true
          }
        ];

        // Enhance analysis results with evolution-detected anomalies
        analysisResults = {
          ...analysisResults,
          anomalies: [...analysisResults.anomalies, ...evolutionAnomalies],
          patterns: [...analysisResults.patterns, ...evolutionPatterns]
        };

      } catch (error) {
        console.warn('Evolution-based anomaly detection failed:', error);
      }
    }

    // Step 3: Create analysis context
    const context = this.createAnalysisContext(telemetryData);

    // Step 4: Enhance recommendations with learning
    this.emit('step-started', { step: 'recommendation-enhancement', sessionId: session.id });
    const enhancedRecommendations = this.config.enabledFeatures.learningEngine ?
      await this.learningEngine.enhanceRecommendations(analysisResults.recommendations, context) :
      analysisResults.recommendations;

    // Step 5: Generate proactive recommendations
    const proactiveRecommendations = this.config.enabledFeatures.learningEngine ?
      await this.learningEngine.generateProactiveRecommendations(telemetryData, context) :
      [];

    // Step 6: Generate evolution-based recommendations
    this.emit('step-started', { step: 'evolution-recommendation-generation', sessionId: session.id });
    const evolutionRecommendations: Recommendation[] = [];
    
    if (this.config.enabledFeatures.evolutionEngine) {
      // Generate recommendations using evolved templates
      for (const baseRec of [...enhancedRecommendations, ...proactiveRecommendations].slice(0, 5)) {
        try {
          const evolvedRec = await this.evolutionEngine.generateRecommendation(
            { 
              baseRecommendation: baseRec,
              telemetryData,
              analysisResults 
            },
            context
          );
          evolutionRecommendations.push(evolvedRec);
        } catch (error) {
          console.warn('Evolution recommendation generation failed:', error);
          // Fallback to original recommendation
          evolutionRecommendations.push(baseRec);
        }
      }
    }

    const allRecommendations = this.config.enabledFeatures.evolutionEngine && evolutionRecommendations.length > 0 ?
      evolutionRecommendations :
      [...enhancedRecommendations, ...proactiveRecommendations];

    // Step 7: Convert recommendations to proposed changes (if in CONTINUOUS_REFINEMENT mode)
    const proposedChanges: ProposedChange[] = [];
    const validationResults: ValidationResult[] = [];

    if (session.configuration.mode === 'CONTINUOUS_REFINEMENT') {
      this.emit('step-started', { step: 'change-generation', sessionId: session.id });
      
      for (const recommendation of allRecommendations.slice(0, 3)) { // Limit to 3 per iteration
        const change = this.convertRecommendationToChange(recommendation);
        proposedChanges.push(change);

        // Step 8: Validate proposed changes
        if (this.config.enabledFeatures.safetyValidation) {
          this.emit('step-started', { step: 'safety-validation', sessionId: session.id });
          const validation = await this.safetyValidator.validateChange(change);
          validationResults.push(validation);

          // Step 9: Implement valid changes (mock implementation for now)
          if (validation.valid) {
            await this.implementChange(change);
            this.emit('change-implemented', { sessionId: session.id, changeId: change.id });
          }
        }
      }
    }

    const result: AnalysisResult = {
      iteration: session.iterations,
      timestamp: iterationStart,
      dataAnalyzed: telemetryData.benchmarks.details.length,
      patternsFound: analysisResults.patterns.map(p => p.name),
      recommendationsGenerated: allRecommendations,
      changesProposed: proposedChanges,
      validationResults: validationResults.length > 0 ? validationResults : undefined
    };

    return result;
  }

  private async gatherTelemetryData(): Promise<TelemetryExport> {
    switch (this.config.dataSource) {
      case 'mock':
        return this.mockDataGenerator.generateTelemetryExport({
          days: 7,
          recordsPerDay: 200,
          includeErrors: true
        });
      
      case 'mcp':
        // TODO: Integrate with MCP telemetry server
        console.log('MCP integration not yet implemented, using mock data');
        return this.mockDataGenerator.generateTelemetryExport({
          days: 7,
          recordsPerDay: 200,
          includeErrors: true
        });
      
      case 'database':
        // TODO: Integrate with database
        console.log('Database integration not yet implemented, using mock data');
        return this.mockDataGenerator.generateTelemetryExport({
          days: 7,
          recordsPerDay: 200,
          includeErrors: true
        });
      
      default:
        throw new Error(`Unsupported data source: ${this.config.dataSource}`);
    }
  }

  private createAnalysisContext(telemetryData: TelemetryExport): AnalysisContext {
    const now = new Date();
    
    return {
      dataVolume: telemetryData.benchmarks.details.length,
      timeRange: telemetryData.metadata.timeRange,
      systemState: {
        avgResponseTime: telemetryData.benchmarks.summary.avgDuration,
        errorRate: 1 - telemetryData.benchmarks.summary.successRate,
        throughput: telemetryData.benchmarks.summary.totalBenchmarks / 24, // Per hour estimate
        activeServers: telemetryData.performance.byServer.map(s => s.serverName),
        recentChanges: [] // Would be populated from git history in real implementation
      },
      environmentFactors: {
        timeOfDay: now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening',
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()],
        load: telemetryData.benchmarks.summary.avgDuration > 300 ? 'high' : telemetryData.benchmarks.summary.avgDuration > 150 ? 'medium' : 'low',
        recentDeployments: false // Would check deployment history
      }
    };
  }

  private convertRecommendationToChange(recommendation: Recommendation): ProposedChange {
    // Convert recommendation to actionable code change
    // This is a simplified implementation - in practice would be more sophisticated
    
    const changeType = recommendation.title.toLowerCase().includes('performance') ? 'optimization' :
                      recommendation.title.toLowerCase().includes('error') ? 'bug_fix' :
                      'refactor';

    return {
      id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: changeType,
      files: this.getRelevantFiles(recommendation),
      description: recommendation.description,
      rationale: `Based on analysis recommendation: ${recommendation.title}`,
      expectedImpact: recommendation.expectedImpact,
      riskLevel: this.assessRiskLevel(recommendation)
    };
  }

  private getRelevantFiles(recommendation: Recommendation): string[] {
    // Determine which files to modify based on recommendation
    // This is a mock implementation
    
    if (recommendation.title.toLowerCase().includes('server')) {
      return ['packages/evals/src/benchmark/server-optimization.ts'];
    }
    
    if (recommendation.title.toLowerCase().includes('error')) {
      return ['packages/evals/src/benchmark/error-handling.ts'];
    }
    
    return ['packages/evals/src/benchmark/general-improvement.ts'];
  }

  private assessRiskLevel(recommendation: Recommendation): 'low' | 'medium' | 'high' {
    if (recommendation.priority === 'critical' || recommendation.confidence < 0.7) {
      return 'high';
    }
    
    if (recommendation.priority === 'high' || recommendation.effort === 'high') {
      return 'medium';
    }
    
    return 'low';
  }

  private async implementChange(change: ProposedChange): Promise<void> {
    // Mock implementation - in real system would make actual code changes
    console.log(`Mock implementation: ${change.description}`);
    
    // Simulate implementation time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.emit('change-implemented', { changeId: change.id, files: change.files });
  }

  private async finalizeSession(session: AnalysisSession): Promise<void> {
    // Generate final report
    if (this.config.enabledFeatures.automaticReporting) {
      await this.generateSessionReport(session);
    }

    // Save session to history
    this.sessionHistory.push(session);
    await this.saveSessionHistory();

    // Clean up current session
    this.currentSession = null;

    this.emit('session-finalized', { sessionId: session.id });
  }

  private async generateSessionReport(session: AnalysisSession): Promise<void> {
    const metrics = await this.getSessionMetrics(session.id);
    const reportPath = join(this.config.reportOutputPath, `session-${session.id}-report.md`);
    
    const report = this.formatSessionReport(session, metrics);
    await fs.writeFile(reportPath, report);
    
    this.emit('report-generated', { sessionId: session.id, reportPath });
  }

  private formatSessionReport(session: AnalysisSession, metrics: AnalysisMetrics | null): string {
    const duration = session.endTime ? 
      (session.endTime.getTime() - session.startTime.getTime()) / 1000 / 60 : // minutes
      0;

    return `# Autonomous Analysis Session Report

## Session Overview
- **Session ID**: ${session.id}
- **Mode**: ${session.mode}
- **Status**: ${session.status}
- **Duration**: ${duration.toFixed(1)} minutes
- **Iterations**: ${session.iterations}/${session.configuration.maxIterations}
- **Start Time**: ${session.startTime.toISOString()}
- **End Time**: ${session.endTime?.toISOString() || 'N/A'}

## Performance Metrics
${metrics ? `
- **Data Processed**: ${metrics.totalDataProcessed} records
- **Patterns Found**: ${metrics.analysisPatterns}
- **Recommendations Generated**: ${metrics.recommendationsGenerated}
- **Changes Implemented**: ${metrics.recommendationsImplemented}
- **Validations Passed**: ${metrics.validationsPassed}
- **Validations Failed**: ${metrics.validationsFailed}
- **Average Confidence**: ${(metrics.averageConfidence * 100).toFixed(1)}%
` : 'Metrics not available'}

## Iteration Results
${session.results.map((result, i) => `
### Iteration ${i + 1}
- **Data Analyzed**: ${result.dataAnalyzed} records
- **Patterns Found**: ${result.patternsFound.length} (${result.patternsFound.join(', ')})
- **Recommendations**: ${result.recommendationsGenerated.length}
- **Changes Proposed**: ${result.changesProposed.length}
- **Validation Results**: ${result.validationResults?.length || 0} checks

#### Top Recommendations:
${result.recommendationsGenerated.slice(0, 3).map(rec => `
- **${rec.title}** (${rec.priority} priority, ${(rec.confidence * 100).toFixed(0)}% confidence)
  - ${rec.description}
  - Expected Impact: ${rec.expectedImpact}
`).join('')}
`).join('')}

## Session Summary
${session.status === 'completed' ? 
  `Session completed successfully with ${session.results.length} analysis iterations.` :
  session.status === 'failed' ? 
    `Session failed: ${session.error}` :
    `Session ended with status: ${session.status}`
}

---
*Generated automatically by Autonomous Analysis System*
*Report Date: ${new Date().toISOString()}*
`;
  }

  private estimateCompletion(): Date | undefined {
    if (!this.currentSession || this.currentSession.status !== 'running') return undefined;

    const elapsed = Date.now() - this.currentSession.startTime.getTime();
    const iterationTime = this.currentSession.iterations > 0 ? elapsed / this.currentSession.iterations : 0;
    const remainingIterations = this.currentSession.configuration.maxIterations - this.currentSession.iterations;
    
    return new Date(Date.now() + (remainingIterations * iterationTime));
  }

  private calculateProgress(): SessionStatus['progress'] {
    if (!this.currentSession) {
      return {
        dataAnalysisComplete: false,
        recommendationsGenerated: false,
        validationComplete: false,
        changesImplemented: 0,
        reportsGenerated: false
      };
    }

    const latestResult = this.currentSession.results[this.currentSession.results.length - 1];
    
    return {
      dataAnalysisComplete: latestResult ? latestResult.dataAnalyzed > 0 : false,
      recommendationsGenerated: latestResult ? latestResult.recommendationsGenerated.length > 0 : false,
      validationComplete: latestResult ? (latestResult.validationResults?.length || 0) > 0 : false,
      changesImplemented: this.currentSession.results.reduce((sum, r) => sum + r.changesProposed.length, 0),
      reportsGenerated: false // Will be true when final report is generated
    };
  }

  private getLastActivity(): string {
    if (!this.currentSession) return 'No active session';
    
    if (this.currentSession.results.length === 0) {
      return 'Session initializing';
    }
    
    const lastResult = this.currentSession.results[this.currentSession.results.length - 1];
    return `Completed iteration ${this.currentSession.iterations}: ${lastResult.recommendationsGenerated.length} recommendations generated`;
  }

  private getSessionWarnings(): string[] {
    const warnings: string[] = [];
    
    if (!this.currentSession) return warnings;
    
    const resourceUsage = this.resourceMonitor.getUsageReport();
    
    if (resourceUsage.memory.percentage > 80) {
      warnings.push(`High memory usage: ${resourceUsage.memory.percentage.toFixed(1)}%`);
    }
    
    if (resourceUsage.cpu.percentage > 90) {
      warnings.push(`High CPU usage: ${resourceUsage.cpu.percentage.toFixed(1)}%`);
    }
    
    if (this.currentSession.results.length > 0) {
      const avgConfidence = this.calculateAverageConfidence(this.currentSession);
      if (avgConfidence < 0.6) {
        warnings.push(`Low average recommendation confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      }
    }
    
    return warnings;
  }

  private getSessionErrors(): string[] {
    if (!this.currentSession) return [];
    
    const errors: string[] = [];
    
    if (this.currentSession.error) {
      errors.push(this.currentSession.error);
    }
    
    // Check for validation failures
    const failedValidations = this.currentSession.results.reduce((count, result) => 
      count + (result.validationResults?.filter(v => !v.valid).length || 0), 0);
    
    if (failedValidations > 0) {
      errors.push(`${failedValidations} validation failures across iterations`);
    }
    
    return errors;
  }

  private calculateAverageConfidence(session: AnalysisSession): number {
    const allRecommendations = session.results.flatMap(r => r.recommendationsGenerated);
    if (allRecommendations.length === 0) return 0;
    
    return allRecommendations.reduce((sum, rec) => sum + rec.confidence, 0) / allRecommendations.length;
  }

  private setupEventHandlers(): void {
    this.on('session-started', (data) => {
      console.log(`Analysis session started: ${data.sessionId} (${data.mode} mode)`);
    });

    this.on('iteration-completed', (data) => {
      console.log(`Iteration ${data.iteration} completed: ${data.result.recommendationsGenerated.length} recommendations`);
    });

    this.on('session-completed', (data) => {
      console.log(`Analysis session completed: ${data.sessionId}`);
    });

    // Evolution event handlers
    if (this.config.enabledFeatures.evolutionEngine) {
      this.evolutionEngine.on('evolution-initialized', (data) => {
        console.log('Evolution engine initialized:', data.components);
      });

      this.evolutionEngine.on('recommendation-generated', (data) => {
        console.log(`Evolution recommendation generated using template: ${data.templateId}`);
      });

      this.evolutionEngine.on('anomalies-detected', (data) => {
        console.log(`Evolution detected ${data.count} anomalies in context: ${data.context}`);
      });

      this.evolutionEngine.on('evolution-completed', (data) => {
        console.log('Evolution cycle completed:', data);
      });
    }
  }

  private async loadSessionHistory(): Promise<void> {
    try {
      const historyPath = join(this.config.reportOutputPath, 'session-history.json');
      const data = await fs.readFile(historyPath, 'utf-8');
      this.sessionHistory = JSON.parse(data).map((session: any) => ({
        ...session,
        startTime: new Date(session.startTime),
        endTime: session.endTime ? new Date(session.endTime) : undefined,
        results: session.results.map((result: any) => ({
          ...result,
          timestamp: new Date(result.timestamp)
        }))
      }));
    } catch (error) {
      console.log('No existing session history found');
      this.sessionHistory = [];
    }
  }

  private async saveSessionHistory(): Promise<void> {
    try {
      const historyPath = join(this.config.reportOutputPath, 'session-history.json');
      await fs.writeFile(historyPath, JSON.stringify(this.sessionHistory, null, 2));
    } catch (error) {
      console.error('Failed to save session history:', error);
    }
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.config.reportOutputPath, { recursive: true });
      await fs.mkdir(this.config.learningDataPath, { recursive: true });
    } catch (error) {
      console.error('Failed to create directories:', error);
    }
  }
} 