# Contextual - Execution Plan

## What's Done

- [x] Monorepo with 5 packages: shared, react, server, context-manager, demo
- [x] Shared types as API contract between packages
- [x] Context manager: 4-step handoff flow (Defaults, Paste, Import, Submit)
- [x] Annotation component: element targeting, @mention parsing (fixed 5 types), depth levels, context pre-search + preview, clipboard copy
- [x] Server: FTS5 indexing, /health, /suggest, /resolve, /scaffold endpoints, depth controller
- [x] Demo: mock checkout prototype wired to server

---

## Next: Gate 1 Build (Instruct Mode + Pass Persistence)

Session 4 decision: ship Instruct mode as the Gate 1 value driver. Inspect mode deferred to Gate 2.

### Step 1: Open the parser
- [ ] Update `parser.ts` to accept any `@source`, not just hardcoded ContextType values
- [ ] Add new shared types: `ParsedAction` (source: string, instruction: string)
- [ ] Autocomplete still shows 5 local repositories; accepts anything else freeform

### Step 2: Build the annotation queue
- [ ] Queue state management (add, edit, reorder, remove instructions)
- [ ] Queue UI component (todo-list-style panel alongside the prototype)
- [ ] Each queue item shows: targeted element + instruction text + parsed @actions
- [ ] Queue persists across element targeting (select element A, annotate, select element B, annotate -- queue grows)

### Step 3: Build multi-instruction pass submission
- [ ] Serialize entire queue as structured prompt set (markdown format)
- [ ] Update output formatter for multi-instruction passes (current: single annotation)
- [ ] Submit = copy structured prompt + persist pass record

### Step 4: Persist passes
- [ ] Add `/passes` folder to project structure (alongside /research, /taste, etc.)
- [ ] On submit, write timestamped JSON pass record
- [ ] Pass record stores: id, timestamp, depth, instructions[] (each with element, rawText, parsed actions, pre-attached context snippets)
- [ ] Add shared types: Pass, Instruction, PreAttachedSnippet

### Step 5: Update shared types
- [ ] Pass, Instruction, ParsedAction, PreAttachedSnippet types
- [ ] Update ContextualState to support queue-based flow
- [ ] Ensure backward compatibility with existing server/resolve contract

### Step 6: Wire it up
- [ ] Update demo app to exercise queue-based flow
- [ ] Update ContextualProvider for new state flow
- [ ] End-to-end test: annotate 3 elements, review queue, submit pass, verify pass record written

---

## Gate 1: Dogfood + Beta

- [ ] Use Contextual on own projects (Generalista, Contextual marketing site)
- [ ] Test Workflow 1 (context manager for setup) + Workflow 2 (Instruct mode for refinement)
- [ ] Recruit 3-5 ICP-fit design partners
- [ ] Run blind comparison: context-informed vs context-blind first prototypes (5 test cases)
- [ ] Track: setup completion, time to first useful output, annotations per week
- [ ] Track: acceptance rate of @mention-action passes vs plain-instruction passes
- [ ] Review persisted pass records -- what patterns emerge?
- [ ] Document friction points and "aha moments"

### Gate 1 Pass Criteria

**Workflow 1 (first prototype quality):**
- Setup completion >80%
- Time from `/use-contextual` to first prototype output <5 min
- Designer prefers context-informed version in 3 of 5 test cases

**Workflow 2 (refinement quality):**
- Users complete 10+ annotations in first week
- Passes with @mention actions produce accepted changes at higher rate than plain-instruction passes (directional)

**Both:**
- Designer reports context materially improved output quality on at least one real task

---

## Gate 2: Inspect Mode + Retention (after Gate 1 data)

Derive from real pass history. Do not spec prematurely.

- [ ] Analyze persisted pass records from Gate 1 usage
- [ ] Define first decision model based on observed patterns
- [ ] Design Inspect mode UX (what are the first 3 things a user sees?)
- [ ] Define writeback semantics (how agent findings get structured back into repositories)
- [ ] Build Inspect mode
- [ ] Build repository viewer in context manager
- [ ] Build tool configuration UI in context manager
- [ ] Decision trail indexing in server (which passes affected which elements)
- [ ] Track D7/D30 retention (Gate 2 metrics)

---

## Post-Gate 1: Landing Page + Soft Launch

- [ ] Landing page at getcontextual.app
- [ ] Demo video: real project, real context, real output improvement
- [ ] npm package published
- [ ] Soft launch to Generalista newsletter subscribers

---

## Gate Sequence (Do Not Skip)

| Gate | Question | Value driver | When |
|------|----------|-------------|------|
| 1 | Do both workflows create repeat value? | Instruct mode + context setup | First usable MVP |
| 2 | Do users come back weekly? | Inspect mode + compounding context | After Gate 1 |
| 3 | Will someone pay? | Full product | After Gate 2 |
| 4 | Does team/enterprise work? | Shared context | After Gate 3 |

---

## Not Building Yet

- Desktop app / system-wide overlay
- Voice input
- Team features, sharing, permissions
- Auto-sync from external tools
- Cloud anything
- Enterprise controls
- Full "decision" ontology (let it emerge from pass data)
- Causal graphs between context and elements
