// =============================================================================
// @Mention Parser
// =============================================================================
// Parses annotation text to extract @source[instruction] directives.
// Examples:
//   "Fix this @research[checkout friction]" -> [{type: "research", query: "checkout friction", ...}]
//   "Use @taste[stripe clarity] and @design-system[button primary]" -> [...]
// =============================================================================

import { CONTEXT_TYPES, isContextType } from '@contextual/shared';
import type { ContextType, ParsedAction, ParsedMention } from '@contextual/shared';

/**
 * Regex to match @type[query] patterns in annotation text.
 * Captures: (1) context type, (2) query string inside brackets
 */
const MENTION_REGEX = /@([\w-]+)\[([^\]]+)\]/g;

/**
 * Parse all @source[instruction] directives from an annotation string.
 * Accepts any source string; validation is handled separately by the UI.
 *
 * @param text - The raw annotation text
 * @returns Array of parsed actions with positions
 */
export function parseActions(text: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  let match: RegExpExecArray | null;

  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    actions.push({
      source: match[1]!.trim(),
      instruction: match[2]!.trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return actions;
}

/**
 * Parse all local-context @mentions from an annotation string.
 *
 * @param text - The raw annotation text
 * @returns Array of parsed mentions with positions
 */
export function parseMentions(text: string): ParsedMention[] {
  return parseActions(text)
    .filter((action): action is ParsedAction & { source: ContextType } =>
      isLocalContextType(action.source)
    )
    .map((action) => ({
      type: action.source,
      query: action.instruction,
      startIndex: action.startIndex,
      endIndex: action.endIndex,
    }));
}

/**
 * Check if a string is a valid context type.
 */
export function isValidContextType(type: string): type is ContextType {
  return isLocalContextType(type);
}

/**
 * Check if a source maps to one of the 5 local context repositories.
 */
export function isLocalContextType(source: string): source is ContextType {
  return isContextType(source);
}

/**
 * Extract the plain text from an annotation (without @mentions).
 * Useful for display purposes.
 */
export function stripMentions(text: string): string {
  return text.replace(MENTION_REGEX, '').replace(/\s+/g, ' ').trim();
}

/**
 * Get autocomplete candidates for a partial @mention.
 * Called while the user is typing to suggest context types.
 *
 * @param partial - The partial text after @, e.g., "res" or "taste["
 * @returns Matching local context types
 */
export function getTypeCompletions(partial: string): string[] {
  const lower = partial.toLowerCase();
  return CONTEXT_TYPES.filter((t) => t.startsWith(lower));
}
