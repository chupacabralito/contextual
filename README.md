# contextual

**Local-first context and pass memory for repo-native agents.**

Contextual is a local tool for people who work in Claude Code and want a repo-native place to keep context, capture UI passes, and record outcomes over time.

## Status

This repo is ready for a **GitHub alpha**, not a broad public release.

Current alpha assumptions:
- macOS
- Terminal.app
- Claude Code
- Node 20+

Pairing and auto-dispatch currently target Terminal.app only.

## What It Does

- **Context manager** for briefs, source material, passes, outcomes, and learned notes
- **Local context server** for indexing, pass persistence, outcomes, and pairing status
- **React toolbar** for in-browser pass capture on apps that expose a browser UI

The browser toolbar is optional. The core workflow is still: context manager + Claude Code + repo-local artifacts.

## Alpha Quick Start

1. Install dependencies and build the workspaces.

```bash
npm install
npm run build
```

2. Create a local context root inside your repo.

```bash
npm run contextual:scaffold -- --project-name contextual-context --base-path "$PWD"
```

3. Start the local Contextual server against that context root.

```bash
npm run contextual:serve -- --context-root "$PWD/contextual-context" --port 4700
```

4. In a second terminal, start the context manager.

```bash
npm run dev:context-manager
```

5. In the Terminal.app tab where Claude Code is running for this repo, pair that tab with the same context root.

```bash
npm run contextual:pair -- --context-root "$PWD/contextual-context"
```

6. Open the context manager, fill out the brief, add source material, and start working.

Optional:
- If your repo has a browser UI, open that app locally and use the Contextual toolbar there to create passes visually.

## Daily Workflow

1. Open the repo in Claude Code.
2. Start the Contextual server.
3. Start the context manager.
4. Pair the Claude Code terminal tab.
5. Update the brief and add source material.
6. If there is a browser UI, make passes there.
7. Review outcomes and keep the repo-local context healthy.

## Root Scripts

```bash
npm run build
npm run build:server
npm run dev:server
npm run dev:context-manager
npm run contextual:scaffold -- --project-name contextual-context --base-path "$PWD"
npm run contextual:serve -- --context-root "$PWD/contextual-context" --port 4700
npm run contextual:pair -- --context-root "$PWD/contextual-context"
npm run contextual:pair-status -- --context-root "$PWD/contextual-context"
npm run contextual:record-outcome -- --context-root "$PWD/contextual-context" --pass-id <pass-id> --status approved
npm run test:server
```

## Repository

- `packages/shared` shared contracts
- `packages/server` local server and CLI
- `packages/react` toolbar package
- `packages/context-manager` context manager app
- `packages/demo` local sandbox

## Known Limits

- pairing supports Terminal.app only
- setup is still developer-oriented
- there is not yet a single `contextual start` command
- browser integration is optional and depends on your app exposing a local browser UI

## Strategy

Contextual is a local-first context management layer for repo-native AI agents. It gives designers and product teams a way to maintain structured context alongside their codebase, so agent-driven workflows can reference real research, strategy, and design decisions.
