# OpenTelemetry Implementation Research Workflow

A comprehensive MCP workflow to research OpenTelemetry implementation patterns.

## Workflow Steps

```
# 1. Search for OpenTelemetry best practices
$web_search = mcp__exa__web_search_exa(
  query="OpenTelemetry Node.js TypeScript implementation best practices 2024",
  numResults=10
)

# 2. Get official documentation in parallel
=> $otel_docs = mcp__context7__resolve-library-id(libraryName="@opentelemetry/api")
=> $otel_sdk = mcp__context7__resolve-library-id(libraryName="@opentelemetry/sdk-node")
=> $otel_http = mcp__context7__resolve-library-id(libraryName="@opentelemetry/exporter-trace-otlp-http")

# 3. Fetch detailed docs if found
? $otel_docs.found -> $api_details = mcp__context7__get-library-docs(
  context7CompatibleLibraryID=$otel_docs.id,
  topic="tracing",
  tokens=5000
)

# 4. Search GitHub for real implementations
=> $github_impl = mcp__github__search_code(
  q="@opentelemetry/api trace TypeScript language:typescript",
  perPage=20
)
=> $github_export = mcp__github__search_code(
  q="OTLPTraceExporter TypeScript language:typescript",
  perPage=20
)

# 5. Scrape top web results for detailed examples
@ url in $web_search.results[0:3].url {
  $scraped[] = mcp__firecrawl-mcp__firecrawl_scrape(
    url=$url,
    formats=["markdown"],
    onlyMainContent=true
  )
}

# 6. Extract specific patterns from scraped content
$patterns = mcp__firecrawl-mcp__firecrawl_extract(
  urls=$web_search.results[0:5].url,
  prompt="Extract OpenTelemetry initialization code, span creation patterns, and error handling examples",
  schema={
    "type": "object",
    "properties": {
      "initialization": {"type": "array", "items": {"type": "string"}},
      "spanPatterns": {"type": "array", "items": {"type": "string"}},
      "errorHandling": {"type": "array", "items": {"type": "string"}}
    }
  }
)

# 7. Save findings to memory
-> mcp__mem0-mcp__add_coding_preference(
  text="""
  OpenTelemetry Implementation Research Results:

  ## Web Search Insights
  ${web_search.results[0:3].title.join('\n')}

  ## Official Documentation
  API Docs: ${api_details.summary || 'Not found'}

  ## GitHub Implementation Examples
  Found ${github_impl.total_count} TypeScript implementations
  Top repositories: ${github_impl.items[0:5].repository.full_name.join(', ')}

  ## Common Patterns
  ${patterns.initialization.join('\n')}

  ## Error Handling
  ${patterns.errorHandling.join('\n')}
  """
)

# 8. Generate implementation checklist
$checklist = mcp__firecrawl-mcp__firecrawl_deep_research(
  query="OpenTelemetry implementation checklist for Node.js production applications",
  maxDepth=2,
  maxUrls=20
)

# 9. Final summary
-> mcp__mem0-mcp__add_coding_preference(
  text="OpenTelemetry Implementation Checklist:\n${checklist.finalAnalysis}"
)
```

## Usage

This workflow will:

1. Search multiple sources for OpenTelemetry best practices
2. Fetch official documentation
3. Find real-world implementations on GitHub
4. Extract code patterns and examples
5. Save everything to memory for future reference

Run with: `/mcp-orchestrate .claude/workflows/otel-implementation-research.md`
