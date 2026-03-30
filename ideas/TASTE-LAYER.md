# The Taste Layer - Design Sensibility as Context

## What is /taste?

The `/taste` folder captures the ineffable quality of good design - the aesthetic decisions, cultural references, and design sensibility that separate great products from functional ones.

## Why This Matters

Traditional handoffs capture WHAT to build. They miss the WHY it should feel a certain way. The taste layer preserves:
- Design inspiration and references
- Aesthetic principles
- Cultural context
- What "good" looks like
- What to avoid (anti-patterns)

## Structure Example

```
/taste
  /inspiration
    - apple-attention-to-detail.md
    - dieter-rams-principles.md
    - competitor-excellence.md
  /feeling
    - brand-personality.md
    - emotional-targets.md
    - user-delight-moments.md
  /principles
    - hierarchy-rules.md
    - motion-philosophy.md
    - color-psychology.md
  /avoid
    - anti-patterns.md
    - design-smells.md
    - uncanny-valley-examples.md
```

## Usage Examples

### Annotation with taste:
"@taste[apple-spacing-rhythm] but adapted for our density needs"

### Motion design:
"@taste[subtle-delight-examples] - add microinteraction here"

### Brand expression:
"@taste[premium-but-approachable] - this feels too cold"

## What Goes in /taste

### DO Include:
- Screenshots of excellent design details
- Quotes about design philosophy
- Examples of "this, not that"
- Cultural references that inform the design
- Specific moments of delight from other products
- Typography and spacing rhythms
- Color usage that evokes the right feeling

### DON'T Include:
- Functional requirements (→ /prd)
- User research findings (→ /research)
- Technical constraints (→ /architecture)
- Specific component specs (→ /design-system)

## The Magic

With the taste layer, agents can understand not just what to build, but how it should FEEL:

**Without taste context:**
"Make a button"
→ Agent creates functional but soulless button

**With taste context:**
"Make a button @taste[apple-taptic-feedback-feeling] @taste[subtle-depth-examples]"
→ Agent creates button with subtle shadows, perfect press states, satisfying interaction

## Real Example

```markdown
# /taste/spacing-rhythm.md

Our spacing follows a musical rhythm - not just mathematical.

Apple Music example: Notice how the spacing between album art and 
title is tighter than title to artist. This creates visual groupings 
that guide the eye.

We follow similar principles:
- Tighter spacing within logical groups
- Generous spacing between groups
- Break the grid when it serves hierarchy
```

When annotating: "@taste[spacing-rhythm] - these feel too evenly spaced"

## Long-term Value

As projects accumulate, /taste becomes:
- A design DNA library
- Onboarding for new designers
- Quality bar for AI agents
- Preservation of design culture

This is how design orgs scale their sensibility - by making taste queryable and referenceable.

## The Competitive Edge

Most AI tools produce competent but soulless design. With the taste layer, Contextual enables AI to build with the nuance and sensibility of the best human designers.

"Good design is obvious. Great design is transparent." - Joe Sparano

The taste layer makes great design teachable to agents.