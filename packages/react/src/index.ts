// =============================================================================
// @contextual/react - React Annotation Component
// =============================================================================
// In-browser annotation component for AI-assisted design iteration.
// Renders alongside prototypes. Handles element targeting, queue-based
// refinement passes, and inspect-mode history lookups.
// =============================================================================

export { ContextualProvider } from './ContextualProvider.js';
export { useContextual } from './hooks/useContextual.js';
export type { ContextualState } from './hooks/useContextual.js';
export { useAnnotationQueue } from './hooks/useAnnotationQueue.js';
export { useElementTargeting } from './hooks/useElementTargeting.js';
export { useMentionParser } from './hooks/useMentionParser.js';
export { parseActions, parseMentions } from './mentions/parser.js';
export { formatOutput, formatPass } from './output/formatter.js';

// Re-export shared types consumers will need
export type {
  Annotation,
  AnnotationMode,
  TargetedElement,
  ParsedAction,
  ParsedMention,
  QueuedInstruction,
  Pass,
  Instruction,
  PreAttachedSnippet,
  ContextType,
  ResolutionDepth,
  StructuredOutput,
  MentionResult,
  ContextMatch,
} from '@contextual/shared';
