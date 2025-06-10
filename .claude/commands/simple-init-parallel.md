# Simple Init Parallel

Initialize three parallel git worktree directories for concurrent development of the Roo Code VS Code extension.

## Variables

FEATURE_NAME: $ARGUMENTS

## Execute these tasks

CREATE new directory 'trees/'

> Execute these steps in parallel for concurrency
> Use absolute paths for all commands

CREATE first worktree:

- RUN `git worktree add -b FEATURE_NAME-1 ./trees/FEATURE_NAME-1`
- COPY `.env` files if they exist in root or packages
- RUN `cd ./trees/FEATURE_NAME-1 && pnpm install`
- RUN `cd ./trees/FEATURE_NAME-1 && pnpm build`
- CONFIGURE for development instance 1

CREATE second worktree:

- RUN `git worktree add -b FEATURE_NAME-2 ./trees/FEATURE_NAME-2`
- COPY `.env` files if they exist in root or packages
- RUN `cd ./trees/FEATURE_NAME-2 && pnpm install`
- RUN `cd ./trees/FEATURE_NAME-2 && pnpm build`
- CONFIGURE for development instance 2

CREATE third worktree:

- RUN `git worktree add -b FEATURE_NAME-3 ./trees/FEATURE_NAME-3`
- COPY `.env` files if they exist in root or packages
- RUN `cd ./trees/FEATURE_NAME-3 && pnpm install`
- RUN `cd ./trees/FEATURE_NAME-3 && pnpm build`
- CONFIGURE for development instance 3
