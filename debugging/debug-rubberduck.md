# /debug-rubberduck

## Variables

CODE_PATH: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `cat ${CODE_PATH} | head -50`

## Instructions

**Beginning State**: Logic seems correct but bug persists, need fresh perspective

Surface hidden assumptions by verbalizing logic:

1. **Explain the failing code path** line-by-line to a rubber duck (or teammate)
2. **When you hit a line you can't justify**, mark it
3. **If stuck**, let the listener ask "why?" until clarity emerges
4. **Capture insight** as a comment or unit test
5. **Verify the explanation** revealed the flawed assumption or logic error
6. **Thank the duck**; commit the fix

**End State**: Hidden assumptions are exposed and logic errors identified
