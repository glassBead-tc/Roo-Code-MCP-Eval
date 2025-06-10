# Integration Architecture Documentation

## Overview

This document maps the current integration points and communication patterns across the Roo Code system. It provides a comprehensive view of how components communicate, share data, manage configuration, and handle failures in the actual implementation.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                        │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────────────┐ │
│  │ ClineProvider│  │ McpHub     │  │ CloudService/        │ │
│  │             │  │            │  │ TelemetryService     │ │
│  └─────────────┘  └────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             │
                       Unix Socket IPC
                             │
┌─────────────────────────────────────────────────────────────┐
│                  Evaluation CLI System                     │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────────────┐ │
│  │ IpcServer   │  │ OpenTelemetry│  │ AI Observer          │ │
│  │             │  │ Tracing     │  │ Integration          │ │
│  └─────────────┘  └────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             │
                      Database Layer
                             │
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL                             │
│    Runs, Tasks, Metrics, MCP Events, AI Insights          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   External Services                        │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────────────┐ │
│  │ AI Providers│  │ MCP Servers│  │ Cloud Services       │ │
│  │ (20+ APIs)  │  │            │  │ (Auth, Telemetry)    │ │
│  └─────────────┘  └────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 1. VS Code Extension ↔ Evaluation CLI Communication (IPC)

### Protocol: Unix Domain Sockets

**Implementation Details:**

- **Transport**: Node-IPC library over Unix domain sockets
- **Socket Path**: `/tmp/roo-code-ipc-{pid}.sock`
- **Message Format**: JSON-based with Zod schema validation
- **Bidirectional**: Extension acts as client, Evaluation CLI as server

### Message Types

#### 1.1 TaskCommand Messages (Client → Server)

```typescript
enum TaskCommandName {
	StartNewTask = "StartNewTask",
	CancelTask = "CancelTask",
	CloseTask = "CloseTask",
	SetTaskContext = "SetTaskContext",
}
```

**StartNewTask Flow:**

```
Extension → Evaluation CLI: StartNewTask
├── configuration: RooCodeSettings
├── text: string (prompt)
├── images?: string[]
└── newTab?: boolean

Response: VS Code launches with task
```

**SetTaskContext Flow:**

```
Extension → Evaluation CLI: SetTaskContext
├── taskId: number (database ID)
├── rooTaskId: string (internal ID)
├── runId: number
├── mcpServer: string
├── userIntent: string
└── otlpEndpoint?: string

Response: TaskContextConfirmation
├── success: boolean
└── error?: string
```

#### 1.2 TaskEvent Messages (Server → Client)

```typescript
enum RooCodeEventName {
	TaskStarted,
	TaskCompleted,
	TaskAborted,
	TaskTokenUsageUpdated,
	TaskToolFailed,
	EvalPass,
	EvalFail,
}
```

**Event Broadcasting:**

- All task events are forwarded to evaluation server
- Token usage tracked in real-time
- Tool failures captured with error details
- Pass/fail results determine evaluation outcome

### Error Handling

- **Connection Failures**: 30-second timeout with retries
- **Message Validation**: Zod schema validation with error reporting
- **Socket Cleanup**: Automatic cleanup on process termination

### Security Boundaries

- **Process Isolation**: Separate processes for extension and evaluation
- **Socket Permissions**: Unix socket with process-owner permissions
- **Data Validation**: All messages validated against TypeScript schemas

## 2. MCP Server Communication Patterns

### Architecture: Hub-and-Spoke Model

**Implementation:**

- **McpHub**: Singleton manager for all MCP connections
- **McpServerManager**: Lifecycle management across webviews
- **Connection Types**: stdio, SSE, streamable-HTTP

### 2.1 Connection Management

#### Server Configuration Schema

```typescript
type ServerConfig = {
	type: "stdio" | "sse" | "streamable-http"
	disabled?: boolean
	timeout?: number // 1-3600 seconds
	alwaysAllow?: string[] // pre-approved tools
	watchPaths?: string[] // auto-restart triggers

	// stdio specific
	command?: string
	args?: string[]
	cwd?: string
	env?: Record<string, string>

	// HTTP specific
	url?: string
	headers?: Record<string, string>
}
```

#### Configuration Sources

1. **Global Settings**: `~/.roo/mcp-settings.json`
2. **Project Settings**: `{workspace}/.roo/mcp.json`
3. **Priority**: Project settings override global settings

### 2.2 Communication Patterns

#### Tool Call Flow

```
1. McpHub.callTool(serverName, toolName, args)
2. Find connection by server name (project > global priority)
3. Validate server not disabled
4. Apply timeout from server config
5. Send MCP request via transport
6. Emit telemetry events (start, success/error)
7. Return response or throw error
```

#### Resource Access Flow

```
1. McpHub.readResource(serverName, uri)
2. Validate connection and enabled state
3. Send resources/read request
4. Track response size and duration
5. Emit resource access events
6. Return resource data
```

### 2.3 Error Handling & Resilience

#### Transport-Specific Error Handling

- **stdio**: stderr monitoring, process restart on exit
- **SSE**: ReconnectingEventSource with exponential backoff
- **streamable-HTTP**: Request timeouts and retry logic

#### Auto-Restart Mechanisms

- **File Watching**: chokidar monitoring of watchPaths
- **Build Detection**: Automatic restart on build/index.js changes
- **Error Recovery**: Connection re-establishment on transport errors

### 2.4 Telemetry Integration

#### OpenTelemetry Tracing

```typescript
// Automatic trace decoration for tool calls
@traceable("MCP Tool Call", { metadata: { type: "mcp_tool_call" } })
async callTool(serverName, toolName, args) {
  // Span attributes include:
  // - mcp.server, mcp.tool
  // - mcp.task_id (from eval context)
  // - eval.task_id, eval.run_id (if in eval mode)
}
```

## 3. API Provider Integrations

### 3.1 Provider Architecture

**Base Provider Pattern:**

- **BaseProvider**: Common interface and token counting
- **Handler Implementation**: Provider-specific API integration
- **Stream Processing**: ApiStream for real-time responses

#### Supported Providers (23 total)

```typescript
const providers = {
	// Cloud APIs
	anthropic: AnthropicHandler,
	openai: OpenAiHandler,
	gemini: GeminiHandler,

	// Enterprise
	bedrock: AwsBedrockHandler,
	vertex: VertexHandler,

	// Aggregators
	openrouter: OpenRouterHandler,
	litellm: LiteLLMHandler,

	// Local/Self-hosted
	ollama: OllamaHandler,
	lmstudio: LmStudioHandler,

	// Specialized
	humanrelay: HumanRelayHandler,
	// ... 13 more providers
}
```

### 3.2 Authentication & Configuration

#### Configuration Management

```typescript
interface ApiHandlerOptions {
	apiKey?: string
	baseUrl?: string
	model?: string
	maxTokens?: number
	temperature?: number
	// Provider-specific options...
}
```

#### Security Patterns

- **Secret Storage**: VS Code SecretStorage API
- **Environment Variables**: Support for env var injection
- **Base URL Override**: Custom endpoints for enterprise

### 3.3 Streaming & Transform Pipelines

#### ApiStream Processing

```typescript
type ApiStreamChunk =
	| { type: "text"; text: string }
	| { type: "usage"; inputTokens: number; outputTokens: number }
	| { type: "reasoning"; text: string } // Claude thinking
```

**Transform Pipeline:**

1. Provider-specific response parsing
2. Token usage extraction and caching
3. Stream chunk normalization
4. Real-time usage tracking

## 4. Database Integration & Data Flows

### 4.1 Database Schema Overview

#### Core Tables

```sql
-- Evaluation runs
runs (id, model, mcp_server, settings, socket_path, concurrency)

-- Individual tasks within runs
tasks (id, run_id, language, exercise, passed, started_at, finished_at)

-- Performance metrics
task_metrics (id, tokens_in, tokens_out, cost, duration, tool_usage)

-- Error tracking
tool_errors (id, task_id, tool_name, error, created_at)
```

#### MCP Telemetry Tables

```sql
-- MCP server connections
mcp_connection_events (server_name, event_type, transport, duration)

-- Resource access patterns
mcp_resource_events (server_name, uri, response_size, duration)

-- Tool call benchmarking
mcp_retrieval_benchmarks (mcp_server_name, user_intent, total_steps)
mcp_retrieval_calls (benchmark_id, request, response, duration_ms)
```

#### AI Integration Tables

```sql
-- AI-generated insights
ai_insights (category, title, description, confidence, evidence)

-- Autonomous recommendations
ai_steering_recommendations (type, priority, expected_impact, status)

-- Anomaly detection
ai_anomalies (type, severity, detected_value, expected_value)

-- Observer sessions
ai_observer_sessions (observer_level, steering_mode, total_insights)
```

### 4.2 Data Flow Patterns

#### Evaluation Run Lifecycle

```
1. CLI creates run record with model/settings
2. Tasks created for each language/exercise combination
3. VS Code processes tasks via IPC
4. Real-time metrics updates during execution
5. Final pass/fail determination via unit tests
6. Run completion with aggregated results
```

#### MCP Telemetry Collection

```
1. McpHub emits events for all operations
2. McpBenchmarkProcessor captures events
3. Database writes for connection/tool/resource events
4. Real-time performance analysis
5. AI observer integration for insights
```

### 4.3 Query Patterns

#### Performance Analysis Queries

```typescript
// Get run success rates by model
const runStats = await db
	.select({ model, passed, failed })
	.from(runs)
	.where(gte(runs.createdAt, subDays(new Date(), 30)))

// MCP server performance metrics
const mcpPerformance = await db
	.select({ serverName, avgDuration, errorRate })
	.from(mcpRetrievalCalls)
	.groupBy(mcpRetrievalCalls.benchmarkId)
```

## 5. Configuration Management & Propagation

### 5.1 Configuration Hierarchy

#### Layered Configuration System

```
1. Default Values (in code)
2. Global VS Code Settings (workspace configuration)
3. Global Roo Settings (~/.roo/settings/)
4. Project Settings ({workspace}/.roo/)
5. Environment Variables (runtime)
6. IPC-provided Settings (evaluation mode)
```

### 5.2 ContextProxy: Unified Configuration Access

#### State Management

```typescript
class ContextProxy {
	private stateCache: GlobalState // VS Code globalState cache
	private secretCache: SecretState // VS Code secrets cache

	// Unified access methods
	getValues(): RooCodeSettings
	setValues(values: RooCodeSettings)

	// Type-safe access
	getValue<K extends RooCodeSettingsKey>(key: K): RooCodeSettings[K]
	setValue<K extends RooCodeSettingsKey>(key: K, value: RooCodeSettings[K])
}
```

#### Configuration Scoping

- **Global State**: Non-sensitive settings (UI preferences, model configs)
- **Secret State**: API keys, tokens (encrypted by VS Code)
- **Pass-through**: Large data (taskHistory) bypasses cache

### 5.3 MCP Configuration Management

#### Multi-Source Configuration

```typescript
// Global MCP settings
~/.roo/mcp-settings.json: {
  "mcpServers": {
    "filesystem": { "command": "npx", "args": ["@modelcontextprotocol/server-filesystem"] }
  }
}

// Project-specific MCP settings
{workspace}/.roo/mcp.json: {
  "mcpServers": {
    "project-tools": { "command": "./local-mcp-server" }
  }
}
```

#### Configuration Validation

- **Zod Schema Validation**: Runtime type checking
- **Error Recovery**: Graceful fallbacks for invalid configs
- **Auto-Migration**: Settings schema evolution support

#### File Watching & Hot Reload

```typescript
// Automatic configuration reloading
watchMcpSettingsFile() {
  vscode.workspace.onDidSaveTextDocument((document) => {
    if (arePathsEqual(document.uri.fsPath, settingsPath)) {
      this.handleConfigFileChange(settingsPath, "global")
    }
  })
}
```

### 5.4 Environment-Based Configuration

#### Evaluation Mode Configuration

```typescript
// Automatic telemetry enablement in eval mode
if (process.env.ROO_EVAL_MODE === "true") {
	await vscode.workspace
		.getConfiguration(Package.name)
		.update("telemetry.mcp.enabled", true, vscode.ConfigurationTarget.Global)
}
```

#### Environment Variable Injection

```typescript
// MCP server configuration with env vars
const configInjected = await injectEnv(config)
// Supports ${ENV_VAR} substitution in server configs
```

## 6. OpenTelemetry & Monitoring Integration

### 6.1 Telemetry Architecture

#### Multi-Provider Support

```typescript
const telemetryProviders = {
	otlp: OtlpProvider, // Standard OTLP endpoint
	jaeger: JaegerProvider, // Jaeger-specific
	console: ConsoleProvider, // Debug output
}
```

#### Configuration-Driven Setup

```json
{
	"providers": [
		{
			"id": "otlp",
			"enabled": true,
			"options": {
				"endpoint": "http://localhost:4318/v1/traces",
				"headers": {}
			}
		}
	],
	"debug": false
}
```

### 6.2 Trace Context Propagation

#### Evaluation Context Injection

```typescript
// MCP calls automatically include eval context
span.setAttributes({
	"mcp.server": serverName,
	"mcp.tool": toolName,
	"eval.task_id": evalContext.taskId, // Database ID
	"eval.run_id": evalContext.runId,
	"eval.mcp_server": evalContext.mcpServer,
})
```

#### Cross-Process Tracing

- **IPC Correlation**: Task IDs propagated across process boundaries
- **Database Correlation**: Trace data linked to evaluation records
- **External Service Tracing**: AI provider calls traced end-to-end

### 6.3 Performance Monitoring

#### Real-Time Metrics Collection

```typescript
// Automatic MCP performance tracking
this.emit("mcp:tool:success", {
	serverName,
	toolName,
	duration,
	responseSize,
	timestamp,
})

// Database metrics ingestion
console.log(
	"🎯 MCP_BENCHMARK:",
	JSON.stringify({
		serverName,
		toolName,
		duration,
		responseSize,
		arguments,
		result,
	}),
)
```

## 7. Error Handling & Resilience Patterns

### 7.1 Graceful Degradation

#### MCP Server Failures

```typescript
// Server-level error handling
transport.onerror = async (error) => {
	connection.server.status = "disconnected"
	this.appendErrorMessage(connection, error.message)
	await this.notifyWebviewOfServerChanges()
}
```

#### Fallback Strategies

- **Provider Switching**: Automatic fallback to alternative AI providers
- **Configuration Recovery**: Default values for corrupted settings
- **Connection Retries**: Exponential backoff for transient failures

### 7.2 Error Propagation

#### Layered Error Handling

```
1. Transport Layer: Connection-level errors
2. Protocol Layer: MCP/API protocol errors
3. Application Layer: Business logic errors
4. User Interface Layer: User-facing error messages
```

#### Error Context Preservation

```typescript
// Rich error context for debugging
throw new Error(
	`No connection found for server: ${serverName}${source ? ` with source ${source}` : ""}. ` +
		`Please make sure to use MCP servers available under 'Connected MCP Servers'.`,
)
```

### 7.3 Monitoring & Alerting

#### Health Check Patterns

- **Server Status Tracking**: Real-time connection health
- **Performance Thresholds**: Automatic alerts for degraded performance
- **Error Rate Monitoring**: Trend analysis for failure patterns

## 8. Security Boundaries & Authentication

### 8.1 Process Isolation

#### Security Model

```
┌─────────────────┐    Unix Socket     ┌─────────────────┐
│   VS Code       │ ←─────────────────→ │  Evaluation     │
│   Extension     │    Validated IPC    │  CLI Process    │
│   (User Space)  │                     │  (Sandboxed)    │
└─────────────────┘                     └─────────────────┘
```

#### Privilege Separation

- **File System Access**: Restricted to workspace and temp directories
- **Network Access**: Only to configured endpoints
- **Process Spawning**: Limited to MCP server processes

### 8.2 Authentication Flows

#### Cloud Service Authentication

```typescript
class AuthService {
	async login(): Promise<void> {
		// OAuth2 PKCE flow for cloud services
		const authUrl = this.buildAuthUrl()
		await vscode.env.openExternal(authUrl)
		// Callback handling via URI handler
	}
}
```

#### API Key Management

```typescript
// Secure secret storage
storeSecret(key: SecretStateKey, value?: string) {
  return value === undefined
    ? this.originalContext.secrets.delete(key)
    : this.originalContext.secrets.store(key, value)
}
```

### 8.3 Data Protection

#### Sensitive Data Handling

- **API Keys**: Encrypted storage via VS Code Secrets API
- **PII Filtering**: Telemetry data scrubbing
- **Local Processing**: AI analysis performed locally when possible

## 9. Performance Considerations & Bottlenecks

### 9.1 Known Performance Characteristics

#### Connection Overhead

- **MCP Server Startup**: 1-3 seconds per server (stdio transport)
- **HTTP Transports**: Lower latency but higher memory usage
- **Connection Pool**: Single connection per server (no pooling)

#### Data Transfer Bottlenecks

- **Large Responses**: MCP resource reads can be multi-MB
- **Streaming Overhead**: Real-time token usage updates
- **Database Writes**: Synchronous writes during evaluation

### 9.2 Scaling Limitations

#### Current Constraints

```typescript
// Evaluation concurrency limit
const TASK_START_DELAY = 10 * 1000 // 10s between task starts
const TASK_TIMEOUT = 5 * 60 * 1000 // 5min task timeout
const concurrency = args.concurrent || 2 // Max 2 concurrent tasks
```

#### Memory Usage Patterns

- **Connection State**: ~50MB per active MCP server
- **Telemetry Buffers**: Configurable retention (default: 100 errors/server)
- **Database Connections**: Single connection pool

### 9.3 Optimization Opportunities

#### Caching Strategies

- **MCP Response Caching**: Not implemented (opportunity)
- **Provider Token Counting**: Local tiktoken vs API counting
- **Configuration Caching**: ContextProxy provides in-memory cache

#### Performance Monitoring

```typescript
// Built-in performance tracking
const duration = Date.now() - startTime
const responseSize = JSON.stringify(result).length

this.emit("mcp:tool:success", {
	serverName,
	toolName,
	duration,
	responseSize,
})
```

## 10. Integration Testing Strategies

### 10.1 Component-Level Testing

#### VS Code Extension Testing

```typescript
// E2E testing framework
apps / vscode - e2e / src / runTest.ts
```

#### IPC Integration Testing

```typescript
// Mock IPC clients/servers for unit tests
__mocks__ / IpcServer.ts
__mocks__ / IpcClient.ts
```

### 10.2 End-to-End Testing

#### Evaluation Pipeline Testing

```bash
# Full integration test via CLI
pnpm --filter @roo-code/evals test:integration

# Test specific language/exercise combination
pnpm --filter @roo-code/evals run-evaluation --exercise "two-fer" --include "javascript"
```

#### MCP Integration Testing

```typescript
// Automated MCP server testing
packages / evals / src / benchmark / McpBenchmarkProcessor.ts
```

### 10.3 Failure Mode Testing

#### Chaos Engineering

- **Process Termination**: Random VS Code/MCP server crashes
- **Network Partitions**: Simulated connection failures
- **Resource Exhaustion**: Memory/disk space limitations

## Conclusion

The Roo Code integration architecture demonstrates a sophisticated multi-process system with robust communication patterns, comprehensive telemetry, and extensive configuration management. Key strengths include:

1. **Modular Design**: Clear separation of concerns across components
2. **Resilience**: Multiple fallback strategies and error recovery mechanisms
3. **Observability**: Comprehensive telemetry and performance monitoring
4. **Extensibility**: Plugin-based provider system and MCP integration
5. **Security**: Process isolation and secure credential management

Areas for future enhancement include connection pooling, response caching, and improved scaling characteristics for high-concurrency evaluation scenarios.

---

_This document reflects the current state of integration architecture as of the latest codebase analysis. For implementation details, refer to the specific source files referenced throughout this document._
