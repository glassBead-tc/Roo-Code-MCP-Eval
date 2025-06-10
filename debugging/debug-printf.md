# /debug-printf

## Variables

SUSPECT_LOCATION: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `grep -n "console\|log\|print" ${SUSPECT_LOCATION} | head -10`

## Instructions

**Beginning State**: Bug location is suspected but internal state is invisible

Expose internal state with minimal overhead:

1. **Identify one branch/loop** where the bug might hide
2. **Insert one log line** with a distinctive tag:
    ```javascript
    console.debug("[BUG-hunt] userId=%s cartTotal=%d", userId, total)
    ```
3. **Re-run the repro**; scan logs with `grep BUG-hunt`
4. **Refine logs** (add/remove fields) until anomaly is obvious
5. **Verify the debug output** shows the exact moment state becomes incorrect
6. **Remove or lower to TRACE** before merging

**End State**: Internal state is visible and bug location is narrowed down
