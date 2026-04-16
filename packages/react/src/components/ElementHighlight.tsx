// =============================================================================
// Element Highlight Overlay
// =============================================================================
// Renders a visual overlay on the hovered/targeted element during targeting mode.
// When an `element` ref is provided, the highlight re-reads getBoundingClientRect
// on scroll and resize so it tracks the element as the page moves.
// =============================================================================

import React, { useEffect, useState } from 'react';
import type { BoundingBox } from '@contextualapp/shared';

interface ElementHighlightProps {
  /** Initial bounding box (used as fallback and first paint) */
  boundingBox: BoundingBox;
  /** Whether this is a hover preview or a confirmed selection */
  variant: 'hover' | 'selected';
  /** Optional live DOM element – when provided the highlight tracks it on scroll/resize */
  element?: HTMLElement | null;
  /** Optional numeric badge shown in the top-left corner (e.g. inspect order number) */
  badge?: number;
}

export function ElementHighlight({ boundingBox, variant, element, badge }: ElementHighlightProps) {
  const [liveBox, setLiveBox] = useState(boundingBox);

  // Keep liveBox in sync with prop changes (e.g. new element selected)
  useEffect(() => {
    setLiveBox(boundingBox);
  }, [boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height]);

  // When an element ref is provided, listen for scroll/resize and re-measure
  useEffect(() => {
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      setLiveBox({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    // Initial measurement
    update();

    // Listen on window scroll (capture phase to catch nested scroll containers)
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [element]);

  const { x, y, width, height } = liveBox;
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
    >
      {badge != null && (
        <span
          style={{
            position: 'absolute',
            top: -10,
            left: -10,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: 'rgba(99, 102, 241, 0.9)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            lineHeight: 1,
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
