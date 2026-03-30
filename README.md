# contextual

**Operating system for context-aware AI design**

Contextual gives AI design agents the context behind the pixels. It helps designers organize research, taste, strategy, stakeholder input, and design-system knowledge before the first prototype, then guide refinement with structured annotation passes and agent actions.

Instead of prompting from zero every time, Contextual makes project knowledge persistent, reusable, and legible to agents. The result is better first outputs, fewer iteration loops, and a growing record of how design decisions were made.

## What It Does

- Organizes project context before the first prototype through a browser-based context manager
- Lets designers annotate prototypes with structured instructions and `@source[instruction]` actions
- Persists local context, pass history, and supporting artifacts so project knowledge compounds over time
- Supports a local-first workflow built for AI-assisted design iteration

## Repository

- `packages/shared` — shared types and contracts
- `packages/server` — local context server for indexing, search, and prompt support
- `packages/react` — annotation component for in-browser refinement
- `packages/context-manager` — browser app for setup, imports, and handoff creation
- `packages/demo` — local sandbox for trying the flows end-to-end

## Current Status

This repo is under active development. The monorepo foundation, local context server, context manager app, and annotation component are in place, with current work focused on the Gate 1 Instruct flow and persisted pass history.

## Development

```bash
npm install
npm run build
npm run typecheck
```

Package-specific commands can be run with `--workspace`, for example:

```bash
npm run dev --workspace=@contextual/context-manager
npm run dev --workspace=@contextual/react
npm run dev:server
```
