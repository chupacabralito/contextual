// =============================================================================
// Output Formatter
// =============================================================================
// Formats the structured pass as markdown for the agent. Includes element data,
// natural language instruction, and @mention actions. Actions reference tools
// or context for the agent to resolve at execution time.
// =============================================================================

import type {
  QueuedInstruction,
  TargetedElement,
} from '@contextualapp/shared';
import { stripMentions } from '../mentions/parser.js';

/**
 * Format a queued multi-instruction pass as markdown for clipboard export.
 */
export function formatPass(queue: QueuedInstruction[]): string {
  const parts: string[] = [];

  parts.push('## Refinement Pass');
  parts.push('');
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
  });

  return parts.join('\n').trimEnd();
}

/**
 * Format element information.
 */
function formatElement(element: TargetedElement): string {
  const { label, selector, boundingBox } = element;

  const bbox = `${boundingBox.width}x${boundingBox.height} at [${boundingBox.x}, ${boundingBox.y}]`;

  let line = `**Element:** ${capitalizeFirst(label)} (${selector}, ${bbox})`;

  if (element.selectedText) {
    line += `\n**Selected text:** "${element.selectedText}"`;
  }

  return line;
}

/**
 * Capitalize first letter.
 */
function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
