# Step 8: Generate Reports

Use the autonomous analysis system to generate comprehensive reports on MCP usage patterns and evaluation results.

## Basic Report Generation

### Run Autonomous Analysis

```bash
cd packages/evals
pnpm tsx src/autonomous/cli/autonomous-analysis.ts
```

This will:

1. Load evaluation data from the database
2. Analyze patterns in MCP usage
3. Generate recommendations
4. Create a markdown report

### Specify Analysis Mode

```bash
# Analysis only (no changes)
pnpm tsx src/autonomous/cli/autonomous-analysis.ts --mode analysis

# With recommendations
pnpm tsx src/autonomous/cli/autonomous-analysis.ts --mode recommend

# Full autonomous mode (with safety checks)
pnpm tsx src/autonomous/cli/autonomous-analysis.ts --mode full
```

## Advanced Report Options

### Custom Report Configuration

Create a configuration file for tailored analysis:

```javascript
// mcp-report-config.js
module.exports = {
	// Focus areas
	analysis: {
		patterns: ["mcp_usage", "performance", "errors", "sequences"],
		metrics: ["duration", "response_size", "success_rate"],
		groupBy: ["language", "mcp_server", "exercise_difficulty"],
	},

	// Report sections
	sections: [
		"executive_summary",
		"mcp_adoption_analysis",
		"performance_metrics",
		"error_analysis",
		"usage_patterns",
		"recommendations",
	],

	// Thresholds for alerts
	thresholds: {
		error_rate: 0.05, // Alert if >5% errors
		slow_response: 5000, // Alert if >5s response
		large_response: 1048576, // Alert if >1MB response
	},
}
```

### Generate Custom Report

```bash
# Using config
pnpm tsx src/autonomous/cli/autonomous-analysis.ts \
  --config ./mcp-report-config.js \
  --output ./reports/mcp-analysis-$(date +%Y%m%d).md
```

## MCP-Specific Reports

### 1. MCP Performance Report

```bash
# Generate performance-focused report
pnpm tsx src/benchmark/generateReport.ts \
  --type performance \
  --run-id $(psql -U roo_code -d roo_code_evals -t -c "SELECT MAX(id) FROM runs")
```

### 2. Quality Assessment Report

```bash
# Assess quality of MCP usage
pnpm tsx src/benchmark/assessQuality.ts \
  --run-id $(psql -U roo_code -d roo_code_evals -t -c "SELECT MAX(id) FROM runs")
```

### 3. Comparative Analysis

```bash
# Compare multiple runs
pnpm tsx src/autonomous/cli/autonomous-analysis.ts \
  --compare-runs 1,2,3 \
  --output comparative-analysis.md
```

## Report Templates

### Executive Summary Template

```markdown
# MCP Evaluation Report - Executive Summary

**Run ID**: {{run_id}}  
**Date**: {{date}}  
**Model**: {{model}}

## Key Findings

- **MCP Adoption**: {{mcp_adoption_rate}}% of tasks used MCP tools
- **Most Used Server**: {{top_server}} ({{top_server_percentage}}%)
- **Average Response Time**: {{avg_response_time}}ms
- **Success Rate**: {{success_rate}}%

## Performance Highlights

{{performance_summary}}

## Recommendations

{{top_recommendations}}
```

### Detailed Analysis Sections

The autonomous system generates these sections:

1. **Pattern Analysis**

    - Common MCP usage sequences
    - Language-specific patterns
    - Tool combination insights

2. **Performance Metrics**

    - Response time distributions
    - Data transfer analysis
    - Bottleneck identification

3. **Error Analysis**

    - Failure patterns
    - Error categorization
    - Reliability metrics

4. **Optimization Opportunities**
    - Caching opportunities
    - Tool selection improvements
    - Parallel execution potential

## Interactive Report Generation

### CLI Interactive Mode

```bash
# Start interactive report builder
pnpm tsx src/autonomous/cli/autonomous-analysis.ts --interactive

# Prompts:
# > Select analysis type: [patterns/performance/errors/full]
# > Select grouping: [language/server/time]
# > Include visualizations? [y/n]
# > Output format: [markdown/html/pdf]
```

### Web-Based Reports

Start the web interface:

```bash
# Start web server
cd apps/web-evals
pnpm dev

# Open browser to http://localhost:3000
```

Features:

- Interactive dashboards
- Real-time filtering
- Export capabilities
- Visualization tools

## Automated Report Generation

### Scheduled Reports

```bash
# Create cron job for daily reports
crontab -e

# Add:
0 2 * * * cd /path/to/packages/evals && pnpm tsx src/autonomous/cli/autonomous-analysis.ts --output /reports/daily-$(date +\%Y\%m\%d).md
```

### CI/CD Integration

```yaml
# .github/workflows/mcp-report.yml
name: Generate MCP Report
on:
    workflow_run:
        workflows: ["Run Evaluation"]
        types: [completed]

jobs:
    report:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - name: Generate Report
              run: |
                  cd packages/evals
                  pnpm tsx src/autonomous/cli/autonomous-analysis.ts \
                    --output report.md
            - name: Upload Report
              uses: actions/upload-artifact@v3
              with:
                  name: mcp-evaluation-report
                  path: packages/evals/report.md
```

## Report Customization

### Add Custom Metrics

```typescript
// custom-metrics.ts
export function calculateCustomMetrics(data: any) {
	return {
		// MCP efficiency score
		efficiency: data.successful_calls / data.total_duration,

		// Tool diversity index
		diversity: new Set(data.mcp_servers).size / data.total_tasks,

		// Cost estimation
		estimated_cost: data.total_tokens * 0.00001,
	}
}
```

### Custom Visualizations

```python
# visualize_mcp.py
import matplotlib.pyplot as plt
import seaborn as sns
from sqlalchemy import create_engine
import pandas as pd

# Connect to database
engine = create_engine('postgresql://roo_code:password@localhost:5433/roo_code_evals')

# Load data
query = """
SELECT * FROM mcp_retrieval_calls
JOIN mcp_retrieval_benchmarks ON ...
"""
df = pd.read_sql(query, engine)

# Create visualizations
fig, axes = plt.subplots(2, 2, figsize=(12, 10))

# 1. Response time distribution
df['duration_ms'].hist(ax=axes[0,0], bins=50)
axes[0,0].set_title('MCP Response Time Distribution')

# 2. Server usage pie chart
df.groupby('mcp_server_name').size().plot.pie(ax=axes[0,1])

# 3. Time series of calls
df.groupby(pd.to_datetime(df['created_at']).dt.hour).size().plot(ax=axes[1,0])

# 4. Heatmap of language vs server
pd.crosstab(df['language'], df['mcp_server_name']).plot.imshow(ax=axes[1,1])

plt.savefig('mcp_analysis_dashboard.png')
```

## Report Distribution

### Email Reports

```bash
# Email report script
#!/bin/bash
REPORT_FILE="report-$(date +%Y%m%d).md"

# Generate report
pnpm tsx src/autonomous/cli/autonomous-analysis.ts --output $REPORT_FILE

# Convert to HTML
pandoc $REPORT_FILE -o report.html

# Email
mail -s "MCP Evaluation Report - $(date +%Y-%m-%d)" \
  -a report.html \
  team@example.com < $REPORT_FILE
```

### Slack Integration

```javascript
// Post report summary to Slack
const { WebClient } = require("@slack/web-api")
const fs = require("fs")

const slack = new WebClient(process.env.SLACK_TOKEN)

async function postReport(reportPath) {
	const report = fs.readFileSync(reportPath, "utf8")
	const summary = extractSummary(report)

	await slack.chat.postMessage({
		channel: "#mcp-evaluations",
		text: "New MCP Evaluation Report",
		blocks: [
			{
				type: "section",
				text: { type: "mrkdwn", text: summary },
			},
		],
	})
}
```

## Best Practices

1. **Regular Reporting**

    - Generate reports after each evaluation run
    - Compare trends over time
    - Track improvements

2. **Focus Areas**

    - Start with high-level summaries
    - Drill down into specific issues
    - Prioritize actionable insights

3. **Stakeholder Communication**

    - Tailor reports to audience
    - Include visualizations
    - Highlight key findings

4. **Continuous Improvement**
    - Use reports to identify optimization opportunities
    - Track the impact of changes
    - Iterate on report format based on feedback

## Summary

The autonomous analysis system provides powerful tools for understanding MCP usage patterns and generating actionable insights. Regular report generation helps track improvements and identify optimization opportunities in how AI agents use external tools.
