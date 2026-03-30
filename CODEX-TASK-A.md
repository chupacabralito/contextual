# Codex Task: Stream A -- React Annotation Component + Demo

## Overview

Transform the single-annotation clipboard flow in `packages/react` into the queue-based Instruct mode with Inspect mode toggle. You own `packages/react` and `packages/demo`. Do not modify `packages/shared`, `packages/server`, or `packages/context-manager` -- those are being updated in a parallel stream.

The shared types in `packages/shared/src/index.ts` have already been updated with all new types you need. Build the project first to confirm: `npm run build`

## Architecture Context

Contextual is a context layer for AI-assisted design. Designers annotate prototype elements with refinement instructions containing `@source[instruction]` directives. The system has two modes:

- **Instruct mode** (primary): Target elements, write instructions with @mentions, accumulate in a queue, submit as a pass
- **Inspect mode** (secondary): Target any element to see its decision trail (what passes targeted it, what context was attached)

The React component communicates with a local server via HTTP (port 4700). The server handles context search and pass persistence. You call the server; the server is being built in the parallel stream.

## Shared Types Available (from @contextual/shared)

```typescript
// New types you'll use:
ParsedAction { source: string; instruction: string; startIndex: number; endIndex: number }
PreAttachedSnippet { type: string; query: string; content: string; source: string }
Instruction { element: TargetedElement; rawText: string; actions: ParsedAction[]; preAttachedContext: PreAttachedSnippet[] }
QueuedInstruction { id: string; element: TargetedElement; rawText: string; actions: ParsedAction[]; depth: ResolutionDepth; createdAt: string; resolvedContext: MentionResult[] }
Pass { id: string; timestamp: string; depth: ResolutionDepth; instructions: Instruction[] }
AnnotationMode = 'instruct' | 'inspect'
CreatePassRequest { pass: Pass }
CreatePassResponse { id: string; path: string; timestamp: string }
InspectResponse { selector: string; passes: InspectPassReference[]; contextHistory: PreAttachedSnippet[] }
InspectPassReference { passId: string; timestamp: string; instruction: Instruction }

// Existing types still available:
Annotation, ParsedMention, StructuredOutput  // (deprecated but not removed)
MentionResult { type: string; query: string; matches: ContextMatch[] }  // type widened to string
ContextMatch, TargetedElement, ResolutionDepth, etc.
```

## Work Items

### A1: Open the Parser

**File:** `packages/react/src/mentions/parser.ts`

Current state: `parseMentions()` uses `isValidContextType()` to reject any @source not in the hardcoded 5. It returns `ParsedMention[]` (type: ContextType).

Changes:
- Add a new function `parseActions(text: string): ParsedAction[]` that uses the same regex but accepts ANY `@source` string. Returns `ParsedAction[]` instead of `ParsedMention[]`. Maps: `source` = capture group 1, `instruction` = capture group 2.
- Keep `parseMentions()` for backward compatibility (still validates against ContextType).
- Update `getTypeCompletions(partial: string)` to return `string[]` instead of `ContextType[]`. It should still prioritize the 5 local types but also accept freeform input.
- Add a helper: `isLocalContextType(source: string): boolean` -- returns true if the source is one of the 5 local types. (You can import `isContextType` from `@contextual/shared` for this.)
- Export `parseActions` from `packages/react/src/index.ts`.

**File:** `packages/react/src/hooks/useMentionParser.ts`

Update to use `parseActions()` internally. The `completions` array should still suggest the 5 local context types when user types `@`, but should not block unknown sources.

### A2: Annotation Queue State

**New file:** `packages/react/src/hooks/useAnnotationQueue.ts`

Create a hook that manages the instruction queue:

```typescript
interface UseAnnotationQueueReturn {
  queue: QueuedInstruction[];
  addToQueue: (instruction: QueuedInstruction) => void;
  removeFromQueue: (id: string) => void;
  updateInstruction: (id: string, updates: Partial<QueuedInstruction>) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  queueLength: number;
}
```

- Queue is an array of `QueuedInstruction` (import from `@contextual/shared`)
- `addToQueue` appends to the end
- `removeFromQueue` removes by ID
- `updateInstruction` merges partial updates (for edit flow)
- `reorderQueue` moves item from one index to another
- `clearQueue` empties the queue (after pass submission)
- Queue persists across element targeting cycles (selecting a new element doesn't clear the queue)

### A3: Annotation Queue UI

**New file:** `packages/react/src/components/QueuePanel.tsx`

A todo-list-style panel that shows the current queue:

- Fixed position: left side of viewport, vertically centered
- Each item shows:
  - Element label (truncated to 30 chars)
  - First line of instruction text (truncated to 50 chars)
  - @action count badge (e.g., "2 actions")
  - Edit button (pencil icon or "Edit" text)
  - Remove button (x icon or "Remove" text)
- Items are visually numbered (1, 2, 3...)
- Drag-to-reorder is nice-to-have; up/down arrow buttons are acceptable
- "Submit Pass" button at the bottom when queue.length > 0
  - Shows instruction count: "Submit Pass (3 instructions)"
- Depth selector at the bottom (shared across the pass)
- Panel header: "Annotation Queue" with item count
- Collapsed state when queue is empty (just a small indicator)
- Style: match existing dark theme (bg: #1a1a2e, border: rgba(99, 102, 241, ...), text: #e0e0e8)
- Add `data-contextual="queue-panel"` attribute (so element targeting ignores it)

Props:
```typescript
interface QueuePanelProps {
  queue: QueuedInstruction[];
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onSubmitPass: () => void;
  depth: ResolutionDepth;
  onDepthChange: (depth: ResolutionDepth) => void;
  isSubmitting: boolean;
}
```

### A4: Mode Toggle

**File:** `packages/react/src/components/Toolbar.tsx`

Current state: Single button that shows state labels ("Annotate", "Click an element...", etc.)

Changes:
- Add mode toggle: two buttons/tabs for "Instruct" and "Inspect"
- Default mode: 'instruct'
- When in Instruct mode: existing behavior (target -> annotate -> queue)
- When in Inspect mode: target -> show decision trail (no annotation input)
- Mode toggle only visible when in 'idle' state
- Active mode visually highlighted

**File:** `packages/react/src/hooks/useContextual.ts`

Add mode state:
```typescript
mode: AnnotationMode;  // 'instruct' | 'inspect'
setMode: (mode: AnnotationMode) => void;
```

Add new state: `'inspecting'` to ContextualState (when in inspect mode and element is targeted).

Update `setTargetedElement` to check mode:
- If instruct: go to 'annotating' state (existing behavior)
- If inspect: go to 'inspecting' state (shows InspectPanel)

### A5: Multi-Instruction Pass Formatter

**File:** `packages/react/src/output/formatter.ts`

Current state: `formatOutput()` formats a single `StructuredOutput`.

Changes:
- Add `formatPass(queue: QueuedInstruction[], depth: ResolutionDepth): string` function
- Output format (markdown):

```markdown
## Refinement Pass

**Depth:** Standard
**Instructions:** 3

---

### Instruction 1
**Element:** Button "Pay $49.00" (button.primary, 200x40 at [320, 480])
**Instruction:** Make this button more visually dominant with a trust indicator
**Actions:**
- @posthog[find proof that trust indicators boost CTA conversion]
- @research[what do our usability studies say about CTA confidence]

**Pre-attached context:**
@research[what do our usability studies say about CTA confidence]:
> 70% of users couldn't find the save button...
> Source: research/checkout-friction.md, 2024-03-15

---

### Instruction 2
...
```

- For each instruction: format element, raw text (stripped of @mentions), list of @actions, then pre-attached context (from resolvedContext)
- Keep existing `formatOutput()` for backward compatibility
- Export `formatPass` from `packages/react/src/index.ts`

### A6: Pass Submission Flow

**File:** `packages/react/src/hooks/useContextual.ts`

Current `submitPass()`:
1. Formats single annotation
2. Copies to clipboard
3. Resets after 1.5s

New `submitPass()`:
1. Convert `QueuedInstruction[]` to `Instruction[]` (extract `preAttachedContext` from `resolvedContext`)
2. Build `Pass` object: `{ id: 'pass_' + Date.now(), timestamp: new Date().toISOString(), depth, instructions }`
3. Format pass via `formatPass()` and copy to clipboard
4. POST to `${serverUrl}/passes` with `{ pass }` body (fire-and-forget, don't block on it)
5. Clear the queue
6. Set state to 'submitted', reset after 1.5s

The conversion from `QueuedInstruction` to `Instruction`:
```typescript
function toInstruction(qi: QueuedInstruction): Instruction {
  const preAttachedContext: PreAttachedSnippet[] = [];
  for (const result of qi.resolvedContext) {
    for (const match of result.matches) {
      preAttachedContext.push({
        type: result.type,
        query: result.query,
        content: match.content,
        source: match.source,
      });
    }
  }
  return {
    element: qi.element,
    rawText: qi.rawText,
    actions: qi.actions,
    preAttachedContext,
  };
}
```

Also update `resolveAndPreview`:
- After resolving, instead of going to 'previewing' state, build a `QueuedInstruction` and add it to the queue
- Then return to 'idle' state (ready for next element)
- The old preview flow (single annotation) can be removed or kept behind a "submit immediately" option

### A7: Inspect Mode UI

**New file:** `packages/react/src/components/InspectPanel.tsx`

Shown when mode is 'inspect' and an element is targeted (state: 'inspecting').

- Calls `GET ${serverUrl}/inspect?selector=${encodeURIComponent(selector)}` on mount
- Shows loading state while fetching
- Displays:
  - Element info (label, selector)
  - "Decision Trail" heading
  - For each pass that targeted this element:
    - Pass timestamp (relative: "2 hours ago" or absolute)
    - Instruction text
    - @actions that were included
    - Pre-attached context snippets (collapsible)
  - "No history yet" state if no passes found
- "Close" button returns to idle
- Positioned near the targeted element (same positioning logic as ContextPreview)
- Style: match existing dark theme
- Add `data-contextual="inspect-panel"` attribute

Props:
```typescript
interface InspectPanelProps {
  element: TargetedElement;
  serverUrl: string;
  onClose: () => void;
}
```

### A8: Update ContextualProvider

**File:** `packages/react/src/ContextualProvider.tsx`

Wire everything together:

1. Import `useAnnotationQueue` hook
2. Pass queue state to `useContextual` (or manage at provider level)
3. Render `QueuePanel` when queue has items (always visible, any state)
4. Render `InspectPanel` when state is 'inspecting' and element is targeted
5. Mode toggle in Toolbar
6. Remove ContextPreview (replaced by queue-based flow) or keep for immediate-submit
7. AnnotationInput's onSubmit now resolves and adds to queue (not preview)

Rendering logic:
```
{/* Queue panel - always visible when queue has items */}
{queue.length > 0 && <QueuePanel ... />}

{/* Inspect panel - visible in inspect mode when element targeted */}
{state === 'inspecting' && targetedElement && <InspectPanel ... />}

{/* Annotation input - visible in instruct mode when annotating */}
{state === 'annotating' && mode === 'instruct' && targetedElement && <AnnotationInput ... />}

{/* Element highlights - both modes */}
{state === 'targeting' && hoveredElement && <ElementHighlight variant="hover" />}
{targetedElement && (state === 'annotating' || state === 'inspecting') && <ElementHighlight variant="selected" />}

{/* Toolbar with mode toggle */}
<Toolbar ... mode={mode} onModeChange={setMode} />
```

### A9: Update Demo App

**File:** `packages/demo/src/App.tsx`

Update the demo instructions to explain the new flow:
- Cmd+Shift+A to start
- Click elements and annotate (instructions accumulate in queue)
- Use @research[...], @taste[...], or any @source[...]
- Switch to Inspect mode to see decision trail
- Submit pass when ready

### A10: Update Exports

**File:** `packages/react/src/index.ts`

Export new items:
```typescript
export { useAnnotationQueue } from './hooks/useAnnotationQueue.js';
export { parseActions } from './mentions/parser.js';
export { formatPass } from './output/formatter.js';
export type { AnnotationMode, ParsedAction, QueuedInstruction, Pass, Instruction, PreAttachedSnippet } from '@contextual/shared';
```

## Server Endpoints You'll Call

These are being built in the parallel stream. Mock them or handle errors gracefully if they're not ready yet.

### POST /passes (persist a pass)
```
POST http://localhost:4700/passes
Content-Type: application/json

{ "pass": { "id": "pass_1234", "timestamp": "2026-03-29T...", "depth": "standard", "instructions": [...] } }

Response: { "id": "pass_1234", "path": "/passes/pass-2026-03-29T....json", "timestamp": "..." }
```

### GET /inspect (decision trail for an element)
```
GET http://localhost:4700/inspect?selector=button.primary

Response: {
  "selector": "button.primary",
  "passes": [
    { "passId": "pass_1234", "timestamp": "...", "instruction": { "element": {...}, "rawText": "...", "actions": [...], "preAttachedContext": [...] } }
  ],
  "contextHistory": [...]
}
```

### POST /resolve (existing, now accepts any source string)
```
POST http://localhost:4700/resolve
{ "mentions": [{ "type": "posthog", "query": "conversion data" }], "depth": "standard" }

Response: { "results": [{ "type": "posthog", "query": "conversion data", "matches": [] }] }
// Unknown sources return empty matches -- that's correct behavior
```

## Build & Verify

```bash
npm run build                    # All 5 packages should pass
npm run build --workspace=@contextual/react   # Your package specifically
npm run build --workspace=@contextual/demo    # Demo should also pass
```

## Acceptance Criteria

1. `@posthog[find data]` parses successfully (not rejected by validator)
2. `@research[pain points]` still autocompletes and resolves via server
3. Target element, type annotation, annotation appears in queue panel
4. Target second element, annotate, queue now has 2 items
5. Edit queue item (re-opens annotation input with pre-filled text)
6. Remove queue item
7. Submit pass: markdown copied to clipboard with multi-instruction format
8. Submit pass: POST /passes called (fire-and-forget, graceful failure)
9. Switch to Inspect mode, target element, see decision trail (or "No history")
10. Full build passes with zero type errors
