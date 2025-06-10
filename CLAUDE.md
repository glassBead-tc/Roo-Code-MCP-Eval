# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Prerequisites

- Node.js v20.19.2 (specified in engines)
- PNPM v10.8.1 (packageManager)

### Initial Setup

```bash
pnpm install
```

### Common Commands

```bash
# Development
pnpm build           # Build all packages
pnpm bundle         # Bundle the extension
pnpm vsix           # Create .vsix package in bin/
pnpm watch:bundle   # Watch mode for development
pnpm watch:tsc      # TypeScript watch mode

# Testing
pnpm test           # Run all tests (Jest and Vitest)
pnpm test -- [file] # Run specific test file
pnpm --filter @roo-code/vscode-e2e test:ci  # Run E2E tests

# Code Quality
pnpm lint          # Run ESLint
pnpm check-types   # TypeScript type checking
pnpm format        # Format with Prettier

# Cleanup
pnpm clean         # Clean build artifacts
```

### Installing Built Extension

```bash
pnpm vsix -- --out ../bin/roo-code.vsix && code --install-extension bin/roo-code.vsix
```

## Architecture Overview

### Monorepo Structure

- **Powered by**: PNPM workspaces + Turborepo
- **Main Extension**: `/src` - VS Code extension source
- **Webview UI**: `/webview-ui` - React-based UI
- **Packages**: `/packages` - Shared packages (@roo-code/\*)
- **Apps**: `/apps` - Supporting applications

### Core Components

#### Task System (`/src/core/task/Task.ts`)

- Central orchestrator for all AI interactions
- Manages conversation state, tool execution, and API communication
- Handles message streaming, token counting, and context management

#### Tool System (`/src/core/tools/`)

- Each tool is a separate module (e.g., `readFileTool.ts`, `writeToFileTool.ts`)
- Tools handle file operations, terminal commands, browser automation, and MCP
- Tool validation and repetition detection built-in

#### API Providers (`/src/api/providers/`)

- Multiple provider support: Anthropic, OpenAI, Bedrock, Vertex, etc.
- Base classes for easy provider extension
- Streaming and transform pipelines for responses

#### Webview Architecture

- **Provider**: `ClineProvider.ts` - Manages webview lifecycle
- **Message Handler**: Bidirectional communication with extension
- **React App**: Located in `/webview-ui/src`

#### MCP Integration (`/src/services/mcp/`)

- Model Context Protocol support for external tools
- McpHub manages connections and tool discovery
- McpServerManager handles server lifecycle

### Key Services

- **Terminal Management**: Custom terminal integration with shell detection
- **Browser Automation**: Puppeteer-based browser control
- **Code Indexing**: Vector-based code search (Qdrant)
- **Checkpoint System**: Task state persistence and recovery

### Configuration

- **Extension Settings**: VS Code configuration contributions
- **Custom Modes**: User-definable AI personas and capabilities
- **Provider Settings**: Flexible API configuration system

### Testing Strategy

- **Unit Tests**: Jest for Node.js code, Vitest for specific modules
- **E2E Tests**: VS Code extension test framework
- **Mocks**: Comprehensive mocks for VS Code APIs and external services

## Development Tips

### Running Locally

1. Press F5 in VS Code to launch Extension Development Host
2. Webview changes appear immediately
3. Extension changes require restart

### Key Files to Understand

- `/src/extension.ts` - Extension entry point
- `/src/core/webview/ClineProvider.ts` - Main webview controller
- `/src/core/prompts/system.ts` - System prompt generation
- `/src/api/providers/index.ts` - Provider registry

### Common Patterns

- Use `ContextProxy` for VS Code context access
- Tools return structured responses with status tracking
- All user-facing strings use i18n system
- Telemetry events follow consistent naming

## Rules and Guidelines

- Rule: the dates on some of the .md files are unreliable. you should use your git tool for accuracy on when a file was actually created.
