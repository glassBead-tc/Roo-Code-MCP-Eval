import { promises as fs } from 'fs';
import { join } from 'path';
import { 
  Recommendation, 
  ProposedChange, 
  ValidationResult, 
  AnalysisSession,
  TelemetryExport,
  BenchmarkDetail 
} from '../types.js';

export interface LearningConfig {
  storagePath: string;
  maxHistorySize: number;
  confidenceThreshold: number;
  adaptationRate: number; // How quickly to adjust based on feedback
  patternMinimumOccurrences: number;
}

export interface LearningRecord {
  id: string;
  timestamp: Date;
  recommendation: Recommendation;
  proposedChange?: ProposedChange;
  outcome: LearningOutcome;
  context: AnalysisContext;
  metrics: OutcomeMetrics;
}

export interface LearningOutcome {
  implemented: boolean;
  successful: boolean;
  measurementPeriod: { start: Date; end: Date };
  actualImpact?: ActualImpact;
  failureReason?: string;
  userFeedback?: UserFeedback;
}

export interface ActualImpact {
  performanceChange: number; // Percentage change
  errorRateChange: number;
  throughputChange: number;
  qualityChange: number;
  userSatisfactionChange?: number;
}

export interface UserFeedback {
  rating: 1 | 2 | 3 | 4 | 5; // 1=poor, 5=excellent
  category: 'accuracy' | 'usefulness' | 'timing' | 'clarity';
  comment?: string;
  wouldImplementAgain: boolean;
}

export interface AnalysisContext {
  dataVolume: number;
  timeRange: { start: Date; end: Date };
  systemState: SystemState;
  environmentFactors: EnvironmentFactors;
}

export interface SystemState {
  avgResponseTime: number;
  errorRate: number;
  throughput: number;
  activeServers: string[];
  recentChanges: string[];
}

export interface EnvironmentFactors {
  timeOfDay: string;
  dayOfWeek: string;
  load: 'low' | 'medium' | 'high';
  recentDeployments: boolean;
  seasonality?: string;
}

export interface OutcomeMetrics {
  predictionAccuracy: number; // How close was the expected impact to actual?
  implementationSuccess: boolean;
  timeToMeasurement: number; // Hours
  confidenceValidated: boolean;
}

export interface Pattern {
  id: string;
  type: 'recommendation' | 'context' | 'failure' | 'success';
  description: string;
  conditions: PatternCondition[];
  confidence: number;
  occurrences: number;
  successRate: number;
  averageImpact: number;
  lastSeen: Date;
}

export interface PatternCondition {
  field: string;
  operator: 'eq' | 'gt' | 'lt' | 'contains' | 'range';
  value: any;
  weight: number;
}

export interface AdaptiveThreshold {
  metric: string;
  currentValue: number;
  baselineValue: number;
  adaptationHistory: { timestamp: Date; value: number; reason: string }[];
  confidence: number;
}

export interface LearningInsight {
  id: string;
  type: 'improvement' | 'warning' | 'trend' | 'anomaly';
  title: string;
  description: string;
  evidence: string[];
  confidence: number;
  actionable: boolean;
  recommendedAction?: string;
}

export class LearningEngine {
  private config: LearningConfig;
  private history: LearningRecord[] = [];
  private patterns: Map<string, Pattern> = new Map();
  private adaptiveThresholds: Map<string, AdaptiveThreshold> = new Map();
  private insights: LearningInsight[] = [];

  constructor(config: LearningConfig) {
    this.config = config;
    this.initializeThresholds();
  }

  async initialize(): Promise<void> {
    await this.loadHistory();
    await this.loadPatterns();
    this.updateAdaptiveThresholds();
    this.generateInsights();
  }

  async recordOutcome(
    recommendationId: string,
    outcome: LearningOutcome,
    context: AnalysisContext
  ): Promise<void> {
    const recommendation = this.findRecommendationById(recommendationId);
    if (!recommendation) {
      throw new Error(`Recommendation ${recommendationId} not found`);
    }

    const record: LearningRecord = {
      id: `lr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      recommendation,
      outcome,
      context,
      metrics: this.calculateOutcomeMetrics(recommendation, outcome)
    };

    this.history.push(record);
    await this.updatePatterns(record);
    await this.adaptThresholds(record);
    await this.saveHistory();
    
    console.log(`Learning: Recorded outcome for recommendation ${recommendationId}`);
  }

  async enhanceRecommendations(
    recommendations: Recommendation[],
    context: AnalysisContext
  ): Promise<Recommendation[]> {
    const enhancedRecommendations = await Promise.all(
      recommendations.map(async (rec) => await this.enhanceRecommendation(rec, context))
    );

    // Sort by enhanced confidence and filter low-confidence recommendations
    return enhancedRecommendations
      .filter(rec => rec.confidence >= this.config.confidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence);
  }

  async generateProactiveRecommendations(
    telemetryData: TelemetryExport,
    context: AnalysisContext
  ): Promise<Recommendation[]> {
    const proactiveRecommendations: Recommendation[] = [];

    // Pattern-based recommendations
    const patternRecs = await this.generatePatternBasedRecommendations(telemetryData, context);
    proactiveRecommendations.push(...patternRecs);

    // Threshold-based recommendations
    const thresholdRecs = await this.generateThresholdBasedRecommendations(telemetryData, context);
    proactiveRecommendations.push(...thresholdRecs);

    // Trend-based recommendations
    const trendRecs = await this.generateTrendBasedRecommendations(telemetryData, context);
    proactiveRecommendations.push(...trendRecs);

    return proactiveRecommendations
      .filter(rec => rec.confidence >= this.config.confidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence);
  }

  async getLearningInsights(): Promise<LearningInsight[]> {
    await this.generateInsights();
    return this.insights;
  }

  async getAdaptationSummary(): Promise<{
    totalLearningRecords: number;
    patternsIdentified: number;
    successRate: number;
    averageImpact: number;
    adaptiveThresholds: number;
    recentInsights: LearningInsight[];
  }> {
    const successfulOutcomes = this.history.filter(r => r.outcome.successful);
    
    return {
      totalLearningRecords: this.history.length,
      patternsIdentified: this.patterns.size,
      successRate: this.history.length > 0 ? successfulOutcomes.length / this.history.length : 0,
      averageImpact: successfulOutcomes.length > 0 
        ? successfulOutcomes.reduce((sum, r) => sum + (r.outcome.actualImpact?.performanceChange || 0), 0) / successfulOutcomes.length 
        : 0,
      adaptiveThresholds: this.adaptiveThresholds.size,
      recentInsights: this.insights.slice(-5)
    };
  }

  // Private methods

  private async enhanceRecommendation(
    recommendation: Recommendation,
    context: AnalysisContext
  ): Promise<Recommendation> {
    // Find similar historical recommendations
    const similarRecords = this.findSimilarRecords(recommendation, context);
    
    if (similarRecords.length === 0) {
      return recommendation; // No learning data available
    }

    // Calculate success rate for similar recommendations
    const successfulSimilar = similarRecords.filter(r => r.outcome.successful);
    const successRate = successfulSimilar.length / similarRecords.length;
    
    // Calculate average actual impact
    const impactData = successfulSimilar
      .map(r => r.outcome.actualImpact?.performanceChange || 0)
      .filter(impact => impact !== 0);
    
    const avgImpact = impactData.length > 0 
      ? impactData.reduce((sum, impact) => sum + impact, 0) / impactData.length 
      : 0;

    // Adjust confidence based on historical performance
    const confidenceAdjustment = (successRate - 0.5) * 0.3; // ±30% max adjustment
    const adjustedConfidence = Math.max(0.1, Math.min(0.99, recommendation.confidence + confidenceAdjustment));

    // Update expected impact if we have reliable historical data
    const updatedExpectedImpact = impactData.length >= 3 
      ? `${Math.abs(avgImpact).toFixed(1)}% ${avgImpact >= 0 ? 'improvement' : 'degradation'} (learned from ${successfulSimilar.length} similar cases)`
      : recommendation.expectedImpact;

    // Add implementation hints based on learned patterns
    const implementationHints = this.generateImplementationHints(recommendation, similarRecords);

    return {
      ...recommendation,
      confidence: adjustedConfidence,
      expectedImpact: updatedExpectedImpact,
      implementationHint: implementationHints || recommendation.implementationHint
    };
  }

  private findSimilarRecords(
    recommendation: Recommendation,
    context: AnalysisContext
  ): LearningRecord[] {
    return this.history.filter(record => {
      // Check recommendation similarity
      const titleSimilarity = this.calculateStringSimilarity(
        recommendation.title.toLowerCase(),
        record.recommendation.title.toLowerCase()
      );
      
      const descriptionSimilarity = this.calculateStringSimilarity(
        recommendation.description.toLowerCase(),
        record.recommendation.description.toLowerCase()
      );
      
      // Check context similarity
      const contextSimilarity = this.calculateContextSimilarity(context, record.context);
      
      return titleSimilarity > 0.7 || descriptionSimilarity > 0.6 || contextSimilarity > 0.8;
    });
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateContextSimilarity(context1: AnalysisContext, context2: AnalysisContext): number {
    let similarity = 0;
    let factors = 0;

    // System state similarity
    const state1 = context1.systemState;
    const state2 = context2.systemState;
    
    if (Math.abs(state1.avgResponseTime - state2.avgResponseTime) / Math.max(state1.avgResponseTime, state2.avgResponseTime) < 0.2) {
      similarity += 0.3;
    }
    factors += 0.3;

    if (Math.abs(state1.errorRate - state2.errorRate) < 0.05) {
      similarity += 0.3;
    }
    factors += 0.3;

    // Environment similarity
    const env1 = context1.environmentFactors;
    const env2 = context2.environmentFactors;
    
    if (env1.load === env2.load) {
      similarity += 0.2;
    }
    factors += 0.2;

    if (env1.timeOfDay === env2.timeOfDay) {
      similarity += 0.1;
    }
    factors += 0.1;

    if (env1.dayOfWeek === env2.dayOfWeek) {
      similarity += 0.1;
    }
    factors += 0.1;

    return factors > 0 ? similarity / factors : 0;
  }

  private generateImplementationHints(
    recommendation: Recommendation,
    similarRecords: LearningRecord[]
  ): string | undefined {
    const successfulRecords = similarRecords.filter(r => r.outcome.successful);
    if (successfulRecords.length === 0) {
      return undefined;
    }

    // Extract common factors from successful implementations
    const hints: string[] = [];
    
    // Check for timing patterns
    const successfulHours = successfulRecords.map(r => new Date(r.timestamp).getHours());
    const avgHour = successfulHours.reduce((sum, hour) => sum + hour, 0) / successfulHours.length;
    if (successfulHours.length >= 2) {
      hints.push(`Best implementation time: ${Math.round(avgHour)}:00 based on historical success`);
    }

    // Check for environment patterns
    const successfulLoads = successfulRecords.map(r => r.context.environmentFactors.load);
    const mostCommonLoad = this.getMostCommon(successfulLoads);
    if (mostCommonLoad) {
      hints.push(`Implement during ${mostCommonLoad} system load for best results`);
    }

    return hints.length > 0 ? hints.join('; ') : undefined;
  }

  private getMostCommon<T>(arr: T[]): T | undefined {
    const counts = new Map<T, number>();
    for (const item of arr) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    
    let maxCount = 0;
    let mostCommon: T | undefined;
    for (const [item, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    }
    
    return mostCommon;
  }

  private async updatePatterns(record: LearningRecord): Promise<void> {
    // Update existing patterns or create new ones
    const patternKey = this.generatePatternKey(record);
    
    const existingPattern = this.patterns.get(patternKey);
    if (existingPattern) {
      existingPattern.occurrences++;
      existingPattern.successRate = this.recalculateSuccessRate(patternKey);
      existingPattern.averageImpact = this.recalculateAverageImpact(patternKey);
      existingPattern.lastSeen = new Date();
      existingPattern.confidence = Math.min(0.95, existingPattern.confidence + 0.1);
    } else {
      // Create new pattern if we have enough occurrences
      const relatedRecords = this.history.filter(r => this.generatePatternKey(r) === patternKey);
      if (relatedRecords.length >= this.config.patternMinimumOccurrences) {
        const newPattern: Pattern = {
          id: `pattern_${Date.now()}`,
          type: record.outcome.successful ? 'success' : 'failure',
          description: this.generatePatternDescription(record),
          conditions: this.extractPatternConditions(record),
          confidence: 0.6,
          occurrences: relatedRecords.length,
          successRate: this.recalculateSuccessRate(patternKey),
          averageImpact: this.recalculateAverageImpact(patternKey),
          lastSeen: new Date()
        };
        
        this.patterns.set(patternKey, newPattern);
      }
    }
  }

  private generatePatternKey(record: LearningRecord): string {
    // Create a key based on recommendation type and context
    const recType = record.recommendation.title.toLowerCase().replace(/\s+/g, '_');
    const load = record.context.environmentFactors.load;
    const errorRate = record.context.systemState.errorRate < 0.05 ? 'low' : 'high';
    
    return `${recType}_${load}_${errorRate}`;
  }

  private generatePatternDescription(record: LearningRecord): string {
    const recType = record.recommendation.title;
    const outcome = record.outcome.successful ? 'succeeds' : 'fails';
    const load = record.context.environmentFactors.load;
    
    return `${recType} typically ${outcome} during ${load} load conditions`;
  }

  private extractPatternConditions(record: LearningRecord): PatternCondition[] {
    return [
      {
        field: 'environmentFactors.load',
        operator: 'eq',
        value: record.context.environmentFactors.load,
        weight: 0.3
      },
      {
        field: 'systemState.errorRate',
        operator: 'lt',
        value: 0.1,
        weight: 0.4
      },
      {
        field: 'systemState.avgResponseTime',
        operator: 'lt',
        value: record.context.systemState.avgResponseTime * 1.2,
        weight: 0.3
      }
    ];
  }

  private recalculateSuccessRate(patternKey: string): number {
    const relatedRecords = this.history.filter(r => this.generatePatternKey(r) === patternKey);
    const successful = relatedRecords.filter(r => r.outcome.successful);
    return relatedRecords.length > 0 ? successful.length / relatedRecords.length : 0;
  }

  private recalculateAverageImpact(patternKey: string): number {
    const relatedRecords = this.history.filter(r => this.generatePatternKey(r) === patternKey);
    const impacts = relatedRecords
      .filter(r => r.outcome.successful && r.outcome.actualImpact)
      .map(r => r.outcome.actualImpact!.performanceChange);
    
    return impacts.length > 0 ? impacts.reduce((sum, impact) => sum + impact, 0) / impacts.length : 0;
  }

  private async adaptThresholds(record: LearningRecord): Promise<void> {
    // Adapt thresholds based on learning outcomes
    const metrics = ['response_time', 'error_rate', 'throughput'];
    
    for (const metric of metrics) {
      const threshold = this.adaptiveThresholds.get(metric);
      if (threshold) {
        const adjustment = this.calculateThresholdAdjustment(record, metric);
        if (Math.abs(adjustment) > 0.01) {
          threshold.currentValue += adjustment * this.config.adaptationRate;
          threshold.adaptationHistory.push({
            timestamp: new Date(),
            value: threshold.currentValue,
            reason: `Adjusted based on ${record.outcome.successful ? 'successful' : 'failed'} outcome`
          });
          
          // Limit history size
          if (threshold.adaptationHistory.length > 50) {
            threshold.adaptationHistory = threshold.adaptationHistory.slice(-50);
          }
        }
      }
    }
  }

  private calculateThresholdAdjustment(record: LearningRecord, metric: string): number {
    // Calculate how much to adjust threshold based on outcome
    if (!record.outcome.successful) return 0;
    
    const actualImpact = record.outcome.actualImpact;
    if (!actualImpact) return 0;
    
    switch (metric) {
      case 'response_time':
        return actualImpact.performanceChange > 10 ? -0.05 : 0; // Lower threshold if big improvement
      case 'error_rate':
        return actualImpact.errorRateChange < -0.1 ? -0.01 : 0; // Lower threshold if error rate improved
      case 'throughput':
        return actualImpact.throughputChange > 15 ? 0.1 : 0; // Raise threshold if throughput improved
      default:
        return 0;
    }
  }

  private async generatePatternBasedRecommendations(
    telemetryData: TelemetryExport,
    context: AnalysisContext
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    for (const [key, pattern] of this.patterns) {
      if (pattern.type === 'success' && pattern.confidence > 0.7) {
        const isApplicable = this.evaluatePatternConditions(pattern.conditions, context);
        
        if (isApplicable) {
          recommendations.push({
            id: `pattern_rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: `Pattern-based: ${pattern.description}`,
            description: `Based on ${pattern.occurrences} historical occurrences with ${(pattern.successRate * 100).toFixed(1)}% success rate`,
            priority: pattern.averageImpact > 15 ? 'high' : pattern.averageImpact > 5 ? 'medium' : 'low',
            expectedImpact: `${Math.abs(pattern.averageImpact).toFixed(1)}% improvement (pattern-based prediction)`,
            effort: 'medium',
            confidence: pattern.confidence,
            implementationHint: `Pattern suggests this works well during ${context.environmentFactors.load} load`
          });
        }
      }
    }
    
    return recommendations;
  }

  private async generateThresholdBasedRecommendations(
    telemetryData: TelemetryExport,
    context: AnalysisContext
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // Check if current metrics exceed adaptive thresholds
    const responseTimeThreshold = this.adaptiveThresholds.get('response_time');
    if (responseTimeThreshold && context.systemState.avgResponseTime > responseTimeThreshold.currentValue) {
      recommendations.push({
        id: `threshold_rec_response_${Date.now()}`,
        title: 'Response Time Threshold Exceeded',
        description: `Current avg response time (${context.systemState.avgResponseTime.toFixed(0)}ms) exceeds learned threshold (${responseTimeThreshold.currentValue.toFixed(0)}ms)`,
        priority: 'high',
        expectedImpact: 'Restore performance to acceptable levels',
        effort: 'medium',
        confidence: responseTimeThreshold.confidence,
        implementationHint: 'Consider scaling or optimizing high-latency operations'
      });
    }
    
    return recommendations;
  }

  private async generateTrendBasedRecommendations(
    telemetryData: TelemetryExport,
    context: AnalysisContext
  ): Promise<Recommendation[]> {
    // Analyze trends in recent learning records to predict future issues
    const recentRecords = this.history.filter(r => 
      new Date().getTime() - r.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );
    
    if (recentRecords.length < 5) return [];
    
    const recommendations: Recommendation[] = [];
    
    // Check for declining success rates
    const recentSuccessRate = recentRecords.filter(r => r.outcome.successful).length / recentRecords.length;
    const overallSuccessRate = this.history.filter(r => r.outcome.successful).length / this.history.length;
    
    if (recentSuccessRate < overallSuccessRate - 0.2) {
      recommendations.push({
        id: `trend_rec_decline_${Date.now()}`,
        title: 'Declining Implementation Success Rate',
        description: `Recent success rate (${(recentSuccessRate * 100).toFixed(1)}%) is significantly lower than historical average (${(overallSuccessRate * 100).toFixed(1)}%)`,
        priority: 'medium',
        expectedImpact: 'Prevent further degradation in autonomous analysis effectiveness',
        effort: 'low',
        confidence: 0.8,
        implementationHint: 'Review recent changes and environmental factors affecting implementation success'
      });
    }
    
    return recommendations;
  }

  private evaluatePatternConditions(conditions: PatternCondition[], context: AnalysisContext): boolean {
    let score = 0;
    let totalWeight = 0;
    
    for (const condition of conditions) {
      const value = this.getContextValue(context, condition.field);
      const matches = this.evaluateCondition(value, condition);
      
      if (matches) {
        score += condition.weight;
      }
      totalWeight += condition.weight;
    }
    
    return totalWeight > 0 ? (score / totalWeight) > 0.6 : false;
  }

  private getContextValue(context: AnalysisContext, field: string): any {
    const parts = field.split('.');
    let value: any = context;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value;
  }

  private evaluateCondition(value: any, condition: PatternCondition): boolean {
    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'gt': return value > condition.value;
      case 'lt': return value < condition.value;
      case 'contains': return Array.isArray(value) ? value.includes(condition.value) : String(value).includes(String(condition.value));
      case 'range': return Array.isArray(condition.value) && value >= condition.value[0] && value <= condition.value[1];
      default: return false;
    }
  }

  private calculateOutcomeMetrics(recommendation: Recommendation, outcome: LearningOutcome): OutcomeMetrics {
    const expectedImpact = parseFloat(recommendation.expectedImpact.match(/(\d+(?:\.\d+)?)/)?.[1] || '0');
    const actualImpact = outcome.actualImpact?.performanceChange || 0;
    
    const predictionAccuracy = expectedImpact > 0 ? 
      Math.max(0, 1 - Math.abs(expectedImpact - Math.abs(actualImpact)) / expectedImpact) : 0;
    
    const measurementTime = outcome.measurementPeriod.end.getTime() - outcome.measurementPeriod.start.getTime();
    
    return {
      predictionAccuracy,
      implementationSuccess: outcome.implemented && outcome.successful,
      timeToMeasurement: measurementTime / (1000 * 60 * 60), // Convert to hours
      confidenceValidated: predictionAccuracy > 0.7
    };
  }

  private async generateInsights(): Promise<void> {
    this.insights = [];
    
    // Generate insights from patterns
    const successPatterns = Array.from(this.patterns.values()).filter(p => p.type === 'success' && p.confidence > 0.8);
    if (successPatterns.length > 0) {
      this.insights.push({
        id: `insight_patterns_${Date.now()}`,
        type: 'improvement',
        title: 'High-Confidence Success Patterns Identified',
        description: `Found ${successPatterns.length} reliable patterns for successful implementations`,
        evidence: successPatterns.map(p => `${p.description} (${p.occurrences} occurrences, ${(p.successRate * 100).toFixed(1)}% success)`),
        confidence: 0.9,
        actionable: true,
        recommendedAction: 'Prioritize recommendations matching these successful patterns'
      });
    }
    
    // Generate insights from recent performance
    if (this.history.length >= 10) {
      const recentRecords = this.history.slice(-10);
      const recentSuccessRate = recentRecords.filter(r => r.outcome.successful).length / recentRecords.length;
      
      if (recentSuccessRate < 0.6) {
        this.insights.push({
          id: `insight_performance_${Date.now()}`,
          type: 'warning',
          title: 'Recent Implementation Success Rate Below Expected',
          description: `Only ${(recentSuccessRate * 100).toFixed(1)}% of recent implementations were successful`,
          evidence: [`${recentRecords.filter(r => !r.outcome.successful).length} failed implementations in last 10 attempts`],
          confidence: 0.85,
          actionable: true,
          recommendedAction: 'Review implementation conditions and reduce recommendation aggressiveness'
        });
      }
    }
    
    // Limit insights to most recent and relevant
    this.insights = this.insights.slice(-10);
  }

  private findRecommendationById(id: string): Recommendation | undefined {
    // In a real implementation, this would search through stored recommendations
    // For now, return undefined as we don't have a recommendation store
    return undefined;
  }

  private initializeThresholds(): void {
    const defaultThresholds = [
      { metric: 'response_time', value: 300 },
      { metric: 'error_rate', value: 0.05 },
      { metric: 'throughput', value: 100 }
    ];
    
    for (const threshold of defaultThresholds) {
      this.adaptiveThresholds.set(threshold.metric, {
        metric: threshold.metric,
        currentValue: threshold.value,
        baselineValue: threshold.value,
        adaptationHistory: [],
        confidence: 0.7
      });
    }
  }

  private updateAdaptiveThresholds(): void {
    // Update adaptive thresholds based on recent learning history
    if (this.history.length < 5) return; // Need minimum data

    const recentRecords = this.history.slice(-20); // Last 20 records
    
    for (const [metric, threshold] of this.adaptiveThresholds) {
      const relevantRecords = recentRecords.filter(record => 
        this.isRelevantForThreshold(record, metric)
      );

      if (relevantRecords.length >= 3) {
        const successfulRecords = relevantRecords.filter(r => r.outcome.successful);
        const successRate = successfulRecords.length / relevantRecords.length;
        
        // Adjust threshold based on success rate
        let adjustment = 0;
        if (successRate > 0.8) {
          // High success rate - can be more aggressive
          adjustment = threshold.currentValue * 0.1;
        } else if (successRate < 0.6) {
          // Low success rate - be more conservative
          adjustment = -threshold.currentValue * 0.1;
        }

        if (Math.abs(adjustment) > 0) {
          const newValue = threshold.currentValue + adjustment;
          threshold.adaptationHistory.push({
            timestamp: new Date(),
            value: newValue,
            reason: `Success rate: ${(successRate * 100).toFixed(1)}%`
          });
          threshold.currentValue = newValue;
          threshold.confidence = Math.min(0.9, threshold.confidence + 0.1);
        }
      }
    }
  }

  private isRelevantForThreshold(record: LearningRecord, metric: string): boolean {
    // Determine if a learning record is relevant for a specific threshold metric
    switch (metric) {
      case 'response_time':
        return record.context.systemState.avgResponseTime > 0;
      case 'error_rate':
        return record.context.systemState.errorRate >= 0;
      case 'throughput':
        return record.context.systemState.throughput > 0;
      default:
        return false;
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      const historyPath = join(this.config.storagePath, 'learning-history.json');
      const data = await fs.readFile(historyPath, 'utf-8');
      this.history = JSON.parse(data).map((record: any) => ({
        ...record,
        timestamp: new Date(record.timestamp),
        outcome: {
          ...record.outcome,
          measurementPeriod: {
            start: new Date(record.outcome.measurementPeriod.start),
            end: new Date(record.outcome.measurementPeriod.end)
          }
        }
      }));
      
      // Limit history size
      if (this.history.length > this.config.maxHistorySize) {
        this.history = this.history.slice(-this.config.maxHistorySize);
      }
    } catch (error) {
      console.log('No existing learning history found, starting fresh');
      this.history = [];
    }
  }

  private async loadPatterns(): Promise<void> {
    try {
      const patternsPath = join(this.config.storagePath, 'learned-patterns.json');
      const data = await fs.readFile(patternsPath, 'utf-8');
      const patternsArray = JSON.parse(data);
      
      this.patterns.clear();
      for (const pattern of patternsArray) {
        this.patterns.set(pattern.id, {
          ...pattern,
          lastSeen: new Date(pattern.lastSeen)
        });
      }
    } catch (error) {
      console.log('No existing patterns found, starting fresh');
      this.patterns.clear();
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      const historyPath = join(this.config.storagePath, 'learning-history.json');
      await fs.writeFile(historyPath, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error('Failed to save learning history:', error);
    }
  }

  async savePatterns(): Promise<void> {
    try {
      const patternsPath = join(this.config.storagePath, 'learned-patterns.json');
      const patternsArray = Array.from(this.patterns.values());
      await fs.writeFile(patternsPath, JSON.stringify(patternsArray, null, 2));
    } catch (error) {
      console.error('Failed to save patterns:', error);
    }
  }
}

export function createLearningEngine(config?: Partial<LearningConfig>): LearningEngine {
  const defaultConfig: LearningConfig = {
    storagePath: './autonomous-learning-data',
    maxHistorySize: 1000,
    confidenceThreshold: 0.6,
    adaptationRate: 0.1,
    patternMinimumOccurrences: 3
  };
  
  return new LearningEngine({ ...defaultConfig, ...config });
} 