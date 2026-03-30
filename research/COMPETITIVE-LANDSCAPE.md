# Competitive Landscape

## The Interaction Model Precedent: Agentation

Benji Taylor's Agentation (benji.org/agentation) established the interaction model for visual AI annotation: a React component that lets you click, highlight, drag-select, and annotate UI elements in the browser, then send structured feedback to any AI agent.

Agentation proved:
- Designers and developers want to point at things, not just describe them in text
- A React component that renders alongside the prototype is the right form factor
- Structured markdown output works with any agent (Claude, Cursor, etc.)
- Iterative "best-shotting" (context-rich passes) beats "one-shotting" (hoping the first attempt works)

**What Agentation doesn't do:** It captures the *what* (element + annotation) but not the *why* (organizational context) or the *what actions to take* (agent instructions). The agent gets "make this button more prominent" without knowing why it should be prominent based on user research, what your brand's approach to prominence looks like, or what data from PostHog says about its current performance.

**Contextual's position:** Same interaction model, different problem. Agentation solves visual feedback. Contextual solves context-informed feedback with agent actions. They're complementary, not competitive.

## What Contextual Does Differently

### Two Workflows, Not One

**Agentation** captures what needs to change (element + annotation).
**Contextual** captures what needs to change + why + what the agent should do to inform the change (element + annotation + @mention actions + organizational context) -- and it starts *before the first prototype is generated*, not just during refinement.

**Workflow 1: Context-Informed First Prototype** -- The context manager (`/use-contextual`) ensures the LLM has full organizational context before generating the first prototype. No other tool addresses this.

**Workflow 2: Context-Informed Refinement** -- Annotations include natural language instructions plus @mention actions for the agent. @mentions are agent actions across an open-ended namespace -- local context types (@research, @taste, etc.) AND external tools (@posthog, @figma, @linear, @slack, anything via MCP/API).

### @Mentions as Agent Actions

No other annotation tool treats annotations as structured agent instructions. Contextual's @mention system tells the agent what to do:
- `@research[checkout friction]` -- search local research files
- `@posthog[checkout drop-off data]` -- query PostHog via MCP
- `@figma[component specs]` -- pull specs from Figma
- `@linear[open issues]` -- check Linear for related tickets

The annotation tool collects and structures. The agent resolves and executes. The namespace is open-ended.

## Real Threats (ranked by severity)

### 1. Figma AI (High)

Figma has the richest design context of any tool: files, components, comments, design systems, version history. They're actively shipping AI features.

**What they could build:** "Reference your research when generating designs" or "AI that knows your design system and applies it automatically."

**Why they haven't yet:** Figma's context is limited to Figma. They don't have user research, Slack conversations, stakeholder feedback, analytics data, or taste references. Their AI knows your design files, not your organizational knowledge. They also have no concept of agent actions -- they can't tell an AI to go query PostHog or search research files.

**Our answer:** Contextual is cross-tool and agent-action-oriented. Figma AI knows your Figma files. Contextual knows your users, research, brand, taste, and stakeholder feedback across every tool -- and instructs the agent to gather more. These are complementary, not competing.

**Timeline risk:** 12-18 months before Figma builds anything resembling cross-tool context orchestration with agent actions. Their architecture is cloud-first, API-driven -- the opposite of local-first.

### 2. Cursor / Claude Code Context Features (High)

Both tools are building context systems:
- Cursor has `.cursorrules` for project-level AI instructions
- Claude Code has `CLAUDE.md` for project context
- Both support attaching files as context

**What they could build:** Better context management UIs, structured project context, design-specific context support.

**Why they haven't yet:** These tools are developer-focused. Their context features optimize for code, not design. No support for taste, visual references, research insights, or stakeholder feedback as structured context types. No visual annotation model. No concept of passes.

**Our answer:** Contextual is designed for how designers think about context (research, taste, stakeholder, design system), not how developers think about it (code rules, architecture docs). Different mental model, different tool. The `/use-contextual` command meets designers in their LLM environment but provides a visual, browser-based experience tailored to design context.

**Timeline risk:** Medium. These tools will keep improving context features, but their focus stays on engineering workflows.

### 3. Notion AI / Coda AI (Medium)

These tools already hold organizational knowledge and are adding AI features.

**What they could build:** "Ask AI about your research docs" or "Generate designs based on your Notion workspace."

**Why they haven't yet:** They're general-purpose knowledge tools, not design workflow tools. No annotation model, no element targeting, no integration with design prototypes, no agent action system.

**Our answer:** Contextual operates at the point of design iteration (annotating UI elements in-browser with agent actions), not at the point of documentation. Different workflow position entirely.

### 4. Adobe (Medium-Low)

Adobe has massive design tool surface area and AI investment.

**What they could build:** Cross-tool AI context within the Adobe ecosystem.

**Why they haven't yet:** Adobe's tools are siloed. Photoshop AI doesn't know about your Illustrator files. Their AI features focus on generation, not context-aware iteration with agent actions.

**Our answer:** Same as Figma -- Contextual is tool-agnostic and organization-aware, not tool-specific.

## Contextual's Positioning

**Category:** The context layer for AI-assisted design iteration.

**One-liner:** Your agent knows your components. Contextual teaches it your users, your research, and your taste.

**Relationship to Agentation:** Agentation captures what needs to change. Contextual captures what needs to change, why, and what actions the agent should take. Same interaction model, different value layer. Potential integration partner.

**Defensible advantages:**
1. **Two-workflow model** -- context-informed first prototypes AND context-informed refinement. No other tool addresses both moments.
2. **@Mentions as agent actions** -- open-ended namespace that instructs agents to take action (search local files, query PostHog, pull Figma specs), not just look up local content
3. **Taste layer** -- no other tool captures design sensibility as structured, queryable context
4. **Protocol potential** -- the /research, /taste, /strategy folder convention could become a standard (like .cursorrules)
5. **Compound context** -- each annotation pass can discover new context that feeds back into project files. Context grows with usage. Switching cost increases over time.
6. **Token efficiency** -- context-informed annotations produce usable output in fewer rounds, saving real money
7. **Local-first** -- no API dependencies, no permission gatekeepers, no rate limits

**Moat trajectory:**
- Short-term: two-workflow model + agent action annotations that nobody else offers
- Medium-term: folder convention becomes adopted standard
- Long-term: compound context graph across projects creates switching cost

## Market Gaps

What nobody has built:
- A two-workflow context system for AI-assisted design (setup + refinement)
- Visual annotation that creates structured agent actions with organizational context
- An open-ended @mention namespace that bridges local context and external tools
- A standard format for how designers organize context for AI tools
- Context resolution with depth levels optimized for token efficiency
- Local-first organizational memory that compounds across projects

## Why Now

1. Agentation proved the annotation interaction model works and developers/designers want it
2. AI agents can handle complex, multi-source context and execute tool actions (Claude 3.5+ level, MCP)
3. Designers are actively using AI tools and hitting the context wall daily
4. .cursorrules proved that simple local context files change AI output quality dramatically
5. No one has combined visual annotation with agent actions and organizational context
6. Token costs make iteration efficiency a real financial concern
7. MCP and tool-use capabilities make open-ended @mention namespaces technically feasible
