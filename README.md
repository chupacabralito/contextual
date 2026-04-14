# contextual

**Local-first context and pass memory for repo-native agents.**

Contextual is a local-first sidecar for terminal agents (Claude Code, Codex) that gives your agent persistent memory across sessions. You organize research, strategy, and design-system knowledge into a local context corpus; the agent draws on it every time. Refinements you make in the browser are captured as structured passes that persist as repo-local artifacts, so the reasoning behind each decision survives beyond a single conversation.

The core insight: when you work through 10-20 refinement cycles with an agent, the accumulated understanding — why a layout changed, what constraints emerged, what research informed a choice — is the most valuable output. Contextual makes sure that understanding compounds instead of evaporating.

## Status

This repo is in **public alpha**.

Current alpha support:
- macOS
- Terminal.app
- Claude Code
- Node 20+

Pairing and auto-dispatch currently target Terminal.app only.

## How It Works

Contextual has three parts:

1. **Context manager** — a web UI for organizing your corpus: briefs, source material, compiled references, and project-scoped workflows.
2. **Local server** — indexes your context corpus with full-text search, persists passes and outcomes, resolves `@source[query]` mentions, and dispatches work to paired terminal tabs.
3. **React toolbar** (optional) — an in-browser overlay for pointing at UI elements, writing refinement instructions, and submitting passes without leaving the prototype.

The browser toolbar is optional. The core workflow is: context manager + Claude Code + repo-local artifacts.

## Key Concepts

### Context Root

A context root is a directory where all your project knowledge lives. It contains seven typed folders for organizing source material:

| Folder | Purpose |
|--------|---------|
| `research/` | User research, market analysis, competitive intel |
| `taste/` | Visual references, brand inspiration, style direction |
| `strategy/` | Product strategy, positioning, business goals |
| `design-system/` | Components, tokens, patterns, UI standards |
| `stakeholders/` | Stakeholder feedback, approval criteria, constraints |
| `technical/` | Architecture decisions, API specs, platform limits |
| `business/` | Business rules, compliance, operational constraints |

Each folder has a `_sources/` directory for raw files and a `compiled.md` that the server auto-generates by merging sources into a single indexed document. The server watches these files and reindexes on change.

### Passes

A pass is the atomic unit of work. In instruct mode, you target a UI element, write refinement instructions using `@source[query]` directives (e.g., `@research[checkout friction] @taste[stripe clarity]`), and submit. The pass is saved as a JSON artifact in the context root and auto-dispatched to the paired Claude Code terminal tab.

Passes persist. By pass 5-20, the agent has enough accumulated context to make connections between research findings and design decisions that would be impossible in a single session.

### Outcomes

After an agent executes a pass, the result is recorded as an outcome: approved, approved-with-feedback, rejected, or pending. Each instruction within a pass can be reviewed individually (looks-good or needs-another-pass). Outcomes can include learning drafts — distilled policy notes that get written back to the `learned/` folder for future sessions.

### Pairing

Pairing connects a Terminal.app tab (where Claude Code is running) to a context root. When a pass is submitted from the browser toolbar, the server uses AppleScript to dispatch the instructions directly into the paired terminal tab. This is the bridge between visual refinement in the browser and agent execution in the terminal.

### Learned Policy

The `learned/` folder accumulates durable lessons from completed passes:

- `operator-preferences/` — approval patterns, style preferences
- `ui-patterns/` — reusable UI decisions
- `tool-routing/` — which sources work for specific types of work
- `project-decisions/` — project-specific rules and constraints

This is how context compounds over time. Each session leaves behind knowledge that makes the next session better.

## Quick Start

### 1. Install and build

```bash
npm install
npm run build
```

### 2. Scaffold a context root

```bash
npm run contextual:scaffold -- --project-name my-context --base-path "$PWD"
```

This creates the full directory structure: seven context folders, `passes/`, `outcomes/`, `learned/` with subfolders, and a `brief.md`.

### 3. Start the server

```bash
npm run contextual:serve -- --context-root "$PWD/my-context" --port 4700
```

### 4. Start the context manager

In a second terminal:

```bash
npm run dev:context-manager
```

### 5. Pair your Claude Code terminal tab

In the Terminal.app tab where Claude Code is running:

```bash
npm run contextual:pair -- --context-root "$PWD/my-context"
```

### 6. Start working

Open the context manager, write your brief, add source material to the relevant context folders, and begin making passes.

If your repo has a browser UI, run it locally and use the Contextual toolbar to create passes visually by pointing at elements and writing instructions.

### One-Command Init (for existing projects)

If you have an existing Next.js or Vite+React project, `init` detects your framework, scaffolds a `.contextual/` directory, adds the toolbar dependency, and injects the overlay into your root layout:

```bash
npm run contextual:init -- --project-dir /path/to/my-app
```

### Keep Private Material Outside This Repo

For public alpha use, keep your personal strategy, research, notes, and local Contextual artifacts in a separate private folder or private repository, then point Contextual at that location:

```bash
npm run contextual:serve -- --context-root "/path/to/your-private-context"
npm run contextual:pair -- --context-root "/path/to/your-private-context"
```

## Daily Workflow

1. Open the repo in Claude Code.
2. Start the Contextual server.
3. Start the context manager.
4. Pair the Claude Code terminal tab.
5. Update the brief and add source material.
6. If there is a browser UI, make passes there.
7. Review outcomes and keep the repo-local context healthy.

## Architecture

```
contextual/
├── packages/
│   ├── shared/          Shared types and contracts
│   ├── server/          Local Express server + CLI
│   ├── react/           Browser toolbar (React component library)
│   ├── context-manager/ Corpus management UI (Vite + React)
│   └── demo/            Local sandbox with mock checkout flow
├── scripts/
│   └── dev.sh           Unified dev launcher
├── package.json         Workspace root
└── tsconfig.base.json   Shared TypeScript config
```

### Server

Express.js on port 4700 (configurable). Key internals:

- **ContextIndex** — SQLite FTS5 in-memory search index, watched via chokidar, auto-reindexes on file changes.
- **PassStore** — reads/writes pass JSON files, supports CSS selector matching for inspect queries.
- **OutcomeStore** — reads/writes outcome JSON files with per-instruction review tracking.
- **PairingStore** — Terminal.app TTY detection and AppleScript dispatch.
- **ToolStore** — configurable `@mention` targets for the toolbar.
- **Depth resolution** — four levels (light, standard, detailed, full) controlling how much context is returned for a mention.

Atomic file writes (temp file + rename) prevent corruption. Path traversal protection on all file operations. CORS enabled for toolbar access from any local app.

### React Toolbar

Exports:

- `ContextualProvider` — wraps your app with the toolbar overlay.
- `useContextual()` — state machine for targeting, annotating, inspecting, and reviewing.
- `useAnnotationQueue()` — FIFO instruction queue management.
- `useElementTargeting()` — click/highlight/drag element selection with CSS selector generation.

Two modes:
- **Instruct** — target elements, write `@source[query]` instructions, queue and submit as a pass.
- **Inspect** — click an element to see its decision trail: which passes targeted it, inherited passes from ancestor elements, and pre-attached context from execution.

### Context Manager

Vite + React 19 app with a two-panel layout. Left panel shows a hierarchical tree of your context corpus and projects. Right panel shows compiled documents, source files, paste zones, and project details. Connects to the server API for all data.

## CLI Reference

```bash
# Setup
contextual-server init [--project-dir <path>]        # Detect framework, scaffold, inject toolbar
contextual-server scaffold --project-name <n> --base-path <p>  # Create context structure

# Server
contextual-server serve [--context-root <path>] [--port <port>] [--project <name>]

# Pairing
contextual-server pair [--context-root <path>] [--tty <tty>]
contextual-server pair-status [--context-root <path>]
contextual-server unpair [--context-root <path>]

# Outcomes
contextual-server record-outcome --context-root <path> --pass-id <id> --status <status> \
  [--feedback <text>] [--summary <text>] [--changed-file <path>] \
  [--looks-good <instruction-id>] [--needs-another-pass <instruction-id>] \
  [--instruction-feedback <instruction-id>=<text>]
```

## npm Scripts

```bash
# Build
npm run build                # Build all workspaces
npm run build:server         # Build server only

# Development
npm run dev                  # Start all services
npm run dev:server           # Watch server TypeScript
npm run dev:context-manager  # Vite dev server for context manager
npm run dev:react            # Watch React toolbar package

# Contextual CLI (via npm)
npm run contextual:scaffold -- --project-name <name> --base-path <path>
npm run contextual:serve -- --context-root <path> [--port <port>]
npm run contextual:pair -- --context-root <path>
npm run contextual:pair-status -- --context-root <path>
npm run contextual:record-outcome -- --context-root <path> --pass-id <id> --status <status>
npm run contextual:init -- [--project-dir <path>]

# Testing
npm run test                 # Test all packages
npm run test:server          # Test server
npm run test:react           # Test React toolbar
npm run typecheck            # TypeScript check all
npm run clean                # Delete dist and build artifacts
```

## Server API

### Corpus
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/corpus` | Overview of all context types with token estimates |
| GET | `/api/corpus/:type` | Get compiled file (meta + content) |
| GET | `/api/corpus/:type/sources` | List source files |
| POST | `/api/corpus/:type/sources` | Add source file |
| DELETE | `/api/corpus/:type/sources/:filename` | Delete source file |
| POST | `/api/corpus/:type/compile` | Auto-compile sources into compiled.md |
| PUT | `/api/corpus/:type/compiled` | Update compiled.md directly |
| PUT | `/api/corpus/:type/priority` | Set priority tier (system, project, reference) |
| GET | `/api/corpus/brief` | Get product brief |
| PUT | `/api/corpus/brief` | Update product brief |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project (name, title, description, activeTypes) |
| GET | `/api/projects/:name` | Get project detail with passes and outcomes |

### Passes and Outcomes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/passes` | Submit pass (auto-dispatches to paired terminal) |
| GET | `/passes` | List all passes |
| GET | `/passes/:id` | Get pass by ID |
| GET | `/passes/:id/outcome` | Get latest outcome for a pass |
| POST | `/outcomes` | Record outcome |
| GET | `/outcomes` | List all outcomes |
| GET | `/outcomes/:id` | Get outcome by ID |

### Context Resolution
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/resolve` | Resolve `@source[query]` mentions in bulk |
| GET | `/suggest` | Autocomplete suggestions for `@` mentions |
| GET | `/inspect` | Decision trail for a CSS selector |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server status and indexed file count |
| GET | `/api/pairing` | Pairing status |
| GET | `/api/discover` | Scan project directory for importable .md files |
| POST | `/api/discover/import` | Batch import discovered files |
| GET | `/tools` | List configured `@mention` tools |
| POST | `/tools` | Update tool configuration |

## Context Root Structure

```
my-context/
├── brief.md
├── research/
│   ├── compiled.md
│   └── _sources/
├── taste/
│   ├── compiled.md
│   └── _sources/
├── strategy/
│   ├── compiled.md
│   └── _sources/
├── design-system/
│   ├── compiled.md
│   └── _sources/
├── stakeholders/
│   ├── compiled.md
│   └── _sources/
├── technical/
│   ├── compiled.md
│   └── _sources/
├── business/
│   ├── compiled.md
│   └── _sources/
├── passes/
│   └── pass-2025-01-15T10-30-00.json
├── outcomes/
│   └── outcome-2025-01-15T10-45-00.json
├── learned/
│   ├── INDEX.md
│   ├── operator-preferences/
│   ├── ui-patterns/
│   ├── tool-routing/
│   └── project-decisions/
└── _projects/
    └── checkout-redesign/
        ├── brief.md
        ├── passes/
        ├── outcomes/
        └── learned/
```

## Known Limits

- Pairing supports Terminal.app only (macOS).
- Setup is still developer-oriented.
- There is not yet a single `contextual start` command.
- Browser integration is optional and depends on your app exposing a local browser UI.
