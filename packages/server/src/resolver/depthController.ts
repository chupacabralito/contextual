// =============================================================================
// Depth Controller
// =============================================================================
// Controls how much context is returned based on the requested depth level.
// Light = minimal tokens. Full = everything.
// =============================================================================

import type { ResolutionDepth, ContextMatch } from '@contextual/shared';

interface ResolveByDepthOptions {
  getRelatedFindings?: (match: ContextMatch) => Promise<string[]>;
}

function truncate(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

/**
 * Filter and shape context matches based on requested depth.
 */
export async function resolveByDepth(
  matches: ContextMatch[],
  depth: ResolutionDepth,
  options: ResolveByDepthOptions = {}
): Promise<ContextMatch[]> {
  switch (depth) {
    case 'light':
      return matches.slice(0, 1).map((match) => ({
        ...match,
        content: truncate(match.content, 120),
        relatedFindings: undefined,
      }));

    case 'standard':
      return matches.slice(0, 3).map((match) => ({
        ...match,
        relatedFindings: undefined,
      }));

    case 'detailed': {
      const selected = matches.slice(0, 5);
      return Promise.all(
        selected.map(async (match) => ({
          ...match,
          relatedFindings: options.getRelatedFindings
            ? await options.getRelatedFindings(match)
            : [],
        }))
      );
    }

    case 'full':
      return Promise.all(
        matches.map(async (match) => ({
          ...match,
          relatedFindings: options.getRelatedFindings
            ? await options.getRelatedFindings(match)
            : match.relatedFindings,
        }))
      );
  }
}
