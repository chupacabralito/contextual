# Phase 1: MVP

> **Implementation note:** This document describes the **target MVP** after Session 3 refinements. Foundational infrastructure (monorepo, basic annotation flow, FTS5 server, context manager handoff, demo app) is built. Session 3 features (Instruct/Inspect modes, annotation queue, configured namespace, tool config UI, repository viewer, decision-trail indexing) are the next implementation pass.

## Philosophy: Two Workflows, One Context Layer

The MVP proves two things: (1) context-informed first prototypes are materially better than context-blind ones, and (2) context-informed annotation passes produce better refinements with fewer iterations. Both workflows share the same context folder structure.

## Workflow 1: Context-Informed First Prototype

### The Context Manager

A standalone browser-based React app invoked via `/use-contextual` in the designer's LLM environment.

**What the UI does:**
1. Shows default context that comes with every new project (from a Contextual root folder)
2. Lets the designer toggle/configure which defaults to include
3. Provides a paste zone for raw unstructured content (research notes, stakeholder emails, brand docs)
4. Lets the designer import reusable context from previous Contextual projects
5. Presents everything in a structured visual format

**When the designer submits:**
1. Collected content goes back to the LLM session
2. The LLM structures raw content into categorized context files
3. Files are written to the project's folder structure
4. The designer generates their first prototype with full organizational context

### Default Context

Every new project starts with a Contextual root folder containing baseline context:
- Design system docs
- Established taste principles
- Company-wide strategy
- Other project-agnostic context the designer has configured as defaults

This folder is copied to each new project, so the designer never starts from zero.

### Context Portability

Some context is reusable across projects (design system, taste). Some is project-specific (research, stakeholder feedback). The context manager lets designers choose what to carry forward.

## Workflow 2: Context-Informed Refinement (Two Modes)

### The Annotation Component

A React component (npm package) that renders in-browser alongside the prototype with two modes.

**Instruct mode (primary) flow:**
1. Designer activates Contextual toolbar
2. Clicks, highlights, or drag-selects a UI element
3. Types refinement instruction with @mention action directives: "Make this button more visually dominant with a trust indicator next to it @posthog[find proof that trust indicators boost CTA conversion rates] @research[what do our usability studies say about CTA confidence]"
4. Annotation added to the annotation queue (visible todo-list-style panel)
5. Continues annotating other elements, building up the queue
6. Reviews, edits, reorders, or removes annotations from the queue
7. Submits the pass (entire queue as structured prompt set to agent)
8. Agent executes all refinement instructions, uses @mentioned tools, makes informed changes
9. Agent writes findings back to context repositories
10. Returns updated prototype with refined elements + richer decision context per element

**Inspect mode (secondary) flow:**
1. Designer targets any element on the prototype -- even ones never annotated
2. Switches to Inspect mode
3. Sees the decision trail: what context informed it, what passes refined it, what data shaped it
4. Every element is a decision-rich object with traceable history

### @Mentions Are Agent Action Directives

@mentions are **directives** -- instructions telling the agent what research task to perform. The syntax is `@source[instruction]`. The annotation tool structures refinement instructions. The agent executes them.

**The namespace is configured per project** (designer enables tools through context manager):
- Local context repositories (always available): `@research`, `@taste`, `@strategy`, `@design-system`, `@stakeholders`
- Configured external tools: `@posthog`, `@figma`, `@linear`, `@slack`, any tool the designer enables

### Annotation Queue and Passes

Annotations accumulate in a **visible queue** -- a todo-list-style panel in the UI. The designer can review, edit, reorder, or remove annotations before submitting. A pass is the submitted queue -- the entire set of refinement instructions processed as a unit. Each pass produces two outputs: a refined prototype AND richer decision context per element. Single annotations can also be submitted immediately.

## Context Structure (User Setup)

Designers organize context into a standard folder structure:

```
/project-name
  /research        (user interviews, findings, pain points)
  /strategy        (vision, success metrics, requirements)
  /design-system   (components, patterns, specifications)
  /stakeholders    (feedback logs, priorities, decisions)
  /taste           (inspiration, brand feeling, anti-patterns, principles)
```

The context manager helps populate this at project start. The agent enriches it over time as @mention actions discover new context.

## What Gets Built in MVP

| Component | Description | Priority |
|-----------|-------------|----------|
| Context manager React app | Browser UI: initial setup, tool configuration, repository viewer (ongoing role) | Must have |
| `/use-contextual` command | Invocation in LLM environment, starts context manager | Must have |
| Default context root folder | Baseline context templates for new projects | Must have |
| React annotation component | Click, highlight, drag-select elements in-browser with mode toggle | Must have |
| Instruct mode | Refinement instruction input with @mention syntax and autocomplete (configured namespace) | Must have |
| Inspect mode | Decision trail viewer -- surface contextual decisions behind any element | Must have |
| Annotation queue | Todo-list-style panel: reviewable, editable, reorderable before submission | Must have |
| Pass submission | Entire queue as structured prompt set (element + refinement instruction + @mention action directives) | Must have |
| Tool configuration | Enable/disable tools as @mention targets per project (in context manager) | Must have |
| Local context server | Node process, indexes context folders, autocomplete, serves Inspect mode search | Must have |
| Decision trail indexing | Track which passes affected which elements, what context was gathered | Must have |
| Resolution depth | Controls how much local context is pre-attached (Light / Standard / Detailed / Full) -- primarily for Inspect mode | Must have |
| Project scaffold | Template folder structure creation | Must have |
| Context portability | Import from previous projects | Nice to have |
| Project switching | Switch between context projects | Nice to have |

## What Gets Built Later

| Component | When | Trigger |
|-----------|------|---------|
| Desktop app (system-wide overlay) | After browser-based value proven | Gate 2 pass |
| Voice input | After typed flow retention proven | Gate 2 pass |
| Auto-extraction from Slack/Figma | After we know which context types matter | Gate 1 data |
| Smart suggestions | After we see usage patterns | Gate 2 data |
| Team sharing | After single-player value proven | Gate 3 pass |
| MCP server integration | After core loops stable | Gate 1+ |

## The Aha Moment

**Workflow 1:** Designer pastes messy research notes and stakeholder emails into the context manager. The LLM structures everything into the right folders. First prototype is generated with awareness of real user pain points and brand standards. It's not perfect, but it's not generic either.

**Workflow 2 (Instruct):** Designer clicks a confusing button in the prototype. Types: "Make this button more visually dominant with a trust indicator next to it @research[what do our usability studies say about CTA confidence] @posthog[find proof that trust indicators boost CTA conversion rates]"

The agent executes the directives. It searches local research and finds: "70% of users couldn't find the save button - user study session 3." It queries PostHog and finds: "Trust badges near CTAs increase conversion by 18%." It uses both findings to redesign the button with a trust badge. The findings get written back to context repositories.

**Workflow 2 (Inspect):** Designer clicks the Pay button they never annotated. Inspect mode shows: "This button is indigo because the design system specifies Indigo 500 for primary actions. It reads 'Pay $49.00' because the Stripe taste reference recommended unambiguous CTAs. The trust indicator was added in Pass 3 after PostHog data showed trust badges increase conversion."

That's when it clicks: every element is a decision-rich object. The agent knows what I know, can go find out what I don't, and every decision is traceable.

## Why Manual Context Setup Is Fine for MVP

1. **Designers already curate** -- mood boards, research repos, design principles docs. This isn't new behavior, it's a new format.
2. **Manual curation produces better context** -- a designer choosing which research quotes matter most creates higher-signal context than auto-extraction dumping everything.
3. **The context manager makes it fast** -- paste raw content, LLM structures it. Not the same as manually creating and filing individual markdown files.
4. **It reveals what matters** -- usage data shows which context types get referenced most. That informs what's worth auto-extracting later.
