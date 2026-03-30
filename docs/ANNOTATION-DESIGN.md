# Annotation Design - Refinement Instructions with Agent Actions

> **Implementation note:** This document describes the **target design** after Session 3 refinements. The current `packages/react` implements a single-mode annotation flow with fixed 5-type @mention parsing, context pre-search + preview, and clipboard copy. The features below (Instruct/Inspect modes, annotation queue, configured namespace, decision trail) are the next implementation pass.

## The Core Model: Annotations Are Refinement Instructions

Each annotation is an instruction to the agent about what to change. @mentions within the annotation are agent sub-tasks that tell the agent where to find guidance for the change. The annotation tool has two modes: **Instruct** (write refinement instructions) and **Inspect** (understand the decisions behind any element).

## The Decision-Rich Prototype

Every element in the prototype has a series of contextual decisions behind it -- not just elements the designer has explicitly annotated. When the agent builds or modifies a prototype, it makes decisions about every element: button color, field order, typography, spacing, trust badge placement. Those decisions are informed by the full body of context.

The prototype is not a flat artifact. It is a **decision-rich object** where every element carries a history of why it exists in its current form.

## Two Modes

### Instruct Mode (Primary)

The designer targets an element and writes a refinement instruction with @mention actions. This is the dominant interaction with the prototype.

Each annotation has two parts:
1. **Refinement instruction** -- what the designer wants the agent to change
2. **@mention actions** -- embedded sub-tasks telling the agent where to find guidance

```
"Make this button more visually dominant with a trust indicator next to it
 @posthog[find proof that trust indicators perform better when paired with visually dominant CTAs]"
```

The agent:
1. Reads the refinement instruction
2. Executes the @mention action (queries PostHog)
3. Uses the findings to inform the design change
4. Writes the findings back to the appropriate context repository

### Inspect Mode (Secondary)

The designer targets **any element** -- whether previously annotated or not -- to understand the decision trail behind it.

**Example:** The designer clicks the Pay button, which they never explicitly annotated. Inspect shows: "This button is indigo because the design system specifies Indigo 500 for primary actions. It reads 'Pay $49.00' with the exact amount because the Stripe taste reference recommended unambiguous CTAs. It's full-width because the CEO directive said mobile-first."

Every element has decisions behind it. Inspect illuminates them. Instruct enriches them.

## @Mention Syntax

### The Construct

The syntax is `@source[instruction]` where:
- `@source` is a configured tool or service
- `[instruction]` is a directive to the agent about what to do with that source

The bracket content is an **instruction**, not a search query. It tells the agent what research task to perform.

### Examples by Tool

**Analytics:**
```
@posthog[find proof that trust indicators boost CTA conversion rates]
@amplitude[what's the checkout funnel drop-off rate for mobile users]
@mixpanel[how do users navigate from product page to checkout]
```

**Design:**
```
@figma[check if we have an existing component for inline trust badges]
@figma[what were the previous versions of this checkout layout]
```

**Project Management:**
```
@linear[are there open issues related to checkout accessibility]
@jira[what tickets exist for the payment form redesign]
```

**Communication:**
```
@slack[find recent feedback about the checkout experience]
@teams[what did the product team say about mobile checkout]
```

**Local Context Repositories:**
```
@research[what do our usability studies say about CTA confidence]
@taste[how does Stripe handle trust indicators near payment buttons]
@design-system[what are our button prominence and spacing patterns]
@stakeholders[what did the CEO say about trust and mobile-first]
@strategy[what are the Q1 conversion rate targets for checkout]
```

### Configured Namespace

The @mention namespace is **configured per project**. The designer enables available tools through the context manager. Only enabled tools appear in autocomplete. The five local context types (research, taste, strategy, design-system, stakeholders) are always available as they represent the context repositories.

## Annotation Queue

Annotations accumulate in a **visible queue** -- a todo-list-style panel in the UI.

**How it works:**
1. Designer targets element A, writes instruction + @mentions --> added to queue
2. Designer targets element B, writes another instruction --> added to queue
3. Designer targets element C --> added to queue
4. Queue is visible, reviewable, editable (reorder, edit, remove)
5. Designer submits the pass when ready

A designer can also add one annotation and submit immediately. The queue enables batching but doesn't enforce it.

## Passes

A pass is the submitted annotation queue -- a **structured set of refinement instructions** that the agent processes as a unit.

Each pass produces two outputs:
1. **A refined prototype** -- visible changes to the elements the designer instructed on
2. **Richer decision context** -- every element now carries deeper understanding of why it exists

The agent works through each instruction, executes @mention actions, makes informed changes, and writes findings back to context repositories. The knowledge base grows with every pass.

## Smart Features

### Auto-complete
As user types `@post...` --> suggests `@posthog` (if enabled in context manager)
As user types `@res...` --> suggests `@research`
As user types `@research[check...` --> suggests recent checkout-related content from local index

### Inspect Preview
When in Inspect mode, the tool queries the context server for decision history relevant to the targeted element. Results show which context informed the element, which passes modified it, and what agent research shaped it.

### Fallback
If no context is found for a local @mention, or a configured tool is unreachable, the instruction still goes through. The agent can search more broadly or report what it couldn't access.

## Resolution Depth

Depth may still apply to how the Inspect mode surfaces decision history (how much detail to show). For Instruct mode, @mention actions are always passed as instructions to the agent -- depth doesn't truncate the directive.

| Level | Inspect mode behavior | Instruct mode behavior |
|---|---|---|
| Light | Summary of decisions per element | Instructions passed as-is |
| Standard | Decisions + source references | Instructions passed as-is |
| Detailed | Full decision trail + related context | Instructions passed as-is |
| Full | Complete cross-type decision history | Instructions passed as-is |

## Key Design Principles

1. **Instructions, Not Analysis** -- Annotations tell the agent what to change, not what the designer observes
2. **Configured Namespace** -- @mention targets are tools the designer has enabled, not a fixed set
3. **Actions, Not Queries** -- Bracket content is a directive ("find proof that..."), not a search term
4. **Queue Before Submit** -- Annotations accumulate; the designer controls when to submit
5. **Two Modes, One Surface** -- Instruct and Inspect share the same element-targeting interface
6. **Every Element Has Decisions** -- Not just annotated elements; the entire prototype is decision-rich
7. **Context Grows** -- Every pass adds to the decision trail and the context repositories
8. **Agent Executes** -- The annotation tool structures instructions; the agent does the work
