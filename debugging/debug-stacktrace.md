# /debug-stacktrace

## Variables

ERROR_MESSAGE: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `git grep -n "${ERROR_MESSAGE}" | head -20`
RUN `find . -name "*.log" -type f -mtime -1 | head -5`

## Instructions

**Beginning State**: Application crashes or throws errors with unclear location

Find the exact file/line and error message before touching code:

1. **Run the program to failure**; copy the full stack trace
2. **Highlight the topmost frame** in your codebase (not dependencies)
3. **Grep the repo** for the error message: `git grep -n "Cannot read property"`
4. **Open the source file** and read three lines above and below the failing line
5. **Note variable names** and suspect data for later probing
6. **Verify the location** by adding a temporary log at the identified line
7. **Document findings** in issue tracker with exact file:line reference

**End State**: Exact source location of error is identified and confirmed
