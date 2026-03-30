# Contextual - Strategic Refinements (Session 2)

> **Note:** This document has been superseded by REFINEMENTS-SESSION-3.md. Session 3 refines several Session 2 decisions, including: annotations as refinement instructions (not analysis), @mention syntax as directives (not queries), configured namespace (not open-ended), two annotation modes (Instruct + Inspect), annotation queue, decision-rich prototype concept, and expanded context manager role. See REFINEMENTS-SESSION-3.md for the current understanding.

This document records the strategic evolution that occurred during Session 2 discussions. All refinements below have been applied to the core strategy and architecture docs. This file is kept as a historical record of what changed and why -- not as a pending action list.

---

## 1. Two-Workflow Model

The original strategy described one workflow: annotation-based refinement. The refined model introduces two distinct workflows that share one context system.

### Workflow 1: Context-Informed First Prototype (NEW)

Before a prototype exists, the designer needs to organize context so the LLM's initial output is informed by real organizational knowledge.

**Entry point:** Designer types `/use-contextual` in their LLM environment (Claude Code, Codex, Cursor).

**What happens:**
- A local React app opens in the browser (the "context manager")
- The app shows default context that comes with every new project (from a Contextual root folder)
- The designer can add new context by pasting raw unstructured content into the UI
- The designer can import reusable context from previous Contextual projects
- When the designer finishes, the content goes back to the LLM session that invoked the command
- The LLM structures the raw content into properly formatted, categorized context files
- Context files are written to the project's folder structure
- The designer proceeds to generate their first prototype, now informed by structured context

### Workflow 2: Context-Informed Refinement (EXISTING, REDEFINED)

A prototype exists. The designer uses the annotation component to refine it.

**What the annotation tool actually does (refined understanding):**
- It's a structured prompt builder, not a clipboard exporter
- Annotations have two parts:
  1. Natural language instructions ("fix this button", "make it more prominent")
  2. @mention actions -- instructions for the agent to gather additional context
- @mentions are agent actions, not just local file lookups (see Section 3)
- Annotations are submitted as passes -- one annotation or many. The designer submits when ready.
- The agent processes the pass: executes @mention actions, gathers context, makes the requested changes, returns a new version of the prototype
- Newly gathered context feeds back into the project's context files

### Shared Layer

Both workflows read from and write to the same context folder structure. Context compounds over time.

---

## 2. Cold Start Solution

### Problem

The original strategy said context setup was "user responsibility" and offered empty folder scaffolding with README guidance. This creates a cold start problem: empty folders mean @mentions resolve to nothing, and the time-to-first-useful-annotation exceeds the Gate 1 target of < 5 minutes.

### Solution

An LLM-powered context organization flow, accessed through a visual browser UI.

**Key decisions:**
- The LLM does the structuring (categorizing raw content into context types)
- The LLM call happens in the user's existing LLM session (no separate API key needed)
- The UI is visual and browser-based (not terminal/CLI -- ICP is designers)
- No third-party integrations (no Notion API, Google Docs API, Figma API, etc.)
- The designer is the integration layer -- they bring the content, the LLM structures it

### Default Context

Every new project starts with a Contextual root folder containing default context:
- Design system docs
- Established taste principles
- Company-wide strategy
- Other project-agnostic context the designer has configured as defaults

This folder is copied to each new project, so the designer never starts from zero.

### Context Portability

Designers can import context from previous Contextual projects. Some context is reusable (design system, taste). Some is project-specific (research findings, stakeholder feedback from a specific initiative).

---

## 3. @Mentions as Agent Actions (Major Refinement)

### Original Model

@mentions were local file lookups. `@research[checkout friction]` searched the local /research folder via SQLite FTS5 and returned matched content. The annotation tool resolved everything locally, showed a preview, and copied structured markdown to clipboard.

### Refined Model

@mentions are instructions for the agent to take action. The annotation tool structures the prompt; the agent executes the actions.

**Examples:**
- `@posthog[find user drop-off data]` -- tells the agent to query PostHog
- `@research[checkout friction]` -- tells the agent to search local research files
- `@figma[component specs for checkout]` -- tells the agent to pull from Figma
- `@linear[open issues on checkout]` -- tells the agent to check Linear

**The @mention namespace is open-ended** -- not limited to the five context types (research, taste, strategy, design-system, stakeholders). Any tool connected via MCP or API is a valid target.

**Context feedback loop:** When the agent executes an action and gathers new information, that context feeds back into the project's context files. The knowledge base grows with each annotation cycle.

---

## 4. The Context Manager (New Component)

### What It Is

A standalone local React app that opens in the browser. It's the visual UI for Workflow 1 (context setup) and for bulk-adding context later.

### How It's Invoked

The `/use-contextual` command in the designer's LLM environment (Claude Code, Codex, Cursor):
1. Starts a local dev server
2. Opens the browser with the context manager UI
3. Waits for the designer to finish
4. Receives the collected content back
5. The LLM structures and files the content into context folders

### What the UI Does

- Shows default context that will be copied to the new project
- Lets the designer toggle/configure which defaults to include
- Provides a paste zone for raw unstructured content
- Lets the designer import context from previous Contextual projects
- Presents everything in a structured, visual format (not a chat interface)

### Relationship to Other Components

- **Context manager** writes to the context folder structure (setup + bulk add)
- **Annotation tool** reads from context folders and creates structured prompts for the agent
- **Local context server** indexes the folders and provides search/autocomplete for both
- The context manager is a separate package in the monorepo (`packages/context-manager` or similar)

---

## 5. Architecture Update

### Original Architecture

```
React Annotation Component (@contextual/react)
    ↕ HTTP
Local Context Server (@contextual/server)
    ↕ File System
Context Folders (markdown/JSON)
```

### Refined Architecture

```
LLM Session (Claude Code / Codex / Cursor)
    ↕ /use-contextual command
Context Manager (standalone React app in browser)
    ↕ writes collected content back to LLM session
    ↕ LLM structures content
    ↕ writes to file system
Context Folders (markdown/JSON)
    ↕ indexed by
Local Context Server (@contextual/server)
    ↕ HTTP (search, autocomplete, health)
React Annotation Component (@contextual/react, embedded in prototype)
    ↕ structured prompts
LLM Session / Agent
    ↕ executes @mention actions
    ↕ gathers context from tools (PostHog, Figma, Linear, etc.)
    ↕ writes new context back to
Context Folders (growing knowledge base)
```

---

## 6. Resolved Questions

### Annotations Are Submitted as Passes

A pass is whatever the designer submits -- one annotation or many. The designer might annotate a single button, or mark up a dozen elements across the prototype, then submit. There's no hard requirement on the number of annotations per pass. The agent processes the pass and returns a new version of the prototype with the feedback addressed.

### The Annotation Tool Does Not Resolve Anything Locally

The annotation tool collects, structures, and batches. It does not resolve @mentions. The agent does all resolution -- searching local context files, querying PostHog via MCP, pulling Figma specs, whatever the @mentions require.

The local context server still has a role:
- Autocomplete suggestions (what @mention types and content are available)
- Indexing what's in the context folders
- Showing designers what local context exists

But it is not the resolver. The agent is.

### The @Mention Namespace Is Open-Ended

Not limited to the five local context types (research, taste, strategy, design-system, stakeholders). Any tool the agent can reach via MCP or API is a valid @mention target: `@posthog`, `@figma`, `@linear`, `@slack`, etc. The five context types are the local folder types. External @mentions are agent actions against connected tools.

---

## 7. Impact on Existing Build

### What Still Applies

- Monorepo structure (packages/shared, packages/react, packages/server)
- Shared types as the API contract
- Local context server for indexing and search
- React annotation component for element targeting, annotation input
- Context folder convention (/research, /taste, /strategy, /design-system, /stakeholders)
- Resolution depth levels (light, standard, detailed, full)

### What Needs to Change

- The annotation tool's output model: from "resolve locally and copy to clipboard" to "structure prompt with actions for the agent"
- @mention types: from fixed five context types to an extensible namespace
- New component: context manager (standalone React app)
- New flow: `/use-contextual` command integration with LLM environments
- The context system becomes a growing knowledge base, not a static file set
- Default context and project templates need to be defined

### What's New to Build

- Context manager React app (`packages/context-manager`)
- `/use-contextual` command/skill for LLM environments
- Default context root folder with templates
- Context portability (import from previous projects)
- Agent action model for @mentions (vs. local-only resolution)
