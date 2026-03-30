# Pass Handoff: React Annotation Component Refinements + Demo Harness

## Pass Name

React Polish + Demo

## Goal

Refine the React annotation component to align with the Session 2 architecture (structured prompt builder with agent actions, not clipboard exporter) and build a minimal demo app so the annotation workflow can be tested in the browser.

## Owner

Claude Code

## Owned Files

- `packages/react/src/**/*`
- `packages/demo/**/*` (new -- to be created)

## Off-Limits Files

- `packages/shared/**/*`
- `packages/server/**/*`

## Required Inputs

- **Shared types:** `packages/shared/src/index.ts` -- all types the React component depends on. Already built, already compiles.
- **Existing React implementation:** All files in `packages/react/src/` are functional and compile clean. This pass is refinements, not a rewrite.

## Architecture Context

The annotation component is a **structured prompt builder** that creates passes for the agent. It does NOT resolve @mentions locally or export to clipboard. The flow is:

1. Designer activates annotation mode
2. Clicks, highlights, or selects a UI element
3. Types annotation: natural language instruction + @mention actions
4. Can annotate multiple elements before submitting
5. Submits a pass (one annotation or many) to the agent
6. The agent processes the pass: executes @mention actions, gathers context, makes changes, returns new prototype version

### @Mention Model

@mentions are **agent actions**, not local file lookups. The namespace is open-ended:
- **Local context types:** `@research`, `@taste`, `@strategy`, `@design-system`, `@stakeholders`
- **External tools:** `@posthog`, `@figma`, `@linear`, `@slack`, anything via MCP/API

The autocomplete draws from:
- Local context types (always available)
- Indexed content within local context folders (via context server `GET /suggest`)
- Registered external tool names (configurable)

### Output Format

The component produces a structured prompt, not clipboard markdown. Example:

```markdown
## Annotation Pass

### Annotation 1
**Element:** Button "Save" (.btn-primary, 200x40 at [320, 480])
**Instruction:** Make this more prominent
**Actions:**
- @research[user-save-button]: Search local research for user save button feedback
- @taste[stripe-cta]: Search local taste for Stripe CTA approach

### Annotation 2
**Element:** h2 "Checkout" (#checkout-header, 400x32 at [100, 200])
**Instruction:** Simplify this flow
**Actions:**
- @posthog[checkout drop-off]: Query PostHog for checkout drop-off data
- @design-system[checkout patterns]: Search local design system for checkout patterns

**Resolution Depth:** Standard
```

### Known issues to fix

1. **Hook duplication.** `AnnotationInput.tsx` reimplements @mention autocomplete detection inline instead of using the exported `useMentionParser` hook in `hooks/useMentionParser.ts`. Refactor to use the hook.

2. **Preview back button.** The "Edit" button in `ContextPreview.tsx` calls `contextual.startTargeting()`, which resets the full workflow (loses element + annotation text). It should return to the `annotating` state with the same targeted element and let the designer edit their annotation. This requires adding a `backToAnnotating()` method to the `useContextual` hook.

3. **Global keyboard shortcut.** No way to activate Contextual without clicking the toolbar button. Add support for a configurable hotkey prop on `ContextualProvider` (default: Cmd+Shift+A / Ctrl+Shift+A).

4. **Pass management.** Ensure the component supports collecting multiple annotations before submission. The designer annotates multiple elements, reviews them in a pass list, then submits the entire pass to the agent.

5. **Output model alignment.** Ensure the output is a structured prompt for the agent (as shown above), not clipboard-bound markdown. The pass submission should format all annotations into the structured prompt format.

6. **Demo harness.** Build `packages/demo/` -- a minimal Vite + React app that wraps sample UI in `<ContextualProvider>`. Use hardcoded mock context responses (no server dependency) so the annotation workflow can be tested end-to-end in the browser.

### Deprioritized (do not build this pass)

- **Drag-select.** Drawing a rectangle to select a region. Listed in product spec but not needed until core loop is validated through real usage.
- **Accessibility polish.** ARIA labels, focus management, tab order. Important but not blocking for dogfood.
- **External tool registration.** The configurable list of external @mention targets. Hardcode the five local types + a few example external tools for now.

## Completion Signal

- `npm run build --workspace=@contextual/react` passes with zero errors
- `AnnotationInput` uses `useMentionParser` hook (no duplicated autocomplete logic)
- "Edit" button in preview returns to annotating state with element + text preserved
- Cmd+Shift+A toggles annotation mode on and off
- Pass management works: designer can annotate multiple elements, review the pass, and submit
- Output is structured prompt format (not clipboard markdown)
- `packages/demo/` runs with `npm run dev` and shows the full annotation workflow in the browser with mock data

## Assumptions

- The demo app is for internal testing and dogfooding only, not for end users
- Mock context data in the demo can be hardcoded -- it doesn't need to match real project structure
- The demo app does not need to be part of the npm-published package
- React 18+ peer dependency is sufficient (no need to support React 17)

## Open Questions

- Should the demo mock the server responses (intercept fetch) or should `useContextual` accept an optional mock/override for resolution? Recommendation: add an optional `resolveMentions` callback prop to `ContextualProvider` so the demo can supply mock results without faking HTTP.
- How does the structured prompt get to the agent? For MVP, the simplest path is likely writing the prompt to a known file location or stdout. This decision can be deferred to the next pass.

## Notes For Next Pass

- After Codex completes the server pass, the next step is integration testing: start the server with real context files and use the demo app to test the full annotation workflow end to end.
- The context manager (standalone React app for Workflow 1) is a separate build pass -- not part of this component.
- The `useMentionParser` hook provides cursor-position-aware autocomplete state. `AnnotationInput` currently manages cursor position manually -- after refactoring to use the hook, make sure cursor position still updates correctly on each keystroke.
- The server defaults to `http://localhost:4700`. The demo should use this default unless overridden.
