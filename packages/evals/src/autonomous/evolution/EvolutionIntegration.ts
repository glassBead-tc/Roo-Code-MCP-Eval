import { EventEmitter } from 'events';
import { EvolvableRecommendationTemplates, TemplateOutcome } from './EvolvableRecommendationTemplates.js';
import { DynamicThresholdLearning } from './DynamicThresholdLearning.js';
import { PatternDiscoveryArchive } from './PatternDiscoveryArchive.js';
import { Recommendation, TelemetryExport } from '../types.js';

export interface EvolutionConfig {
  enableRecommendationEvolution: boolean;
  enableThresholdLearning: boolean;
  enablePatternDiscovery: boolean;
  evolutionInterval: number; // hours
  performanceEvaluationWindow: number; // hours
}

export interface EvolutionMetrics {
  recommendationTemplates: {
    total: number;
    active: number;
    averageFitness: number;
    generationDistribution: Record<number, number>;
  };
  thresholds: {
    current: Record<string, number>;
    improvements: Array<{ name: string; improvement: number }>;
    overallImprovement: number;
  };
  patterns: {
    total: number;
    active: number;
    averageF1Score: number;
    contextCoverage: Record<string, number>;
  };
}

export class EvolutionIntegration extends EventEmitter {
  private config: EvolutionConfig;
  private recommendationEvolver: EvolvableRecommendationTemplates;
  private thresholdLearner: DynamicThresholdLearning;
  private patternArchive: PatternDiscoveryArchive;
  private lastEvolutionTime: Date;
  private evolutionTimer?: NodeJS.Timeout;

  constructor(config: Partial<EvolutionConfig> = {}) {
    super();
    
    this.config = {
      enableRecommendationEvolution: true,
      enableThresholdLearning: true,
      enablePatternDiscovery: true,
      evolutionInterval: 24, // Daily evolution by default
      performanceEvaluationWindow: 168, // Weekly evaluation
      ...config
    };

    // Initialize components
    this.recommendationEvolver = new EvolvableRecommendationTemplates({
      populationSize: 20,
      evaluationPeriod: 7
    });

    this.thresholdLearner = new DynamicThresholdLearning({
      evaluationWindow: this.config.performanceEvaluationWindow,
      minSampleSize: 50
    });

    this.patternArchive = new PatternDiscoveryArchive({
      maxPatterns: 50,
      evaluationWindow: this.config.performanceEvaluationWindow
    });

    this.lastEvolutionTime = new Date();
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    this.emit('evolution-initializing');

    // Start evolution timer
    if (this.config.evolutionInterval > 0) {
      this.evolutionTimer = setInterval(
        () => this.performEvolution(),
        this.config.evolutionInterval * 60 * 60 * 1000
      );
    }

    this.emit('evolution-initialized', {
      components: {
        recommendations: this.config.enableRecommendationEvolution,
        thresholds: this.config.enableThresholdLearning,
        patterns: this.config.enablePatternDiscovery
      }
    });
  }

  async shutdown(): Promise<void> {
    if (this.evolutionTimer) {
      clearInterval(this.evolutionTimer);
    }
    this.emit('evolution-shutdown');
  }

  // Recommendation generation with evolution
  async generateRecommendation(
    data: Record<string, any>,
    context?: any
  ): Promise<Recommendation> {
    if (!this.config.enableRecommendationEvolution) {
      // Fallback to basic recommendation
      return this.createBasicRecommendation(data);
    }

    const { recommendation, templateId } = await this.recommendationEvolver.generateRecommendation(
      data,
      context
    );

    // Track template usage for evolution
    this.emit('recommendation-generated', { templateId, recommendation });

    return recommendation;
  }

  // Record recommendation outcome for learning
  recordRecommendationOutcome(
    recommendationId: string,
    templateId: string,
    outcome: {
      implemented: boolean;
      successful: boolean;
      userFeedback?: string;
    }
  ): void {
    if (!this.config.enableRecommendationEvolution) return;

    const templateOutcome: TemplateOutcome = {
      templateId,
      recommendationId,
      implemented: outcome.implemented,
      successful: outcome.successful,
      confidenceScore: outcome.successful ? 0.9 : 0.3,
      feedback: outcome.userFeedback,
      timestamp: new Date()
    };

    this.recommendationEvolver.recordOutcome(templateId, templateOutcome);
    this.emit('outcome-recorded', { type: 'recommendation', outcome: templateOutcome });
  }

  // Dynamic threshold management
  getThreshold(name: string): number {
    if (!this.config.enableThresholdLearning) {
      // Return default thresholds
      return this.getDefaultThreshold(name);
    }

    try {
      return this.thresholdLearner.getThreshold(name);
    } catch (error) {
      // Fallback to default if threshold not found
      return this.getDefaultThreshold(name);
    }
  }

  recordThresholdDetection(
    thresholdName: string,
    detected: boolean,
    actualPositive: boolean
  ): void {
    if (!this.config.enableThresholdLearning) return;

    this.thresholdLearner.recordDetection(thresholdName, detected, actualPositive);
    this.emit('detection-recorded', { 
      type: 'threshold', 
      threshold: thresholdName, 
      detected, 
      actualPositive 
    });
  }

  // Pattern-based anomaly detection
  async detectAnomalies(
    data: number[],
    context: string,
    metadata?: Record<string, any>
  ): Promise<{
    anomalies: Array<{ index: number; value: number; confidence: number }>;
    patternUsed: string;
  }> {
    if (!this.config.enablePatternDiscovery) {
      // Fallback to simple threshold detection
      return this.simpleAnomalyDetection(data, context);
    }

    const result = await this.patternArchive.detectAnomalies(data, context, metadata);
    
    this.emit('anomalies-detected', {
      context,
      count: result.anomalies.length,
      patternId: result.patternId
    });

    return {
      anomalies: result.anomalies,
      patternUsed: result.patternId
    };
  }

  recordAnomalyDetectionOutcome(
    patternId: string,
    context: string,
    detectedIndices: number[],
    actualAnomalies: number[]
  ): void {
    if (!this.config.enablePatternDiscovery) return;

    this.patternArchive.recordDetectionOutcome(
      patternId,
      context,
      actualAnomalies,
      detectedIndices
    );

    this.emit('detection-outcome-recorded', {
      type: 'pattern',
      patternId,
      context,
      accuracy: this.calculateAccuracy(detectedIndices, actualAnomalies)
    });
  }

  // Evolution execution
  async performEvolution(): Promise<void> {
    this.emit('evolution-started');
    const startTime = Date.now();

    try {
      // Evolve recommendation templates
      if (this.config.enableRecommendationEvolution) {
        await this.recommendationEvolver.evolveTemplates();
        this.emit('component-evolved', { component: 'recommendations' });
      }

      // Adapt thresholds
      if (this.config.enableThresholdLearning) {
        await this.thresholdLearner.adaptThresholds();
        this.emit('component-evolved', { component: 'thresholds' });
      }

      // Evolve detection patterns
      if (this.config.enablePatternDiscovery) {
        await this.patternArchive.evolvePatterns();
        this.emit('component-evolved', { component: 'patterns' });
      }

      this.lastEvolutionTime = new Date();
      const duration = Date.now() - startTime;

      this.emit('evolution-completed', {
        duration,
        metrics: await this.getEvolutionMetrics()
      });

    } catch (error) {
      this.emit('evolution-failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get current evolution metrics
  async getEvolutionMetrics(): Promise<EvolutionMetrics> {
    const recommendationStats = this.recommendationEvolver.getArchiveStats();
    const thresholdReport = this.thresholdLearner.getPerformanceReport();
    const patternStats = this.patternArchive.getArchiveStats();

    return {
      recommendationTemplates: {
        total: recommendationStats.totalTemplates,
        active: recommendationStats.activeTemplates,
        averageFitness: recommendationStats.averageFitness,
        generationDistribution: recommendationStats.generationDistribution
      },
      thresholds: {
        current: this.thresholdLearner.exportBestConfiguration(),
        improvements: thresholdReport.thresholds.map(t => ({
          name: t.name,
          improvement: t.improvement
        })),
        overallImprovement: thresholdReport.overallImprovement
      },
      patterns: {
        total: patternStats.totalPatterns,
        active: patternStats.activePatterns,
        averageF1Score: patternStats.averageF1Score,
        contextCoverage: patternStats.contextCoverage
      }
    };
  }

  // Export best configurations
  exportBestConfigurations(): {
    thresholds: Record<string, number>;
    topTemplates: Array<{ id: string; template: string; performance: number }>;
    topPatterns: Array<{ id: string; contexts: string[]; f1Score: number }>;
  } {
    // Export thresholds
    const thresholds = this.thresholdLearner.exportBestConfiguration();

    // Get top templates (would need to add this method to EvolvableRecommendationTemplates)
    const topTemplates: any[] = []; // Placeholder

    // Get top patterns (would need to add this method to PatternDiscoveryArchive)
    const topPatterns: any[] = []; // Placeholder

    return {
      thresholds,
      topTemplates,
      topPatterns
    };
  }

  // Import configurations
  importConfigurations(config: {
    thresholds?: Record<string, number>;
  }): void {
    if (config.thresholds && this.config.enableThresholdLearning) {
      this.thresholdLearner.importConfiguration(config.thresholds);
      this.emit('configuration-imported', { type: 'thresholds' });
    }
  }

  // Helper methods
  private createBasicRecommendation(data: Record<string, any>): Recommendation {
    return {
      id: `rec_${Date.now()}`,
      title: data.title || 'System Optimization',
      description: data.description || 'Consider optimizing system performance',
      priority: data.priority || 'medium',
      expectedImpact: data.expectedImpact || 'Moderate improvement',
      effort: data.effort || 'medium',
      confidence: data.confidence || 0.7
    };
  }

  private getDefaultThreshold(name: string): number {
    const defaults: Record<string, number> = {
      'anomaly_detection_confidence': 0.85,
      'performance_degradation_threshold': 0.15,
      'resource_spike_threshold': 2.0,
      'error_rate_threshold': 0.05,
      'latency_deviation_threshold': 3.0
    };
    return defaults[name] || 0.5;
  }

  private async simpleAnomalyDetection(
    data: number[],
    context: string
  ): Promise<{ anomalies: Array<{ index: number; value: number; confidence: number }>; patternUsed: string }> {
    // Simple z-score based detection
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const std = Math.sqrt(data.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / data.length);
    const threshold = 3;

    const anomalies = data
      .map((value, index) => ({
        index,
        value,
        confidence: Math.min(Math.abs((value - mean) / std) / threshold, 1)
      }))
      .filter(a => a.confidence > 0.8);

    return { anomalies, patternUsed: 'simple_zscore' };
  }

  private calculateAccuracy(detected: number[], actual: number[]): number {
    const truePositives = detected.filter(d => actual.includes(d)).length;
    const falsePositives = detected.filter(d => !actual.includes(d)).length;
    const falseNegatives = actual.filter(a => !detected.includes(a)).length;
    
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    
    return precision + recall > 0 
      ? 2 * (precision * recall) / (precision + recall)
      : 0;
  }

  private setupEventHandlers(): void {
    // Forward events from components
    this.recommendationEvolver.on('evolution-completed', (data) => {
      this.emit('component-evolution-completed', { component: 'recommendations', ...data });
    });

    this.thresholdLearner.on('adaptation-completed', (data) => {
      this.emit('component-evolution-completed', { component: 'thresholds', ...data });
    });

    this.patternArchive.on('evolution-completed', (data) => {
      this.emit('component-evolution-completed', { component: 'patterns', ...data });
    });
  }
} 