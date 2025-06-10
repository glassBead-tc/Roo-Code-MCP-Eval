# OpenTelemetry Infrastructure

## Overview

The Roo Code evaluation system implements a comprehensive OpenTelemetry-based telemetry infrastructure for observing MCP server interactions and system performance. The infrastructure is designed with extensibility and plugin architecture at its core.

## Core Components

### 1. Telemetry Initialization (`src/telemetry/initializeOtel.ts`)

**Purpose**: Central initialization point for OpenTelemetry configuration.

**Key Features**:

- Auto-discovery of available ports (starting from 4318)
- Plugin-based provider management
- Environment-specific configuration
- Integration with MCP benchmark processor

**Configuration Options**:

```typescript
interface InitializeOtelOptions {
	port?: number // OTLP HTTP receiver port
	debug?: boolean // Debug mode toggle
	telemetryConfig?: TelemetryPluginConfig // Custom configuration
	env?: "development" | "production" | "test" // Environment
}
```

**Resource Attributes**:

- `service.name`: "roo-code-evals" (configurable via OTEL_SERVICE_NAME)
- `service.version`: "1.0.0" (configurable via OTEL_SERVICE_VERSION)
- `deployment.environment`: Environment-specific labeling

### 2. Plugin Management (`src/telemetry/TelemetryPluginManager.ts`)

**Architecture**: Dynamic provider loading with factory pattern.

**Capabilities**:

- Runtime provider registration
- Configuration validation
- Resource attribute merging
- Graceful shutdown handling

**Provider Lifecycle**:

1. Factory registration
2. Configuration validation
3. Provider initialization
4. Span processor creation
5. Resource attribute merging
6. Shutdown coordination

### 3. Built-in Providers (`src/telemetry/providers/`)

#### OTLP Provider (`OtlpProvider.ts`)

- **Protocol**: OpenTelemetry Protocol over HTTP
- **Default Endpoint**: `http://localhost:4318/v1/traces`
- **Configuration**: Headers via OTEL_EXPORTER_OTLP_HEADERS
- **Use Case**: Production telemetry backends (Jaeger, Datadog, etc.)

#### Jaeger Provider (`JaegerProvider.ts`)

- **Protocol**: Jaeger-specific OTLP export
- **Endpoint**: Jaeger collector interface
- **Configuration**: Jaeger-specific headers and authentication
- **Use Case**: Jaeger-native deployments

#### Console Provider (`ConsoleProvider.ts`)

- **Output**: Structured console logging
- **Features**: Pretty-printing in debug mode
- **Configuration**: Format options
- **Use Case**: Development and debugging

### 4. Configuration System

#### Configuration Structure

```typescript
interface TelemetryPluginConfig {
	providers: Array<{
		id: string // Provider identifier
		name: string // Human-readable name
		enabled: boolean // Enable/disable toggle
		options: Record<string, any> // Provider-specific options
	}>
	debug: boolean // Global debug flag
}
```

#### Default Configuration

```json
{
	"providers": [
		{
			"id": "otlp",
			"name": "OpenTelemetry Protocol",
			"enabled": true,
			"options": {
				"endpoint": "http://localhost:4318/v1/traces",
				"headers": {}
			}
		},
		{
			"id": "console",
			"name": "Console Debug",
			"enabled": false, // Enabled only in debug mode
			"options": {
				"prettyPrint": true
			}
		}
	],
	"debug": false
}
```

#### Environment Variables

- `OTEL_SERVICE_NAME`: Service identifier
- `OTEL_SERVICE_VERSION`: Version labeling
- `OTEL_LOG_LEVEL`: Log level control ("debug" enables console provider)
- `OTEL_EXPORTER_OTLP_ENDPOINT`: Override OTLP endpoint
- `OTEL_EXPORTER_OTLP_HEADERS`: JSON-encoded headers
- `NODE_ENV`: Environment classification

## MCP Integration

### Span Processing Architecture

**Target Spans**: Only processes spans with:

- `span.kind`: `SpanKind.CLIENT`
- `rpc.system`: "mcp"
- `rpc.service`: ["exa", "firecrawl"] (configurable)

**Attribute Schema**:

- `mcp.task_id`: Task identifier (string or number)
- `mcp.request`: JSON-encoded request data
- `mcp.response`: JSON-encoded response data
- `mcp.response_size_bytes`: Response payload size

### Task Context Management

**ID Mapping**: Bridges Roo's string task IDs with database integer IDs

```typescript
// Registration
registerTaskIdMapping(rooTaskId: string, dbTaskId: number): void

// Context setting
setTaskContext(taskId: number, runId: number, mcpServer: string, userIntent: string): void
```

**Context Structure**:

```typescript
interface TaskContext {
	taskId: number
	runId: number
	mcpServer: string
	userIntent: string
	startTime: Date
	currentStep: number
	totalSteps: number
}
```

### Performance Metrics

**Collected Metrics**:

- Request/response duration (high-resolution timestamps)
- Response payload size (bytes)
- Error count per task
- Step latency trends
- Resource usage (placeholder for future implementation)

**Trend Analysis**:

- Rolling window of last 50 spans per task
- Duration trend calculation (increasing/decreasing/stable)
- Performance baseline establishment

## AI Integration Points

### Observer Integration

**Integration Layer**: `EvalObserverIntegration` connects telemetry with AI analysis.

**Data Flow**:

1. Span completion triggers AI processing
2. Performance metrics calculated
3. Historical trends analyzed
4. System health assessed
5. Insights generated and stored

**Observer Data Structure**:

```typescript
interface SpanObservationData {
	span: ReadableSpan
	taskContext: TaskContext
	performanceMetrics: PerformanceMetrics
	recentTrends: TrendData[]
	systemHealth: SystemHealth
}
```

### Real-time Analysis

**Capabilities**:

- Anomaly detection on response times
- Pattern recognition in MCP usage
- Performance degradation alerts
- Resource usage monitoring
- Steering recommendations

**Configuration Levels**:

- **Basic**: Anomaly detection, performance analysis
- **Full**: Pattern recognition, steering recommendations
- **Autonomous**: Continuous learning, auto-implementation

## Testing Infrastructure

### Test Configuration

**Test Files**:

- `__tests__/TelemetryConfigLoader.test.ts`: Configuration loading tests
- `__tests__/TelemetryPluginManager.test.ts`: Plugin management tests
- `__tests__/providers.test.ts`: Provider functionality tests
- `__tests__/jaeger-otlp-test.ts`: Jaeger integration tests
- `__tests__/simple-telemetry-test.ts`: Basic telemetry tests

**Standalone Testing**:

```bash
# Test without database
pnpm test:telemetry

# Simple node test
pnpm test:telemetry:simple
```

### Mock Infrastructure

**Test Scenarios**:

- Provider initialization/shutdown
- Configuration validation
- Span processing pipeline
- Error handling and recovery
- Performance under load

## Production Considerations

### Deployment Architecture

**Container Integration**:

- Automatic port discovery prevents conflicts
- Environment-based configuration
- Graceful shutdown with cleanup
- Resource attribute consistency

**Scalability Features**:

- Plugin-based provider selection
- Configurable batch sizes
- Memory-efficient span processing
- Connection pooling for exporters

### Monitoring and Observability

**Self-Monitoring**:

- Telemetry system health metrics
- Provider connectivity status
- Export success/failure rates
- Performance impact measurement

**Troubleshooting**:

- Debug mode with detailed logging
- Console provider for local debugging
- Configuration validation errors
- Connectivity diagnostics

### Security and Privacy

**Data Handling**:

- Request/response data serialization
- PII filtering capabilities (not currently implemented)
- Secure credential management
- Network encryption for exports

**Access Control**:

- Environment-based configuration
- Credential isolation
- Network segmentation
- Audit trail maintenance

## Extension Points

### Custom Providers

**Provider Interface**:

```typescript
interface TelemetryProvider {
	initialize(config: any): Promise<void>
	createSpanProcessor(): SpanProcessor
	getResourceAttributes(): Record<string, any>
	shutdown(): Promise<void>
}
```

**Registration Pattern**:

```typescript
// Custom provider factory
class CustomProviderFactory implements TelemetryProviderFactory {
	create(): TelemetryProvider {
		return new CustomProvider()
	}
}

// Registration
pluginManager.registerFactory("custom", new CustomProviderFactory())
```

### Configuration Extensions

**Custom Configuration**:

- Provider-specific options
- Dynamic configuration updates
- Environment-specific overrides
- Runtime configuration validation

**Integration Hooks**:

- Pre/post initialization callbacks
- Configuration change notifications
- Provider lifecycle events
- Error recovery mechanisms

This infrastructure provides a robust foundation for observing MCP server interactions while maintaining flexibility for future enhancements and custom integrations.
