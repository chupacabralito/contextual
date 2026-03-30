# Contextual - Strategic Refinements (Session 4)

This document records the build sequencing and minimal ontology decisions made in Session 4. These decisions scope what gets built for Gate 1 and what gets deferred.

---

## 1. Gate 1 Scope: Instruct Mode First

### Decision

Ship Instruct mode as the Gate 1 value driver. Inspect mode is deferred to Gate 2 (retention).

**Gate 1 proves:** Better instructions plus context improve outcomes.
**Gate 2 proves:** Accumulated context brings designers back.

Instruct mode is the shortest path to Gate 1 proof. Inspect mode depends on having real pass history to surface, which only exists after Instruct mode has been used.

### What this means for build order

**Gate 1 (build now):**
- Open parser to accept any `@source` (not just hardcoded 5 types)
- Queue-based Instruct mode (annotation queue UI, multi-instruction passes)
- Pass persistence to `/passes` folder
- Structured prompt output for multi-instruction passes

**Gate 2 (build after Gate 1 data):**
- Inspect mode UX
- Decision model (derived from real pass history)
- Writeback semantics (how agent findings get structured back into repositories)
- Repository viewer in context manager

---

## 2. Minimal Pass Schema

### Decision

Define just enough structure so the product doesn't paint itself into a corner. Do not define a full "decision" ontology yet.

### Schema

```
Pass
  id: string (uuid or timestamp-based)
  timestamp: ISO 8601
  depth: ResolutionDepth
  instructions: Instruction[]

Instruction
  element: TargetedElement (selector, label, boundingBox, tagName, selectedText)
  rawText: string (the full annotation text including @mentions)
  actions: ParsedAction[] (parsed @source[instruction] directives)
  preAttachedContext: PreAttachedSnippet[] (local context included in the prompt at submit time)

ParsedAction
  source: string (any @mention target -- not limited to ContextType)
  instruction: string (the directive in brackets)

PreAttachedSnippet
  type: string (context type or tool source)
  query: string
  content: string (the snippet that was included)
  source: string (file path or origin)
```

### Key decisions in the schema

- **`source` is a string, not a ContextType.** The parser accepts any `@source`, not just the 5 local types. This preserves the protocol/UX separation.
- **`preAttachedContext` is stored.** Later, you'll want to know not just what the user asked, but what context the system handed the agent at submit time. This is the raw material for understanding whether better context led to better outcomes.
- **No "decision" type.** The word "decision" stays out of the schema. It remains an interpretation layer until patterns emerge from real usage.
- **No artifact type yet.** Passes can produce artifacts (agent output, writeback files), but the artifact schema is deferred until real passes show what those look like.

---

## 3. Pass Persistence

### Decision

On submit, write one timestamped pass record file to a `/passes` folder alongside the existing context repositories.

### Format

JSON file, one per pass. Example: `/passes/pass-2026-03-29T14-22-01Z.json`

### What gets stored

- Pass ID and timestamp
- Depth level used
- All instructions in the pass (element + text + parsed actions + pre-attached context)

### What does NOT get stored yet

- Agent response or output
- What the agent changed in the prototype
- Writeback artifacts (these go to context repositories when/if the agent writes them)
- Any "decision" interpretation

### Three immediate benefits

1. **Audit trail** for real usage patterns
2. **Source material** for Inspect mode (when built)
3. **Concrete artifact** for debugging whether better passes lead to better outcomes

---

## 4. Protocol vs UX Separation

### Decision

Preserve this distinction everywhere.

**Protocol level:** `@source[instruction]` works for any source. The parser accepts any string as a source. The structured prompt includes whatever the user typed.

**UX level:** Configured tools appear in autocomplete. The 5 local repositories are always suggested. Unknown sources are accepted but not auto-completed. Validation is advisory, not blocking.

This means the parser can be updated immediately (accept any `@source`) without needing the tool configuration UI. Autocomplete initially shows the 5 local repositories and accepts anything else the user types freeform.

---

## 5. What Stays Deferred

| Feature | Deferred until | Reason |
|---------|---------------|--------|
| Full "decision" ontology | After real pass data exists | Model observed behavior, not imagined behavior |
| Inspect mode | Gate 2 | Needs accumulated pass history to be useful |
| Inspect mode UX spec | After seeing real pass records | What's worth surfacing depends on what passes actually contain |
| Writeback semantics | After seeing agent behavior | How agents write context back depends on real usage patterns |
| Tool configuration UI | After parser accepts any @source | Protocol works without it; autocomplete is sufficient for Gate 1 |
| Repository viewer | Gate 2 | Value compounds with Inspect mode |
| Context manager expansion | Gate 2 | Setup flow is sufficient for Gate 1 |
| Causal graphs (context -> element) | Well after Gate 1 | Premature; let the ontology emerge |

---

## 6. Near-Term Build Sequence

1. **Open the parser** -- accept any `@source`, not just hardcoded ContextType values
2. **Build the annotation queue** -- todo-list-style panel, add/edit/reorder/remove instructions
3. **Build multi-instruction pass submission** -- serialize queue as structured prompt set
4. **Persist passes** -- write pass record to `/passes` on submit
5. **Store pre-attached context** -- include local context snippets in the pass record
6. **Update shared types** -- Pass, Instruction, ParsedAction, PreAttachedSnippet

Items 1-6 transform the current single-annotation clipboard flow into the queue-based Instruct mode described in Session 3, with pass persistence as the foundation for everything that follows.

---

## 7. What This Changes About Session 3

Session 3 described Instruct and Inspect as co-equal MVP features. Session 4 sequences them:

| Session 3 | Session 4 |
|-----------|-----------|
| Instruct + Inspect are both MVP | Instruct is Gate 1; Inspect is Gate 2 |
| Decision model needed for MVP | Minimal pass schema for Gate 1; decision model deferred |
| Context manager needs tool config + repository viewer for MVP | Context manager setup flow is sufficient for Gate 1 |
| Server needs decision-trail indexing for MVP | Server needs pass persistence for Gate 1; decision indexing deferred |
| Full writeback semantics needed | Writeback deferred; passes are the fossil record |

Session 3 direction remains correct. Session 4 sequences the execution so Gate 1 is achievable without premature specification.
