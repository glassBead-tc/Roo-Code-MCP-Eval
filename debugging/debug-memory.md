# /debug-memory

## Variables

PROCESS_NAME: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `ps aux | grep ${PROCESS_NAME} | head -5`
RUN `which leaks || echo "leaks tool not found"`

## Instructions

**Beginning State**: Application memory usage grows over time or crashes with out-of-memory

Find leaks causing slow creep or crashes:

1. **Reproduce leak scenario**; record PID with `ps aux | grep ${PROCESS_NAME}`
2. **Run macOS leak detection**: `leaks -atExit -- ./my_app` or `leaks $PID`
3. **Analyze report**; jump to stack traces of unfreed allocations
4. **Fix allocation/close logic**; ensure proper cleanup in destructors/finally blocks
5. **For web apps**, use browser devtools "Performance" → "Record" → look at heap graph
6. **Verify the fix** by running leak tool again to confirm zero leaks
7. **Document memory management patterns** for the team

**End State**: Memory leaks are eliminated and memory usage remains stable over time
