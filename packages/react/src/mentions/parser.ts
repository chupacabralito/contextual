// =============================================================================
// @Mention Parser
// =============================================================================
// Parses annotation text to extract @source[instruction] directives.
// Examples:
//   "Fix this @research[checkout friction]" -> [{type: "research", query: "checkout friction", ...}]
//   "Use @taste[stripe clarity] and @design-system[button primary]" -> [...]
// =============================================================================

import type { ParsedAction } from '@contextualapp/shared';

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
 * Extract the plain text from an annotation (without @mentions).
 * Useful for display purposes.
 */
export function stripMentions(text: string): string {
  return text.replace(MENTION_REGEX, '').replace(/\s+/g, ' ').trim();
}

