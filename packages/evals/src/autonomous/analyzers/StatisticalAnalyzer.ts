import { 
  TelemetryExport, 
  BenchmarkDetail, 
  TrendAnalysis, 
  Recommendation,
  ServerPerformance,
  TaskTypePerformance 
} from '../types.js';

export interface AnalysisResults {
  anomalies: Anomaly[];
  patterns: Pattern[];
  insights: Insight[];
  recommendations: Recommendation[];
  statisticalSummary: StatisticalSummary;
}

export interface Anomaly {
  id: string;
  type: 'performance' | 'error' | 'usage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedComponents: string[];
  confidence: number;
  detectionMethod: string;
  suggestedInvestigation: string;
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  frequency: number;
  significance: number; // p-value
  examples: string[];
  actionable: boolean;
}

export interface Insight {
  id: string;
  category: 'performance' | 'reliability' | 'efficiency' | 'cost';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  evidence: string[];
  quantification?: {
    metric: string;
    value: number;
    unit: string;
  };
}

export interface StatisticalSummary {
  dataPoints: number;
  timespan: { start: Date; end: Date };
  distributions: {
    responseTime: Distribution;
    tokenUsage: Distribution;
    errorRate: Distribution;
  };
  correlations: Correlation[];
  trends: TrendSummary[];
}

export interface Distribution {
  mean: number;
  median: number;
  standardDeviation: number;
  min: number;
  max: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  outliers: number[];
}

export interface Correlation {
  variables: [string, string];
  coefficient: number;
  pValue: number;
  interpretation: string;
}

export interface TrendSummary {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  rate: number; // change per unit time
  confidence: number;
  significance: number;
}

export class StatisticalAnalyzer {
  analyze(telemetryData: TelemetryExport): AnalysisResults {
    const benchmarks = telemetryData.benchmarks.details;
    
    return {
      anomalies: this.detectAnomalies(benchmarks, telemetryData.performance),
      patterns: this.identifyPatterns(benchmarks),
      insights: this.generateInsights(telemetryData),
      recommendations: this.generateStatisticalRecommendations(benchmarks, telemetryData),
      statisticalSummary: this.generateStatisticalSummary(benchmarks)
    };
  }

  private detectAnomalies(benchmarks: BenchmarkDetail[], performance: any): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Detect response time anomalies using IQR method
    const responseTimes = benchmarks.filter(b => b.success).map(b => b.duration);
    const responseTimeAnomalies = this.detectOutliers(responseTimes);
    
    if (responseTimeAnomalies.outliers.length > 0) {
      const affectedBenchmarks = benchmarks.filter(b => 
        responseTimeAnomalies.outliers.includes(b.duration)
      );
      const affectedServers = [...new Set(affectedBenchmarks.map(b => b.mcpServer))];
      
      anomalies.push({
        id: 'anom-001',
        type: 'performance',
        severity: responseTimeAnomalies.outliers.length > 10 ? 'high' : 'medium',
        description: `${responseTimeAnomalies.outliers.length} response time outliers detected (>${responseTimeAnomalies.threshold.toFixed(0)}ms)`,
        affectedComponents: affectedServers,
        confidence: 0.95,
        detectionMethod: 'Interquartile Range (IQR)',
        suggestedInvestigation: 'Check server load, network conditions, and query complexity for affected servers'
      });
    }

    // Detect error rate anomalies
    const errorRateAnomalies = this.detectErrorRateAnomalies(performance.byServer);
    anomalies.push(...errorRateAnomalies);

    // Detect token usage anomalies
    const tokenUsages = benchmarks.map(b => b.tokenUsage.total);
    const tokenAnomalies = this.detectOutliers(tokenUsages);
    
    if (tokenAnomalies.outliers.length > 0) {
      anomalies.push({
        id: 'anom-003',
        type: 'usage',
        severity: 'medium',
        description: `${tokenAnomalies.outliers.length} token usage outliers detected`,
        affectedComponents: ['token-usage-system'],
        confidence: 0.90,
        detectionMethod: 'Statistical outlier detection',
        suggestedInvestigation: 'Review queries causing high token consumption'
      });
    }

    return anomalies;
  }

  private detectErrorRateAnomalies(serverPerformance: ServerPerformance[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const errorRates = serverPerformance.map(s => s.errorRate);
    const meanErrorRate = errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length;
    const stdDev = Math.sqrt(errorRates.reduce((sum, rate) => sum + Math.pow(rate - meanErrorRate, 2), 0) / errorRates.length);
    
    const threshold = meanErrorRate + 2 * stdDev; // 2 standard deviations
    const problematicServers = serverPerformance.filter(s => s.errorRate > threshold);
    
    if (problematicServers.length > 0) {
      anomalies.push({
        id: 'anom-002',
        type: 'error',
        severity: problematicServers.some(s => s.errorRate > 0.1) ? 'critical' : 'high',
        description: `${problematicServers.length} servers with abnormally high error rates`,
        affectedComponents: problematicServers.map(s => s.serverName),
        confidence: 0.98,
        detectionMethod: 'Z-score analysis (2σ threshold)',
        suggestedInvestigation: 'Investigate server health, connection stability, and authentication issues'
      });
    }

    return anomalies;
  }

  private identifyPatterns(benchmarks: BenchmarkDetail[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Pattern: Time-based performance variations
    const timePattern = this.analyzeTimeBasedPatterns(benchmarks);
    if (timePattern) patterns.push(timePattern);

    // Pattern: Server-specific failure modes
    const serverFailurePattern = this.analyzeServerFailurePatterns(benchmarks);
    if (serverFailurePattern) patterns.push(serverFailurePattern);

    // Pattern: Task complexity correlation
    const complexityPattern = this.analyzeComplexityPatterns(benchmarks);
    if (complexityPattern) patterns.push(complexityPattern);

    return patterns;
  }

  private analyzeTimeBasedPatterns(benchmarks: BenchmarkDetail[]): Pattern | null {
    // Group benchmarks by time windows (simulated - in real implementation would use actual timestamps)
    const windows = this.groupByTimeWindows(benchmarks, 10); // 10 benchmarks per window
    const windowAvgs = windows.map(window => 
      window.reduce((sum, b) => sum + b.duration, 0) / window.length
    );

    const coefficient = this.calculateVariationCoefficient(windowAvgs);
    
    if (coefficient > 0.3) { // High variation
      return {
        id: 'pattern-001',
        name: 'Time-based Performance Variation',
        description: 'Performance varies significantly across different time periods',
        frequency: windows.length,
        significance: 0.02,
        examples: [
          `Peak performance window: ${Math.min(...windowAvgs).toFixed(0)}ms avg`,
          `Worst performance window: ${Math.max(...windowAvgs).toFixed(0)}ms avg`
        ],
        actionable: true
      };
    }

    return null;
  }

  private analyzeServerFailurePatterns(benchmarks: BenchmarkDetail[]): Pattern | null {
    const serverErrors = new Map<string, number>();
    const serverTotals = new Map<string, number>();

    benchmarks.forEach(b => {
      serverTotals.set(b.mcpServer, (serverTotals.get(b.mcpServer) || 0) + 1);
      if (!b.success) {
        serverErrors.set(b.mcpServer, (serverErrors.get(b.mcpServer) || 0) + 1);
      }
    });

    const serverErrorRates = Array.from(serverTotals.entries()).map(([server, total]) => ({
      server,
      errorRate: (serverErrors.get(server) || 0) / total
    }));

    const avgErrorRate = serverErrorRates.reduce((sum, s) => sum + s.errorRate, 0) / serverErrorRates.length;
    const problematicServers = serverErrorRates.filter(s => s.errorRate > avgErrorRate * 2);

    if (problematicServers.length > 0) {
      return {
        id: 'pattern-002',
        name: 'Server-Specific Failure Pattern',
        description: 'Certain servers consistently show higher failure rates',
        frequency: problematicServers.length,
        significance: 0.01,
        examples: problematicServers.map(s => 
          `${s.server}: ${(s.errorRate * 100).toFixed(1)}% error rate`
        ),
        actionable: true
      };
    }

    return null;
  }

  private analyzeComplexityPatterns(benchmarks: BenchmarkDetail[]): Pattern | null {
    // Analyze correlation between token usage and response time
    const successfulBenchmarks = benchmarks.filter(b => b.success);
    const tokenUsages = successfulBenchmarks.map(b => b.tokenUsage.total);
    const durations = successfulBenchmarks.map(b => b.duration);

    const correlation = this.calculateCorrelation(tokenUsages, durations);

    if (correlation.coefficient > 0.6) { // Strong positive correlation
      return {
        id: 'pattern-003',
        name: 'Complexity-Performance Correlation',
        description: 'Higher token usage strongly correlates with longer response times',
        frequency: successfulBenchmarks.length,
        significance: correlation.pValue,
        examples: [
          `Correlation coefficient: ${correlation.coefficient.toFixed(3)}`,
          `Statistical significance: p = ${correlation.pValue.toFixed(4)}`
        ],
        actionable: true
      };
    }

    return null;
  }

  private generateInsights(telemetryData: TelemetryExport): Insight[] {
    const insights: Insight[] = [];
    const { benchmarks, performance } = telemetryData;

    // Performance efficiency insight
    const avgDuration = benchmarks.summary.avgDuration;
    const avgTokens = benchmarks.summary.avgTokenUsage;
    const efficiency = avgTokens / avgDuration; // tokens per ms

    insights.push({
      id: 'insight-001',
      category: 'efficiency',
      title: 'Token Processing Efficiency',
      description: `Current system processes ${efficiency.toFixed(2)} tokens per millisecond on average`,
      impact: efficiency < 0.5 ? 'high' : efficiency < 1.0 ? 'medium' : 'low',
      evidence: [
        `Average response time: ${avgDuration.toFixed(0)}ms`,
        `Average token usage: ${avgTokens.toFixed(0)} tokens`,
        `Efficiency ratio: ${efficiency.toFixed(3)} tokens/ms`
      ],
      quantification: {
        metric: 'tokens_per_millisecond',
        value: efficiency,
        unit: 'tokens/ms'
      }
    });

    // Reliability insight
    const successRate = benchmarks.summary.successRate;
    insights.push({
      id: 'insight-002',
      category: 'reliability',
      title: 'System Reliability Assessment',
      description: `System achieves ${(successRate * 100).toFixed(1)}% success rate across all operations`,
      impact: successRate < 0.9 ? 'high' : successRate < 0.95 ? 'medium' : 'low',
      evidence: [
        `Total benchmarks: ${benchmarks.summary.totalBenchmarks}`,
        `Successful operations: ${Math.round(benchmarks.summary.totalBenchmarks * successRate)}`,
        `Failed operations: ${Math.round(benchmarks.summary.totalBenchmarks * (1 - successRate))}`
      ],
      quantification: {
        metric: 'success_rate',
        value: successRate,
        unit: 'percentage'
      }
    });

    // Performance distribution insight
    const p95Duration = benchmarks.summary.p95Duration;
    const medianDuration = benchmarks.summary.medianDuration;
    const variability = p95Duration / medianDuration;

    insights.push({
      id: 'insight-003',
      category: 'performance',
      title: 'Response Time Variability',
      description: variability > 3 
        ? 'High variability in response times indicates inconsistent performance'
        : 'Response times show good consistency across operations',
      impact: variability > 3 ? 'medium' : 'low',
      evidence: [
        `Median response time: ${medianDuration.toFixed(0)}ms`,
        `95th percentile: ${p95Duration.toFixed(0)}ms`,
        `Variability ratio: ${variability.toFixed(1)}x`
      ],
      quantification: {
        metric: 'p95_to_median_ratio',
        value: variability,
        unit: 'ratio'
      }
    });

    return insights;
  }

  private generateStatisticalRecommendations(benchmarks: BenchmarkDetail[], telemetryData: TelemetryExport): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Analyze performance distribution
    const durations = benchmarks.filter(b => b.success).map(b => b.duration);
    const distribution = this.calculateDistribution(durations);

    if (distribution.percentiles.p95 > distribution.mean * 2) {
      recommendations.push({
        id: 'stat-rec-001',
        title: 'Address Performance Tail Latency',
        description: 'P95 response time is significantly higher than average, indicating tail latency issues',
        priority: 'high',
        expectedImpact: '20-30% improvement in worst-case response times',
        effort: 'medium',
        confidence: 0.85,
        implementationHint: 'Focus on optimizing slow operations and implementing timeout strategies'
      });
    }

    // Analyze error clustering
    const errorsByServer = this.groupErrorsByServer(benchmarks);
    const serverEntries = Object.entries(errorsByServer);
    const serverWithMostErrors = serverEntries.length > 0 ? 
      serverEntries.sort(([,a], [,b]) => b - a)[0] : null;

    if (serverWithMostErrors && serverWithMostErrors[1] > 0) {
      recommendations.push({
        id: 'stat-rec-002',
        title: `Investigate ${serverWithMostErrors[0]} Server Issues`,
        description: `${serverWithMostErrors[0]} server accounts for ${serverWithMostErrors[1]} errors`,
        priority: 'medium',
        expectedImpact: `${(serverWithMostErrors[1] / benchmarks.length * 100).toFixed(1)}% error reduction potential`,
        effort: 'low',
        confidence: 0.90,
        implementationHint: 'Review server configuration, connection pooling, and error handling'
      });
    }

    return recommendations;
  }

  private generateStatisticalSummary(benchmarks: BenchmarkDetail[]): StatisticalSummary {
    const successfulBenchmarks = benchmarks.filter(b => b.success);
    const durations = successfulBenchmarks.map(b => b.duration);
    const tokenUsages = successfulBenchmarks.map(b => b.tokenUsage.total);
    const errorRates = this.calculateTimeWindowErrorRates(benchmarks);

    return {
      dataPoints: benchmarks.length,
      timespan: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Mock: 7 days ago
        end: new Date()
      },
      distributions: {
        responseTime: this.calculateDistribution(durations),
        tokenUsage: this.calculateDistribution(tokenUsages),
        errorRate: this.calculateDistribution(errorRates)
      },
      correlations: tokenUsages.length > 0 && durations.length > 0 ? [
        this.calculateCorrelation(tokenUsages, durations.slice(0, tokenUsages.length))
      ] : [],
      trends: this.calculateTrends(benchmarks)
    };
  }

  // Utility methods

  private detectOutliers(data: number[]): { outliers: number[]; threshold: number } {
    if (data.length === 0) {
      return { outliers: [], threshold: 0 };
    }
    
    const sorted = [...data].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)] || 0;
    const q3 = sorted[Math.floor(sorted.length * 0.75)] || 0;
    const iqr = q3 - q1;
    const threshold = q3 + 1.5 * iqr;
    
    return {
      outliers: data.filter(x => x > threshold),
      threshold
    };
  }

  private calculateDistribution(data: number[]): Distribution {
    if (data.length === 0) {
      return {
        mean: 0,
        median: 0,
        standardDeviation: 0,
        min: 0,
        max: 0,
        percentiles: { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 },
        outliers: []
      };
    }

    const sorted = [...data].sort((a, b) => a - b);
    const mean = data.reduce((sum, x) => sum + x, 0) / data.length;
    const variance = data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / data.length;
    
    return {
      mean,
      median: sorted[Math.floor(sorted.length / 2)] || 0,
      standardDeviation: Math.sqrt(variance),
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      percentiles: {
        p25: sorted[Math.floor(sorted.length * 0.25)] || 0,
        p50: sorted[Math.floor(sorted.length * 0.50)] || 0,
        p75: sorted[Math.floor(sorted.length * 0.75)] || 0,
        p90: sorted[Math.floor(sorted.length * 0.90)] || 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] || 0
      },
      outliers: this.detectOutliers(data).outliers
    };
  }

  private calculateCorrelation(x: number[], y: number[]): Correlation {
    const n = Math.min(x.length, y.length);
    const xSlice = x.slice(0, n);
    const ySlice = y.slice(0, n);
    
    const meanX = xSlice.reduce((sum, val) => sum + val, 0) / n;
    const meanY = ySlice.reduce((sum, val) => sum + val, 0) / n;
    
    const numerator = xSlice.reduce((sum, val, i) => sum + (val - meanX) * (ySlice[i] - meanY), 0);
    const denomX = Math.sqrt(xSlice.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0));
    const denomY = Math.sqrt(ySlice.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0));
    
    const coefficient = numerator / (denomX * denomY);
    
    // Simplified p-value calculation (in practice, would use proper statistical test)
    const tStat = coefficient * Math.sqrt((n - 2) / (1 - coefficient * coefficient));
    const pValue = Math.max(0.001, Math.min(0.999, 1 - Math.abs(tStat) / 10)); // Rough approximation
    
    return {
      variables: ['tokenUsage', 'duration'],
      coefficient,
      pValue,
      interpretation: Math.abs(coefficient) > 0.7 ? 'strong' : Math.abs(coefficient) > 0.3 ? 'moderate' : 'weak'
    };
  }

  private groupByTimeWindows(benchmarks: BenchmarkDetail[], windowSize: number): BenchmarkDetail[][] {
    const windows: BenchmarkDetail[][] = [];
    for (let i = 0; i < benchmarks.length; i += windowSize) {
      windows.push(benchmarks.slice(i, i + windowSize));
    }
    return windows;
  }

  private calculateVariationCoefficient(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return stdDev / mean;
  }

  private groupErrorsByServer(benchmarks: BenchmarkDetail[]): Record<string, number> {
    const errors: Record<string, number> = {};
    benchmarks.filter(b => !b.success).forEach(b => {
      errors[b.mcpServer] = (errors[b.mcpServer] || 0) + 1;
    });
    return errors;
  }

  private calculateTimeWindowErrorRates(benchmarks: BenchmarkDetail[]): number[] {
    const windowSize = 50; // Benchmarks per window
    const errorRates: number[] = [];
    
    for (let i = 0; i < benchmarks.length; i += windowSize) {
      const window = benchmarks.slice(i, i + windowSize);
      const errorRate = window.filter(b => !b.success).length / window.length;
      errorRates.push(errorRate);
    }
    
    return errorRates;
  }

  private calculateTrends(benchmarks: BenchmarkDetail[]): TrendSummary[] {
    // Simplified trend calculation - in practice would use proper time series analysis
    const windowSize = Math.floor(benchmarks.length / 5); // 5 time windows
    const trends: TrendSummary[] = [];
    
    // Response time trend
    const responseTimes = benchmarks.filter(b => b.success).map(b => b.duration);
    const firstHalf = responseTimes.slice(0, Math.floor(responseTimes.length / 2));
    const secondHalf = responseTimes.slice(Math.floor(responseTimes.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, x) => sum + x, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, x) => sum + x, 0) / secondHalf.length;
    const change = (secondAvg - firstAvg) / firstAvg;
    
    trends.push({
      metric: 'response_time',
      direction: change > 0.05 ? 'increasing' : change < -0.05 ? 'decreasing' : 'stable',
      rate: change,
      confidence: 0.8,
      significance: 0.05
    });
    
    return trends;
  }
} 