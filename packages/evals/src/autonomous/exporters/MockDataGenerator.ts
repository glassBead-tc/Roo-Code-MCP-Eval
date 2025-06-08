import { 
  TelemetryExport, 
  BenchmarkDetail, 
  BenchmarkSummary, 
  TrendAnalysis, 
  ServerPerformance, 
  TaskTypePerformance, 
  TimeWindowPerformance,
  ErrorPattern,
  ErrorFrequency,
  ErrorImpact,
  Recommendation
} from '../types.js';

export class MockDataGenerator {
  private readonly mcpServers = [
    'filesystem', 'github', 'context7', 'exa', 'mem0-mcp', 
    'firecrawl', 'sqlite', 'postgres', 'redis'
  ];

  private readonly taskTypes = [
    'code-search', 'documentation-lookup', 'file-analysis', 
    'semantic-search', 'data-retrieval', 'api-call', 'computation'
  ];

  private readonly errorTypes = [
    'timeout', 'connection-failed', 'rate-limit', 'auth-failed',
    'invalid-response', 'network-error', 'resource-exhausted'
  ];

  generateTelemetryExport(options: {
    days: number;
    recordsPerDay: number;
    includeErrors: boolean;
    timeRange?: { start: Date; end: Date };
  }): TelemetryExport {
    const endDate = options.timeRange?.end || new Date();
    const startDate = options.timeRange?.start || new Date(endDate.getTime() - (options.days * 24 * 60 * 60 * 1000));
    
    const benchmarkDetails = this.generateBenchmarkDetails(
      startDate, 
      endDate, 
      options.recordsPerDay * options.days,
      options.includeErrors
    );

    return {
      metadata: {
        exportDate: new Date().toISOString(),
        timeRange: { start: startDate, end: endDate },
        version: '1.0.0',
        dataQuality: {
          completeness: 0.95 + Math.random() * 0.05, // 95-100%
          sampleSize: benchmarkDetails.length,
          missingDataPoints: options.includeErrors ? ['some-timeouts'] : []
        }
      },
      benchmarks: {
        summary: this.generateBenchmarkSummary(benchmarkDetails, { start: startDate, end: endDate }),
        details: benchmarkDetails,
        trends: this.generateTrendAnalysis(benchmarkDetails)
      },
      performance: {
        byServer: this.generateServerPerformance(benchmarkDetails),
        byTaskType: this.generateTaskTypePerformance(benchmarkDetails),
        byTimeWindow: this.generateTimeWindowPerformance(benchmarkDetails)
      },
      errors: {
        patterns: this.generateErrorPatterns(benchmarkDetails),
        frequency: this.generateErrorFrequency(benchmarkDetails),
        impact: this.generateErrorImpact(benchmarkDetails)
      },
      recommendations: {
        immediate: this.generateImmediateRecommendations(benchmarkDetails),
        longTerm: this.generateLongTermRecommendations(benchmarkDetails)
      }
    };
  }

  private generateBenchmarkDetails(
    startDate: Date, 
    endDate: Date, 
    totalRecords: number,
    includeErrors: boolean
  ): BenchmarkDetail[] {
    const details: BenchmarkDetail[] = [];
    const timeSpan = endDate.getTime() - startDate.getTime();

    for (let i = 0; i < totalRecords; i++) {
      const timestamp = new Date(startDate.getTime() + Math.random() * timeSpan);
      const mcpServer = this.mcpServers[Math.floor(Math.random() * this.mcpServers.length)];
      const taskType = this.taskTypes[Math.floor(Math.random() * this.taskTypes.length)];
      
      // Generate realistic performance characteristics per server
      const baseLatency = this.getServerBaseLatency(mcpServer);
      const variation = 0.5 + Math.random(); // 0.5x to 1.5x variation
      const duration = Math.round(baseLatency * variation);
      
      const hasError = includeErrors && Math.random() < 0.05; // 5% error rate
      
      details.push({
        id: i + 1,
        mcpServer,
        taskType,
        duration,
        tokenUsage: {
          input: Math.round(50 + Math.random() * 500),
          output: Math.round(20 + Math.random() * 200),
          total: 0 // Will calculate below
        },
        success: !hasError,
        errorDetails: hasError ? this.generateErrorMessage() : undefined,
        retrievalCalls: {
          count: Math.round(1 + Math.random() * 5),
          totalDuration: Math.round(duration * 0.7), // 70% of total time
          avgResponseSize: Math.round(1024 + Math.random() * 10240) // 1-11KB
        }
      });
    }

    // Calculate total token usage
    details.forEach(detail => {
      detail.tokenUsage.total = detail.tokenUsage.input + detail.tokenUsage.output;
    });

    return details.sort((a, b) => a.id - b.id);
  }

  private getServerBaseLatency(serverName: string): number {
    const latencies: Record<string, number> = {
      'filesystem': 50,
      'github': 300,
      'context7': 800,
      'exa': 1200,
      'mem0-mcp': 150,
      'firecrawl': 2000,
      'sqlite': 20,
      'postgres': 100,
      'redis': 5
    };
    return latencies[serverName] || 200;
  }

  private generateErrorMessage(): string {
    const errorType = this.errorTypes[Math.floor(Math.random() * this.errorTypes.length)];
    const messages: Record<string, string[]> = {
      'timeout': ['Request timed out after 30s', 'Connection timeout'],
      'connection-failed': ['Unable to connect to server', 'Connection refused'],
      'rate-limit': ['Rate limit exceeded', 'Too many requests'],
      'auth-failed': ['Authentication failed', 'Invalid API key'],
      'invalid-response': ['Invalid JSON response', 'Malformed response'],
      'network-error': ['Network unreachable', 'DNS resolution failed'],
      'resource-exhausted': ['Memory limit exceeded', 'CPU limit exceeded']
    };
    
    const typeMessages = messages[errorType] || ['Unknown error'];
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  }

  private generateBenchmarkSummary(details: BenchmarkDetail[], timeRange: { start: Date; end: Date }): BenchmarkSummary {
    const successfulBenchmarks = details.filter(d => d.success);
    const durations = successfulBenchmarks.map(d => d.duration).sort((a, b) => a - b);
    const tokenUsages = successfulBenchmarks.map(d => d.tokenUsage.total);

    return {
      totalBenchmarks: details.length,
      successRate: successfulBenchmarks.length / details.length,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length || 0,
      medianDuration: durations[Math.floor(durations.length / 2)] || 0,
      p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
      avgTokenUsage: tokenUsages.reduce((sum, t) => sum + t, 0) / tokenUsages.length || 0,
      timeRange
    };
  }

  private generateTrendAnalysis(details: BenchmarkDetail[]): TrendAnalysis[] {
    return [
      {
        metric: 'response_time',
        direction: Math.random() > 0.5 ? 'improving' : 'degrading',
        changePercent: -5 + Math.random() * 15, // -5% to +10%
        significance: 0.01 + Math.random() * 0.04, // p-value 0.01-0.05
        dataPoints: this.generateDataPoints(details, 'duration')
      },
      {
        metric: 'success_rate',
        direction: Math.random() > 0.7 ? 'improving' : 'stable',
        changePercent: -1 + Math.random() * 3, // -1% to +2%
        significance: 0.02 + Math.random() * 0.03,
        dataPoints: this.generateSuccessRatePoints(details)
      },
      {
        metric: 'token_efficiency',
        direction: Math.random() > 0.6 ? 'improving' : 'degrading',
        changePercent: -8 + Math.random() * 12, // -8% to +4%
        significance: 0.01 + Math.random() * 0.04,
        dataPoints: this.generateDataPoints(details, 'tokenUsage')
      }
    ];
  }

  private generateDataPoints(details: BenchmarkDetail[], metric: 'duration' | 'tokenUsage'): { timestamp: Date; value: number }[] {
    // Group by hour and calculate averages
    const hourlyData = new Map<number, number[]>();
    
    details.forEach(detail => {
      const hour = Math.floor(detail.id / 10) * 10; // Group every 10 records as an "hour"
      const value = metric === 'duration' ? detail.duration : detail.tokenUsage.total;
      
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(value);
    });

    return Array.from(hourlyData.entries()).map(([hour, values]) => ({
      timestamp: new Date(Date.now() - (100 - hour) * 60 * 60 * 1000), // Hours ago
      value: values.reduce((sum, v) => sum + v, 0) / values.length
    }));
  }

  private generateSuccessRatePoints(details: BenchmarkDetail[]): { timestamp: Date; value: number }[] {
    // Group by batches and calculate success rates
    const batchSize = 20;
    const points: { timestamp: Date; value: number }[] = [];
    
    for (let i = 0; i < details.length; i += batchSize) {
      const batch = details.slice(i, i + batchSize);
      const successRate = batch.filter(d => d.success).length / batch.length;
      
      points.push({
        timestamp: new Date(Date.now() - (details.length - i) * 60 * 1000), // Minutes ago
        value: successRate * 100 // Percentage
      });
    }

    return points;
  }

  private generateServerPerformance(details: BenchmarkDetail[]): ServerPerformance[] {
    const serverStats = new Map<string, BenchmarkDetail[]>();
    
    details.forEach(detail => {
      if (!serverStats.has(detail.mcpServer)) {
        serverStats.set(detail.mcpServer, []);
      }
      serverStats.get(detail.mcpServer)!.push(detail);
    });

    return Array.from(serverStats.entries()).map(([serverName, serverDetails]) => {
      const successful = serverDetails.filter(d => d.success);
      const totalCalls = serverDetails.length;
      const errorRate = (serverDetails.length - successful.length) / serverDetails.length;
      
      return {
        serverName,
        totalCalls,
        avgResponseTime: successful.reduce((sum, d) => sum + d.duration, 0) / successful.length || 0,
        errorRate,
        throughput: totalCalls / 24, // Calls per hour (assuming 24 hour period)
        reliability: 1 - errorRate
      };
    });
  }

  private generateTaskTypePerformance(details: BenchmarkDetail[]): TaskTypePerformance[] {
    const taskStats = new Map<string, BenchmarkDetail[]>();
    
    details.forEach(detail => {
      if (!taskStats.has(detail.taskType)) {
        taskStats.set(detail.taskType, []);
      }
      taskStats.get(detail.taskType)!.push(detail);
    });

    return Array.from(taskStats.entries()).map(([taskType, taskDetails]) => {
      const successful = taskDetails.filter(d => d.success);
      
      return {
        taskType,
        count: taskDetails.length,
        successRate: successful.length / taskDetails.length,
        avgDuration: successful.reduce((sum, d) => sum + d.duration, 0) / successful.length || 0,
        tokenEfficiency: successful.reduce((sum, d) => sum + (d.duration / d.tokenUsage.total), 0) / successful.length || 0
      };
    });
  }

  private generateTimeWindowPerformance(details: BenchmarkDetail[]): TimeWindowPerformance[] {
    // Simulate different time windows with trends
    return [
      {
        window: '1h',
        avgDuration: 200 + Math.random() * 100,
        errorRate: 0.02 + Math.random() * 0.03,
        throughput: 50 + Math.random() * 20,
        trend: Math.random() > 0.5 ? 'improving' : 'stable'
      },
      {
        window: '24h',
        avgDuration: 220 + Math.random() * 80,
        errorRate: 0.03 + Math.random() * 0.02,
        throughput: 45 + Math.random() * 15,
        trend: Math.random() > 0.6 ? 'improving' : 'degrading'
      },
      {
        window: '7d',
        avgDuration: 240 + Math.random() * 60,
        errorRate: 0.04 + Math.random() * 0.02,
        throughput: 42 + Math.random() * 12,
        trend: Math.random() > 0.7 ? 'stable' : 'degrading'
      }
    ];
  }

  private generateErrorPatterns(details: BenchmarkDetail[]): ErrorPattern[] {
    const errorDetails = details.filter(d => !d.success && d.errorDetails);
    const patterns = new Map<string, number>();
    
    errorDetails.forEach(detail => {
      const errorType = this.classifyError(detail.errorDetails!);
      patterns.set(errorType, (patterns.get(errorType) || 0) + 1);
    });

    return Array.from(patterns.entries()).map(([pattern, frequency]) => ({
      pattern,
      frequency,
      severity: this.getErrorSeverity(pattern),
      impact: this.getErrorImpact(pattern),
      suggestedFix: this.getErrorFix(pattern)
    }));
  }

  private generateErrorFrequency(details: BenchmarkDetail[]): ErrorFrequency[] {
    const errorTypes = ['timeout', 'connection-failed', 'rate-limit'];
    const now = new Date();
    
    return errorTypes.map(errorType => ({
      errorType,
      count: Math.floor(Math.random() * 10),
      firstSeen: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Within last week
      lastSeen: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000), // Within last day
      trend: Math.random() > 0.5 ? 'decreasing' : 'stable'
    }));
  }

  private generateErrorImpact(details: BenchmarkDetail[]): ErrorImpact[] {
    return [
      {
        errorType: 'timeout',
        performanceImpact: 0.15, // 15% performance degradation
        userImpact: 0.08, // 8% user impact
        systemImpact: 0.05 // 5% system impact
      },
      {
        errorType: 'rate-limit',
        performanceImpact: 0.25,
        userImpact: 0.12,
        systemImpact: 0.08
      }
    ];
  }

  private generateImmediateRecommendations(details: BenchmarkDetail[]): Recommendation[] {
    return [
      {
        id: 'rec-001',
        title: 'Optimize slow MCP server responses',
        description: 'Several MCP servers showing response times >1000ms',
        priority: 'high',
        expectedImpact: '15-20% latency reduction',
        effort: 'medium',
        confidence: 0.85,
        implementationHint: 'Focus on context7 and firecrawl servers'
      },
      {
        id: 'rec-002',
        title: 'Implement retry logic for timeout errors',
        description: 'Timeout errors account for 60% of failures',
        priority: 'medium',
        expectedImpact: '10% error rate reduction',
        effort: 'low',
        confidence: 0.92
      }
    ];
  }

  private generateLongTermRecommendations(details: BenchmarkDetail[]): Recommendation[] {
    return [
      {
        id: 'rec-lt-001',
        title: 'Implement caching layer for frequent queries',
        description: 'Analysis shows 30% query repetition across sessions',
        priority: 'medium',
        expectedImpact: '25% overall performance improvement',
        effort: 'high',
        confidence: 0.78,
        implementationHint: 'Consider Redis or in-memory cache'
      },
      {
        id: 'rec-lt-002',
        title: 'Load balancing for high-traffic MCP servers',
        description: 'GitHub and context7 servers showing capacity constraints',
        priority: 'low',
        expectedImpact: '30% throughput increase',
        effort: 'high',
        confidence: 0.65
      }
    ];
  }

  private classifyError(errorMessage: string): string {
    if (errorMessage.includes('timeout')) return 'timeout';
    if (errorMessage.includes('connection')) return 'connection-failed';
    if (errorMessage.includes('rate limit')) return 'rate-limit';
    if (errorMessage.includes('auth')) return 'auth-failed';
    return 'unknown';
  }

  private getErrorSeverity(pattern: string): 'low' | 'medium' | 'high' | 'critical' {
    const severities: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'timeout': 'medium',
      'connection-failed': 'high',
      'rate-limit': 'medium',
      'auth-failed': 'critical',
      'unknown': 'low'
    };
    return severities[pattern] || 'low';
  }

  private getErrorImpact(pattern: string): string {
    const impacts: Record<string, string> = {
      'timeout': 'Delayed responses, poor user experience',
      'connection-failed': 'Service unavailability, failed operations',
      'rate-limit': 'Reduced throughput, throttled operations',
      'auth-failed': 'Complete service failure, security concern',
      'unknown': 'Unpredictable behavior'
    };
    return impacts[pattern] || 'Unknown impact';
  }

  private getErrorFix(pattern: string): string {
    const fixes: Record<string, string> = {
      'timeout': 'Increase timeout values or optimize server performance',
      'connection-failed': 'Implement connection pooling and retry logic',
      'rate-limit': 'Implement exponential backoff and request queuing',
      'auth-failed': 'Verify and refresh authentication credentials',
      'unknown': 'Enable detailed error logging for diagnosis'
    };
    return fixes[pattern] || 'Investigate and analyze error patterns';
  }
}

// Utility function to generate realistic test data
export function generateSampleData(): TelemetryExport {
  const generator = new MockDataGenerator();
  return generator.generateTelemetryExport({
    days: 7,
    recordsPerDay: 200,
    includeErrors: true
  });
} 