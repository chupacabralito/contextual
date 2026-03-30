# Tandem Work Protocol

## Purpose

This protocol lets Claude and Codex work in parallel without colliding on the
same files or changing shared contracts mid-pass. Ownership is temporary and
pass-based, not permanent.

## Core Rule

Before each implementation pass, assign one owner per write surface.

Ownership should be defined by specific files or directories, not by broad
labels like "backend" or "frontend."

## Working Rules

1. Assign one owner for every file or directory that may be edited in the pass.
2. Non-owners may inspect owned files, but should not edit them during that pass.
3. Shared contract files are locked unless the pass explicitly includes contract work.
4. Reassign ownership only at pass boundaries, not mid-pass.
5. Prefer additive changes over contract changes during implementation passes.
6. If a shared type or interface must change, stop and open a separate contract pass.
7. Do not rely on generated output ownership unless that output is explicitly in scope for the pass.

## Current Default Split

Use this split unless a newer handoff note replaces it.

- Claude owns `packages/server/src/**`
- Codex avoids edits in `packages/server/src/**` during the current server pass
- `packages/shared/src/index.ts` is locked unless both sides explicitly agree to a contract pass
- `packages/react/src/**` stays separate from server work unless a later pass assigns it

## Pass Checklist

Every pass should define:

- Goal
- Owned files
- Files explicitly off-limits
- Required inputs from other packages
- Completion signal
- Known assumptions or open questions

## Handoff Rules

- Keep handoff notes short and concrete
- Name exact owned paths
- State what is locked, not just what is in scope
- Use build or runtime checks as the completion signal when possible
- Record assumptions so the next pass does not re-decide them

## Coordination Defaults

- Flexibility matters more than permanent tool-specific roles
- File ownership matters more than category ownership
- Shared contracts should stay stable during implementation passes
- Dist output should not become a coordination surface unless explicitly assigned

## Example Pass

- Goal: implement server routes and indexing
- Owned files: `packages/server/src/*`
- Off-limits: `packages/shared/*`, `packages/react/*`
- Required inputs: current shared types only
- Completion signal: `npm run build` and `npm run typecheck` pass, `/health` and `/resolve` work
- Assumptions: no shared contract changes, no frontend edits required
