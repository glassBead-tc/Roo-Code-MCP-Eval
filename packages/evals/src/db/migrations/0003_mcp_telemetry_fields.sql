-- Add MCP telemetry fields to mcpRetrievalCalls
ALTER TABLE "mcp_retrieval_calls" ADD COLUMN "duration_ms" integer;
ALTER TABLE "mcp_retrieval_calls" ADD COLUMN "error_message" text;
ALTER TABLE "mcp_retrieval_calls" ADD COLUMN "source" text;
ALTER TABLE "mcp_retrieval_calls" ADD COLUMN "timeout_ms" integer;

-- Create MCP connection events table
CREATE TABLE IF NOT EXISTS "mcp_connection_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"task_id" integer,
	"server_name" text NOT NULL,
	"event_type" text NOT NULL,
	"source" text,
	"transport" text,
	"duration_ms" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create MCP resource events table
CREATE TABLE IF NOT EXISTS "mcp_resource_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"task_id" integer,
	"server_name" text NOT NULL,
	"uri" text NOT NULL,
	"event_type" text NOT NULL,
	"source" text,
	"duration_ms" integer,
	"response_size" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "mcp_connection_events" ADD CONSTRAINT "mcp_connection_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "mcp_connection_events" ADD CONSTRAINT "mcp_connection_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "mcp_resource_events" ADD CONSTRAINT "mcp_resource_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "mcp_resource_events" ADD CONSTRAINT "mcp_resource_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;