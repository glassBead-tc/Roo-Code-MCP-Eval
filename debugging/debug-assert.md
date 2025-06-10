# /debug-assert

## Variables

INVARIANT_DESCRIPTION: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `grep -n "assert\|require\|expect" . -r | head -10`

## Instructions

**Beginning State**: Bug manifests far from where corruption actually occurs

Fail fast at the real point of corruption:

1. **Identify invariants** ("index within bounds", "total ≥ 0")
2. **Add language assertion** or explicit guard:
    ```python
    assert 0 <= idx < len(arr), f"idx={idx} out of range"
    ```
3. **Run full test suite**; ensure new assertion fires in failing scenario
4. **Verify the assertions** catch corruption at the exact moment it happens
5. **Keep assertions in dev/staging**; compile out in prod if performance-critical

**End State**: Corruption is caught immediately when it occurs, not when symptoms appear
