import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { MockDataGenerator } from '../exporters/MockDataGenerator.js';
import { TelemetryExport, TelemetryQueryParams, ExportFormat } from '../types.js';

export interface TelemetryServerConfig {
  name: string;
  version: string;
  dataSource: 'mock' | 'database' | 'real-time';
  mockDataConfig?: {
    days: number;
    recordsPerDay: number;
    includeErrors: boolean;
  };
  cacheConfig?: {
    enabled: boolean;
    ttlMinutes: number;
    maxEntries: number;
  };
}

export class TelemetryMCPServer {
  private server: Server;
  private mockGenerator: MockDataGenerator;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private config: TelemetryServerConfig;

  constructor(config: TelemetryServerConfig) {
    this.config = config;
    this.mockGenerator = new MockDataGenerator();
    
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'query_telemetry',
            description: 'Query MCP server telemetry data with filters and aggregation options',
            inputSchema: {
              type: 'object',
              properties: {
                queryType: {
                  type: 'string',
                  enum: ['benchmarks', 'calls', 'metrics', 'aggregated'],
                  description: 'Type of telemetry data to query'
                },
                filters: {
                  type: 'object',
                  properties: {
                    startDate: { type: 'string', description: 'Start date (ISO string)' },
                    endDate: { type: 'string', description: 'End date (ISO string)' },
                    mcpServer: { type: 'string', description: 'Filter by MCP server name' },
                    minDuration: { type: 'number', description: 'Minimum duration in ms' },
                    maxDuration: { type: 'number', description: 'Maximum duration in ms' },
                    taskType: { type: 'string', description: 'Filter by task type' },
                    success: { type: 'boolean', description: 'Filter by success/failure' }
                  },
                  description: 'Query filters'
                },
                aggregation: {
                  type: 'object',
                  properties: {
                    groupBy: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Fields to group by'
                    },
                    metrics: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: ['avg', 'min', 'max', 'p50', 'p95', 'p99', 'count', 'sum']
                      },
                      description: 'Aggregation metrics to calculate'
                    }
                  },
                  description: 'Aggregation options'
                },
                limit: { type: 'number', description: 'Maximum number of results' },
                offset: { type: 'number', description: 'Pagination offset' }
              },
              required: ['queryType']
            }
          },
          {
            name: 'export_telemetry',
            description: 'Export telemetry data in various formats',
            inputSchema: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  enum: ['json', 'csv', 'parquet'],
                  description: 'Export format'
                },
                compression: { type: 'boolean', description: 'Compress output' },
                includeMetadata: { type: 'boolean', description: 'Include metadata' },
                filters: {
                  type: 'object',
                  description: 'Same filters as query_telemetry'
                }
              },
              required: ['format']
            }
          },
          {
            name: 'get_telemetry_summary',
            description: 'Get high-level summary of telemetry data',
            inputSchema: {
              type: 'object',
              properties: {
                timeWindow: {
                  type: 'string',
                  enum: ['1h', '24h', '7d', '30d'],
                  description: 'Time window for summary'
                },
                includeErrors: { type: 'boolean', description: 'Include error analysis' },
                includeTrends: { type: 'boolean', description: 'Include trend analysis' }
              }
            }
          },
          {
            name: 'get_server_health',
            description: 'Get health status of MCP servers',
            inputSchema: {
              type: 'object',
              properties: {
                serverName: { type: 'string', description: 'Specific server to check' }
              }
            }
          },
          {
            name: 'get_real_time_metrics',
            description: 'Get real-time performance metrics',
            inputSchema: {
              type: 'object',
              properties: {
                window: {
                  type: 'string',
                  enum: ['5m', '15m', '1h'],
                  description: 'Time window for real-time data'
                },
                metrics: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['response_time', 'error_rate', 'throughput', 'token_usage']
                  },
                  description: 'Specific metrics to retrieve'
                }
              }
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'query_telemetry':
            return await this.handleQueryTelemetry(args as TelemetryQueryParams & { limit?: number; offset?: number });
          
          case 'export_telemetry':
            return await this.handleExportTelemetry(args as any);
          
          case 'get_telemetry_summary':
            return await this.handleGetSummary(args as any);
          
          case 'get_server_health':
            return await this.handleGetServerHealth(args as any);
          
          case 'get_real_time_metrics':
            return await this.handleGetRealTimeMetrics(args as any);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  private async handleQueryTelemetry(params: TelemetryQueryParams & { limit?: number; offset?: number }) {
    const cacheKey = `query_${JSON.stringify(params)}`;
    
    // Check cache first
    if (this.config.cacheConfig?.enabled) {
      const cached = this.getCached(cacheKey);
      if (cached) {
        return { content: [{ type: 'text', text: JSON.stringify(cached) }] };
      }
    }

    // Generate or fetch data based on data source
    let telemetryData: TelemetryExport;
    
    switch (this.config.dataSource) {
      case 'mock':
        telemetryData = await this.getMockData(params);
        break;
      case 'database':
        telemetryData = await this.getDatabaseData(params);
        break;
      case 'real-time':
        telemetryData = await this.getRealTimeData(params);
        break;
      default:
        throw new McpError(ErrorCode.InternalError, `Unsupported data source: ${this.config.dataSource}`);
    }

    // Apply filters
    const filteredData = this.applyFilters(telemetryData, params.filters);
    
    // Apply aggregation
    const aggregatedData = params.aggregation ? 
      this.applyAggregation(filteredData, params.aggregation) : 
      filteredData;

    // Apply pagination
    const paginatedData = this.applyPagination(aggregatedData, params.limit, params.offset);

    // Cache the result
    if (this.config.cacheConfig?.enabled) {
      this.setCached(cacheKey, paginatedData);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(paginatedData, null, 2)
      }]
    };
  }

  private async handleExportTelemetry(params: { format: string; compression?: boolean; includeMetadata?: boolean; filters?: any }) {
    const telemetryData = this.config.dataSource === 'mock' ? 
      this.mockGenerator.generateTelemetryExport({
        days: this.config.mockDataConfig?.days || 7,
        recordsPerDay: this.config.mockDataConfig?.recordsPerDay || 200,
        includeErrors: this.config.mockDataConfig?.includeErrors || true
      }) :
      await this.getDatabaseData({ queryType: 'benchmarks' });

    const filteredData = params.filters ? this.applyFilters(telemetryData, params.filters) : telemetryData;
    
    let exportData: string;
    
    switch (params.format) {
      case 'json':
        exportData = JSON.stringify(filteredData, null, 2);
        break;
      case 'csv':
        exportData = this.convertToCSV(filteredData);
        break;
      case 'parquet':
        // For now, return JSON with a note about parquet
        exportData = JSON.stringify({
          note: 'Parquet format would be implemented with a parquet library',
          data: filteredData
        }, null, 2);
        break;
      default:
        throw new McpError(ErrorCode.InvalidParams, `Unsupported format: ${params.format}`);
    }

    return {
      content: [{
        type: 'text',
        text: exportData
      }]
    };
  }

  private async handleGetSummary(params: { timeWindow?: string; includeErrors?: boolean; includeTrends?: boolean }) {
    const telemetryData = this.config.dataSource === 'mock' ? 
      this.mockGenerator.generateTelemetryExport({
        days: this.getTimeWindowDays(params.timeWindow),
        recordsPerDay: 200,
        includeErrors: params.includeErrors ?? true
      }) :
      await this.getDatabaseData({ queryType: 'aggregated' });

    const summary = {
      timeWindow: params.timeWindow || '7d',
      summary: telemetryData.benchmarks.summary,
      serverHealth: telemetryData.performance.byServer.map(s => ({
        name: s.serverName,
        status: s.errorRate < 0.05 ? 'healthy' : s.errorRate < 0.1 ? 'degraded' : 'unhealthy',
        errorRate: s.errorRate,
        avgResponseTime: s.avgResponseTime
      })),
      ...(params.includeErrors && {
        topErrors: telemetryData.errors.patterns.slice(0, 5)
      }),
      ...(params.includeTrends && {
        trends: telemetryData.benchmarks.trends
      })
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(summary, null, 2)
      }]
    };
  }

  private async handleGetServerHealth(params: { serverName?: string }) {
    // Mock server health data - in real implementation would check actual server status
    const servers = ['filesystem', 'github', 'context7', 'exa', 'mem0-mcp', 'firecrawl'];
    const targetServers = params.serverName ? [params.serverName] : servers;

    const healthData = targetServers.map(serverName => ({
      name: serverName,
      status: Math.random() > 0.1 ? 'healthy' : 'degraded',
      lastCheck: new Date().toISOString(),
      responseTime: Math.floor(50 + Math.random() * 200),
      errorRate: Math.random() * 0.1,
      uptime: 0.99 + Math.random() * 0.01,
      version: '1.0.0',
      endpoints: {
        ping: Math.random() > 0.05,
        query: Math.random() > 0.02,
        health: true
      }
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(healthData, null, 2)
      }]
    };
  }

  private async handleGetRealTimeMetrics(params: { window?: string; metrics?: string[] }) {
    const window = params.window || '15m';
    const metrics = params.metrics || ['response_time', 'error_rate', 'throughput'];
    
    // Generate mock real-time data
    const now = new Date();
    const points = 20; // 20 data points in the window
    const interval = this.getWindowInterval(window);
    
    const realTimeData = metrics.map(metric => ({
      metric,
      unit: this.getMetricUnit(metric),
      dataPoints: Array.from({ length: points }, (_, i) => ({
        timestamp: new Date(now.getTime() - (points - i) * interval).toISOString(),
        value: this.generateMockMetricValue(metric)
      }))
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          window,
          generatedAt: now.toISOString(),
          metrics: realTimeData
        }, null, 2)
      }]
    };
  }

  // Helper methods

  private async getMockData(params: TelemetryQueryParams): Promise<TelemetryExport> {
    return this.mockGenerator.generateTelemetryExport({
      days: this.config.mockDataConfig?.days || 7,
      recordsPerDay: this.config.mockDataConfig?.recordsPerDay || 200,
      includeErrors: this.config.mockDataConfig?.includeErrors || true
    });
  }

  private async getDatabaseData(params: TelemetryQueryParams): Promise<TelemetryExport> {
    // Placeholder for real database integration
    // Would use Drizzle ORM to query actual telemetry tables
    console.log('Database query not yet implemented, using mock data');
    return this.getMockData(params);
  }

  private async getRealTimeData(params: TelemetryQueryParams): Promise<TelemetryExport> {
    // Placeholder for real-time data integration
    // Would connect to live telemetry streams
    console.log('Real-time data not yet implemented, using mock data');
    return this.getMockData(params);
  }

  private applyFilters(data: TelemetryExport, filters?: any): TelemetryExport {
    if (!filters) return data;

    let filteredDetails = data.benchmarks.details;

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      // In real implementation, would filter by actual timestamps
    }

    if (filters.mcpServer) {
      filteredDetails = filteredDetails.filter(d => d.mcpServer === filters.mcpServer);
    }

    if (filters.minDuration !== undefined) {
      filteredDetails = filteredDetails.filter(d => d.duration >= filters.minDuration);
    }

    if (filters.maxDuration !== undefined) {
      filteredDetails = filteredDetails.filter(d => d.duration <= filters.maxDuration);
    }

    if (filters.taskType) {
      filteredDetails = filteredDetails.filter(d => d.taskType === filters.taskType);
    }

    if (filters.success !== undefined) {
      filteredDetails = filteredDetails.filter(d => d.success === filters.success);
    }

    return {
      ...data,
      benchmarks: {
        ...data.benchmarks,
        details: filteredDetails
      }
    };
  }

  private applyAggregation(data: TelemetryExport, aggregation: any): any {
    // Simplified aggregation - in real implementation would be more sophisticated
    const { groupBy, metrics } = aggregation;
    
    if (!groupBy || groupBy.length === 0) {
      return data;
    }

    // Group by the first field for simplicity
    const groupField = groupBy[0];
    const grouped = new Map<string, any[]>();

    data.benchmarks.details.forEach(item => {
      const key = (item as any)[groupField] || 'unknown';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    const aggregatedResults = Array.from(grouped.entries()).map(([key, items]) => {
      const result: any = { [groupField]: key };
      
      if (metrics?.includes('avg')) {
        result.avgDuration = items.reduce((sum, item) => sum + item.duration, 0) / items.length;
      }
      if (metrics?.includes('count')) {
        result.count = items.length;
      }
      if (metrics?.includes('min')) {
        result.minDuration = Math.min(...items.map(item => item.duration));
      }
      if (metrics?.includes('max')) {
        result.maxDuration = Math.max(...items.map(item => item.duration));
      }

      return result;
    });

    return { aggregatedResults };
  }

  private applyPagination(data: any, limit?: number, offset?: number): any {
    if (!limit) return data;

    if (data.aggregatedResults) {
      return {
        ...data,
        aggregatedResults: data.aggregatedResults.slice(offset || 0, (offset || 0) + limit)
      };
    }

    if (data.benchmarks?.details) {
      return {
        ...data,
        benchmarks: {
          ...data.benchmarks,
          details: data.benchmarks.details.slice(offset || 0, (offset || 0) + limit)
        }
      };
    }

    return data;
  }

  private convertToCSV(data: TelemetryExport): string {
    const headers = ['id', 'mcpServer', 'taskType', 'duration', 'success', 'tokenUsage', 'errorDetails'];
    const rows = [headers.join(',')];

    data.benchmarks.details.forEach(item => {
      const row = [
        item.id,
        item.mcpServer,
        item.taskType,
        item.duration,
        item.success,
        item.tokenUsage.total,
        item.errorDetails || ''
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  private getCached(key: string): any | null {
    if (!this.config.cacheConfig?.enabled) return null;
    
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const ttl = this.config.cacheConfig.ttlMinutes * 60 * 1000;
    if (Date.now() - cached.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setCached(key: string, data: any): void {
    if (!this.config.cacheConfig?.enabled) return;
    
    if (this.cache.size >= (this.config.cacheConfig.maxEntries || 100)) {
      // Simple LRU: remove oldest
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private getTimeWindowDays(timeWindow?: string): number {
    switch (timeWindow) {
      case '1h': return 1;
      case '24h': return 1;
      case '7d': return 7;
      case '30d': return 30;
      default: return 7;
    }
  }

  private getWindowInterval(window: string): number {
    switch (window) {
      case '5m': return 15000; // 15 seconds per point
      case '15m': return 45000; // 45 seconds per point
      case '1h': return 180000; // 3 minutes per point
      default: return 45000;
    }
  }

  private getMetricUnit(metric: string): string {
    switch (metric) {
      case 'response_time': return 'ms';
      case 'error_rate': return 'percentage';
      case 'throughput': return 'requests/sec';
      case 'token_usage': return 'tokens';
      default: return 'unit';
    }
  }

  private generateMockMetricValue(metric: string): number {
    switch (metric) {
      case 'response_time': return 100 + Math.random() * 200;
      case 'error_rate': return Math.random() * 0.1;
      case 'throughput': return 10 + Math.random() * 50;
      case 'token_usage': return 100 + Math.random() * 900;
      default: return Math.random() * 100;
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Server Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`MCP Telemetry Server started: ${this.config.name} v${this.config.version}`);
  }
}

// Factory function for creating the server
export function createTelemetryMCPServer(config?: Partial<TelemetryServerConfig>): TelemetryMCPServer {
  const defaultConfig: TelemetryServerConfig = {
    name: 'roo-code-telemetry',
    version: '1.0.0',
    dataSource: 'mock',
    mockDataConfig: {
      days: 7,
      recordsPerDay: 200,
      includeErrors: true
    },
    cacheConfig: {
      enabled: true,
      ttlMinutes: 5,
      maxEntries: 100
    }
  };

  return new TelemetryMCPServer({ ...defaultConfig, ...config });
}

// CLI entry point
if (require.main === module) {
  const server = createTelemetryMCPServer();
  server.start().catch(console.error);
} 