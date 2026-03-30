# Contextual - Concept

## The Core Insight

Designers are no longer building for humans. We're building for agents who are building for humans.

That's a fundamental shift. The designer's job is moving from crafting output to directing agents with context only you have -- your research, your taste, your knowledge of what users need, your stakeholder constraints. The agent handles execution. You supply the expertise that makes execution worth anything.

The craft isn't the pixels anymore. The craft is the context.

## The Problem

AI agents are fast but context-blind. Every time a designer prompts an agent, the agent starts from zero:
- It doesn't know your users or what research has revealed
- It hasn't seen your brand guidelines or design system
- It misses stakeholder feedback and strategic direction
- It has no sense of your design sensibility or taste

The result: generic output that needs heavy reworking. Each iteration costs tokens and time. Designers spend more effort re-explaining context than they save using AI.

## The Precedent: Agentation

Benji Taylor's Agentation (benji.org/agentation) proved the interaction model: a React component that lets you point at a UI element in the browser, annotate it, and send structured feedback to an AI agent. Click, highlight, drag-select -- then describe what needs to change.

But those annotations are context-blind. The agent gets "make this button more prominent" -- it doesn't know why it should be prominent, what user research says about it, or what your brand's approach to prominence looks like. It guesses. You iterate. Tokens burn.

## What Contextual Adds

Contextual adds organizational context at two critical moments: before the first prototype and during every refinement pass.

**Agentation** captures *what* needs to change (element + annotation).
**Contextual** turns every annotation into a refinement instruction with embedded agent sub-tasks, and turns every prototype element into a decision-rich object with a traceable history (element + refinement instruction + @mention action directives + organizational context).

## Two Workflows

### Workflow 1: Context-Informed First Prototype

Before writing a single prompt, the designer organizes context using the context manager -- a browser-based UI invoked via `/use-contextual` in their LLM environment. They paste raw research notes, configure default context (design system, taste, strategy), and import from previous projects. The LLM structures everything into the project's context folders. The first prototype is generated with full organizational context, not generic assumptions.

### Workflow 2: Context-Informed Refinement (Two Modes)

**Instruct mode (primary):** The designer targets an element and writes a refinement instruction with @mention action directives:

"Make this button more visually dominant with a trust indicator next to it @posthog[find proof that trust indicators boost CTA conversion rates] @research[what do our usability studies say about CTA confidence]"

This annotation has two parts:
1. **Refinement instruction:** "Make this button more visually dominant with a trust indicator next to it"
2. **@mention action directives:** `@posthog[...]` and `@research[...]` tell the agent what research tasks to perform to inform the change

Annotations accumulate in a visible queue (todo-list-style panel). The designer submits the queue as a pass. The agent executes all instructions, uses @mentioned tools, makes informed changes, and writes findings back to context repositories. Each pass produces two outputs: a refined prototype AND richer decision context per element.

**Inspect mode (secondary):** The designer targets any element -- even ones never annotated -- to see the decision trail behind it: what context informed it, what passes refined it, what data shaped it. Every element in the prototype is a decision-rich object.

## @Mentions as Agent Action Directives

@mentions are not search queries. They are **directives** -- instructions telling the agent what research task to perform. The syntax is `@source[instruction]`.

The namespace is **configured per project** -- the designer enables tools through the context manager:
- **Local context repositories (always available):** `@research`, `@taste`, `@strategy`, `@design-system`, `@stakeholders`
- **Configured external tools:** `@posthog`, `@figma`, `@linear`, `@slack`, `@amplitude`, and any other tool the designer enables

The five context types are **repositories** where agent findings accumulate -- not the @mention namespace. The annotation tool structures refinement instructions. The agent executes them.

## Context as a Growing Knowledge Base

The context folder structure isn't static. It grows:
- Default context provides a starting point for every project
- The context manager adds structured content before the first prototype
- Each annotation pass may discover new context (via external tool queries)
- That context feeds back into the project files
- The next pass benefits from richer context

Context compounds over time. The agent gets smarter about your project with every iteration.

## Target User

Design leads at AI-forward startups (Series A-C) who are already prototyping with Claude or Cursor weekly. They feel the context pain daily and are technically adventurous enough to adopt a new tool.

## Context Structure

Projects use a local folder convention:
```
/project-name
  /research        (user interviews, findings, pain points)
  /strategy        (vision, success metrics, requirements)
  /design-system   (components, patterns, specifications)
  /stakeholders    (feedback logs, priorities, decisions)
  /taste           (inspiration, brand feeling, anti-patterns, design principles)
```

All stored as markdown/JSON. Local-first. Git-friendly. Agent-readable.

## Context Resolution Depth

Different annotations need different context depth:

| Level | What the agent gets | When to use |
|---|---|---|
| Light | Key finding only | Quick fixes, copy changes |
| Standard | Finding + source + date | Typical iteration pass |
| Detailed | Full finding, related findings, design system constraints | Complex redesigns |
| Full | Everything across all context types for this element | Major architectural decisions |

Lighter context = fewer tokens = cheaper per iteration. Designer chooses, or Contextual infers from annotation complexity.

## The Taste Layer

The /taste folder captures design sensibility -- the aesthetic decisions, cultural references, and quality bar that separate great products from functional ones. This is the context type no other tool captures, and it's where Contextual's differentiation is sharpest.

See TASTE-LAYER.md for full design.

## Positioning

**Agentation** captures what needs to change (element + annotation).
**Contextual** turns every annotation into a refinement instruction with embedded agent sub-tasks, and turns every prototype element into a decision-rich object with a traceable history.

**Category:** The context layer for AI-assisted design iteration.

**One-liner:** Your agent knows your components. Contextual teaches it your users, your research, and your taste.

**Two-sentence pitch:** Every annotation is an instruction to the agent -- what to change and where to find guidance. Every element in the prototype carries a history of why it exists, making design decisions traceable and context accumulative.

## Protocol Ambition

The /research, /taste, /strategy, /design-system folder structure should become a standard convention for how designers organize context for AI tools. Like .cursorrules became a de facto standard for AI coding context.

## What This Is Not

- Not a design tool (it augments the ones you already use)
- Not a knowledge management system (it's structured for agents, not humans)
- Not a replacement for design expertise (your judgment is the input; context makes it portable to agents)
- Not Agentation with a feature bolted on (it's a different product solving a different problem -- context, not just annotation)
