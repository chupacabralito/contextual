# Pass Handoff: Context Manager App

## Pass Name

Context Manager MVP

## Goal

Build the standalone browser-based React app that serves as the context manager for Workflow 1 (context-informed first prototype). This app opens in the browser when the designer invokes `/use-contextual` in their LLM environment. It lets the designer review default context, paste raw unstructured content, import from previous projects, and send everything back to the LLM session for structuring into context folders.

## Owner

Codex

## Owned Files

- `packages/context-manager/**/*`

## Off-Limits Files

- `packages/shared/**/*`
- `packages/react/**/*`
- `packages/server/**/*`
- `package.json` (root -- except adding context-manager to workspaces if needed)
- `docs/**/*`

## Current Repo State

The monorepo has three packages today:
- `packages/shared` -- complete, exports types and API contract
- `packages/server` -- complete, Express server with FTS5 indexing, all tests pass
- `packages/react` -- complete, annotation component (being refined in a parallel Claude Code pass)

`packages/context-manager` does not exist yet. This pass creates it.

## What the App Does

The context manager is an interstitial step between project creation and first prototype generation. It opens in the browser, lets the designer configure what context to include, and sends the collected content back to the LLM session.

### UI Screens / Views

**1. Default Context Review**
- Reads from a Contextual root folder (path passed as config/query param)
- Lists each context type folder (research, taste, strategy, design-system, stakeholders) with file counts and brief summaries
- Each context type has a toggle (include/exclude for this project)
- Shows a preview of contents when a type is expanded

**2. Paste Zone**
- Large text area where the designer can paste raw unstructured content
- Examples: research notes, stakeholder emails, brand guidelines, meeting transcripts
- Multiple paste entries allowed (each can be labeled or tagged with an intended context type)
- No structuring happens here -- the LLM in the designer's session handles that later

**3. Import from Previous Projects**
- File browser / project picker that shows existing Contextual project folders
- Designer selects which context types to import from a previous project
- Shows what will be imported before confirming
- Copies selected context files to the new project's folder structure

**4. Summary + Submit**
- Shows everything that will be sent back: default context selections, pasted content, imported files
- Submit button that writes the collected content to the output channel
- Clear confirmation that content has been sent

### Communication Channel

When the designer clicks Submit, the app writes collected content to one of:
1. **A known file location** (e.g., `.contextual/handoff.json` in the project directory) that the LLM session reads
2. **The local context server** via a new `POST /handoff` endpoint (if the server is running)

Option 1 is simpler and has no server dependency. Implement option 1 for MVP. The output file should be JSON with this structure:

```json
{
  "timestamp": "2026-03-29T...",
  "defaultContext": {
    "included": ["research", "taste", "strategy"],
    "excluded": ["design-system", "stakeholders"]
  },
  "pastedContent": [
    {
      "label": "User research notes",
      "suggestedType": "research",
      "content": "Raw pasted text here..."
    }
  ],
  "importedFrom": {
    "projectName": "previous-project",
    "importedTypes": ["taste", "design-system"],
    "files": ["taste/brand-principles.md", "design-system/components.md"]
  }
}
```

The LLM session reads this file and uses it to structure content into the project's context folders.

## Technical Requirements

### Stack
- **Vite + React + TypeScript** -- same toolchain as the rest of the monorepo
- **No additional runtime dependencies** beyond React and Vite defaults
- **Reads file system** via a lightweight local API (see below)

### Local File Access
The browser app cannot read the file system directly. Use one of these approaches:
1. **Vite dev server middleware** that exposes a few read-only endpoints for listing context folders and reading file previews
2. **Use the existing context server** (`@contextual/server` at port 4700) for folder listing if it's running, with graceful fallback

Recommendation: add a minimal Vite plugin or middleware that serves the Contextual root folder contents. This avoids coupling to the context server.

### Package Structure

```
packages/context-manager/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.tsx              -- React entry point
    App.tsx               -- Main app component, routes between views
    components/
      DefaultContextView.tsx    -- Toggle/preview default context
      PasteZone.tsx             -- Paste raw content with labels
      ImportView.tsx            -- Browse and import from previous projects
      SummaryView.tsx           -- Review + submit
    hooks/
      useContextRoot.ts         -- Reads context root folder via local API
      usePreviousProjects.ts    -- Lists previous project folders
    api/
      localFiles.ts             -- Fetch wrapper for local file access
      handoff.ts                -- Write handoff JSON on submit
    types.ts                    -- App-specific types (not shared)
  server/
    middleware.ts               -- Vite middleware for local file access
```

### Package.json

```json
{
  "name": "@contextual/context-manager",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  }
}
```

Note: `private: true` -- this is a standalone app, not published to npm.

### Configuration

The app needs to know:
1. **Context root path** -- where the Contextual root folder lives (default context)
2. **Project path** -- where the new project's context folders will be created
3. **Previous projects path** -- where to look for importable projects

These are passed as query parameters when the app URL is opened:
```
http://localhost:5173/?contextRoot=/path/to/root&projectPath=/path/to/new-project
```

Or as environment variables in `.env` for development.

## Completion Signal

- `npm run build --workspace=@contextual/context-manager` passes with zero errors
- `npm run dev --workspace=@contextual/context-manager` starts the app in the browser
- Default context view shows files from a test context root folder
- Paste zone accepts text input with labels
- Import view lists available previous projects
- Submit writes a valid handoff JSON file to the project directory
- App is visually usable (does not need to be polished, but must be functional)

## Assumptions

- The Contextual root folder exists and contains markdown files in the standard five subfolders
- Previous projects follow the same folder convention
- The designer has a browser available (this is a browser app)
- The LLM session is responsible for reading the handoff file and structuring content -- this app does NOT call any LLM API
- No authentication, no remote access -- localhost only

## Design Guidelines

- **Dark theme** consistent with the annotation component (dark navy backgrounds, indigo accents)
- **Structured visual layout** -- not a chat interface. Think dashboard/settings page.
- **Simple navigation** -- tabs or step-through (Default Context -> Paste -> Import -> Submit)
- **Non-blocking** -- every view is optional. The designer can submit with just defaults, just pasted content, or any combination.

## What This Pass Does NOT Include

- `/use-contextual` command integration with LLM environments (that's a separate skill/command, not part of this app)
- LLM-assisted structuring of pasted content (the LLM session handles this after reading the handoff file)
- Connection to the annotation component (they share context folders but don't talk to each other)
- Any cloud features, team features, or external integrations

## Notes For Next Pass

- After this pass, the next step is building the `/use-contextual` command/skill that starts this app's dev server, opens the browser, and reads the handoff file when the designer submits
- The handoff JSON format may evolve based on what the LLM session needs -- keep it simple and extensible
- The context server (`packages/server`) could eventually serve the same file-listing endpoints this app needs, but for MVP they're independent
