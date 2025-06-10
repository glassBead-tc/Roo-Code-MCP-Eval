# /debug-loglevel

## Variables

SERVICE_NAME: $ARGUMENTS
LOG_LEVEL: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `env | grep -i log | sort`
RUN `grep -r "LOG_LEVEL\|logLevel" --include="*.{json,yaml,env}" | head -10`

## Instructions

**Beginning State**: Production bug needs more context but redeployment takes too long

Gather extra context without redeploying:

1. **Ship structured logs** with levels (INFO, DEBUG, TRACE)
2. **Expose log level** via env var or feature flag (`LOG_LEVEL=debug`)
3. **When bug surfaces in prod**, flip level to DEBUG for the affected service only
4. **Collect logs** for the next few requests; revert to INFO to reduce noise
5. **Analyze new data** and correlate with the bug occurrence
6. **Verify the additional logging** provided the missing context needed for diagnosis
7. **Commit a permanent fix** plus strategic debug logs for future issues

**End State**: Production debugging capability exists without requiring redeployment
