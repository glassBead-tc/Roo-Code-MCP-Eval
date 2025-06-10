# /debug-interactive

## Variables

BREAKPOINT_LOCATION: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `grep -n "debugger\|breakpoint\|pdb" . -r | head -5`

## Instructions

**Beginning State**: Need to inspect variable values and execution flow in real-time

Pause execution and inspect memory step-by-step:

1. **Set breakpoint** just before the failure (`debugger;` in JS, `import pdb; pdb.set_trace()` in Python)
2. **Reproduce**; execution halts at breakpoint
3. **Inspect variables**: `print foo`, `locals`, `watch add(x,y)`
4. **Step through code**: `next` (step over) and `step` (step into) until state diverges from expectations
5. **Verify the inspection** captured the exact moment and variables where bug occurs
6. **Record findings** in issue tracker; clear breakpoints afterward

**End State**: Bug root cause identified through live variable inspection
