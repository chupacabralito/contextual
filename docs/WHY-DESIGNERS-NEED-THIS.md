# Why Designers Need Contextual

## The Current Reality

Designers working with AI agents face a fundamental problem: **context loss at two critical moments**.

**Moment 1: The First Prototype**
Every time you start a new project with an AI agent, it starts from zero:
- It doesn't know your users
- It hasn't seen your research
- It ignores your brand guidelines
- It misses stakeholder feedback
- It lacks your design sensibility

You get a generic first output that needs heavy reworking before iteration even begins.

**Moment 2: Every Refinement Pass**
When you annotate a prototype to improve it, the agent gets "make this button more prominent" -- but it doesn't know why it should be prominent, what user research says about it, what PostHog data shows about its performance, or what your brand's approach to prominence looks like.

You iterate more rounds than necessary because the agent is guessing instead of knowing.

## What Changes with Contextual

### Workflow 1: Context-Informed First Prototype

**Before Contextual:**
- You prompt the LLM with a description of what you need
- The LLM generates a generic prototype with no awareness of your users, brand, or research
- You spend the next several rounds getting it to a reasonable starting point

**With Contextual:**
- You type `/use-contextual` in your LLM environment
- A visual browser UI opens showing your default context (design system, taste, strategy)
- You paste raw research notes, stakeholder emails, or brand docs
- The LLM structures everything into organized context files
- Your first prototype is generated with full organizational awareness
- It's not perfect, but it's not generic either

### Workflow 2: Context-Informed Refinement (Instruct + Inspect)

**Before Contextual:**
"Make this button more prominent"
-> AI makes button bigger and red (generic solution)
-> 3 more rounds to get it right

**With Contextual (Instruct mode):**
"Make this button more visually dominant with a trust indicator next to it @posthog[find proof that trust indicators boost CTA conversion rates] @research[what do our usability studies say about CTA confidence]"
-> Agent executes the @posthog directive: finds trust badges near CTAs increase conversion by 18%
-> Agent executes the @research directive: finds "70% of users couldn't find the save button"
-> Agent uses both findings + your design system to redesign the button with a trust badge
-> Findings written back to context repositories for future passes
-> One round, informed solution

**With Contextual (Inspect mode):**
-> Target any element on the prototype -- even ones you never annotated
-> See the decision trail: what context informed it, what passes refined it, what data shaped it
-> Every element is a decision-rich object with traceable history

## Real Designer Workflows

### Starting a New Project
- Designer types `/use-contextual` in Claude Code
- Context manager opens in browser
- Default context loads automatically (design system, taste principles, company strategy)
- Designer pastes research findings from recent user study
- Designer imports reusable context from a previous related project
- LLM structures everything into organized context folders
- First prototype output is informed by real organizational knowledge

### Design Review with Stakeholder
- CEO: "This doesn't feel premium enough"
- Designer: *clicks element* "Make this feel more premium with refined spacing and typography @taste[how does Apple handle premium feeling in checkout flows] @design-system[what are our elevated spacing and typography patterns]"
- Agent executes directives, finds taste references and design system patterns
- Makes informed change, writes findings back to context repositories

### Iterating Based on Data
- Designer sees low engagement on checkout
- *Click + type*: "Simplify this to a single-column layout @research[what do our usability studies say about checkout confusion] @posthog[find the checkout funnel drop-off rate for mobile users]"
- Agent executes both directives -- searches local research AND queries PostHog
- Uses both findings to make a data-informed simplification
- Findings written back to context repositories, enriching future passes and Inspect mode

### Maintaining Design Quality
- Every annotation includes context references
- Design rationale travels with the work through @taste references
- Quality bar is preserved across iterations
- Organizational knowledge accumulates over time

## The Compound Effect

Week 1: Default context + basic paste, better first outputs
Month 1: Rich project context, AI feels like a team member who knows your project
Month 6: Organizational memory across projects, AI knows your standards
Year 1: Design DNA preserved, new designers onboard with existing context instantly

## @Mentions as Agent Action Directives

@mentions aren't search queries. They're **directives** -- instructions telling the agent what research task to perform. The syntax is `@source[instruction]`.

**Local context repositories:**
- `@research[what do our usability studies say about CTA confidence]` -- directive to search research files
- `@taste[how does Stripe handle trust indicators near payment buttons]` -- directive to reference taste principles
- `@design-system[what are our button prominence and spacing patterns]` -- directive to check design system

**Configured external tools:**
- `@posthog[find proof that trust indicators boost CTA conversion rates]` -- directive to query PostHog
- `@figma[check if we have an existing component for inline trust badges]` -- directive to pull from Figma
- `@linear[are there open issues related to checkout accessibility]` -- directive to check Linear
- `@slack[find recent feedback about the checkout experience]` -- directive to search Slack

The namespace is **configured per project** -- the designer enables tools through the context manager. The five context types (research, taste, strategy, design-system, stakeholders) are always available as repositories. External tools are enabled as needed.

## Why Typed Annotations First

The fastest path to proving value is in the browser, where prototype iteration already happens:
- No native app complexity
- No OS permissions work
- No change to the designer's existing prototype workflow
- Faster path to testing whether context actually improves output

## Why Voice Matters Later

Design critique is verbal:
- "This feels too cramped"
- "Follow our accessibility guidelines"
- "Match what users said about confusion"

Voice annotation may eventually preserve the natural way designers already communicate about their work, but it is an acceleration layer after the typed loop is validated.

## The Bottom Line

**Without Contextual**: You + Generic AI = Lots of manual fixing, context lost between every round

**With Contextual**: You + Context-Aware AI = Design partner that knows your users, research, brand, and taste -- and can go find out what it doesn't know

It's not about replacing designers. It's about making every designer more capable by giving their AI collaborators the context to do great work.

## Who This Is For

- **Design leads at AI-forward startups** already prototyping with Claude or Cursor weekly
- **Product designers in small startup teams** who already feel the context problem in day-to-day AI use
- **Design engineers close to the prototype workflow** who need context-rich prompts, not generic output

The future isn't designers OR agents. It's designers WITH agents.
Contextual makes that collaboration actually work.
