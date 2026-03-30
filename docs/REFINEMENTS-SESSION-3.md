# Contextual - Strategic Refinements (Session 3)

This document records the strategic evolution that occurred during Session 3 discussions. All refinements below have been applied to the core strategy, architecture, and supporting docs. This file is kept as a historical record of what changed and why.

---

## 1. Annotation as Prompt (Core Reframe)

### Previous Understanding

The annotation tool was built as a context lookup system. The designer annotated an element, typed @mentions that searched local context files, reviewed the pre-searched results, and submitted a structured analysis document to the agent. The @mentions pulled in evidence; the output read like a research report.

### Corrected Understanding

Each annotation is a **refinement instruction** to the agent. The designer tells the agent what to change. @mentions within the annotation are **agent sub-tasks** that inform how the change gets made.

**Example of the wrong framing:**
"This button feels weak. @research[checkout friction]" -- reads as "here's my observation, here's the evidence."

**Example of the correct framing:**
"Make this button more visually dominant with a trust indicator next to it @posthog[find proof about how trust indicators perform better when paired with visually dominant CTAs]" -- reads as "change this, and do this research to inform the change."

The annotation is the **what to do**. The @mentions are the **how to think about it**, with specific sub-tasks the agent should execute.

---

## 2. @Mentions as Agent Actions (Refined from Session 2)

### Session 2 Understanding

@mentions had an open-ended namespace -- any tool the agent could reach. The five context types (research, taste, strategy, design-system, stakeholders) were described as local folder types, with external @mentions being agent actions against connected tools.

### Session 3 Refinement

The @mention namespace is **configured, not fully open-ended**. The user enables the tools and systems they have access to. These might include:

- **AI agents**: Claude, Codex, etc.
- **Analytics**: PostHog, Amplitude
- **Design tools**: Figma
- **Development**: Vercel, GitHub
- **Communication**: Slack, Teams
- **Project management**: Linear, Jira
- **Any other MCP-connected tool**

The user configures which tools are available as @mention targets in the context manager (see Section 5).

### The @mention Construct

The syntax is `@source[instruction]` where:
- `@source` is the configured tool or service
- `[instruction]` is a directive to the agent about what to do with that source -- not a search query, but a research task or action

The agent:
1. Receives the instruction
2. Calls the referenced tool (via MCP or API)
3. Gets data back
4. Uses the data to inform the refinement
5. Writes the findings back into the appropriate context repository

### Context Types as Repositories

The five context types (research, taste, strategy, design-system, stakeholders) remain important, but they serve as **repositories for design decisions** -- the places where findings accumulate. They are not the @mention namespace. Agent findings from @mention actions get filed into the appropriate context type folder.

---

## 3. Two Modes of the Annotation Tool

The annotation tool is a single interface with two modes, both accessed by targeting an element on screen.

### The Decision-Rich Prototype

Every element in the prototype has a series of contextual decisions behind it -- not just elements the designer has explicitly annotated. When the agent builds or modifies a prototype, it makes decisions about every element: button color, field order, typography, spacing, trust badge placement. Those decisions are informed by the full body of context: initial project setup, taste references, research findings, stakeholder directives, and agent research from @mention actions.

The prototype is not a flat artifact. It is a **decision-rich object** where every element carries a history of why it exists in its current form.

### Inspect Mode (Secondary)

The designer targets **any element** -- whether previously annotated or not -- and the tool surfaces the decision trail behind it.

**Flow:**
1. Target any element on the prototype
2. Switch to Inspect mode
3. See the contextual decisions behind that element: what context informed it, what research shaped it, what stakeholder directives influenced it, what prior passes refined it

**Example:** The designer clicks the Pay button, which they never explicitly annotated. Inspect shows: "This button is indigo because the design system specifies Indigo 500 for primary actions. It reads 'Pay $49.00' with the exact amount because the Stripe taste reference recommended unambiguous CTAs. It's full-width because the CEO directive said mobile-first. The trust indicator was added in Pass 3 after PostHog data showed trust badges near CTAs increase conversion by 18%."

Every element has decisions behind it. Inspect illuminates them.

This mode reads from the context repositories that have been growing through setup and Instruct passes. The local context server's FTS5 search capability serves this mode -- searching the accumulated context for relevant decision history.

### Instruct Mode (Primary)

The designer targets an element and writes a refinement instruction with @mention actions. This **adds to the decision trail** -- providing feedback and requesting additional context that will inform future decisions about that element and potentially others.

**Flow:**
1. Target an element
2. Write instruction: "Make this button more prominent @posthog[find data on CTA visibility and conversion]"
3. Add to the annotation queue (see Section 4)
4. Continue annotating other elements
5. Submit the pass when ready

The agent receives the pass, executes all instructions, uses @mentioned tools, makes the changes, and writes findings back to context. Every instruction enriches the decision context for the affected elements.

This is the **dominant interaction** with the prototype.

### The Relationship Between Modes

- **Inspect** illuminates the decisions behind any element
- **Instruct** enriches the decisions by adding feedback and requesting additional context
- Both operate on the same decision-rich prototype
- Both start with element targeting; the divergence is in what happens next

---

## 4. Annotation Queue and Pass Structure

### Previous Understanding

A pass was described as "one annotation or many" -- the designer submits whenever ready. There was no explicit queue concept.

### Session 3 Refinement

The annotation tool needs an **annotation queue** -- a visible list that builds up as the designer works, similar to a todo list.

**How it works:**

1. Designer targets element A, writes instruction + @mentions --> added to queue
2. Designer targets element B, writes another instruction --> added to queue
3. Designer targets element C --> added to queue
4. The queue is visible in the UI (like a todo list sidebar or panel)
5. Designer can review, edit, reorder, or remove annotations from the queue
6. When ready, designer submits the pass

### Pass = Submitted Queue

A pass is the entire annotation queue submitted as a unit. It becomes a **structured set of prompts** that the agent processes:

- Each annotation is one prompt (element + instruction + @mention actions)
- The agent works through the set, executing refinements and @mention sub-tasks
- Results (prototype changes + gathered context) feed back into the context repositories

### Single Annotation Is Still Valid

A designer can add one annotation to the queue and submit immediately. The queue doesn't enforce batching -- it enables it.

---

## 5. Context Manager (Expanded Role)

### Previous Understanding

The context manager was a one-time setup wizard with 4 steps: review defaults, paste material, import from previous projects, write handoff.

### Session 3 Refinement

The context manager has an expanded, ongoing role:

### Tool Configuration

This is where the user enables which tools and services are available as @mention targets. The context manager defines the namespace:
- Connect PostHog, Figma, Amplitude, Slack, etc.
- Each connected tool becomes available as an @mention target in the annotation tool
- Configuration persists per project

### Context Repositories as Living Stores

The five context types are not just starting material. They are **living repositories** where agent findings accumulate after every pass:

- Pass includes `@posthog[find data on checkout abandonment]`
- Agent queries PostHog, finds data
- Agent writes findings to `/research/posthog-checkout-abandonment-2025-03.md`
- That context is now available for future Inspect queries and future passes

The context manager needs to surface this growing body of decisions, not just the initial seed content.

### Ongoing Role

The context manager is not a one-time setup tool. It has three ongoing functions:

1. **Initial setup**: Configure tools, set up context repositories, import starting material
2. **Repository viewer**: See accumulated context across all types, understand the decision history
3. **Configuration management**: Add/remove tools, manage defaults, import from other projects

The context repositories are what feed the Inspect mode in the annotation tool.

---

## 6. The Complete Feedback Loop

```
Designer annotates elements (Instruct mode)
    |
    v
Annotation queue builds up
    |
    v
Designer submits pass (structured prompt set)
    |
    v
Agent receives pass
    |
    +--> Executes refinement instructions (changes the prototype)
    |
    +--> Executes @mention actions (calls PostHog, Figma, etc.)
    |
    +--> Writes findings back to context repositories
    |
    v
Updated prototype reflects TWO things:
    |
    +--> The visible refinements (what the designer asked for)
    |
    +--> Deeper decision context per element (why each change was made,
    |    what data informed it, what the agent found)
    |
    v
Context repositories grow
    |
    +--> Feed Inspect mode (designer can now understand the decisions
    |    behind each annotated element with richer context than before)
    |
    +--> Inform future passes (richer context over time)
    |
    +--> Visible in context manager (repository viewer)
    |
    v
Designer reviews updated prototype
    |
    v
Designer annotates again (next pass)...
```

Each pass produces two outputs: a better prototype AND a deeper understanding of the decisions behind it. The prototype isn't just visually refined -- each annotated element now carries richer context about why it looks the way it does. This is what makes Inspect mode increasingly valuable over successive passes. The system is accumulative in both dimensions: design quality and decision transparency.

---

## 7. What This Changes About Session 2

### Session 2 Decisions That Still Hold

- Two-workflow model (context setup + annotation refinement)
- Context folder convention (/research, /taste, /strategy, /design-system, /stakeholders)
- Monorepo structure
- Local context server for indexing and search
- `/use-contextual` command for initial setup

### Session 2 Decisions That Are Refined

| Session 2 | Session 3 |
|-----------|-----------|
| @mention namespace is open-ended | @mention namespace is configured per project (user enables tools) |
| Annotation tool is a structured prompt builder | Annotation tool is a refinement instruction builder with two modes (Instruct + Inspect) |
| Pass = one or many annotations, no queue | Pass = submitted annotation queue; queue is a visible UI element |
| Context manager is a one-time setup wizard | Context manager is ongoing: setup, repository viewer, tool configuration |
| Server pre-searches local context and shows preview | Server serves Inspect mode; Instruct mode passes actions through to agent |
| Five context types are local folder types AND @mention targets | Five context types are repositories only; @mention targets are configured tools |
| Resolution depth levels (light/standard/detailed/full) | Depth may still apply to Inspect mode, but Instruct mode sends instructions as-is |

---

## 8. Impact on Current Codebase

### What Can Be Kept

- **Element targeting** (useElementTargeting hook) -- same for both modes
- **Annotation input surface** -- same text entry, though @mention autocomplete changes
- **Server indexing/FTS5 search** -- repurposed for Inspect mode
- **Monorepo structure and shared types** -- architecture is sound
- **Context manager component structure** -- needs expansion, not replacement
- **Demo package** -- still useful for testing

### What Needs to Change

- **Annotation tool output model**: From analysis document to refinement instruction set
- **@mention parser**: From fixed 5-type autocomplete to configured tool namespace
- **New: Annotation queue UI**: Todo-list-style panel for building up passes
- **New: Instruct/Inspect mode toggle**: Two modes sharing one element-targeting interface
- **Context preview panel**: In Instruct mode, shows the instruction set being built; in Inspect mode, shows decision history
- **Context manager**: Add tool configuration, repository viewer, ongoing management
- **Server endpoints**: May need new endpoints for Inspect mode (decision trail per element)
- **Shared types**: ContextType remains for repositories; new types needed for configured tools

### What's New to Build

- Annotation queue component and state management
- Instruct/Inspect mode switching
- Tool configuration system (in context manager)
- Decision trail indexing (which passes affected which elements)
- Agent action protocol (structured format for @mention instructions)
