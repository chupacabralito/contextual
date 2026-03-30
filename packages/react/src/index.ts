// =============================================================================
// @contextual/react - React Annotation Component
// =============================================================================
// In-browser annotation component for AI-assisted design iteration.
// Renders alongside prototypes. Handles element targeting, @mention annotations,
// context preview, and structured pass submission to AI agents.
// =============================================================================

export { ContextualProvider } from './ContextualProvider.js';
export { useContextual } from './hooks/useContextual.js';
export type { ContextualState } from './hooks/useContextual.js';
export { useElementTargeting } from './hooks/useElementTargeting.js';
export { useMentionParser } from './hooks/useMentionParser.js';
export { parseMentions } from './mentions/parser.js';
export { formatOutput } from './output/formatter.js';

// Re-export shared types consumers will need
export type {
  Annotation,
  TargetedElement,
  ParsedMention,
  ContextType,
  ResolutionDepth,
  StructuredOutput,
  MentionResult,
  ContextMatch,
} from '@contextual/shared';
