# AI-Native Evaluation Integration Guide

This guide explains how to use the new AI-native evaluation features that have been integrated into the existing MCP evaluation CLI infrastructure.

## Overview

The AI-native evaluation system enhances the existing evaluation infrastructure with:

- **Real-time AI observation** of evaluation telemetry and system health
- **Anomaly detection** and pattern recognition across evaluation runs
- **Intelligent steering recommendations** for optimizing evaluation performance
- **Persistent insights storage** for cross-evaluation learning
- **Autonomous analysis** capabilities for advanced users

## Backward Compatibility

**All existing evaluation workflows continue to work unchanged.** AI features are completely optional and disabled by default.

## Quick Start

### Enable Basic AI Observation

```bash
# Add basic AI observation to any existing evaluation command
pnpm run cli --ai-observer basic

# Example with model and language selection
pnpm run cli --model claude-3-5-haiku-20241022 --include javascript,python --ai-observer basic
```

### Enable Full AI Features

```bash
# Full AI observation with steering suggestions
pnpm run cli --ai-observer full --ai-steering suggest --ai-insights store

# Autonomous mode with automatic steering (advanced)
pnpm run cli --ai-observer autonomous --ai-steering auto --ai-insights realtime
```

## AI Observer Levels

### `--ai-observer basic`

- **Anomaly detection**: Identifies performance outliers and errors
- **Performance analysis**: Tracks evaluation metrics and trends
- **System health monitoring**: Monitors resource usage and container health
- **No steering**: Observation only, no recommendations

### `--ai-observer full`

- **All basic features** plus:
- **Pattern recognition**: Identifies recurring evaluation patterns
- **Steering recommendations**: Suggests performance optimizations
- **Advanced insights**: Provides actionable improvement recommendations

### `--ai-observer autonomous`

- **All full features** plus:
- **Autonomous analysis**: Continuous learning and adaptation
- **Predictive insights**: Forecasts potential issues before they occur
- **Cross-evaluation learning**: Learns from historical evaluation data

## AI Steering Modes

### `--ai-steering monitor-only`

- AI observes and analyzes but makes no recommendations
- Pure monitoring and data collection

### `--ai-steering suggest`

- AI provides steering recommendations that must be manually approved
- Recommendations appear in logs and final reports
- Safe for production use

### `--ai-steering auto`

- AI can automatically implement low-risk steering actions
- High-risk actions still require manual approval
- **Use with caution** - monitor first few runs carefully

## AI Insights Configuration

### `--ai-insights store`

- Stores AI insights in the database for persistence
- Enables cross-evaluation learning and trend analysis
- Recommended for production environments

### `--ai-insights export`

- Stores insights and periodically exports data for analysis
- Useful for research and development workflows

### `--ai-insights realtime`

- Provides real-time insights without persistent storage
- Minimal overhead, good for development testing

## Advanced Configuration

### Custom Configuration File

Create a custom AI configuration file:

```json
{
	"enabled": true,
	"observerConfig": {
		"features": {
			"anomalyDetection": true,
			"steeringRecommendations": true,
			"performanceAnalysis": true,
			"systemHealthMonitoring": true,
			"patternRecognition": true
		},
		"thresholds": {
			"performanceThreshold": 3000,
			"errorRateThreshold": 5,
			"resourceUsageThreshold": 75,
			"confidenceThreshold": 0.8
		},
		"analysis": {
			"windowSize": 100,
			"batchSize": 20,
			"updateInterval": 3000
		},
		"integration": {
			"persistInsights": true,
			"enableSteering": false,
			"autoImplementRecommendations": false
		}
	},
	"orchestratorConfig": {
		"enableAutonomousAnalysis": false,
		"enableSteeringRecommendations": true,
		"enableContinuousLearning": false,
		"dataExportInterval": 15
	},
	"persistenceConfig": {
		"enableInsightStorage": true,
		"enableRecommendationTracking": true,
		"batchInsertSize": 50
	}
}
```

Use with: `--ai-config path/to/ai-config.json`

## Example Workflows

### Development Testing

```bash
# Light AI observation for development
pnpm run cli --exercise two-fer --ai-observer basic
```

### Production Monitoring

```bash
# Comprehensive monitoring with insights storage
pnpm run cli --model claude-3-5-haiku-20241022 --ai-observer full --ai-steering suggest --ai-insights store
```

### Research & Analysis

```bash
# Full autonomous analysis with data export
pnpm run cli --ai-observer autonomous --ai-steering suggest --ai-insights export --ai-config research-config.json
```

### Existing Run Analysis

```bash
# Add AI analysis to an existing run
pnpm run cli --run-id 123 --ai-observer full --ai-insights store
```

## Understanding AI Reports

When AI features are enabled, evaluation runs include additional output:

```
AI Evaluation Report:
===================
Total Insights: 15
Average Confidence: 82.3%
Critical Issues: 2
Actionable Recommendations: 8

Key Insights:
1. Performance Degradation Detected (performance, 85% confidence)
   Token usage increased 23% in final 30% of tasks
2. Error Pattern Identified (reliability, 91% confidence)
   Network timeouts correlate with high concurrency periods
3. Resource Optimization Opportunity (efficiency, 78% confidence)
   Memory usage peaks suggest batch size adjustment needed
```

## Database Schema

AI features add several new tables to store insights:

- `ai_insights`: Stores AI-generated insights and recommendations
- `ai_steering_recommendations`: Tracks steering suggestions and their outcomes
- `ai_anomalies`: Records detected anomalies and their resolutions
- `ai_observer_sessions`: Tracks AI observation sessions per evaluation run

## Safety and Monitoring

### Safety Guidelines

1. **Start with basic observation** to understand AI behavior before enabling steering
2. **Monitor AI recommendations** carefully in the first few runs
3. **Use suggest mode** before enabling automatic steering
4. **Review AI confidence levels** - ignore low-confidence recommendations
5. **Keep human oversight** - AI complements, doesn't replace human judgment

### Monitoring AI Performance

1. **Check confidence levels** in reports - aim for >70% average confidence
2. **Review recommendation effectiveness** in database analytics
3. **Monitor resource impact** - AI should add <10% overhead
4. **Validate anomaly detection** against known issues

## Troubleshooting

### AI Features Not Working

1. Check that AI observer is enabled: `--ai-observer basic`
2. Verify database connection for insights storage
3. Check logs for initialization errors
4. Ensure OpenTelemetry is properly configured

### High Resource Usage

1. Reduce AI analysis window size in configuration
2. Disable features not needed (e.g., pattern recognition)
3. Use realtime insights instead of storage for lighter operation
4. Increase analysis batch size to reduce frequency

### Low Quality Insights

1. Increase confidence threshold in configuration
2. Run longer evaluations to provide more data for AI analysis
3. Check that MCP servers are providing quality telemetry data
4. Consider using custom configuration tuned for your workload

## Migration from Existing Workflows

All existing evaluation commands work unchanged. To gradually adopt AI features:

1. **Week 1**: Add `--ai-observer basic` to existing commands
2. **Week 2**: Enable insights storage with `--ai-insights store`
3. **Week 3**: Add steering suggestions with `--ai-steering suggest`
4. **Week 4**: Consider full AI features based on initial results

## Support and Feedback

The AI-native evaluation system is designed to enhance, not replace, existing evaluation workflows. All features are optional and can be disabled at any time.

For issues or questions:

1. Check the troubleshooting section above
2. Review AI confidence levels and recommendations in reports
3. Consider adjusting AI configuration thresholds
4. Disable AI features temporarily to isolate issues

## Performance Impact

Expected performance impact when AI features are enabled:

- **Basic observation**: <2% overhead
- **Full observation**: 3-5% overhead
- **Autonomous mode**: 5-10% overhead

The AI system is designed to have minimal impact on evaluation performance while providing valuable insights for optimization.
