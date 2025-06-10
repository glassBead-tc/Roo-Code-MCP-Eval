# CLI System Architecture

## Overview

The Roo Code CLI system provides a comprehensive command-line interface for executing MCP server evaluations. Built on the `cmd-ts` framework, it offers flexible configuration, concurrent execution, and optional AI-native capabilities while maintaining full backward compatibility.

## Command Structure

### Primary CLI Entry Point (`src/cli/index.ts`)

**Base Command**:

```bash
pnpm cli [options]
```

**Core Arguments**:

- `--run-id, -r <number>`: Execute existing run by ID
- `--model, -m <string>`: AI model identifier (default: claude-3-5-haiku-20241022)
- `--include, -i <string>`: Comma-separated languages to include
- `--exclude, -e <string>`: Comma-separated languages to exclude
- `--exercise, -x <string>`: Single exercise name for focused testing
- `--concurrent, -c <number>`: Concurrency level (default: 2)
- `--description, -d <string>`: Human-readable run description

**AI-Native Features** (Optional):

- `--ai-observer <string>`: Observation level (basic|full|autonomous)
- `--ai-steering <string>`: Steering mode (monitor-only|suggest|auto)
- `--ai-insights <string>`: Insights configuration (store|export|realtime)
- `--ai-config <string>`: Path to custom AI configuration file

## Execution Modes

### 1. New Run Creation

**Default Behavior**: Creates new evaluation run with specified parameters.

**Process Flow**:

1. Validate language selections against supported languages
2. Create database run record with model and configuration
3. Generate tasks for each language/exercise combination
4. Execute evaluation pipeline
5. Generate comprehensive results

**Example Commands**:

```bash
# Full evaluation across all languages
pnpm cli --model claude-3-5-haiku-20241022 --description "Baseline evaluation"

# JavaScript-only evaluation
pnpm cli --include javascript --concurrent 4

# Single exercise across multiple languages
pnpm cli --exercise two-bucket --include "javascript,python,go"

# With AI observation enabled
pnpm cli --ai-observer full --ai-steering suggest --ai-insights store
```

### 2. Existing Run Execution

**Use Case**: Resume or re-run evaluation with existing configuration.

**Behavior**: Loads run configuration from database and executes with optional AI features.

**Example**:

```bash
# Execute existing run with AI features
pnpm cli --run-id 42 --ai-observer autonomous --ai-steering auto
```

### 3. Single Exercise Mode

**Purpose**: Focused testing of specific programming challenges.

**Benefits**:

- Faster iteration for debugging
- Targeted language-specific testing
- Resource-efficient development workflow

**Implementation**:

- Searches for exercise across specified languages
- Creates minimal task set
- Maintains full evaluation pipeline
- Error if exercise not found in any target language

## AI Configuration System

### Configuration Levels

#### Observer Levels

- **Basic**: Anomaly detection, performance analysis, system health monitoring
- **Full**: Adds steering recommendations and pattern recognition
- **Autonomous**: Enables continuous learning and autonomous analysis

#### Steering Modes

- **Monitor-only**: Observation without intervention capabilities
- **Suggest**: Generate recommendations for human review
- **Auto**: Automatic implementation of high-confidence recommendations

#### Insights Configuration

- **Store**: Persist insights to database for historical analysis
- **Export**: Enhanced data export with periodic intervals
- **Realtime**: Live insights without persistent storage

### Custom Configuration Files

**Configuration Structure**:

```json
{
	"enabled": true,
	"observerConfig": {
		"features": {
			"anomalyDetection": true,
			"performanceAnalysis": true,
			"systemHealthMonitoring": true,
			"steeringRecommendations": false,
			"patternRecognition": true
		},
		"integration": {
			"persistInsights": true,
			"enableSteering": false,
			"autoImplementRecommendations": false
		}
	},
	"orchestratorConfig": {
		"enableAutonomousAnalysis": false,
		"enableSteeringRecommendations": false,
		"enableContinuousLearning": false,
		"dataExportInterval": 30
	},
	"persistenceConfig": {
		"enableInsightStorage": true,
		"enableRecommendationTracking": true,
		"batchInsertSize": 100
	}
}
```

**Loading Mechanism**:

```typescript
if (args.configPath) {
	try {
		const customConfig = JSON.parse(fs.readFileSync(args.configPath, "utf-8"))
		Object.assign(config, customConfig)
	} catch (error) {
		console.warn(`Failed to load AI configuration: ${error}`)
	}
}
```

## Language and Exercise Management

### Supported Languages

**Language Constants**:

```typescript
export const exerciseLanguages = ["go", "java", "javascript", "python", "rust"] as const
export type ExerciseLanguage = (typeof exerciseLanguages)[number]
```

**Exercise Resolution**:

- External repository: `Roo-Code-Evals`
- Path resolution: `../../../../../evals`
- Directory-based exercise discovery
- Language-specific prompt files

### Test Command Configuration

**Per-Language Test Commands**:

```typescript
const testCommands: Record<ExerciseLanguage, { commands: string[] }> = {
	go: { commands: ["go test"] },
	java: { commands: ["./gradlew test"] },
	javascript: { commands: ["pnpm install --ignore-workspace", "pnpm test"] },
	python: { commands: ["uv run python3 -m pytest -o markers=task *_test.py"] },
	rust: { commands: ["cargo test"] },
}
```

**Test Execution**:

- Timeout: 2 minutes per test command
- Process tree termination for cleanup
- Sequential command execution per task
- Failure short-circuiting

## VS Code Integration

### Headless Execution

**VS Code Launch**:

```bash
xvfb-run -a env ROO_CODE_IPC_SOCKET_PATH="{socket}" code --disable-workspace-trust "{workspace}"
```

**Environment Setup**:

- Virtual display via Xvfb
- Workspace trust disabled for security
- IPC socket path injection
- Extension pre-installation

### IPC Communication Architecture

**Socket Management**:

- Unix socket per task: `/tmp/roo-code-ipc-{pid}.sock`
- Per-task sockets: `{dirname}/task-{taskId}.sock`
- Connection timeout: 30 seconds
- Graceful disconnection handling

**Message Flow**:

1. **Connection Establishment**: CLI waits for VS Code to connect
2. **Task Context Setting**: Confirmation-based context establishment
3. **Task Execution**: StartNewTask command with configuration
4. **Event Streaming**: Bidirectional progress updates
5. **Task Completion**: Cleanup and disconnection

**Key Message Types**:

```typescript
// Task context establishment
{
  type: IpcMessageType.TaskCommand,
  data: {
    commandName: TaskCommandName.SetTaskContext,
    data: {
      taskId: number,        // Database ID
      rooTaskId: string,     // Roo's internal ID
      runId: number,
      mcpServer: string,
      userIntent: string,
      otlpEndpoint: string
    }
  }
}

// Task execution
{
  type: IpcMessageType.TaskCommand,
  data: {
    commandName: TaskCommandName.StartNewTask,
    data: {
      configuration: RooCodeSettings,
      text: string,          // Exercise prompt
      newTab: boolean
    }
  }
}
```

### Workspace Management

**Git Operations**:

```bash
# Clean workspace setup
git config user.name "Roo Code"
git config user.email "support@roocode.com"
git checkout -f
git clean -fd
git checkout -b runs/{runId}-{uuid} main

# Post-evaluation commit
git add .
git commit -m "Run #{runId}" --no-verify
```

**Exercise Structure**:

- Base path: `/evals/{language}/{exercise}`
- Prompt injection: `.roo/system-prompt-code` (optional)
- Workspace-level VS Code configuration

## OpenTelemetry Integration

### Initialization

**OTEL Setup**:

```typescript
const otel = await initializeOpenTelemetry({
	debug: process.env.OTEL_LOG_LEVEL === "debug",
	env: process.env.NODE_ENV || "development",
})
```

**Components**:

- Automatic port discovery (starting from 4318)
- McpBenchmarkProcessor integration
- AI-enhanced processing (when enabled)
- Graceful shutdown coordination

### Task Context Injection

**Context Setting**:

```typescript
// Register mapping between Roo's task ID and database ID
otel.mcpProcessor.registerTaskIdMapping(rooTaskId, task.id)

// Provide OTLP endpoint to VS Code extension
{
	data: {
		otlpEndpoint: `http://localhost:${otel.port}`
	}
}
```

**Span Processing**:

- MCP spans filtered by server name
- Task ID mapping for database correlation
- Performance metrics calculation
- AI processing integration

## Concurrent Execution

### Task Scheduling

**Concurrency Management**:

```typescript
const runningPromises: TaskPromise[] = []
const TASK_START_DELAY = 10_000 // 10 seconds between starts

for (const task of tasks) {
	const promise = processTask(run.id, task, delay)
	delay += TASK_START_DELAY
	runningPromises.push(promise)

	if (runningPromises.length >= run.concurrency) {
		delay = 0
		await Promise.race(runningPromises) // Wait for any to complete
	}
}
```

**Resource Management**:

- Staggered task starts to prevent resource contention
- Configurable concurrency limits
- Promise-based completion tracking
- Automatic cleanup on completion

### Error Handling

**Timeout Management**:

- Task timeout: 5 minutes
- Unit test timeout: 2 minutes
- IPC connection timeout: 30 seconds
- Process cleanup with signal handling

**Failure Recovery**:

- Graceful task cancellation
- Process tree termination
- Socket cleanup
- Database state consistency

## Performance Monitoring

### Task Metrics Collection

**Timing Tracking**:

```typescript
// Task lifecycle timing
taskStartedAt = Date.now()
const duration = Date.now() - taskStartedAt

// Metrics update
await updateTaskMetrics(taskMetricsId, {
	cost: totalCost,
	tokensIn: totalTokensIn,
	tokensOut: totalTokensOut,
	duration,
	toolUsage,
})
```

**Event-Driven Updates**:

- `TaskStarted`: Initialize metrics
- `TaskTokenUsageUpdated`: Update token counts
- `TaskCompleted`: Finalize metrics
- `TaskToolFailed`: Record error details

### System Resource Usage

**Process Monitoring**:

- VS Code process detection
- Socket file existence verification
- Environment variable validation
- Resource cleanup verification

**Debugging Support**:

- Process tree inspection
- VS Code version checking
- Socket connectivity testing
- Detailed error logging

## Extensibility Points

### Custom Model Support

**Model Configuration**:

```typescript
const run = await createRun({
	model,
	settings: {
		apiProvider: "openrouter",
		openRouterModelId: model,
		// Additional provider-specific settings
	},
})
```

**Provider Integration**:

- OpenRouter model selection
- API key injection via environment
- Provider-specific configuration options

### Custom Exercise Sets

**Exercise Discovery**:

```typescript
const exercises = await getExercisesForLanguage(language)
// Returns directory-based exercise list
```

**Extension Opportunities**:

- Custom exercise repositories
- Exercise filtering by difficulty
- Tag-based exercise selection
- Custom prompt templates

### AI Integration Hooks

**Observer Integration**:

```typescript
if (aiIntegration?.isEnabled()) {
	await aiIntegration.startObserverSession(run.id, observerLevel, steeringMode, insightsConfig)
	// Enhanced benchmark processor with AI integration
	const enhancedProcessor = new McpBenchmarkProcessor(db, aiIntegration)
}
```

**Report Generation**:

```typescript
const aiReport = await aiIntegration.generateAIReport(run.id)
// Comprehensive insights, recommendations, and anomaly detection
```

## Environment Configuration

### Required Environment Variables

**Database Connection**:

- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: Environment classification

**API Configuration**:

- `OPENROUTER_API_KEY`: OpenRouter API access

**Optional Configuration**:

- `ROO_CODE_IPC_SOCKET_PATH`: Override default socket path
- `FOOTGUN_SYSTEM_PROMPT`: Inject custom system prompt
- `VSCODE_PATH`: Custom VS Code executable path
- `OTEL_*`: OpenTelemetry configuration variables

### Development Support

**Debug Features**:

- Verbose logging with `--log trace`
- Process output piping for debugging
- Socket and process monitoring
- Error reproduction capabilities

**Testing Support**:

- Test database configuration
- Isolated test environments
- Mock data generation
- Unit test integration

This CLI system provides a robust, flexible foundation for MCP server evaluation with comprehensive configuration options, concurrent execution capabilities, and optional AI-native features while maintaining simplicity for basic use cases.
