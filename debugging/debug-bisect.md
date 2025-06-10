# /debug-bisect

## Variables

GOOD_COMMIT: $ARGUMENTS
TEST_COMMAND: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `git log --oneline -10`
RUN `git bisect start HEAD ${GOOD_COMMIT}`

## Instructions

**Beginning State**: Bug exists but unknown when it was introduced or which code causes it

Cut the search space (code or input) in half repeatedly:

**Temporal (Git)**

1. `git bisect start HEAD good_commit`
2. Let Git check out midpoint; run repro
3. `git bisect good` or `git bisect bad`
4. Iterate until offending commit appears; read its diff

**Spatial (Code)**

1. Comment out or return half of a function
2. Re-run repro
3. Keep the half that fails; halve again
4. Stop when a single line flips pass ↔ fail
5. **Verify the bisection** by confirming the identified commit/line truly introduces the bug
6. **Document the exact change** that caused the regression

**End State**: Specific commit or code section that introduced the bug is identified
