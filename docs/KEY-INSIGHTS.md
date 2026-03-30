# Key Insights from Discussion

## The Spark (March 28, 2026)

John realized: "Designers are no longer building for humans. We're building for agents who are building for humans."

This led to the concept of Contextual - a tool that makes organizational knowledge accessible to AI agents through:
1. Context setup before the first prototype (context manager)
2. Context-informed annotation with @mention agent actions
3. Compound learning across projects

## The Two-Workflow Realization (Session 2)

The original concept described one workflow: annotation-based refinement. The critical insight was that context matters at two moments:

1. **Before the first prototype** -- The LLM needs organizational context to produce a non-generic first output. The context manager (`/use-contextual`) handles this.
2. **During refinement** -- Each annotation pass gives the agent structured instructions with @mention actions to gather more context and make informed changes.

Both workflows share the same context folder structure. Context compounds over time.

## Annotations as Refinement Instructions (Session 3)

The annotation tool is not a context lookup system. Each annotation is a **refinement instruction** to the agent. The designer tells the agent what to change. @mentions within the annotation are **agent sub-tasks** -- directives telling the agent where to find guidance for the change.

**Wrong framing:** "This button feels weak. @research[checkout friction]" -- observation + evidence.
**Correct framing:** "Make this button more visually dominant with a trust indicator next to it @posthog[find proof that trust indicators perform better when paired with visually dominant CTAs]" -- instruction + directive.

## @Mentions as Agent Action Directives (Session 2, refined Session 3)

The original model treated @mentions as local file lookups. Session 2 refined them to agent actions. Session 3 refined further: the syntax is `@source[instruction]` where brackets contain **directives**, not search queries. The namespace is **configured per project** -- the designer enables tools through the context manager.

- `@posthog[find proof that trust indicators boost CTA conversion rates]` -- directive to query PostHog
- `@research[what do our usability studies say about CTA confidence]` -- directive to search local research
- `@figma[check if we have an existing component for inline trust badges]` -- directive to check Figma

The five context types (research, taste, strategy, design-system, stakeholders) are **repositories** where findings accumulate -- not the @mention namespace. The annotation tool structures instructions. The agent executes them.

## Two Modes, One Annotation Tool (Session 3)

The annotation tool has two modes sharing the same element-targeting interface:

1. **Instruct mode (primary):** Write refinement instructions with @mention action directives. Annotations accumulate in a visible queue (todo-list-style panel). Submit the queue as a pass.
2. **Inspect mode (secondary):** Target any element to understand the decision trail behind it -- what context informed it, what passes refined it, what data shaped it.

## The Decision-Rich Prototype (Session 3)

Every element in the prototype carries a history of why it exists -- not just elements the designer has explicitly annotated. The agent makes decisions about every element (button color, field order, typography, spacing) informed by the full body of context. Inspect mode illuminates these decisions. Instruct mode enriches them. Each pass produces two outputs: a refined prototype AND richer decision context per element.

## Why This Matters (vs Writing About Change)

**The Benji Taylor Lesson**: Don't write about paradigm shifts - build tools that embody them. Agentation doesn't theorize about agentic design; it just lets you click and annotate.

## The Local File System Advantage

- **No gatekeepers** - No APIs, permissions, or rate limits for local context
- **Native agent language** - Markdown/JSON is how agents already think
- **Instant feedback loops** - Change -> see -> annotate -> repeat
- **Version control built-in** - Git tracks everything
- **Growing knowledge base** - Context compounds as the agent discovers new information through @mention actions

## The Designer as Integration Layer

No third-party integrations needed for context setup. The designer brings the content (research notes, stakeholder emails, brand docs). The LLM structures it into the right context folders. External tools are accessed through @mention agent actions, not through upfront API integrations.

## Why Not Just a Skill?

Skills create new UI through text instructions. Contextual operates at two levels:
- **Context manager**: Visual browser UI for organizing context before the first prototype
- **Annotation component**: Visual/spatial annotation of prototype elements with @mention agent actions
- **Skill approach**: "Create button with 16px padding"
- **Contextual approach**: Click -> "Make this button more prominent @research[what do our usability studies say about CTA confidence] @posthog[find proof that trust indicators boost conversion]" -> Agent executes directives, makes informed change, writes findings back to context

## The Evolution of Designer Value

**Old world**: "I can craft beautiful interfaces"
**New world**: "I can teach agents to craft beautiful interfaces with full context"

The craft isn't the pixels anymore. The craft is the context.

## Context as Infrastructure

Not just a design system, but an entire organizational brain:
- Every element in the prototype is a decision-rich object with traceable history
- Every annotation enriches future projects through context repositories
- Knowledge compounds rather than disappears -- each pass produces two outputs (refined prototype + richer decisions)
- The agent gets smarter about your project with every pass
- Inspect mode makes the growing decision history accessible at any time

## The Cold Start Solution

Empty context folders = no value. The solution:
1. **Default context** - Every new project starts with a Contextual root folder (design system, taste, strategy)
2. **LLM-assisted structuring** - Paste raw content, LLM organizes it into context types
3. **Context portability** - Import reusable context from previous projects

The designer never starts from zero.

## Why Now?

1. Agents are capable enough to use structured context and execute tool actions (MCP)
2. Designers are looking for better ways to work with AI
3. Agentation proved the annotation interaction model works
4. .cursorrules proved that simple local context files change AI output quality
5. No one has combined context setup + visual annotation + agent actions
6. Token costs make iteration efficiency a real financial concern
