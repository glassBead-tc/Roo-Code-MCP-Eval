# /debug-reproduce

## Variables

FAILING_INPUT: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `mkdir -p tests/bugs`
RUN `echo "${FAILING_INPUT}" > /tmp/failing_input.txt`

## Instructions

**Beginning State**: Bug occurs inconsistently or only in specific conditions

Create a deterministic, quick-running test case that triggers the bug every time:

1. **Capture failing input** (API request, CLI args, file, etc.)
2. **Strip to minimum viable repro** — remove anything not needed to break
3. **Automate it**:
    ```bash
    # example
    echo "$JSON" | jq . > /tmp/failing.json
    ./my_app /tmp/failing.json           # <10 s runtime
    ```
4. **Commit as a unit test** or shell script in `tests/bugs/BUG-1234.sh`
5. **Verify the reproduction** by running the script twice to confirm it always fails
6. **Document the repro** for team use and future debugging

**End State**: Reliable reproduction case exists that can trigger the bug on demand
