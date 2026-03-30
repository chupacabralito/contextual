// =============================================================================
// @Mention Parser
// =============================================================================
// Parses annotation text to extract @type[query] mentions.
// Examples:
//   "Fix this @research[checkout friction]" -> [{type: "research", query: "checkout friction", ...}]
//   "Use @taste[stripe clarity] and @design-system[button primary]" -> [...]
// =============================================================================

import { CONTEXT_TYPES } from '@contextual/shared';
import type { ContextType, ParsedMention } from '@contextual/shared';

/**
 * Regex to match @type[query] patterns in annotation text.
 * Captures: (1) context type, (2) query string inside brackets
 */
const MENTION_REGEX = /@([\w-]+)\[([^\]]+)\]/g;

/**
 * Parse all @mentions from an annotation string.
 *
 * @param text - The raw annotation text
 * @returns Array of parsed mentions with positions
 */
export function parseMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const type = match[1] as string;

    // Only include valid context types
    if (isValidContextType(type)) {
      mentions.push({
        type: type as ContextType,
        query: match[2]!.trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  return mentions;
}

/**
 * Check if a string is a valid context type.
 */
export function isValidContextType(type: string): type is ContextType {
  return CONTEXT_TYPES.includes(type as ContextType);
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
 * @returns Matching context types
 */
export function getTypeCompletions(partial: string): ContextType[] {
  const lower = partial.toLowerCase();
  return CONTEXT_TYPES.filter((t) => t.startsWith(lower));
}
