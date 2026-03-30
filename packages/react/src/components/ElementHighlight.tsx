// =============================================================================
// Element Highlight Overlay
// =============================================================================
// Renders a visual overlay on the hovered/targeted element during targeting mode.
// =============================================================================

import React from 'react';
import type { BoundingBox } from '@contextual/shared';

interface ElementHighlightProps {
  /** Bounding box of the element to highlight */
  boundingBox: BoundingBox;
  /** Whether this is a hover preview or a confirmed selection */
  variant: 'hover' | 'selected';
}

export function ElementHighlight({ boundingBox, variant }: ElementHighlightProps) {
  const { x, y, width, height } = boundingBox;

  const isHover = variant === 'hover';

  return (
    <div
      data-contextual="highlight"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width,
        height,
        border: isHover
          ? '2px dashed rgba(99, 102, 241, 0.6)'
          : '2px solid rgba(99, 102, 241, 0.9)',
        backgroundColor: isHover
          ? 'rgba(99, 102, 241, 0.05)'
          : 'rgba(99, 102, 241, 0.08)',
        borderRadius: 4,
        pointerEvents: 'none',
        zIndex: 2147483645,
        transition: 'all 0.1s ease-out',
      }}
    />
  );
}
