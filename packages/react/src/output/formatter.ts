// =============================================================================
// Output Formatter
// =============================================================================
// Formats the structured pass as markdown for the agent. Includes element data,
// natural language instruction, and @mention actions. Local context types have
// pre-searched snippets at the chosen depth level. External tool actions are
// passed as instructions for the agent to execute at runtime.
// =============================================================================

import type {
  Annotation,
  MentionResult,
  ResolutionDepth,
  StructuredOutput,
  ContextMatch,
} from '@contextual/shared';

/**
 * Format a structured output as markdown for clipboard export.
 */
export function formatOutput(output: StructuredOutput): string {
  const { annotation, resolvedContext, depth } = output;
  const parts: string[] = [];

  // Header
  parts.push('## Annotation');
  parts.push('');

  // Element info
  parts.push(formatElement(annotation));
  parts.push('');

  // Annotation text (strip @mentions for readability)
  const plainText = annotation.rawText
    .replace(/@[\w-]+\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plainText) {
    parts.push(`**Annotation:** ${plainText}`);
    parts.push('');
  }

  // Resolved context
  if (resolvedContext.length > 0) {
    parts.push('**Resolved Context:**');
    parts.push('');

    for (const result of resolvedContext) {
      parts.push(formatMentionResult(result, depth));
      parts.push('');
    }
  }

  return parts.join('\n').trimEnd();
}

/**
 * Format element information.
 */
function formatElement(annotation: Annotation): string {
  const { element } = annotation;
  const { label, selector, boundingBox } = element;

  const bbox = `${boundingBox.width}x${boundingBox.height} at [${boundingBox.x}, ${boundingBox.y}]`;

  let line = `**Element:** ${capitalizeFirst(label)} (${selector}, ${bbox})`;

  if (element.selectedText) {
    line += `\n**Selected text:** "${element.selectedText}"`;
  }

  return line;
}

/**
 * Format a single mention result at the given depth.
 */
function formatMentionResult(
  result: MentionResult,
  depth: ResolutionDepth
): string {
  const parts: string[] = [];

  parts.push(`@${result.type}[${result.query}]:`);

  if (result.matches.length === 0) {
    parts.push('> No matching context found');
    return parts.join('\n');
  }

  for (const match of result.matches) {
    parts.push(formatMatch(match, depth));
  }

  return parts.join('\n');
}

/**
 * Format a single context match based on depth level.
 *
 * Light: key finding only (one line)
 * Standard: finding + source + date
 * Detailed: full finding + related findings
 * Full: everything
 */
function formatMatch(match: ContextMatch, depth: ResolutionDepth): string {
  const parts: string[] = [];

  switch (depth) {
    case 'light':
      // One line: just the key content
      parts.push(`> ${truncate(match.content, 120)}`);
      break;

    case 'standard':
      // Content + source + date
      parts.push(`> ${match.content}`);
      parts.push(`> Source: ${match.source}${match.date ? `, ${match.date}` : ''}`);
      break;

    case 'detailed':
      // Full content + related findings
      parts.push(`> ${match.content}`);
      parts.push(`> Source: ${match.source}${match.date ? `, ${match.date}` : ''}`);
      if (match.relatedFindings && match.relatedFindings.length > 0) {
        parts.push(`> Related:`);
        for (const related of match.relatedFindings) {
          parts.push(`> - ${related}`);
        }
      }
      break;

    case 'full':
      // Everything including relevance score
      parts.push(`> ${match.content}`);
      parts.push(`> Source: ${match.source}${match.date ? `, ${match.date}` : ''}`);
      parts.push(`> Relevance: ${Math.round(match.relevance * 100)}%`);
      if (match.relatedFindings && match.relatedFindings.length > 0) {
        parts.push(`> Related:`);
        for (const related of match.relatedFindings) {
          parts.push(`> - ${related}`);
        }
      }
      break;
  }

  return parts.join('\n');
}

/**
 * Truncate a string to a max length with ellipsis.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter.
 */
function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
