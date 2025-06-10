# Step 2: Build Project

Before running evaluations, all TypeScript packages need to be compiled and the VS Code extension needs to be packaged.

## Full Build Process

### 1. Install Dependencies

From the monorepo root:

```bash
# Install all dependencies
pnpm install

# Verify installation
pnpm list --depth=0
```

### 2. Build All Packages

```bash
# From monorepo root
pnpm build
```

This runs the build process for all packages in dependency order:

- `@roo-code/types` - Shared TypeScript types
- `@roo-code/ipc` - Inter-process communication
- `@roo-code/evals` - Evaluation system
- `roo-cline` - VS Code extension

### 3. Build VS Code Extension

The evaluation system needs the Roo Code extension to be built and packaged:

```bash
# From monorepo root
pnpm vsix

# This creates: bin/roo-code.vsix
ls -la bin/
```

## Verify Build Success

### Check Compiled Output

```bash
# Check evals package
ls packages/evals/dist/
# Should see: cli/, db/, benchmark/, telemetry/, etc.

# Check extension
ls src/dist/
# Should see: extension.js and related files
```

### Check for TypeScript Errors

```bash
# Run type checking
pnpm check-types

# Run linting (optional)
pnpm lint
```

## Build Artifacts

The build process creates:

1. **JavaScript files** - Compiled from TypeScript
2. **Source maps** - For debugging
3. **Type definitions** - `.d.ts` files
4. **VS Code extension** - `.vsix` package

### Key Build Outputs for MCP Evaluation

- `packages/evals/dist/cli/index.js` - Main CLI entry point
- `packages/evals/dist/benchmark/McpBenchmarkProcessor.js` - MCP telemetry processor
- `packages/evals/dist/telemetry/` - OpenTelemetry providers
- `bin/roo-code.vsix` - Packaged VS Code extension

## Troubleshooting Build Issues

### Missing Dependencies

```bash
# Clean and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript Errors

If you encounter TypeScript errors:

1. **Check Node version**:

    ```bash
    node --version  # Should be v20.19.2
    ```

2. **Clean build artifacts**:

    ```bash
    pnpm clean
    rm -rf packages/*/dist
    ```

3. **Rebuild specific package**:
    ```bash
    # Build only evals package
    pnpm --filter @roo-code/evals build
    ```

### VSIX Build Failures

If the extension fails to build:

1. **Check for uncommitted changes**:

    ```bash
    git status
    ```

2. **Build extension separately**:

    ```bash
    cd src
    pnpm bundle
    pnpm package
    ```

3. **Use existing VSIX**:
   If you have a pre-built `.vsix` file, copy it to `bin/`:
    ```bash
    cp /path/to/roo-code.vsix bin/
    ```

## Incremental Builds

For faster development cycles:

```bash
# Watch mode for evals package
cd packages/evals
pnpm build --watch

# In another terminal, watch extension
cd src
pnpm watch:bundle
```

## Docker Build (Alternative)

If you're using Docker for evaluation:

```bash
cd packages/evals
docker build -t roo-code-evals .
```

The Dockerfile:

- Installs all dependencies
- Builds the project
- Installs the VS Code extension
- Sets up the evaluation environment

## Environment-Specific Builds

### Production Build

```bash
NODE_ENV=production pnpm build
```

### Debug Build

```bash
# Enable source maps and debug info
DEBUG=* pnpm build
```

## Next Steps

With the project built successfully, proceed to [Step 3: Configure MCP Servers](./03-configure-mcp-servers.md) to set up the MCP servers that will be tracked during evaluation.
