# /debug-instrument

## Variables

HOTSPOT_LOCATION: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `grep -r "metric\|counter\|timer" --include="*.{js,py,go}" | head -10`

## Instructions

**Beginning State**: Bug only appears in production or long-running systems, not in local testing

Catch bugs that only appear in long-running or production systems:

1. **Add counters/timers** (OpenTelemetry, Prometheus) at suspected hotspots
2. **Deploy behind feature flag**; let prod traffic flow
3. **Visualize metrics dashboard**; look for spikes, gaps, or divergences
4. **Correlate anomalies** with logs/trace IDs to pinpoint root cause
5. **Verify the instrumentation** captured the problematic behavior patterns
6. **Remove temporary probes** or drop to DEBUG level

**End State**: Production behavior is visible through metrics and root cause identified
