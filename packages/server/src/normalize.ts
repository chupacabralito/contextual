// =============================================================================
// Shared Normalization Functions
// =============================================================================
// Base normalization for Pass and PassOutcome records. Used by both:
// - PassStore/OutcomeStore (disk read normalization)
// - server.ts (API input normalization, which extends these with project defaults)
// =============================================================================

import type { Pass, PassOutcome } from '@contextual/shared';

/**
 * Normalize a Pass record: ensure all optional arrays exist and
 * all instructions have IDs.
 */
export function normalizePassBase(pass: Pass): Pass {
  return {
    ...pass,
    affectedContextTypes: Array.isArray(pass.affectedContextTypes)
      ? pass.affectedContextTypes
      : [],
    loadedContextPaths: Array.isArray(pass.loadedContextPaths)
      ? pass.loadedContextPaths
      : [],
    instructions: pass.instructions.map((instruction, index) => ({
      ...instruction,
      id:
        typeof instruction.id === 'string' && instruction.id.trim()
          ? instruction.id
          : `${pass.id}_instruction_${index + 1}`,
      preAttachedContext: Array.isArray(instruction.preAttachedContext)
        ? instruction.preAttachedContext
        : [],
    })),
  };
}

/**
 * Normalize a PassOutcome record: ensure all optional arrays exist.
 */
export function normalizeOutcomeBase(outcome: PassOutcome): PassOutcome {
  return {
    ...outcome,
    affectedContextTypes: Array.isArray(outcome.affectedContextTypes)
      ? outcome.affectedContextTypes
      : [],
    loadedContextPaths: Array.isArray(outcome.loadedContextPaths)
      ? outcome.loadedContextPaths
      : [],
    instructionReviews: Array.isArray(outcome.instructionReviews)
      ? outcome.instructionReviews
      : [],
    changedFiles: Array.isArray(outcome.changedFiles) ? outcome.changedFiles : [],
    writebacks: Array.isArray(outcome.writebacks) ? outcome.writebacks : [],
  };
}
