CREATE TABLE "mcp_retrieval_benchmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"task_id" integer NOT NULL,
	"mcp_server_name" text NOT NULL,
	"user_intent" text NOT NULL,
	"total_steps" integer NOT NULL,
	"code_execution_success" boolean,
	"error_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_retrieval_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"benchmark_id" integer NOT NULL,
	"step_number" integer NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb NOT NULL,
	"response_size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_retrieval_benchmarks" ADD CONSTRAINT "mcp_retrieval_benchmarks_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_retrieval_benchmarks" ADD CONSTRAINT "mcp_retrieval_benchmarks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_retrieval_calls" ADD CONSTRAINT "mcp_retrieval_calls_benchmark_id_mcp_retrieval_benchmarks_id_fk" FOREIGN KEY ("benchmark_id") REFERENCES "public"."mcp_retrieval_benchmarks"("id") ON DELETE no action ON UPDATE no action;