import { EventEmitter } from 'events';

export interface ThresholdConfig {
  id: string;
  name: string;
  value: number;
  minValue: number;
  maxValue: number;
  stepSize: number;
  performanceHistory: ThresholdPerformance[];
  adaptationRate: number;
  lastUpdated: Date;
}

export interface ThresholdPerformance {
  timestamp: Date;
  value: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface ThresholdArchive {
  thresholds: Map<string, ThresholdConfig>;
  performanceHistory: Map<string, ThresholdPerformance[]>;
  bestConfigurations: Map<string, ThresholdConfig[]>;
}

export interface LearningConfig {
  evaluationWindow: number; // hours
  minSampleSize: number;
  adaptationRate: number;
  explorationRate: number;
  performanceWeight: {
    precision: number;
    recall: number;
    f1Score: number;
  };
}

export class DynamicThresholdLearning extends EventEmitter {
  private archive: ThresholdArchive;
  private config: LearningConfig;
  private activeThresholds: Map<string, ThresholdConfig>;

  constructor(config: Partial<LearningConfig> = {}) {
    super();

    this.config = {
      evaluationWindow: 24,
      minSampleSize: 100,
      adaptationRate: 0.1,
      explorationRate: 0.05,
      performanceWeight: {
        precision: 0.3,
        recall: 0.4,
        f1Score: 0.3
      },
      ...config
    };

    this.archive = {
      thresholds: new Map(),
      performanceHistory: new Map(),
      bestConfigurations: new Map()
    };

    this.activeThresholds = new Map();
    this.initializeDefaultThresholds();
  }

  private initializeDefaultThresholds(): void {
    const defaultThresholds: Partial<ThresholdConfig>[] = [
      {
        name: 'anomaly_detection_confidence',
        value: 0.85,
        minValue: 0.5,
        maxValue: 0.99,
        stepSize: 0.01,
        adaptationRate: 0.05
      },
      {
        name: 'performance_degradation_threshold',
        value: 0.15,
        minValue: 0.05,
        maxValue: 0.5,
        stepSize: 0.01,
        adaptationRate: 0.03
      },
      {
        name: 'resource_spike_threshold',
        value: 2.0,
        minValue: 1.5,
        maxValue: 5.0,
        stepSize: 0.1,
        adaptationRate: 0.04
      },
      {
        name: 'error_rate_threshold',
        value: 0.05,
        minValue: 0.01,
        maxValue: 0.2,
        stepSize: 0.005,
        adaptationRate: 0.03
      },
      {
        name: 'latency_deviation_threshold',
        value: 3.0,
        minValue: 1.0,
        maxValue: 5.0,
        stepSize: 0.1,
        adaptationRate: 0.04
      }
    ];

    defaultThresholds.forEach((threshold, index) => {
      const id = `threshold_${threshold.name}`;
      const fullThreshold: ThresholdConfig = {
        ...threshold as ThresholdConfig,
        id,
        performanceHistory: [],
        lastUpdated: new Date()
      };

      this.archive.thresholds.set(id, fullThreshold);
      this.activeThresholds.set(threshold.name!, fullThreshold);
    });

    this.emit('thresholds-initialized', { count: defaultThresholds.length });
  }

  getThreshold(name: string): number {
    const threshold = this.activeThresholds.get(name);
    if (!threshold) {
      throw new Error(`Threshold ${name} not found`);
    }
    return threshold.value;
  }

  recordDetection(
    thresholdName: string,
    detected: boolean,
    actualPositive: boolean
  ): void {
    const threshold = this.activeThresholds.get(thresholdName);
    if (!threshold) return;

    // Update performance metrics
    const performance = this.getOrCreateCurrentPerformance(threshold);
    
    if (actualPositive && detected) {
      performance.truePositives++;
    } else if (actualPositive && !detected) {
      performance.falseNegatives++;
    } else if (!actualPositive && detected) {
      performance.falsePositives++;
    } else {
      performance.trueNegatives++;
    }

    // Recalculate metrics
    this.updatePerformanceMetrics(performance);
    
    this.emit('detection-recorded', {
      thresholdName,
      detected,
      actualPositive,
      currentValue: threshold.value
    });
  }

  async adaptThresholds(): Promise<void> {
    this.emit('adaptation-started');

    for (const [name, threshold] of this.activeThresholds) {
      const adapted = await this.adaptThreshold(threshold);
      if (adapted) {
        this.activeThresholds.set(name, adapted);
        this.archive.thresholds.set(adapted.id, adapted);
      }
    }

    this.emit('adaptation-completed', {
      thresholds: Array.from(this.activeThresholds.keys())
    });
  }

  private async adaptThreshold(threshold: ThresholdConfig): Promise<ThresholdConfig | null> {
    const recentPerformance = this.getRecentPerformance(threshold);
    
    if (recentPerformance.length < this.config.minSampleSize) {
      return null; // Not enough data to adapt
    }

    // Calculate weighted performance score
    const lastPerformance = recentPerformance[recentPerformance.length - 1];
    if (!lastPerformance) return null;
    
    const currentScore = this.calculateWeightedScore(lastPerformance);
    
    // Explore or exploit
    if (Math.random() < this.config.explorationRate) {
      // Exploration: try random adjustment
      return this.exploreThreshold(threshold);
    } else {
      // Exploitation: gradient-based adjustment
      return this.exploitThreshold(threshold, recentPerformance);
    }
  }

  private exploreThreshold(threshold: ThresholdConfig): ThresholdConfig {
    const direction = Math.random() < 0.5 ? -1 : 1;
    const newValue = Math.max(
      threshold.minValue,
      Math.min(
        threshold.maxValue,
        threshold.value + direction * threshold.stepSize * (1 + Math.random())
      )
    );

    return {
      ...threshold,
      value: newValue,
      lastUpdated: new Date()
    };
  }

  private exploitThreshold(
    threshold: ThresholdConfig,
    recentPerformance: ThresholdPerformance[]
  ): ThresholdConfig {
    // Estimate gradient using finite differences
    const gradient = this.estimateGradient(threshold, recentPerformance);
    
    // Update value using gradient ascent
    const learningRate = threshold.adaptationRate * this.config.adaptationRate;
    const newValue = Math.max(
      threshold.minValue,
      Math.min(
        threshold.maxValue,
        threshold.value + learningRate * gradient
      )
    );

    // Store in best configurations if performance improved
    const lastPerf = recentPerformance[recentPerformance.length - 1];
    if (lastPerf) {
      const currentScore = this.calculateWeightedScore(lastPerf);
      this.updateBestConfigurations(threshold, currentScore);
    }

    return {
      ...threshold,
      value: newValue,
      lastUpdated: new Date()
    };
  }

  private estimateGradient(
    threshold: ThresholdConfig,
    recentPerformance: ThresholdPerformance[]
  ): number {
    // Group performance by threshold value
    const performanceByValue = new Map<number, ThresholdPerformance[]>();
    
    recentPerformance.forEach(perf => {
      const value = perf.value;
      if (!performanceByValue.has(value)) {
        performanceByValue.set(value, []);
      }
      performanceByValue.get(value)!.push(perf);
    });

    // Calculate average score for each value
    const valueScores: Array<{ value: number; score: number }> = [];
    
    performanceByValue.forEach((perfs, value) => {
      const avgScore = perfs.reduce((sum, p) => sum + this.calculateWeightedScore(p), 0) / perfs.length;
      valueScores.push({ value, score: avgScore });
    });

    // Simple linear regression to estimate gradient
    if (valueScores.length < 2) return 0;

    valueScores.sort((a, b) => a.value - b.value);
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = valueScores.length;
    
    valueScores.forEach(({ value, score }) => {
      sumX += value;
      sumY += score;
      sumXY += value * score;
      sumX2 += value * value;
    });

    const gradient = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return isNaN(gradient) ? 0 : gradient;
  }

  private calculateWeightedScore(performance: ThresholdPerformance): number {
    const weights = this.config.performanceWeight;
    
    return (
      weights.precision * performance.precision +
      weights.recall * performance.recall +
      weights.f1Score * performance.f1Score
    );
  }

  private updatePerformanceMetrics(performance: ThresholdPerformance): void {
    const tp = performance.truePositives;
    const fp = performance.falsePositives;
    const fn = performance.falseNegatives;
    
    performance.precision = tp > 0 ? tp / (tp + fp) : 0;
    performance.recall = tp > 0 ? tp / (tp + fn) : 0;
    performance.f1Score = performance.precision + performance.recall > 0
      ? 2 * (performance.precision * performance.recall) / (performance.precision + performance.recall)
      : 0;
  }

  private getOrCreateCurrentPerformance(threshold: ThresholdConfig): ThresholdPerformance {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.evaluationWindow * 60 * 60 * 1000);
    
    let currentPerf = threshold.performanceHistory.find(p => 
      p.timestamp >= windowStart && p.value === threshold.value
    );

    if (!currentPerf) {
      currentPerf = {
        timestamp: now,
        value: threshold.value,
        truePositives: 0,
        falsePositives: 0,
        trueNegatives: 0,
        falseNegatives: 0,
        precision: 0,
        recall: 0,
        f1Score: 0
      };
      threshold.performanceHistory.push(currentPerf);
    }

    return currentPerf;
  }

  private getRecentPerformance(threshold: ThresholdConfig): ThresholdPerformance[] {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.evaluationWindow * 60 * 60 * 1000);
    
    return threshold.performanceHistory.filter(p => p.timestamp >= windowStart);
  }

  private updateBestConfigurations(threshold: ThresholdConfig, score: number): void {
    const bestConfigs = this.archive.bestConfigurations.get(threshold.name) || [];
    
    // Keep top 5 configurations
    const lastPerf = threshold.performanceHistory[threshold.performanceHistory.length - 1];
    if (lastPerf) {
      bestConfigs.push({
        ...threshold,
        performanceHistory: [{
          timestamp: lastPerf.timestamp,
          value: lastPerf.value,
          truePositives: lastPerf.truePositives,
          falsePositives: lastPerf.falsePositives,
          trueNegatives: lastPerf.trueNegatives,
          falseNegatives: lastPerf.falseNegatives,
          precision: lastPerf.precision,
          recall: lastPerf.recall,
          f1Score: score
        }]
      });
    }

    bestConfigs.sort((a, b) => {
      const scoreA = a.performanceHistory[0]?.f1Score || 0;
      const scoreB = b.performanceHistory[0]?.f1Score || 0;
      return scoreB - scoreA;
    });

    this.archive.bestConfigurations.set(
      threshold.name,
      bestConfigs.slice(0, 5)
    );
  }

  getPerformanceReport(): {
    thresholds: Array<{
      name: string;
      currentValue: number;
      bestValue: number;
      currentF1Score: number;
      improvement: number;
    }>;
    overallImprovement: number;
  } {
    const report: any = { thresholds: [], overallImprovement: 0 };
    let totalImprovement = 0;
    let count = 0;

    this.activeThresholds.forEach((threshold, name) => {
      const recent = this.getRecentPerformance(threshold);
      const lastRecent = recent[recent.length - 1];
      const currentF1 = lastRecent?.f1Score || 0;

      const bestConfig = this.archive.bestConfigurations.get(name)?.[0];
      const bestF1 = bestConfig?.performanceHistory?.[0]?.f1Score || currentF1;

      const firstPerf = threshold.performanceHistory[0];
      const initialF1 = firstPerf?.f1Score || 0.5;
      const improvement = ((currentF1 - initialF1) / initialF1) * 100;

      report.thresholds.push({
        name,
        currentValue: threshold.value,
        bestValue: bestConfig?.value || threshold.value,
        currentF1Score: currentF1,
        improvement
      });

      totalImprovement += improvement;
      count++;
    });

    report.overallImprovement = count > 0 ? totalImprovement / count : 0;
    
    return report;
  }

  exportBestConfiguration(): Record<string, number> {
    const config: Record<string, number> = {};
    
    this.activeThresholds.forEach((threshold, name) => {
      const bestConfig = this.archive.bestConfigurations.get(name)?.[0];
      config[name] = bestConfig?.value || threshold.value;
    });

    return config;
  }

  importConfiguration(config: Record<string, number>): void {
    Object.entries(config).forEach(([name, value]) => {
      const threshold = this.activeThresholds.get(name);
      if (threshold) {
        threshold.value = Math.max(
          threshold.minValue,
          Math.min(threshold.maxValue, value)
        );
        threshold.lastUpdated = new Date();
      }
    });

    this.emit('configuration-imported', { thresholds: Object.keys(config) });
  }
}
