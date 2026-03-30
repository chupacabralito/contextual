# Contextual - Project Summary

## What It Is

A context layer for AI-assisted design that supports two workflows: (1) a context manager that helps designers organize context, configure tools, and view accumulated design decisions, and (2) an annotation component with two modes -- **Instruct** (write refinement instructions with @mention agent actions, queue them, submit as passes) and **Inspect** (target any element to understand the contextual decisions behind it). Every element in the prototype is a decision-rich object with a traceable history that grows with each pass.

## The Core Insight

Designers are no longer building for humans. We're building for agents who are building for humans.

The craft isn't the pixels anymore. The craft is the context. Your expertise -- user research, taste, stakeholder intent -- is what makes agent output worth anything. Contextual makes that expertise available both before the first prototype and at the point of annotation.

## The Precedent

Agentation (benji.org/agentation) proved the interaction model: point at a UI element, annotate it, send structured feedback to an agent. But those annotations are context-blind. The agent gets "make this bigger" without knowing why.

Contextual adds the why. Same interaction model, different value layer.

## Two Workflows, One Context System

### Workflow 1: Context-Informed First Prototype

1. **Invoke** -- designer types `/use-contextual` in their LLM environment
2. **Configure** -- context manager opens in browser, shows default context
3. **Add** -- paste raw unstructured content, import from previous projects
4. **Structure** -- content goes back to LLM, which categorizes and files it
5. **Generate** -- first prototype is informed by real organizational context

### Workflow 2: Context-Informed Refinement (Two Modes)

**Instruct mode (primary):**
1. **Target + Instruct** -- click, highlight, or drag-select any element, write a refinement instruction with @mention actions
2. **Queue** -- annotation added to a visible queue (todo-list panel); continue annotating other elements
3. **Submit pass** -- the entire queue submitted as a structured prompt set
4. **Agent executes** -- processes each instruction, executes @mention actions, makes informed changes
5. **Two outputs** -- refined prototype + richer decision context per element
6. **Context grows** -- agent findings written back to context repositories

**Inspect mode (secondary):**
1. **Target any element** -- even ones never annotated
2. **See the decision trail** -- what context informed it, what passes refined it, what data shaped it

### Shared Layer

Both workflows read from and write to the same context folder structure. Context compounds over time.

## Current Status

**Building toward Gate 1.** Monorepo has five packages (shared, react, server, context-manager, demo). All build and pass tests. The current implementation reflects the pre-Session 3 architecture. Session 4 sequenced the build: Gate 1 ships Instruct mode + pass persistence; Gate 2 adds Inspect mode + decision model after real usage data exists.

### What's built and working

| Package | What exists today |
|---------|-------------------|
| **shared** | Type contracts, 5 fixed ContextType values, API types, constants |
| **react** | Single-mode annotation: element targeting (click, highlight, drag-select), @mention parsing against fixed 5 context types, 4 depth levels, context pre-search + preview, clipboard copy of structured prompt. No Instruct/Inspect toggle, no annotation queue, no configured namespace. |
| **server** | SQLite FTS5 indexing of context folders by content/source/date/contextType. Endpoints: /health, /suggest, /resolve, /scaffold. No decision-trail metadata, no pass provenance, no element-level history. |
| **context-manager** | 4-step handoff flow: Defaults, Paste, Import, Submit. No tool configuration UI, no repository viewer, no decision-history browser. |
| **demo** | Mock checkout prototype wrapped in ContextualProvider, wired to server on port 4700. |

### Next: Gate 1 Build (Instruct Mode + Pass Persistence)

1. **Open the parser** -- accept any `@source`, not just hardcoded ContextType values
2. **Build annotation queue** -- todo-list-style UI panel, add/edit/reorder/remove instructions
3. **Multi-instruction pass submission** -- serialize queue as structured prompt set
4. **Persist passes** -- write timestamped JSON pass records to `/passes` on submit
5. **Update shared types** -- Pass, Instruction, ParsedAction, PreAttachedSnippet
6. **Wire it up** -- update demo app, ContextualProvider, end-to-end test

### Deferred to Gate 2 (after real pass data exists)

- Inspect mode UX and decision trail viewer
- Decision model (derived from observed pass patterns)
- Tool configuration UI in context manager
- Repository viewer in context manager
- Decision-trail indexing in server
- Writeback semantics

See TODO.md for full execution plan and REFINEMENTS-SESSION-4.md for the sequencing rationale.

## Key Decisions

### Session 3 (target architecture -- not yet implemented)

- **Architecture:** Three components -- context manager (standalone React app), annotation component (npm package), local context server (Node). Monorepo has packages: shared, react, server, context-manager, demo
- **Two workflows:** Context setup via `/use-contextual` + annotation-based refinement
- **Two annotation modes:** Instruct (refinement instructions with @mention actions, queued, submitted as passes) + Inspect (decision trail behind any element)
- **@mentions are agent actions:** Configured namespace (user enables tools per project). Syntax: `@source[instruction]`
- **Annotation queue:** Visible todo-list panel. Designer accumulates instructions, submits when ready.
- **Decision-rich prototype:** Every element carries a history of why it exists. Inspect illuminates. Instruct enriches.
- **Context manager has ongoing role:** Initial setup + tool configuration + repository viewer
- **Context types are repositories:** research, taste, strategy, design-system, stakeholders are where findings accumulate, not the @mention namespace
- **The annotation tool does not resolve @mentions:** It structures refinement instructions. The agent executes.
- **Passes produce two outputs:** Refined prototype + richer decision context per element
- **Cold start solution:** Default context per project + LLM-assisted structuring via browser UI
- **ICP:** Design leads at AI-forward startups (Series A-C) already using Claude/Cursor
- **Positioning:** Annotations are instructions, not analysis. Every element is decision-rich.

### Session 4 (build sequencing)

- **Gate 1 = Instruct mode + pass persistence.** Shortest path to proof that better instructions + context improve outcomes.
- **Gate 2 = Inspect mode + decision model.** Derived from real pass history, not premature spec.
- **Minimal pass schema:** Pass > Instructions > ParsedActions > PreAttachedSnippets. No "decision" type yet.
- **Pass persistence:** Timestamped JSON to `/passes` folder on submit. Stores everything needed to later derive the decision model.
- **Protocol/UX separation:** Parser accepts any `@source` at protocol level. Autocomplete (UX) shows configured tools. Validation is advisory, not blocking.
- **PreAttachedContext stored in pass records:** For later analysis of whether better context led to better outcomes.
- **"Decision" stays out of the schema:** Let the ontology emerge from observed pass patterns.

## Key Files

| File | What it covers |
|------|---------------|
| PRODUCT-STRATEGY.md | Two-workflow model, stage-gate roadmap, ICP, value prop, metrics, monetization, positioning |
| TODO.md | Execution plan with build order |
| CONCEPT.md | Core insight, Agentation precedent, what Contextual adds, @mention actions |
| TECHNICAL-ARCHITECTURE.md | Three-component architecture, API design, output format |
| PHASE1-CONTEXT-BUILDING.md | MVP scope, context manager, annotation tool, build/don't-build tables |
| ANNOTATION-DESIGN.md | @mention syntax, open namespace, agent actions, autocomplete |
| COMPETITIVE-LANDSCAPE.md | Threats, Agentation relationship, positioning |
| TASTE-LAYER.md | The taste/sensibility layer concept |
| REFINEMENTS-SESSION-2.md | Historical record of strategic evolution from Session 2 (superseded by Session 3) |
| REFINEMENTS-SESSION-3.md | Session 3 refinements: annotation-as-prompt, Instruct/Inspect modes, annotation queue, configured namespace, decision-rich prototype (applied to core docs) |
| REFINEMENTS-SESSION-4.md | Session 4 build sequencing: Gate 1 = Instruct + pass persistence, Gate 2 = Inspect + decision model, minimal pass schema, protocol/UX separation |

## Domain

getcontextual.app (secured)
