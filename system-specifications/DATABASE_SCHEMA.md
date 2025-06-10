# Database Schema Architecture

## Overview

The Roo Code evaluation system uses PostgreSQL with Drizzle ORM for data persistence. The schema is designed to capture comprehensive evaluation metrics, MCP server interactions, and AI-generated insights while maintaining referential integrity and query performance.

## Core Evaluation Tables

### 1. Runs Table

**Purpose**: Top-level evaluation run management.

```sql
CREATE TABLE runs (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  task_metrics_id INTEGER REFERENCES taskMetrics(id),
  model TEXT NOT NULL,
  mcp_server TEXT,
  description TEXT,
  settings JSONB,  -- RooCodeSettings type
  pid INTEGER,
  socket_path TEXT NOT NULL,
  concurrency INTEGER DEFAULT 2 NOT NULL,
  passed INTEGER DEFAULT 0 NOT NULL,
  failed INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```

**Key Fields**:

- `model`: AI model identifier (e.g., "claude-3-5-haiku-20241022")
- `settings`: JSON configuration including API provider settings
- `socket_path`: Unix socket path for IPC communication
- `concurrency`: Number of parallel task executions
- `task_metrics_id`: Aggregated metrics reference (populated on completion)

### 2. Tasks Table

**Purpose**: Individual evaluation task tracking.

```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  run_id INTEGER REFERENCES runs(id) NOT NULL,
  task_metrics_id INTEGER REFERENCES taskMetrics(id),
  language TEXT NOT NULL,  -- ExerciseLanguage type
  exercise TEXT NOT NULL,
  passed BOOLEAN,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL
);

-- Unique constraint on run/language/exercise combination
CREATE UNIQUE INDEX tasks_language_exercise_idx
ON tasks(run_id, language, exercise);
```

**Key Fields**:

- `language`: Programming language (go|java|javascript|python|rust)
- `exercise`: Exercise name from Roo-Code-Evals repository
- `passed`: Unit test success status (NULL while running)
- `task_metrics_id`: Performance metrics reference

### 3. Task Metrics Table

**Purpose**: Performance and cost tracking for tasks and runs.

```sql
CREATE TABLE taskMetrics (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  tokens_context INTEGER NOT NULL,
  cache_writes INTEGER NOT NULL,
  cache_reads INTEGER NOT NULL,
  cost REAL NOT NULL,
  duration INTEGER NOT NULL,  -- milliseconds
  tool_usage JSONB,  -- ToolUsage type
  created_at TIMESTAMP NOT NULL
);
```

**Key Fields**:

- Token counters for LLM usage tracking
- Cache utilization metrics
- Cost calculation in monetary units
- Duration in milliseconds
- `tool_usage`: JSON object with tool-specific attempt/failure counts

### 4. Tool Errors Table

**Purpose**: Error tracking for debugging and reliability analysis.

```sql
CREATE TABLE toolErrors (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  run_id INTEGER REFERENCES runs(id),
  task_id INTEGER REFERENCES tasks(id),
  tool_name TEXT NOT NULL,  -- ToolName type
  error TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```

## MCP Telemetry Tables

### 1. MCP Retrieval Benchmarks

**Purpose**: High-level MCP server interaction tracking per task.

```sql
CREATE TABLE mcp_retrieval_benchmarks (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES runs(id) NOT NULL,
  task_id INTEGER REFERENCES tasks(id) NOT NULL,
  mcp_server_name TEXT NOT NULL,
  user_intent TEXT NOT NULL,
  total_steps INTEGER NOT NULL,
  code_execution_success BOOLEAN,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Key Fields**:

- `mcp_server_name`: Server identifier (e.g., "exa", "firecrawl")
- `user_intent`: Exercise or task description
- `total_steps`: Number of MCP calls made during task
- `code_execution_success`: Final task outcome

### 2. MCP Retrieval Calls

**Purpose**: Detailed MCP operation logging with request/response data.

```sql
CREATE TABLE mcp_retrieval_calls (
  id SERIAL PRIMARY KEY,
  benchmark_id INTEGER REFERENCES mcp_retrieval_benchmarks(id) NOT NULL,
  step_number INTEGER NOT NULL,
  request JSONB NOT NULL,
  response JSONB NOT NULL,
  response_size INTEGER NOT NULL,
  duration_ms INTEGER,
  error_message TEXT,
  source TEXT,  -- 'global' or 'project'
  timeout_ms INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Key Fields**:

- `step_number`: Sequential step within benchmark
- `request`/`response`: Full MCP call data as JSON
- `response_size`: Payload size in bytes
- `duration_ms`: Call latency from OpenTelemetry spans
- `source`: MCP server configuration source

### 3. MCP Connection Events

**Purpose**: Connection lifecycle and reliability tracking.

```sql
CREATE TABLE mcp_connection_events (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES runs(id) NOT NULL,
  task_id INTEGER REFERENCES tasks(id),
  server_name TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'start', 'established', 'error'
  source TEXT,  -- 'global' or 'project'
  transport TEXT,  -- transport type used
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 4. MCP Resource Events

**Purpose**: Resource access pattern tracking.

```sql
CREATE TABLE mcp_resource_events (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES runs(id) NOT NULL,
  task_id INTEGER REFERENCES tasks(id),
  server_name TEXT NOT NULL,
  uri TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'start', 'success', 'error'
  source TEXT,  -- 'global' or 'project'
  duration_ms INTEGER,
  response_size INTEGER,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## AI Analysis Tables

### 1. AI Insights

**Purpose**: Machine-generated analysis and recommendations.

```sql
CREATE TABLE ai_insights (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES runs(id) NOT NULL,
  task_id INTEGER REFERENCES tasks(id),
  category TEXT NOT NULL,  -- 'performance', 'quality', 'efficiency', 'reliability'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence REAL NOT NULL,  -- 0.0 to 1.0
  severity TEXT NOT NULL,  -- 'info', 'warning', 'error', 'critical'
  evidence JSONB NOT NULL,  -- string[]
  recommendations JSONB NOT NULL,  -- string[]
  context_snapshot JSONB,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  action_taken TEXT
);
```

**Key Fields**:

- `confidence`: AI confidence score (0.0-1.0)
- `evidence`: Supporting data points
- `recommendations`: Actionable suggestions
- `context_snapshot`: Evaluation state when detected

### 2. AI Steering Recommendations

**Purpose**: AI-generated operational recommendations.

```sql
CREATE TABLE ai_steering_recommendations (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES runs(id) NOT NULL,
  task_id INTEGER REFERENCES tasks(id),
  type TEXT NOT NULL,  -- 'pause_task', 'adjust_concurrency', 'switch_server', etc.
  priority TEXT NOT NULL,  -- 'low', 'medium', 'high', 'critical'
  description TEXT NOT NULL,
  expected_impact TEXT NOT NULL,
  confidence REAL NOT NULL,
  parameters JSONB,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'applied', 'ignored', 'failed'
  applied_at TIMESTAMP,
  applied_by TEXT,  -- 'human', 'auto'
  outcome TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Workflow**:

1. AI generates recommendation with confidence score
2. System or human applies recommendation
3. Outcome tracked for learning feedback

### 3. AI Anomalies

**Purpose**: Automated anomaly detection and alerting.

```sql
CREATE TABLE ai_anomalies (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES runs(id) NOT NULL,
  task_id INTEGER REFERENCES tasks(id),
  type TEXT NOT NULL,  -- 'performance', 'error', 'resource', 'pattern'
  severity TEXT NOT NULL,  -- 'low', 'medium', 'high', 'critical'
  description TEXT NOT NULL,
  confidence REAL NOT NULL,
  detected_value REAL,
  expected_value REAL,
  threshold REAL,
  context JSONB,
  suggested_action TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolution_note TEXT,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Detection Types**:

- Performance degradation
- Error rate spikes
- Resource exhaustion
- Behavioral pattern changes

### 4. AI Observer Sessions

**Purpose**: AI observation session management and metrics.

```sql
CREATE TABLE ai_observer_sessions (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES runs(id) NOT NULL,
  observer_level TEXT NOT NULL,  -- 'basic', 'full', 'autonomous'
  steering_mode TEXT,  -- 'monitor-only', 'suggest', 'auto'
  insights_config TEXT,  -- 'store', 'export', 'realtime'
  configuration JSONB,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'completed', 'failed'
  total_insights INTEGER DEFAULT 0,
  total_anomalies INTEGER DEFAULT 0,
  total_recommendations INTEGER DEFAULT 0,
  average_confidence REAL
);
```

## Database Queries Layer

### Query Organization (`src/db/queries/`)

**Module Structure**:

- `runs.ts`: Run CRUD operations and aggregation
- `tasks.ts`: Task management and metrics
- `taskMetrics.ts`: Performance data operations
- `errors.ts`: Error handling and custom exceptions
- `toolErrors.ts`: Tool error tracking
- `aiInsights.ts`: AI analysis data operations

### Key Query Patterns

#### Run Completion Aggregation

```typescript
// From runs.ts - finishRun()
const aggregatedMetrics = await db
	.select({
		tokensIn: sum(schema.taskMetrics.tokensIn),
		tokensOut: sum(schema.taskMetrics.tokensOut),
		cost: sum(schema.taskMetrics.cost),
		passed: sql`sum(CASE WHEN ${schema.tasks.passed} THEN 1 ELSE 0 END)`,
		failed: sql`sum(CASE WHEN ${schema.tasks.passed} THEN 0 ELSE 1 END)`,
	})
	.from(schema.taskMetrics)
	.innerJoin(schema.tasks, eq(schema.taskMetrics.id, schema.tasks.taskMetricsId))
	.where(eq(schema.tasks.runId, runId))
```

#### MCP Benchmark Processing

```typescript
// Benchmark creation with returned ID
const benchmarkId = await db
	.insert(mcpRetrievalBenchmarks)
	.values({
		runId,
		taskId,
		mcpServerName,
		userIntent,
		totalSteps: 0,
	})
	.returning({ id: mcpRetrievalBenchmarks.id })

// MCP call logging
await db.insert(mcpRetrievalCalls).values({
	benchmarkId,
	stepNumber,
	request,
	response,
	responseSize,
})
```

#### AI Insights Summary

```typescript
// AI insights aggregation (aiInsights.ts)
const summary = await db
  .select({
    totalInsights: count(),
    avgConfidence: avg(aiInsights.confidence),
    criticalInsights: sum(case().when(eq(aiInsights.severity, 'critical'), 1).else(0))
  })
  .from(aiInsights)
  .where(eq(aiInsights.runId, runId))
```

## Migration System

### Drizzle Configuration

**Migration Management**: Automated schema versioning with Drizzle Kit.

**Current Migrations** (`src/db/migrations/`):

- `0000_young_trauma.sql`: Initial schema
- `0001_living_mariko_yashida.sql`: MCP tables addition
- `0002_fearless_wild_child.sql`: AI tables addition
- `0003_mcp_telemetry_fields.sql`: MCP telemetry enhancements

**Migration Commands**:

```bash
pnpm db:generate    # Generate new migration
pnpm db:migrate     # Apply migrations
pnpm db:push        # Push schema changes (development)
pnpm db:check       # Validate schema consistency
```

### Environment Management

**Database URLs**:

- Development: `postgres://postgres:password@localhost:5432/evals_development`
- Test: `postgres://postgres:password@localhost:5432/evals_test`
- Docker: `postgres://postgres:password@postgres:5432/evals_development`

**Configuration Files**:

- `.env.development`: Development database configuration
- `.env.test`: Test database configuration
- `docker-compose.yml`: Container database setup

## Performance Considerations

### Indexing Strategy

**Existing Indexes**:

- Primary keys on all tables (auto-generated)
- Unique constraint on `tasks(run_id, language, exercise)`
- Foreign key indexes (automatic)

**Recommended Additional Indexes**:

```sql
-- Query optimization for common access patterns
CREATE INDEX idx_tasks_run_passed ON tasks(run_id, passed);
CREATE INDEX idx_mcp_calls_benchmark_step ON mcp_retrieval_calls(benchmark_id, step_number);
CREATE INDEX idx_ai_insights_run_severity ON ai_insights(run_id, severity);
CREATE INDEX idx_ai_anomalies_run_type ON ai_anomalies(run_id, type, resolved);
```

### Data Retention

**Growth Patterns**:

- MCP calls scale with task complexity (~10-100 calls per task)
- AI insights grow with observation level (0-50 insights per task)
- Tool errors depend on stability (0-20 errors per task)

**Archival Strategy**:

- Completed runs can be archived after analysis
- Raw MCP call data suitable for compression
- AI insights retained for learning and pattern analysis

## Security and Access Control

### Connection Security

- PostgreSQL authentication with credentials
- Network isolation in Docker environment
- Connection pooling for resource management

### Data Privacy

- Request/response data stored as JSONB (may contain sensitive information)
- No built-in PII filtering (consideration for future implementation)
- Audit trail through timestamps and foreign keys

### Backup and Recovery

- Standard PostgreSQL backup procedures
- Volume persistence in Docker setup
- Schema recreation through migrations

This database schema provides comprehensive tracking of evaluation execution, MCP server performance, and AI-generated insights while maintaining data integrity and query performance for analytical workloads.
