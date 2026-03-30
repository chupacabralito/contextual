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
  QueuedInstruction,
  TargetedElement,
} from '@contextual/shared';
import { stripMentions } from '../mentions/parser.js';

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
  parts.push(formatElement(annotation.element));
  parts.push('');

  // Annotation text (strip @mentions for readability)
  const plainText = stripMentions(annotation.rawText);
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
 * Format a queued multi-instruction pass as markdown for clipboard export.
 */
export function formatPass(
  queue: QueuedInstruction[],
  depth: ResolutionDepth
): string {
  const parts: string[] = [];

  parts.push('## Refinement Pass');
  parts.push('');
  parts.push(`**Depth:** ${capitalizeFirst(depth)}`);
  parts.push(`**Instructions:** ${queue.length}`);

  queue.forEach((instruction, index) => {
    parts.push('');
    parts.push('---');
    parts.push('');
    parts.push(`### Instruction ${index + 1}`);
    parts.push(formatElement(instruction.element));

    const plainText = stripMentions(instruction.rawText);
    if (plainText) {
      parts.push(`**Instruction:** ${plainText}`);
    }

    parts.push('**Actions:**');
    if (instruction.actions.length > 0) {
      for (const action of instruction.actions) {
        parts.push(`- @${action.source}[${action.instruction}]`);
      }
    } else {
      parts.push('- None');
    }

    const snippets = instruction.resolvedContext.flatMap((result) =>
      result.matches.map((match) => ({
        type: result.type,
        query: result.query,
        match,
      }))
    );

    if (snippets.length > 0) {
      parts.push('');
      parts.push('**Pre-attached context:**');

      for (const snippet of snippets) {
        parts.push(`@${snippet.type}[${snippet.query}]:`);
        parts.push(formatMatch(snippet.match, depth));
      }
    }
  });

  return parts.join('\n').trimEnd();
}

/**
 * Format element information.
 */
function formatElement(element: TargetedElement | Annotation): string {
  const target = 'element' in element ? element.element : element;
  const { label, selector, boundingBox } = target;

  const bbox = `${boundingBox.width}x${boundingBox.height} at [${boundingBox.x}, ${boundingBox.y}]`;

  let line = `**Element:** ${capitalizeFirst(label)} (${selector}, ${bbox})`;

  if (target.selectedText) {
    line += `\n**Selected text:** "${target.selectedText}"`;
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
