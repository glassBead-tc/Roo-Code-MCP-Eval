CREATE TABLE "mcp_connection_events" (
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
--> statement-breakpoint
CREATE TABLE "mcp_resource_events" (
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
--> statement-breakpoint
ALTER TABLE "mcp_retrieval_calls" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "mcp_retrieval_calls" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "mcp_retrieval_calls" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "mcp_retrieval_calls" ADD COLUMN "timeout_ms" integer;--> statement-breakpoint
ALTER TABLE "mcp_connection_events" ADD CONSTRAINT "mcp_connection_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_connection_events" ADD CONSTRAINT "mcp_connection_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_resource_events" ADD CONSTRAINT "mcp_resource_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_resource_events" ADD CONSTRAINT "mcp_resource_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;