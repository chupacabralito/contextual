# Technical Architecture

> **Implementation note:** This document describes the **target MVP architecture** after Session 3 refinements, with build sequencing updated per Session 4 decisions. Session 4 split the build into Gate 1 (Instruct mode + pass persistence) and Gate 2 (Inspect mode + decision model). See the "Implementation Status" section at the end of each component for what exists today vs. what's planned, and the Build Order section for the Gate 1 sequence.

## Approach: Three Components

The MVP has three pieces:

1. **Context manager** (standalone React app) -- browser-based UI with an ongoing role, not a one-time setup tool. Three functions: (a) **initial setup** via `/use-contextual` (default context, raw content paste, project import), (b) **tool configuration** (enable PostHog, Figma, Amplitude, etc. as @mention targets), (c) **repository viewer** (see accumulated context across all types, understand the growing decision history).

2. **React annotation component** (npm package) -- renders in-browser alongside the prototype with two modes. **Instruct mode** (primary): designer writes refinement instructions with @mention actions, annotations accumulate in a visible queue, submitted as passes. **Inspect mode** (secondary): designer targets any element to surface the decision trail behind it. This component does NOT resolve @mentions or execute actions -- the agent does.

3. **Local context server** (Node process) -- indexes the context folder structure (markdown/JSON), provides autocomplete suggestions for the annotation component. Serves Inspect mode by searching accumulated context for decision history relevant to any element. Instruct mode passes @mention action instructions through to the agent -- the server does not execute them.

## Why This Architecture

**Follows proven precedent.** Agentation uses the same annotation model -- React component, npm install, renders in-browser. Proven adoption path for design/dev tools.

**Two entry points, one context layer.** The context manager handles project setup (Workflow 1). The annotation component handles refinement (Workflow 2). Both read from and write to the same context folder structure.

**Agent-agnostic.** Structured prompts work with Claude, Cursor, Codex, or any agent. @mentions are agent actions -- the agent decides how to execute them based on its available tools (local files, MCP servers, APIs).

**Zero new workflow.** Designers are already iterating on prototypes in the browser. Contextual appears as a toolbar in that same environment. Context setup happens in the LLM environment they're already using.

**Simple installation.** `npm install contextual` -> wrap your app in `<ContextualProvider>` -> done for the annotation component. Context manager is invoked via `/use-contextual`.

## Component Architecture

```
LLM Session (Claude Code / Codex / Cursor)
    ↕ /use-contextual command
Context Manager (standalone React app in browser)
    ↕ writes collected content back to LLM session
    ↕ LLM structures content into folders
    ↕
Context Folders (markdown/JSON -- growing knowledge base)
├── /research
├── /taste
├── /strategy
├── /design-system
└── /stakeholders
    ↕ indexed by
Local Context Server (Node process)
├── File watcher (monitors context folders)
├── Search index (SQLite FTS5)
├── Autocomplete provider
├── Depth controller (Light / Standard / Detailed / Full)
└── Project manager (switch between context projects)
    ↕ HTTP (autocomplete, search, health)
React Annotation Component (in-browser, alongside prototype)
├── Mode toggle (Instruct / Inspect)
├── Toolbar UI (activate/deactivate)
├── Element targeting (click, highlight, drag-select -- both modes)
├── [Instruct] Annotation input (refinement instruction + @mention actions)
├── [Instruct] @Mention autocomplete (configured tool namespace)
├── [Instruct] Annotation queue (visible todo-list panel)
├── [Instruct] Pass submission (structured prompt set to agent)
├── [Inspect] Decision trail viewer (context history for any element)
└── [Inspect] Reads from context server (accumulated decisions)
    ↕ structured prompt
LLM Session / Agent
    ↕ executes @mention actions
    ↕ local context + MCP/API tools (PostHog, Figma, Linear, etc.)
    ↕ writes discovered context back to
Context Folders (compounds over time)
```

## Context Manager

### What it renders

**Initial setup view:**
- Default context overview (what comes with every new project)
- Toggle/configuration for which defaults to include
- Paste zone for raw unstructured content
- Import from previous Contextual projects

**Tool configuration view:**
- List of available tools/services (PostHog, Figma, Amplitude, Slack, Vercel, etc.)
- Enable/disable tools as @mention targets
- Configuration persists per project

**Repository viewer:**
- Accumulated context across all five context types
- Decision history: what was added, when, from which pass or agent action
- Browse and search the growing knowledge base

All views are visual, browser-based layouts (not a chat interface).

### How it's invoked
The `/use-contextual` command in the designer's LLM environment:
1. Starts a local dev server for the context manager app
2. Opens the browser
3. Waits for the designer to finish
4. Receives collected content back via the local server
5. The LLM session structures and files the content

### Communication channel
Browser app writes collected content to the local context server (or a known file location). The LLM session picks it up and processes it.

### Implementation status
**Built:** 4-step handoff flow (Defaults, Paste, Import, Submit) in `packages/context-manager`. Default context display with toggle/include, paste zone, import from previous projects, summary/submit view.
**Not yet built:** Tool configuration view, repository viewer, decision history browser. The `/use-contextual` invocation flow is not yet wired.

## React Annotation Component

### What it renders
- Floating toolbar with mode toggle (Instruct / Inspect)
- Element targeting overlay -- click, highlight text, or drag-select areas (both modes)
- **Instruct mode:** Annotation input with @mention syntax + autocomplete, annotation queue (todo-list-style panel), submit button for pass
- **Inspect mode:** Decision trail viewer showing contextual decisions behind the targeted element

### Element identification
Following Agentation's approach:
- Buttons identified by text content
- Images by alt attributes
- Elements by class names and DOM position
- Bounding box captured for spatial context
- Text selections captured as exact strings

### @Mention namespace
Configured per project, not fully open-ended. The designer enables available tools through the context manager:
- **Configured tools:** `@posthog`, `@figma`, `@amplitude`, `@slack`, `@vercel`, `@linear`, etc.
- **Local repositories:** `@research`, `@taste`, `@strategy`, `@design-system`, `@stakeholders`

The autocomplete draws from:
- Enabled tool names (configured in context manager)
- Local context type names (always available)
- Indexed content within local context folders (via context server, for query hints)

### Output format
Structured prompt set combining element data + refinement instructions + @mention actions:

```markdown
## Refinement Pass

### Instruction 1
**Element:** Button "Pay $49.00" (.btn-primary, 200x40 at [320, 480])
**Instruction:** Make this button more visually dominant with a trust indicator next to it
**Actions:**
- @posthog[find proof that trust indicators perform better when paired with visually dominant CTAs]
- @research[what do our usability studies say about CTA confidence]

### Instruction 2
**Element:** h2 "Checkout" (#checkout-header, 400x32 at [100, 200])
**Instruction:** Simplify this to a single-column layout
**Actions:**
- @amplitude[find the checkout funnel drop-off rate for mobile users]
- @design-system[check our card and form field spacing patterns]

### Instruction 3
**Element:** div "Order summary" (.order-summary, 300x200 at [600, 200])
**Instruction:** Make this collapsible on mobile
**Actions:**
- @figma[check if we have an existing collapsible card component]
```

Note: Each @mention action is a directive to the agent, not a search query. The agent executes the action, uses the findings to inform the change, and writes the findings back to the appropriate context repository.

### Output depth levels

Depth controls how much local context is pre-attached to the structured prompt. External tool actions are always passed as-is (the agent executes them at runtime). The agent can always do additional resolution beyond what's pre-attached.

| Level | Local context in prompt | External actions |
|---|---|---|
| Light | Action names only (no snippets) | Passed as-is |
| Standard | Action names + source hints + brief snippets | Passed as-is |
| Detailed | Full local context previews + related findings | Passed as-is |
| Full | Cross-type context (all context types relevant to this element) | Passed as-is |

### Implementation status
**Built:** Single-mode annotation flow in `packages/react` -- element targeting (click, highlight, drag-select), annotation input with @mention autocomplete, context pre-search via server + preview panel, structured prompt copy to clipboard, 4 depth levels. Parser validates against fixed 5 ContextType values only. 5 workflow states: idle, targeting, annotating, previewing, submitted.
**Not yet built:** Instruct/Inspect mode toggle, annotation queue (todo-list panel), configured tool namespace (parser only accepts hardcoded context types), multi-instruction pass format, pass submission to agent (currently copies single annotation to clipboard).

## Local Context Server

### Core responsibilities
- Watch context folders for file changes
- Maintain search index of all context files
- Provide autocomplete suggestions for @mention queries
- Serve indexed content for preview/depth control
- Manage multiple projects

### What it does
- Indexes context folders and maintains a search index of accumulated context
- Provides autocomplete suggestions while the designer types @mentions (configured tools + local content)
- Serves Inspect mode: searches accumulated context for decision history relevant to any element
- Indexes decision trail metadata (which passes affected which elements, what context was gathered)

### What it does NOT do
- Execute external tool actions (the agent queries PostHog, Figma, etc. at runtime)
- Replace the agent's own resolution (the agent can always search more broadly)
- Structure raw content (the LLM session handles this during Workflow 1)

### Search approach

**Start with:** SQLite FTS5 (full-text search). Fast, local, zero dependencies beyond sql.js. Handles fuzzy matching well enough for MVP.

**Upgrade path:** Local embeddings for semantic search if FTS5 proves too literal. But start simple -- most queries will match on keywords.

### API (local HTTP)

```
POST /resolve
{
  "mentions": [
    { "type": "research", "query": "user save button" },
    { "type": "taste", "query": "stripe cta" }
  ],
  "depth": "standard"
}

Response:
{
  "results": [
    {
      "type": "research",
      "query": "user save button",
      "matches": [
        {
          "content": "70% of users couldn't find the save button...",
          "source": "checkout-usability-study.md",
          "date": "2024-12-15",
          "relevance": 0.92
        }
      ]
    }
  ]
}
```

This endpoint serves two purposes: (1) autocomplete previews while the designer is annotating, and (2) pre-searching local context snippets that get embedded in the structured prompt at the chosen depth level. It is not an agent-facing API -- the agent receives the pre-attached snippets in the prompt and can always do additional resolution on its own.

```
GET /health
GET /suggest?partial=res&type=research
POST /scaffold
```

### Implementation status
**Built:** SQLite FTS5 indexing of markdown/JSON files by content, source, date, contextType in `packages/server`. All 4 endpoints working (/health, /suggest, /resolve, /scaffold). Depth controller filters matches by level (light: 1 match truncated to 120 chars, standard: 3 matches, detailed: 5 + related, full: all). File watcher monitors context folders. Autocomplete from indexed content. 8 passing tests.
**Not yet built:** Decision-trail metadata (which passes affected which elements), element-level provenance, Inspect mode search (contextual decisions behind a specific element). Current index has no concept of passes or element associations.

## Build Order (Session 4 Sequencing)

Session 4 split the build into two gates. Gate 1 ships Instruct mode with pass persistence. Gate 2 adds Inspect mode and the decision model derived from real pass data.

### Gate 1: Instruct Mode + Pass Persistence (build now)

1. **Open the parser** -- update `parser.ts` to accept any `@source`, not just hardcoded ContextType values. Add `ParsedAction` type (source: string, instruction: string). Autocomplete still shows 5 local repositories; accepts anything else freeform.
2. **Build the annotation queue** -- queue state management (add, edit, reorder, remove), todo-list-style UI panel alongside prototype, each item shows targeted element + instruction + parsed @actions. Queue persists across element targeting.
3. **Build multi-instruction pass submission** -- serialize entire queue as structured prompt set (markdown format). Update output formatter for multi-instruction passes. Submit = copy structured prompt + persist pass record.
4. **Persist passes** -- add `/passes` folder to project structure. On submit, write timestamped JSON pass record. Pass record stores: id, timestamp, depth, instructions[] (each with element, rawText, parsed actions, pre-attached context snippets).
5. **Update shared types** -- Pass, Instruction, ParsedAction, PreAttachedSnippet types. Update ContextualState for queue-based flow. Maintain backward compatibility with server/resolve contract.
6. **Wire it up** -- update demo app for queue-based flow, update ContextualProvider for new state, end-to-end test.

### Minimal Pass Schema (Gate 1)

```
Pass
  id: string (uuid or timestamp-based)
  timestamp: ISO 8601
  depth: ResolutionDepth
  instructions: Instruction[]

Instruction
  element: TargetedElement (selector, label, boundingBox, tagName, selectedText)
  rawText: string (the full annotation text including @mentions)
  actions: ParsedAction[] (parsed @source[instruction] directives)
  preAttachedContext: PreAttachedSnippet[] (local context included at submit time)

ParsedAction
  source: string (any @mention target -- not limited to ContextType)
  instruction: string (the directive in brackets)

PreAttachedSnippet
  type: string (context type or tool source)
  query: string
  content: string (the snippet that was included)
  source: string (file path or origin)
```

Key schema decisions:
- `source` is a string, not a ContextType -- preserves protocol/UX separation
- `preAttachedContext` is stored -- later analysis needs to know what context the system handed the agent
- No "decision" type -- stays out of the schema until patterns emerge from real usage
- No artifact type yet -- deferred until real passes show what artifacts look like

### Gate 2: Inspect Mode + Decision Model (after Gate 1 data)

- Analyze persisted pass records from Gate 1 usage
- Define decision model based on observed patterns
- Build Inspect mode UX
- Build repository viewer in context manager
- Add decision-trail indexing to server
- Define writeback semantics

### Original build order (foundational -- completed)

1. ~~Context manager~~ -- 4-step handoff flow (done)
2. ~~React annotation component~~ -- single-mode annotation flow (done)
3. ~~Local context server~~ -- FTS5 indexing + 4 endpoints (done)
4. ~~Shared types~~ -- type contracts + API types (done)
5. ~~Demo app~~ -- mock checkout with ContextualProvider (done)

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Platform | Three components (context manager, annotation component, context server) | Two workflows + two modes need flexible UIs, one shared backend |
| Annotation model | Two modes: Instruct (refinement instructions) + Inspect (decision trail) | Annotations are actions, not analysis. Understanding decisions is separate. |
| Annotation output | Structured prompt set to agent (refinement instructions + @mention actions) | Agent executes instructions and @mention actions directly via tools |
| @Mention namespace | Configured per project (user enables tools) | Designer controls which tools are available; not fully open-ended |
| @Mention resolution | Agent-side, not local | Configured tools require agent's tool access (MCP/API) |
| Annotation queue | Visible todo-list panel in UI | Enables batched passes; designer reviews before submitting |
| Search | SQLite FTS5 (for autocomplete + Inspect mode) | Local, fast, simple. Serves Inspect mode and autocomplete |
| Storage | Markdown/JSON in folders (context repositories) | Git-friendly, human-readable, agent-readable, growing knowledge base |
| Communication | Local HTTP between components | Simple, debuggable, no complex IPC |
| Context manager role | Ongoing (setup + tool config + repository viewer) | Not a one-time wizard; context grows with every pass |
| Context manager invocation | `/use-contextual` command in LLM environment | Meets designers where they already work |
| Pass persistence | Timestamped JSON to `/passes` folder on submit | Audit trail, Inspect mode source material, debugging artifact |
| Gate sequencing | Instruct mode = Gate 1; Inspect mode = Gate 2 | Instruct is shortest path to proof; Inspect needs real pass history |
| Pass schema | Minimal: Pass > Instructions > ParsedActions > PreAttachedSnippets | Just enough structure to not paint into a corner; no "decision" type yet |

## Future Expansion (Not MVP)

- **Desktop app** -- system-wide overlay for annotation outside the browser (Figma, native apps). Only justified after browser-based value is proven.
- **MCP server** -- expose context resolution as an MCP tool for direct agent integration.
- **Figma plugin** -- annotation directly in Figma canvas.
- **Voice input** -- speak annotations instead of typing.
- **Auto-extraction** -- ingest from Slack, Figma, Notion automatically.

Each of these is a future gate, not an MVP requirement.
