# Contextual - Product Strategy

## Vision

Reduce iteration loops, token spend, and rework in AI-assisted design by giving agents organizational context at the point of annotation -- and before the first prototype is even generated.

## Core Hypothesis

Structured context (research, taste, stakeholder feedback, design system refs, strategy) fed to AI agents produces more consistent, user-aligned, and operator-aligned outputs -- with fewer iterations and less token spend. This is true whether the context informs the initial prototype or the refinement annotations that follow. If this is true, the product builds itself. If it's not, nothing else matters.

## Founder's Advantage

This product is being built from lived operating experience, not from a cold-start hypothesis. Prior internal work proved that AI can sit productively across the design-to-engineering boundary when the system has the right structure.

That workflow already established a few things that matter here:
- A shared design system can function as a contract between design and engineering
- AI can turn design intent into working prototypes quickly enough to change team behavior
- Prototypes become much more valuable when they are built from real system components instead of screenshots
- Designers will use AI workflows when the path from idea to editable output is short and reliable

Contextual extends that same pattern one layer earlier. Instead of only translating approved designs into prototypes and production-ready components, it gives the agent the research, strategy, stakeholder context, and taste needed to make better design decisions from the very first output.

## Value Proposition

**Fewer iterations, less token spend.** Every round-trip with an agent costs tokens and designer time. Context-enriched annotations reduce rework loops because the agent isn't guessing -- it has the research, the taste references, the stakeholder input.

**Better first outputs.** With Contextual, the agent has organizational context before generating the initial prototype. The first output is informed by real research, real strategy, and real design system constraints -- not generic best practices.

**Consistent outputs.** Without context, every prompt starts from zero. The agent reinvents your brand, spacing, and interaction patterns each time. With context, outputs stay aligned with established standards.

**Aligned with user needs.** The agent builds for your actual users based on your research, not generic assumptions.

**Aligned with human operator intent.** The designer or stakeholder has a point of view. Context makes that POV legible to the agent instead of requiring manual re-explanation every prompt.

## Beachhead ICP

**Design leads at AI-forward startups (Series A-C) who are already prototyping with Claude or Cursor weekly.**

Why this ICP:
- They already feel the context pain -- they're prompting AI tools daily and getting generic output
- They're technically adventurous enough to adopt a new tool
- They're in John's direct network
- They have real projects with real organizational context to test against
- They can become case studies and evangelists

Exclude until repeat usage is proven: freelancers, enterprise teams, non-AI-using designers, researchers, PMs.

## Two-Workflow Model

Contextual supports two distinct workflows that share one context system.

### Workflow 1: Context-Informed First Prototype

Before a prototype exists, the designer needs to organize context so the LLM's first output is actually informed by organizational knowledge.

**Entry point:** Designer types `/use-contextual` in their LLM environment (Claude Code, Codex, Cursor).

**What happens:**
1. A local React app (the "context manager") opens in the browser
2. The app shows default context that comes with every new project
3. The designer can add new context by pasting raw unstructured content
4. The designer can import reusable context from previous projects
5. When finished, the content goes back to the LLM session
6. The LLM structures the raw content into properly categorized context files
7. Context files are written to the project's folder structure
8. The designer generates their first prototype, now informed by structured context

### Workflow 2: Context-Informed Refinement

A prototype exists. The designer uses the annotation component to refine it. The annotation tool has two modes:

**Instruct mode (primary):** Each annotation is a refinement instruction. The designer tells the agent what to change, with @mention actions that tell the agent where to look for guidance.

1. Designer activates Contextual in the browser (toolbar appears alongside prototype)
2. Clicks, highlights, or drag-selects UI elements
3. Types refinement instructions with @mention actions (e.g., "Make this button more dominant @posthog[find proof that trust indicators boost CTA conversion]")
4. Each annotation is added to an **annotation queue** -- a visible todo-list-style panel
5. Designer continues annotating other elements, building up the queue
6. When ready, designer submits the pass (the entire queue as a structured prompt set)
7. The agent executes all instructions, uses @mentioned tools, makes changes
8. Agent writes findings back into context repositories
9. Updated prototype reflects both the visible refinements AND deeper decision context per element

**Inspect mode (secondary):** The designer targets any element -- whether previously annotated or not -- to understand the decision trail behind it. Every element in the prototype has contextual decisions behind it (from initial context, taste references, prior passes, agent research). Inspect surfaces these decisions.

### The Decision-Rich Prototype

The prototype is not a flat artifact. Every element carries a history of why it exists in its current form -- which context informed it, which passes refined it, what data the agent found. Each pass produces two outputs: a better prototype AND a deeper understanding of the decisions behind every element. This is what makes Inspect mode increasingly valuable over successive passes.

### Shared Context Layer

Both workflows read from and write to the same context folder structure. Context compounds over time -- the knowledge base grows with each pass.

## @Mention Actions

@mentions are instructions for the agent to take action. The syntax is `@source[instruction]` where `@source` is a configured tool or service, and `[instruction]` is a directive telling the agent what to do with that source.

**Examples:**
- `@posthog[find proof that trust indicators perform better when paired with visually dominant CTAs]` -- agent queries PostHog for data
- `@figma[check if we have an existing component for inline trust badges]` -- agent pulls from Figma
- `@amplitude[find the checkout funnel drop-off rate for mobile users]` -- agent queries Amplitude
- `@research[what do our usability studies say about CTA confidence]` -- agent searches local research files

The @mention namespace is **configured per project** -- the designer enables the tools and services they have access to (PostHog, Figma, Amplitude, Slack, Vercel, etc.) through the context manager. Each enabled tool becomes available as an @mention target.

The five context types (research, taste, strategy, design-system, stakeholders) are **repositories** where design decisions and agent findings accumulate. They are not the @mention namespace -- they are where results get stored.

## Context Resolution Depth

The structured prompt sent to the agent includes two kinds of content:

1. **Local context snippets** -- pre-searched from the context folders and embedded in the prompt at the depth level the designer chose. This is a convenience: the agent gets relevant local findings up front without needing to search from scratch.
2. **External action instructions** -- passed through as-is regardless of depth. The agent executes these at runtime (e.g., querying PostHog, pulling Figma specs).

Depth controls how much local context is pre-attached. Lighter context = fewer tokens = cheaper per iteration.

| Level | Local context included | External actions | When to use |
|---|---|---|---|
| Light | Key finding only (~120 chars) | Passed as-is | Quick fixes, copy changes |
| Standard | Finding + source + date | Passed as-is | Typical iteration pass |
| Detailed | Full finding + related findings + design system constraints | Passed as-is | Complex redesigns |
| Full | Everything across all context types for this element | Passed as-is | Major decisions |

Designer chooses explicitly, or Contextual infers from annotation complexity. The agent can always do additional resolution beyond what's pre-attached.

## Cold Start Solution

### Problem

Empty context folders mean the structured prompt carries no local context snippets -- the agent receives action instructions but has nothing pre-attached to work from. First outputs are weaker, and the time-to-first-useful-output exceeds the Gate 1 target if the designer has to manually populate folders before generating anything.

### Solution

**Default context.** Every new project starts with a Contextual root folder containing baseline context: design system docs, established taste principles, company-wide strategy, and other project-agnostic context the designer has configured as defaults. This folder is copied to each new project.

**LLM-assisted structuring.** The context manager UI lets designers paste raw unstructured content. The LLM (in the designer's existing session) categorizes and structures it into the right context folders. No separate API key required.

**Context portability.** Designers can import reusable context from previous Contextual projects. Design system and taste carry forward. Project-specific research stays behind.

## Stage-Gate Roadmap

### Gate 1: Core Loop Activated by Target ICP

**Objective:** Prove both workflows create value -- context-informed first prototype and annotation-based refinement.

**Metrics:**

*Workflow 1 (first prototype quality):*
- Setup completion rate (project created, context added via context manager) >80%
- Time from `/use-contextual` to first prototype output <5 min
- Blind comparison: context-informed first prototype rated higher than context-blind baseline on same task by designer (3 of 5 test cases)

*Workflow 2 (refinement quality):*
- User completes 10+ annotations in first week
- Passes with @mention actions produce accepted changes at higher rate than plain-instruction passes (directional signal, not statistical)

*Both workflows:*
- Designer reports that context materially improved output quality on at least one real task (qualitative, per user)

**Timeline:** First 4-6 weeks after MVP is usable

### Gate 2: Repeat Weekly Usage and Retention

**Objective:** Prove designers come back.

**Metrics:**
- Weekly annotation sessions per active user
- D7 retention > 40%
- D30 retention > 20%
- % of annotations that include @mention actions (vs. plain instructions)

**Timeline:** After Gate 1

### Gate 3: Paid Single-User Conversion

**Objective:** Prove someone will pay for this.

**Metrics:**
- Conversion rate from free to paid
- Willingness-to-pay signal from beta users
- User-reported quality lift vs. working without Contextual
- Token spend: Directional signal only if tooling exposes comparable usage

**Timeline:** After Gate 2 passes

### Gate 4: Team Features and Enterprise Pilots

**Objective:** Prove multi-user value.

**Prerequisites:** Permissioning, audit controls, security model, data boundaries
**Metrics:** Team adoption rate, shared context usage, enterprise pilot close rate

**Timeline:** Only after Gate 3

## MVP Scope (Initial Build Target)

> **Implementation note:** The sections below describe the target MVP after Session 3 refinements. The current codebase has the foundational infrastructure (monorepo, shared types, basic annotation flow, FTS5 server, context manager handoff), but does not yet implement Instruct/Inspect modes, annotation queue, configured tool namespace, tool configuration UI, repository viewer, or decision-trail indexing. See SUMMARY.md "Current Status" for the exact gap.

### Architecture: Three components

1. **Context manager** (standalone React app) -- browser-based UI with an ongoing role. Handles initial setup (default context, raw content paste, project import) via `/use-contextual`. Also serves as the **tool configuration** surface (enable PostHog, Figma, Amplitude, etc. as @mention targets) and the **repository viewer** (see accumulated context across all types, understand the decision history growing with each pass).

2. **React annotation component** (npm package) -- renders in-browser alongside the prototype. Two modes: **Instruct** (refinement instructions with @mention actions, added to an annotation queue, submitted as passes) and **Inspect** (target any element to surface the decision trail behind it). The annotation queue is a visible todo-list-style panel.

3. **Local context server** (Node process) -- indexes context folders, provides autocomplete suggestions for the annotation component. Serves the Inspect mode by searching accumulated context for decision history relevant to any element. The Instruct mode passes @mention actions through to the agent -- the server does not execute them.

### Core loops:

**Workflow 1 (Setup):**
1. Designer invokes `/use-contextual` in LLM environment
2. Context manager opens in browser
3. Reviews/configures default context
4. Pastes raw content, imports from previous projects
5. Submits back to LLM session
6. LLM structures and files content into context folders
7. Designer generates first prototype with full context

**Workflow 2 (Refinement -- Instruct mode):**
1. Designer activates annotation toolbar in browser
2. Clicks/highlights/drag-selects UI elements
3. Types refinement instruction with @mention actions
4. Annotation added to queue (visible todo-list panel)
5. Repeats for other elements as needed
6. Submits pass (entire queue as structured prompt set)
7. Agent processes pass: executes instructions, uses @mentioned tools, makes changes
8. Returns updated prototype with refined elements + richer decision context
9. Findings written back to context repositories

**Workflow 2 (Understanding -- Inspect mode):**
1. Designer targets any element on the prototype
2. Switches to Inspect mode
3. Sees the decision trail behind that element: what context informed it, what research shaped it, what prior passes refined it

### In scope:
- Context manager React app (initial setup, tool configuration, repository viewer)
- React annotation component with two modes (Instruct + Inspect)
- Annotation queue UI (todo-list-style, reviewable before submission)
- @mention syntax parsing with configured tool namespace
- Annotation pass submission (structured prompt set to agent)
- Local context server (indexing, autocomplete, Inspect mode search)
- Decision trail per element (which context informed each element)
- Default context root folder with templates
- Project scaffold (folder structure creation)

### Out of scope:
- Desktop app (future expansion after browser-based value proven)
- Voice input (acceleration layer after typed flow validated)
- Team features, sharing, permissions
- Auto-sync from Slack, Figma, Notion (designer is the integration layer)
- Cloud anything
- Enterprise controls

### Principle: No infrastructure work unless it directly improves the core loops.

## Positioning

**Agentation** captures what needs to change (element + annotation).
**Contextual** turns every annotation into a refinement instruction with embedded agent sub-tasks, and turns every prototype element into a decision-rich object with a traceable history.

**Category:** The context layer for AI-assisted design iteration.

**One-liner:** Your agent knows your components. Contextual teaches it your users, your research, and your taste.

**Two-sentence pitch:** Every annotation is an instruction to the agent -- what to change and where to find guidance. Every element in the prototype carries a history of why it exists, making design decisions traceable and context accumulative.

**Protocol ambition:** The /research, /taste, /strategy, /design-system folder structure should become a standard convention for how designers organize context for AI tools. Like .cursorrules became a de facto standard for AI coding context.

## Monetization (Sequenced to Capability)

### Stage 1: Single-user paid (post-Gate 3)
- Free tier: basic annotation, 1 project, local only
- Pro ($15-25/mo): unlimited projects, advanced search, export formats
- Price validated through beta user willingness-to-pay conversations

### Stage 2: Small-team sharing (post-Gate 4 prerequisites)
- Team tier: shared context libraries, basic permissions
- Pricing TBD based on team value signal

### Stage 3: Enterprise (only after trust controls exist)
- Custom pricing, on-prem option, SSO, audit logs
- Requires: encryption, data boundaries, redaction controls, compliance work

No team/enterprise revenue assumptions in the plan until stage gates are met.

## Trust Model (Minimum Viable)

**Beta posture:**
- Local-first: all context stays on device by default
- Explicit data boundaries: clear documentation of what leaves device (nothing, unless user submits to their own LLM session)
- No telemetry on context content
- Git-friendly storage: user owns and controls all files

**Enterprise posture (later):**
- Local encryption at rest
- Redaction controls for sensitive context
- "Never leaves device unless..." policy with explicit user consent
- Compliance trajectory defined when enterprise motion begins

## Success Metrics by Stage

| Stage | Metric | Target |
|-------|--------|--------|
| Gate 1 (WF1) | Setup completion | >80% |
| Gate 1 (WF1) | Time from /use-contextual to first prototype | <5 min |
| Gate 1 (WF1) | Context-informed vs context-blind prototype quality | Designer prefers informed version in 3 of 5 test cases |
| Gate 1 (WF2) | Annotations in week 1 | 10+ per user |
| Gate 1 (WF2) | @mention action passes vs plain passes | Directional signal that actions produce better changes |
| Gate 1 | Output quality lift (both workflows) | Qualitative signal per user on real tasks |
| Gate 2 | D7 retention | >40% |
| Gate 2 | D30 retention | >20% |
| Gate 2 | Weekly sessions | 3+ per user |
| Gate 3 | Free-to-paid conversion | >5% |
| Gate 3 | User-reported quality lift | Qualitative signal |

## Go-to-Market (Controllable Channels Only)

- **Build-in-public series:** Document building Contextual and what live usage reveals
- **Design-team pilots:** Direct outreach to ICP in John's network
- **Before/after demos:** Screen recordings showing output quality with real context in real workflows
- **Generalista community:** Newsletter subscribers as early beta pool
- **Case studies from beta users:** Real projects, real results

No GTM plan depends on endorsements, viral moments, or uncontrollable events.
