# /debug-parity

## Variables

ENVIRONMENT_NAME: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `sw_vers && uname -a`
RUN `node --version 2>/dev/null || python --version 2>/dev/null || go version 2>/dev/null`
RUN `env | grep -E "(NODE_ENV|ENVIRONMENT|STAGE)" | sort`

## Instructions

**Beginning State**: Environments have drifted apart causing inconsistent behavior

Detect hidden drift between dev, staging, and prod:

1. **Print env vars & versions** at app start-up:
    ```bash
    NODE_ENV=production
    APP_VERSION=1.4.2
    POSTGRES=16.2
    ```
2. **Collect the same dump** from failing and working environments
3. **Use a checklist**: macOS version, runtime, feature flags, brew packages
4. **Sync divergent items**; rerun repro
5. **Verify parity** by confirming environments now behave identically
6. **Automate parity check** in CI to prevent regressions

**End State**: All environments are aligned and drift detection is automated
