# Phase 1: Configuration & Core Fixes

## Overview

Clean up the OpenTelemetry MCP instrumentation to respect user settings and remove development artifacts that force tracing regardless of configuration.

## Objectives

1. Remove hard-coded overrides that force tracing enabled
2. Clean up test artifacts and manual trace blocks
3. Ensure tracing only runs when `telemetry.mcp.enabled` is true
4. Validate configuration flow from settings to instrumentation

## Current Issues

### Hard-coded Overrides

- Look for `|| true` or similar patterns that bypass user settings
- Check for environment variable overrides in development
- Ensure telemetry settings are properly propagated to MCP instrumentation

### Test Artifacts

- Remove manual test trace blocks that were added during development
- Clean up any console.log statements or debug output
- Remove temporary configuration files or test data

### Configuration Validation

- Verify the settings path: VS Code settings → Extension config → Telemetry client → MCP instrumentation
- Ensure proper fallback behavior when telemetry is disabled
- Check that span creation is properly gated behind enabled checks

## Key Files to Investigate

### Extension Configuration

- `src/extension/api.ts` - Extension-level telemetry setup
- Settings contributions in `package.json`
- Any telemetry initialization in `src/extension.ts`

### MCP Instrumentation

- `packages/evals/src/autonomous/mcp/telemetry-server.ts`
- MCP service files in `src/services/mcp/`
- Any OpenTelemetry setup files

### Settings Management

- Configuration classes that handle telemetry settings
- Provider settings that might override MCP telemetry

## Success Criteria

- [ ] No spans are created when `telemetry.mcp.enabled` is false
- [ ] All hard-coded overrides are removed
- [ ] Clean codebase with no development artifacts
- [ ] Settings flow is documented and validated

## Challenges & Considerations

### Backward Compatibility

- Ensure existing users aren't broken by configuration changes
- Maintain default settings that make sense for most users
- Consider migration path for any changed setting names

### Performance Impact

- Disabled telemetry should have zero performance overhead
- Avoid checking settings on every operation if possible
- Cache telemetry state to minimize lookup costs

### Error Handling

- Gracefully handle malformed or missing settings
- Provide clear feedback when telemetry is misconfigured
- Don't break MCP functionality when telemetry fails

## Implementation Strategy

### Step 1: Audit Current State

1. Search codebase for `|| true`, `force`, or similar override patterns
2. Identify all places where MCP telemetry is initialized
3. Map the configuration flow from VS Code settings to span creation

### Step 2: Clean Configuration

1. Remove hard-coded overrides
2. Ensure proper settings propagation
3. Add validation for telemetry configuration

### Step 3: Test Configuration States

1. Test with telemetry enabled
2. Test with telemetry disabled
3. Test with malformed configuration
4. Verify no spans are created when disabled

### Step 4: Documentation

1. Document the settings flow
2. Update any configuration examples
3. Ensure CLAUDE.md reflects correct testing procedures

## Risk Mitigation

- Test extensively with telemetry both enabled and disabled
- Verify MCP functionality is unaffected when telemetry is off
- Ensure no breaking changes to existing evaluation workflows
- Have rollback plan if configuration changes cause issues

## Dependencies

- Understanding of current VS Code settings system
- Knowledge of OpenTelemetry instrumentation patterns
- Access to MCP server configurations for testing
