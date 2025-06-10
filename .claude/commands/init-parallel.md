# Initialize parallel git worktree directories for MCP server development

## Variables

FEATURE_NAME: $ARGUMENTS
NUMBER_OF_PARALLEL_WORKTREES: $ARGUMENTS

## Execute these commands

> Execute the loop in parallel with the Batch and Task tool

- create a new dir `trees/`
- for i in NUMBER_OF_PARALLEL_WORKTREES
    - RUN `git worktree add -b FEATURE_NAME-i ./trees/FEATURE_NAME-i`
    - RUN `cd ./trees/FEATURE_NAME-i && npm install`
    - RUN `cd ./trees/FEATURE_NAME-i && npm run build`
    - UPDATE `./trees/FEATURE_NAME-i/.env` or configuration file:
        - Change the server port to `3000+(i)` to avoid conflicts
    - RUN `cat ./trees/FEATURE_NAME-i/.env` to verify the server port is set correctly
    - RUN `cd trees/FEATURE_NAME-i && git ls-files` to validate
- RUN `git worktree list` to verify all trees were created properly

## Development Mode

After initialization, run the server in each worktree:

- Navigate to each worktree directory
- Run `npm run dev` to start the server in development mode
- For watching TypeScript changes: `npm run watch` (if available)
- Test the server using appropriate API testing tools
