// =============================================================================
// Element Targeting Hook
// =============================================================================
// Handles click, highlight, and drag-select interactions for targeting
// UI elements in the browser. Returns a TargetedElement when the user
// selects something.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TargetedElement, SelectionMode, BoundingBox } from '@contextual/shared';

interface UseElementTargetingOptions {
  /** Whether targeting mode is active */
  enabled: boolean;
  /** Called when an element is targeted */
  onTarget: (element: TargetedElement) => void;
  /** CSS selector for elements to ignore (e.g., Contextual's own UI) */
  ignoreSelector?: string;
}

interface UseElementTargetingReturn {
  /** The currently hovered element (for highlight preview) */
  hoveredElement: HTMLElement | null;
  /** Clear the current targeting */
  clearTarget: () => void;
}

/**
 * Generate a human-readable label for an element.
 * Follows Agentation's approach: button text, alt text, tag + class.
 */
function getElementLabel(el: HTMLElement): string {
  // Button or link text
  if (el.tagName === 'BUTTON' || el.tagName === 'A') {
    const text = el.textContent?.trim();
    if (text) return `${el.tagName.toLowerCase()} "${text}"`;
  }

  // Image alt text
  if (el.tagName === 'IMG') {
    const alt = el.getAttribute('alt');
    if (alt) return `img "${alt}"`;
    return 'img (no alt)';
  }

  // Input with placeholder or label
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const placeholder = el.getAttribute('placeholder');
    const label = el.getAttribute('aria-label');
    if (label) return `${el.tagName.toLowerCase()} "${label}"`;
    if (placeholder) return `${el.tagName.toLowerCase()} "${placeholder}"`;
  }

  // Heading text
  if (/^H[1-6]$/.test(el.tagName)) {
    const text = el.textContent?.trim().slice(0, 40);
    if (text) return `${el.tagName.toLowerCase()} "${text}"`;
  }

  // Fallback: tag + class
  const classes = el.className && typeof el.className === 'string'
    ? `.${el.className.split(' ').filter(Boolean).join('.')}`
    : '';
  return `${el.tagName.toLowerCase()}${classes}`;
}

/**
 * Generate a CSS selector that identifies an element.
 */
function getElementSelector(el: HTMLElement): string {
  // ID is most specific
  if (el.id) return `#${el.id}`;

  // Build selector from tag + classes (escape special chars for valid CSS selectors)
  const tag = el.tagName.toLowerCase();
  const classes = el.className && typeof el.className === 'string'
    ? el.className.split(' ').filter(Boolean).map((c) => `.${CSS.escape(c)}`).join('')
    : '';

  // Add nth-of-type if needed for uniqueness among same-tag siblings
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (s) => s.tagName === el.tagName
    );
    if (siblings.length > 1) {
      const index = siblings.indexOf(el) + 1;
      return `${tag}${classes}:nth-of-type(${index})`;
    }
  }

  return `${tag}${classes}`;
}

/**
 * Walk up the DOM tree and collect selectors for all ancestor elements.
 * Stops at <body>. Returns parent-first order (nearest ancestor first).
 */
function getAncestorSelectors(el: HTMLElement): string[] {
  const ancestors: string[] = [];
  let current = el.parentElement;
  while (current && current.tagName !== 'BODY' && current.tagName !== 'HTML') {
    ancestors.push(getElementSelector(current));
    current = current.parentElement;
  }
  return ancestors;
}

/**
 * Get bounding box for an element.
 */
function getBoundingBox(el: HTMLElement): BoundingBox {
  const rect = el.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

/**
 * Hook for element targeting in the browser.
 * Supports click selection and text highlight selection.
 */
export function useElementTargeting({
  enabled,
  onTarget,
  ignoreSelector = '[data-contextual]',
}: UseElementTargetingOptions): UseElementTargetingReturn {
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const ignoreRef = useRef(ignoreSelector);
  ignoreRef.current = ignoreSelector;

  const clearTarget = useCallback(() => {
    setHoveredElement(null);
  }, []);

  // Mouse move handler for hover preview
  useEffect(() => {
    if (!enabled) {
      setHoveredElement(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Ignore Contextual's own UI
      if (target.closest(ignoreRef.current)) {
        setHoveredElement(null);
        return;
      }

      setHoveredElement(target);
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Ignore Contextual's own UI
      if (target.closest(ignoreRef.current)) return;

      e.preventDefault();
      e.stopPropagation();

      // Check for text selection (highlight mode)
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      let selectionMode: SelectionMode = 'click';
      let elementToTarget = target;

      if (selectedText && selectedText.length > 0) {
        selectionMode = 'highlight';
        // Use the common ancestor of the selection as the target
        const range = selection?.getRangeAt(0);
        if (range?.commonAncestorContainer) {
          const ancestor = range.commonAncestorContainer;
          elementToTarget =
            ancestor.nodeType === Node.ELEMENT_NODE
              ? (ancestor as HTMLElement)
              : (ancestor.parentElement ?? target);
        }
      }

      const targeted: TargetedElement = {
        selector: getElementSelector(elementToTarget),
        label: getElementLabel(elementToTarget),
        selectionMode,
        boundingBox: getBoundingBox(elementToTarget),
        tagName: elementToTarget.tagName.toLowerCase(),
        ancestorSelectors: getAncestorSelectors(elementToTarget),
        ...(selectedText ? { selectedText } : {}),
      };

      onTarget(targeted);
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [enabled, onTarget]);

  return { hoveredElement, clearTarget };
}
