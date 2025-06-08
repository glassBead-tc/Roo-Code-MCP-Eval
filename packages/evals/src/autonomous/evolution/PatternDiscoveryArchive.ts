import { EventEmitter } from 'events';

export interface DetectionPattern {
  id: string;
  name: string;
  description: string;
  pattern: PatternDefinition;
  performance: PatternPerformance;
  contexts: Set<string>;
  parentId?: string;
  generation: number;
  createdAt: Date;
  lastUsed?: Date;
}

export interface PatternDefinition {
  type: 'statistical' | 'threshold' | 'ml' | 'hybrid';
  parameters: Record<string, any>;
  code: string; // Executable pattern detection logic
  dependencies: string[];
}

export interface PatternPerformance {
  detections: number;
  truePositives: number;
  falsePositives: number;
  precision: number;
  recall: number;
  f1Score: number;
  avgDetectionTime: number;
  contexts: Map<string, ContextPerformance>;
}

export interface ContextPerformance {
  context: string;
  uses: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface PatternArchive {
  patterns: Map<string, DetectionPattern>;
  activePatterns: Set<string>;
  contextIndex: Map<string, Set<string>>; // context -> pattern IDs
  performanceHistory: Map<string, PatternPerformance[]>;
}

export interface DiscoveryConfig {
  maxPatterns: number;
  minPerformanceThreshold: number;
  contextSimilarityThreshold: number;
  mutationRate: number;
  crossoverRate: number;
  evaluationWindow: number; // hours
}

export class PatternDiscoveryArchive extends EventEmitter {
  private archive: PatternArchive;
  private config: DiscoveryConfig;
  private patternExecutor: PatternExecutor;

  constructor(config: Partial<DiscoveryConfig> = {}) {
    super();

    this.config = {
      maxPatterns: 50,
      minPerformanceThreshold: 0.6,
      contextSimilarityThreshold: 0.7,
      mutationRate: 0.15,
      crossoverRate: 0.25,
      evaluationWindow: 168, // 1 week
      ...config
    };

    this.archive = {
      patterns: new Map(),
      activePatterns: new Set(),
      contextIndex: new Map(),
      performanceHistory: new Map()
    };

    this.patternExecutor = new PatternExecutor();
    this.initializeBasePatterns();
  }

  private initializeBasePatterns(): void {
    const basePatterns: Partial<DetectionPattern>[] = [
      {
        name: 'statistical_outlier',
        description: 'Detects outliers using statistical methods (z-score, IQR)',
        pattern: {
          type: 'statistical',
          parameters: {
            method: 'z-score',
            threshold: 3,
            windowSize: 100
          },
          code: `
            function detect(data, params) {
              const mean = data.reduce((a, b) => a + b, 0) / data.length;
              const std = Math.sqrt(data.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / data.length);
              return data.map(value => ({
                value,
                anomaly: Math.abs((value - mean) / std) > params.threshold
              }));
            }
          `,
          dependencies: []
        },
        contexts: new Set(['performance', 'resource_usage'])
      },
      {
        name: 'threshold_breach',
        description: 'Simple threshold-based anomaly detection',
        pattern: {
          type: 'threshold',
          parameters: {
            upperThreshold: 0.9,
            lowerThreshold: 0.1,
            consecutiveBreaches: 3
          },
          code: `
            function detect(data, params) {
              let breachCount = 0;
              return data.map(value => {
                const breach = value > params.upperThreshold || value < params.lowerThreshold;
                breachCount = breach ? breachCount + 1 : 0;
                return {
                  value,
                  anomaly: breachCount >= params.consecutiveBreaches
                };
              });
            }
          `,
          dependencies: []
        },
        contexts: new Set(['error_rate', 'availability'])
      },
      {
        name: 'pattern_deviation',
        description: 'Detects deviations from learned patterns',
        pattern: {
          type: 'ml',
          parameters: {
            modelType: 'isolation_forest',
            contamination: 0.1,
            features: ['value', 'rate_of_change', 'time_of_day']
          },
          code: `
            function detect(data, params) {
              // Simplified pattern matching
              const baseline = data.slice(0, Math.floor(data.length * 0.8));
              const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
              const variance = baseline.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / baseline.length;
              
              return data.map((value, idx) => {
                const deviation = Math.abs(value - mean) / Math.sqrt(variance);
                const rateOfChange = idx > 0 ? Math.abs(value - data[idx - 1]) : 0;
                return {
                  value,
                  anomaly: deviation > 2 && rateOfChange > mean * 0.5
                };
              });
            }
          `,
          dependencies: []
        },
        contexts: new Set(['latency', 'throughput'])
      }
    ];

    basePatterns.forEach((pattern, index) => {
      const id = `pattern_base_${index}`;
      const fullPattern: DetectionPattern = {
        ...pattern as DetectionPattern,
        id,
        performance: {
          detections: 0,
          truePositives: 0,
          falsePositives: 0,
          precision: 0.8,
          recall: 0.7,
          f1Score: 0.75,
          avgDetectionTime: 10,
          contexts: new Map()
        },
        generation: 0,
        createdAt: new Date()
      };

      this.archive.patterns.set(id, fullPattern);
      this.archive.activePatterns.add(id);
      
      // Index by context
      fullPattern.contexts.forEach(context => {
        if (!this.archive.contextIndex.has(context)) {
          this.archive.contextIndex.set(context, new Set());
        }
        this.archive.contextIndex.get(context)!.add(id);
      });
    });

    this.emit('patterns-initialized', { count: basePatterns.length });
  }

  async detectAnomalies(
    data: number[],
    context: string,
    metadata?: Record<string, any>
  ): Promise<{
    anomalies: Array<{ index: number; value: number; confidence: number }>;
    patternId: string;
    executionTime: number;
  }> {
    const startTime = Date.now();
    
    // Select appropriate pattern for context
    const patternId = this.selectPattern(context, data, metadata);
    const pattern = this.archive.patterns.get(patternId)!;
    
    // Execute pattern
    const results = await this.patternExecutor.execute(pattern, data);
    
    // Convert to anomaly format
    const anomalies = results
      .map((result, index) => ({
        index,
        value: result.value,
        confidence: result.confidence || (result.anomaly ? 0.8 : 0)
      }))
      .filter(a => a.confidence > 0.5);

    const executionTime = Date.now() - startTime;
    
    // Update pattern usage stats
    pattern.performance.detections++;
    pattern.performance.avgDetectionTime = 
      (pattern.performance.avgDetectionTime * (pattern.performance.detections - 1) + executionTime) / 
      pattern.performance.detections;
    pattern.lastUsed = new Date();

    return { anomalies, patternId, executionTime };
  }

  recordDetectionOutcome(
    patternId: string,
    context: string,
    trueAnomalies: number[],
    detectedAnomalies: number[]
  ): void {
    const pattern = this.archive.patterns.get(patternId);
    if (!pattern) return;

    // Calculate metrics
    const truePositives = detectedAnomalies.filter(d => trueAnomalies.includes(d)).length;
    const falsePositives = detectedAnomalies.filter(d => !trueAnomalies.includes(d)).length;
    const falseNegatives = trueAnomalies.filter(t => !detectedAnomalies.includes(t)).length;

    // Update overall performance
    pattern.performance.truePositives += truePositives;
    pattern.performance.falsePositives += falsePositives;
    
    const totalPositives = pattern.performance.truePositives;
    const totalDetections = totalPositives + pattern.performance.falsePositives;
    const totalActual = totalPositives + falseNegatives;
    
    pattern.performance.precision = totalPositives / totalDetections || 0;
    pattern.performance.recall = totalPositives / totalActual || 0;
    pattern.performance.f1Score = pattern.performance.precision + pattern.performance.recall > 0
      ? 2 * (pattern.performance.precision * pattern.performance.recall) / 
        (pattern.performance.precision + pattern.performance.recall)
      : 0;

    // Update context-specific performance
    if (!pattern.performance.contexts.has(context)) {
      pattern.performance.contexts.set(context, {
        context,
        uses: 0,
        precision: 0,
        recall: 0,
        f1Score: 0
      });
    }

    const contextPerf = pattern.performance.contexts.get(context)!;
    contextPerf.uses++;
    contextPerf.precision = (contextPerf.precision * (contextPerf.uses - 1) + 
      (truePositives / (truePositives + falsePositives) || 0)) / contextPerf.uses;
    contextPerf.recall = (contextPerf.recall * (contextPerf.uses - 1) + 
      (truePositives / (truePositives + falseNegatives) || 0)) / contextPerf.uses;
    contextPerf.f1Score = contextPerf.precision + contextPerf.recall > 0
      ? 2 * (contextPerf.precision * contextPerf.recall) / (contextPerf.precision + contextPerf.recall)
      : 0;

    this.emit('outcome-recorded', { patternId, context, performance: contextPerf });
  }

  async evolvePatterns(): Promise<void> {
    this.emit('evolution-started');

    // Evaluate current patterns
    const evaluations = this.evaluatePatterns();
    
    // Remove poor performers if at capacity
    if (this.archive.activePatterns.size >= this.config.maxPatterns) {
      this.removePoorPerformers(evaluations);
    }

    // Generate new patterns through evolution
    const newPatterns = await this.generateNewPatterns(evaluations);
    
    // Add successful patterns to archive
    for (const pattern of newPatterns) {
      if (await this.validatePattern(pattern)) {
        this.archive.patterns.set(pattern.id, pattern);
        this.archive.activePatterns.add(pattern.id);
        
        // Update context index
        pattern.contexts.forEach(context => {
          if (!this.archive.contextIndex.has(context)) {
            this.archive.contextIndex.set(context, new Set());
          }
          this.archive.contextIndex.get(context)!.add(pattern.id);
        });
      }
    }

    this.emit('evolution-completed', { 
      newPatterns: newPatterns.length,
      totalActive: this.archive.activePatterns.size 
    });
  }

  private selectPattern(
    context: string,
    data: number[],
    metadata?: Record<string, any>
  ): string {
    // Get patterns for this context
    const contextPatterns = this.archive.contextIndex.get(context) || new Set();
    
    // If no context-specific patterns, use all active patterns
    const candidateIds = contextPatterns.size > 0 
      ? Array.from(contextPatterns)
      : Array.from(this.archive.activePatterns);

    // Score each pattern
    const scores = candidateIds.map(id => {
      const pattern = this.archive.patterns.get(id)!;
      const contextPerf = pattern.performance.contexts.get(context);
      
      // Base score on context-specific performance if available
      const baseScore = contextPerf 
        ? contextPerf.f1Score 
        : pattern.performance.f1Score * 0.8; // Penalty for unknown context
      
      // Adjust for recency
      const recencyBonus = pattern.lastUsed 
        ? Math.exp(-(Date.now() - pattern.lastUsed.getTime()) / (24 * 60 * 60 * 1000))
        : 0.5;
      
      // Diversity bonus
      const generationBonus = 1 + (pattern.generation * 0.05);
      
      return {
        id,
        score: baseScore * recencyBonus * generationBonus
      };
    });

    // Select best pattern with some exploration
    scores.sort((a, b) => b.score - a.score);
    
    // Epsilon-greedy selection
    if (Math.random() < 0.1 && scores.length > 1) {
      // Explore: select random from top 3
      const topN = Math.min(3, scores.length);
      const selected = scores[Math.floor(Math.random() * topN)];
      if (selected) return selected.id;
    }
    
    // Return first score or first candidate as fallback
    if (scores.length > 0 && scores[0]) {
      return scores[0].id;
    }
    
    // Ultimate fallback - return first candidate
    return candidateIds[0] || 'pattern_base_0';
  }

  private evaluatePatterns(): Map<string, number> {
    const evaluations = new Map<string, number>();
    
    this.archive.activePatterns.forEach(id => {
      const pattern = this.archive.patterns.get(id)!;
      const score = this.calculatePatternScore(pattern);
      evaluations.set(id, score);
    });

    return evaluations;
  }

  private calculatePatternScore(pattern: DetectionPattern): number {
    // Weighted score based on performance and usage
    const perfScore = pattern.performance.f1Score;
    const usageScore = Math.min(1, pattern.performance.detections / 100);
    const efficiencyScore = Math.max(0, 1 - (pattern.performance.avgDetectionTime / 1000));
    
    return perfScore * 0.6 + usageScore * 0.2 + efficiencyScore * 0.2;
  }

  private removePoorPerformers(evaluations: Map<string, number>): void {
    const sorted = Array.from(evaluations.entries())
      .sort((a, b) => a[1] - b[1]); // Sort ascending
    
    const removeCount = Math.floor(this.archive.activePatterns.size * 0.1);
    
    for (let i = 0; i < removeCount && i < sorted.length; i++) {
      const entry = sorted[i];
      if (!entry) continue;
      const [patternId, score] = entry;
      if (score < this.config.minPerformanceThreshold) {
        this.archive.activePatterns.delete(patternId);
        
        // Remove from context index
        const pattern = this.archive.patterns.get(patternId);
        if (pattern) {
          pattern.contexts.forEach(context => {
            this.archive.contextIndex.get(context)?.delete(patternId);
          });
        }
        
        this.emit('pattern-removed', { patternId, score });
      }
    }
  }

  private async generateNewPatterns(
    evaluations: Map<string, number>
  ): Promise<DetectionPattern[]> {
    const newPatterns: DetectionPattern[] = [];
    const parents = this.selectParents(evaluations);
    
    // Crossover
    for (let i = 0; i < parents.length - 1; i += 2) {
      if (Math.random() < this.config.crossoverRate) {
        const child = this.crossoverPatterns(parents[i], parents[i + 1]);
        newPatterns.push(child);
      }
    }
    
    // Mutation
    for (const parent of parents) {
      if (Math.random() < this.config.mutationRate) {
        const mutant = this.mutatePattern(parent);
        newPatterns.push(mutant);
      }
    }
    
    return newPatterns;
  }

  private selectParents(evaluations: Map<string, number>): DetectionPattern[] {
    const sorted = Array.from(evaluations.entries())
      .sort((a, b) => b[1] - a[1]);
    
    const parentCount = Math.min(10, Math.floor(sorted.length / 2));
    const parents: DetectionPattern[] = [];
    
    for (let i = 0; i < parentCount && i < sorted.length; i++) {
      const pattern = this.archive.patterns.get(sorted[i][0]);
      if (pattern) {
        parents.push(pattern);
      }
    }
    
    return parents;
  }

  private crossoverPatterns(
    parent1: DetectionPattern,
    parent2: DetectionPattern
  ): DetectionPattern {
    // Combine parameters
    const combinedParams = {
      ...parent1.pattern.parameters,
      ...parent2.pattern.parameters
    };
    
    // Combine contexts
    const combinedContexts = new Set([
      ...parent1.contexts,
      ...parent2.contexts
    ]);
    
    // Create hybrid pattern
    return {
      id: `pattern_hybrid_${Date.now()}`,
      name: `${parent1.name}_x_${parent2.name}`,
      description: `Hybrid of ${parent1.name} and ${parent2.name}`,
      pattern: {
        type: 'hybrid',
        parameters: combinedParams,
        code: this.generateHybridCode(parent1.pattern, parent2.pattern),
        dependencies: [...new Set([...parent1.pattern.dependencies, ...parent2.pattern.dependencies])]
      },
      performance: {
        detections: 0,
        truePositives: 0,
        falsePositives: 0,
        precision: (parent1.performance.precision + parent2.performance.precision) / 2,
        recall: (parent1.performance.recall + parent2.performance.recall) / 2,
        f1Score: (parent1.performance.f1Score + parent2.performance.f1Score) / 2,
        avgDetectionTime: (parent1.performance.avgDetectionTime + parent2.performance.avgDetectionTime) / 2,
        contexts: new Map()
      },
      contexts: combinedContexts,
      parentId: parent1.id,
      generation: Math.max(parent1.generation, parent2.generation) + 1,
      createdAt: new Date()
    };
  }

  private mutatePattern(pattern: DetectionPattern): DetectionPattern {
    const mutated = JSON.parse(JSON.stringify(pattern)) as DetectionPattern;
    mutated.id = `pattern_mutant_${Date.now()}`;
    mutated.name = `${pattern.name}_mut`;
    mutated.parentId = pattern.id;
    mutated.generation = pattern.generation + 1;
    mutated.createdAt = new Date();
    
    // Mutate parameters
    Object.keys(mutated.pattern.parameters).forEach(key => {
      const value = mutated.pattern.parameters[key];
      if (typeof value === 'number') {
        // Gaussian mutation
        mutated.pattern.parameters[key] = value * (1 + (Math.random() - 0.5) * 0.2);
      }
    });
    
    // Potentially add/remove contexts
    if (Math.random() < 0.3) {
      const allContexts = Array.from(this.archive.contextIndex.keys());
      const newContext = allContexts[Math.floor(Math.random() * allContexts.length)];
      mutated.contexts.add(newContext);
    }
    
    return mutated;
  }

  private generateHybridCode(pattern1: PatternDefinition, pattern2: PatternDefinition): string {
    return `
      function detect(data, params) {
        // Execute both patterns
        const results1 = (${pattern1.code})(data, params);
        const results2 = (${pattern2.code})(data, params);
        
        // Combine results
        return data.map((value, idx) => ({
          value,
          anomaly: results1[idx].anomaly || results2[idx].anomaly,
          confidence: (results1[idx].confidence || 0) * 0.5 + (results2[idx].confidence || 0) * 0.5
        }));
      }
    `;
  }

  private async validatePattern(pattern: DetectionPattern): Promise<boolean> {
    try {
      // Test pattern on sample data
      const testData = Array.from({ length: 100 }, () => Math.random());
      const results = await this.patternExecutor.execute(pattern, testData);
      
      // Check if results are valid
      return results.length === testData.length && 
             results.every(r => typeof r.value === 'number' && typeof r.anomaly === 'boolean');
    } catch (error) {
      this.emit('pattern-validation-failed', { patternId: pattern.id, error });
      return false;
    }
  }

  getArchiveStats(): {
    totalPatterns: number;
    activePatterns: number;
    averageF1Score: number;
    contextCoverage: Record<string, number>;
    generationDistribution: Record<number, number>;
  } {
    const activePatternsList = Array.from(this.archive.activePatterns)
      .map(id => this.archive.patterns.get(id)!);

    const totalF1 = activePatternsList.reduce((sum, p) => sum + p.performance.f1Score, 0);
    
    const contextCoverage: Record<string, number> = {};
    this.archive.contextIndex.forEach((patterns, context) => {
      contextCoverage[context] = patterns.size;
    });

    const generationDistribution: Record<number, number> = {};
    activePatternsList.forEach(pattern => {
      generationDistribution[pattern.generation] = 
        (generationDistribution[pattern.generation] || 0) + 1;
    });

    return {
      totalPatterns: this.archive.patterns.size,
      activePatterns: this.archive.activePatterns.size,
      averageF1Score: totalF1 / activePatternsList.length,
      contextCoverage,
      generationDistribution
    };
  }
}

// Pattern executor helper class
class PatternExecutor {
  async execute(
    pattern: DetectionPattern,
    data: number[]
  ): Promise<Array<{ value: number; anomaly: boolean; confidence?: number }>> {
    try {
      // Create a safe execution environment
      const code = pattern.pattern.code.trim();
      
      // Execute the pattern code in a controlled environment
      const detectFunction = new Function('data', 'params', `
        ${code}
        return detect(data, params);
      `);
      
      // Execute with parameters
      const results = detectFunction(data, pattern.pattern.parameters);
      
      // Ensure results are in the correct format
      if (!Array.isArray(results)) {
        throw new Error('Pattern must return an array');
      }
      
      return results.map((result, idx) => {
        if (typeof result === 'boolean') {
          return { value: data[idx], anomaly: result, confidence: 0.5 };
        } else if (typeof result === 'object' && result !== null) {
          return {
            value: result.value !== undefined ? result.value : data[idx],
            anomaly: Boolean(result.anomaly),
            confidence: result.confidence || 0.5
          };
        } else {
          return { value: data[idx], anomaly: false, confidence: 0.5 };
        }
      });
    } catch (error) {
      throw new Error(`Pattern execution failed: ${error}`);
    }
  }
}
