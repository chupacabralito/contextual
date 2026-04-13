// =============================================================================
// Annotation Input
// =============================================================================
// Text input with @mention syntax support and autocomplete dropdown.
// Uses the useMentionParser hook for all @mention detection and completion.
// Positioned near the targeted element, draggable via header bar.
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMentionParser } from '../hooks/useMentionParser.js';
import { useTheme } from '../theme.js';

const INPUT_MAX_WIDTH = 600;
const INPUT_MIN_WIDTH = 180;
const VIEWPORT_MARGIN = 12;
const INPUT_MIN_BOTTOM_CLEARANCE = 48;

function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 1024, height: 768 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function getInputWidth(viewportWidth: number) {
  return Math.min(INPUT_MAX_WIDTH, Math.max(INPUT_MIN_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2));
}

function clampInputPosition(
  position: { x: number; y: number },
  viewport: { width: number; height: number },
  inputWidth: number
) {
  const maxX = Math.max(VIEWPORT_MARGIN, viewport.width - inputWidth - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, viewport.height - INPUT_MIN_BOTTOM_CLEARANCE);

  const nextX = Math.min(Math.max(position.x, VIEWPORT_MARGIN), maxX);
  const nextY = Math.min(Math.max(position.y, VIEWPORT_MARGIN), maxY);

  if (nextX === position.x && nextY === position.y) {
    return position;
  }

  return { x: nextX, y: nextY };
}

interface AnnotationInputProps {
  /** Position near the targeted element */
  position: { x: number; y: number };
  /** Base URL for remote autocomplete / resolve endpoints */
  serverUrl?: string;
  /** Called when user submits the annotation */
  onSubmit: (text: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Pre-fill text when editing an existing queued instruction */
  initialText?: string;
}

export function AnnotationInput({
  position,
  serverUrl,
  onSubmit,
  onCancel,
  initialText = '',
}: AnnotationInputProps) {
  const t = useTheme();
  const isDark = t.panelBg === '#111827';
  const parser = useMentionParser({ serverUrl });
  const [selectedCompletion, setSelectedCompletion] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState(getViewportSize);
  const [inputWidth, setInputWidth] = useState(() => getInputWidth(getViewportSize().width));

  // -------------------------------------------------------------------------
  // Resize state (right-edge drag)
  // -------------------------------------------------------------------------
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX.current;
      const maxForViewport = Math.min(INPUT_MAX_WIDTH, viewport.width - VIEWPORT_MARGIN * 2);
      const newWidth = Math.min(maxForViewport, Math.max(INPUT_MIN_WIDTH, resizeStartWidth.current + deltaX));
      setInputWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, viewport.width]);

  // Clamp width on viewport resize
  useEffect(() => {
    const maxForViewport = Math.min(INPUT_MAX_WIDTH, viewport.width - VIEWPORT_MARGIN * 2);
    if (inputWidth > maxForViewport) {
      setInputWidth(maxForViewport);
    }
  }, [viewport, inputWidth]);

  // -------------------------------------------------------------------------
  // Drag state
  // -------------------------------------------------------------------------
  const [dragPos, setDragPos] = useState(() =>
    clampInputPosition(
      { x: position.x, y: position.y + 8 },
      getViewportSize(),
      getInputWidth(getViewportSize().width)
    )
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - dragPos.x,
      y: e.clientY - dragPos.y,
    };
    e.preventDefault();
  }, [dragPos]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragPos(() =>
        clampInputPosition(
          { x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y },
          { width: window.innerWidth, height: window.innerHeight },
          inputWidth
        )
      );
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [inputWidth, isDragging]);

  useEffect(() => {
    const handleResize = () => {
      setViewport(getViewportSize());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const nextAnchor = { x: position.x, y: position.y + 8 };
    const lastAnchor = lastAnchorRef.current;
    const anchorChanged =
      !lastAnchor ||
      lastAnchor.x !== nextAnchor.x ||
      lastAnchor.y !== nextAnchor.y;

    if (!anchorChanged || isDragging) return;

    lastAnchorRef.current = nextAnchor;

    setDragPos((prev) => {
      const next = clampInputPosition(
        nextAnchor,
        viewport,
        inputWidth
      );
      return next.x === prev.x && next.y === prev.y ? prev : next;
    });
  }, [inputWidth, isDragging, position.x, position.y, viewport]);

  useEffect(() => {
    setDragPos((prev) => clampInputPosition(prev, viewport, inputWidth));
  }, [inputWidth, viewport]);

  // Initialize with pre-fill text when editing an existing instruction
  useEffect(() => {
    if (initialText) {
      parser.setText(initialText);
      parser.setCursorPosition(initialText.length);
    }
  }, []); // Only on mount

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync cursor position from textarea to hook on every change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart ?? value.length;
    parser.setText(value);
    parser.setCursorPosition(cursorPos);
    setSelectedCompletion(0);
  }, [parser]);

  // Also sync cursor on click/arrow key movement within textarea
  const handleSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    parser.setCursorPosition(target.selectionStart ?? parser.text.length);
  }, [parser]);

  const applyCompletion = useCallback(
    (completion: string) => {
      if (parser.mentionStartIndex === -1) return;

      const cursorPos = inputRef.current?.selectionStart ?? parser.text.length;
      const newText =
        parser.text.slice(0, parser.mentionStartIndex) +
        `@${completion}[` +
        parser.text.slice(cursorPos);

      parser.setText(newText);
      setSelectedCompletion(0);

      // Move cursor inside the brackets
      const newPos = parser.mentionStartIndex + completion.length + 2; // @type[
      parser.setCursorPosition(newPos);

      requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(newPos, newPos);
        inputRef.current?.focus();
      });
    },
    [parser]
  );

  const handleSubmit = useCallback(() => {
    if (parser.text.trim()) {
      onSubmit(parser.text.trim());
    }
  }, [parser.text, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle autocomplete navigation
      if (parser.completions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedCompletion((prev) => (prev + 1) % parser.completions.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedCompletion(
            (prev) => (prev - 1 + parser.completions.length) % parser.completions.length
          );
          return;
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
          if (parser.completions[selectedCompletion]) {
            e.preventDefault();
            applyCompletion(parser.completions[selectedCompletion]);
            return;
          }
        }
      }

      // Submit on Cmd/Ctrl + Enter
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
        return;
      }

      // Cancel on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
    },
    [parser.completions, selectedCompletion, applyCompletion, handleSubmit, onCancel]
  );

  return (
    <div
      data-contextual="input"
      style={{
        position: 'fixed',
        left: dragPos.x,
        top: dragPos.y,
        zIndex: 2147483646,
        width: inputWidth,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
        userSelect: (isDragging || isResizing) ? 'none' : 'auto',
        overflow: 'visible',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: t.annotationBg,
          border: `1px solid ${t.annotationBorder}`,
          borderRadius: 4,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          style={{
            padding: '4px 12px',
            backgroundColor: t.annotationHeaderBg,
            cursor: isDragging ? 'grabbing' : 'grab',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 14,
            borderBottom: `1px solid ${t.annotationBorderSubtle}`,
          }}
        >
          <div style={{
            width: 32,
            height: 3,
            borderRadius: 2,
            backgroundColor: t.annotationHandleColor,
          }} />
        </div>

        {/* Input body */}
        <div style={{ padding: 12 }}>
          {/* Annotation text area */}
          <textarea
            ref={inputRef}
            value={parser.text}
            onChange={handleChange}
            onSelect={handleSelect}
            onKeyDown={handleKeyDown}
            placeholder='Write an instruction... use @tool[query] for agent actions'
            rows={3}
            style={{
              width: '100%',
              backgroundColor: t.annotationInputBg,
              color: t.inputText,
              border: `1px solid ${t.annotationInputBorder}`,
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {/* Autocomplete dropdown */}
          {parser.completions.length > 0 && (
            <div
              style={{
                marginTop: 4,
                backgroundColor: t.annotationCompletionBg,
                border: `1px solid ${t.annotationInputBorder}`,
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              {parser.completions.map((type, i) => (
                <div
                  key={type}
                  onClick={() => applyCompletion(type)}
                  style={{
                    padding: '6px 10px',
                    fontSize: 12,
                    color: i === selectedCompletion ? t.textPrimary : t.textSecondary,
                    backgroundColor:
                      i === selectedCompletion
                        ? t.accentBg
                        : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  @{type}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 6, fontSize: 11, color: t.annotationHintText, lineHeight: 1.5 }}>
            Use{' '}
            <code style={{ fontFamily: '"SF Mono", Menlo, monospace', color: t.annotationCodeText }}>
              @tool[query]
            </code>{' '}
            to reference configured tools or specify agent actions.
          </div>

          {/* Bottom bar: Done button + keyboard shortcut hint */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <span style={{ fontSize: 11, color: t.annotationHintText }}>
              {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter
            </span>

            <button
              onClick={handleSubmit}
              style={{
                padding: '3px 10px',
                marginRight: 10,
                fontSize: 11,
                fontWeight: 600,
                color: isDark ? '#a3e635' : '#65a30d',
                backgroundColor: isDark ? 'rgba(163, 230, 53, 0.1)' : 'rgba(101, 163, 13, 0.1)',
                border: `1px solid ${isDark ? 'rgba(163, 230, 53, 0.25)' : 'rgba(101, 163, 13, 0.25)'}`,
                borderRadius: 5,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Bottom-right resize handle (perforation grip) */}
      <div
        data-contextual="input-resize-handle"
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 24,
          height: 24,
          cursor: 'nwse-resize',
          zIndex: 10,
          borderBottomRightRadius: 4,
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          resizeStartX.current = e.clientX;
          resizeStartWidth.current = inputWidth;
          setIsResizing(true);
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          style={{
            position: 'absolute',
            right: 3,
            bottom: 3,
          }}
        >
          {/* Row 1 (bottom): 3 dots */}
          <circle cx="16" cy="16" r="1.5" fill={isDark ? '#a3e635' : '#65a30d'} opacity="0.8" />
          <circle cx="10" cy="16" r="1.5" fill={isDark ? '#a3e635' : '#65a30d'} opacity="0.7" />
          <circle cx="4"  cy="16" r="1.5" fill={isDark ? '#a3e635' : '#65a30d'} opacity="0.6" />
          {/* Row 2: 2 dots */}
          <circle cx="16" cy="10" r="1.5" fill={isDark ? '#a3e635' : '#65a30d'} opacity="0.7" />
          <circle cx="10" cy="10" r="1.5" fill={isDark ? '#a3e635' : '#65a30d'} opacity="0.6" />
          {/* Row 3 (top): 1 dot */}
          <circle cx="16" cy="4" r="1.5" fill={isDark ? '#a3e635' : '#65a30d'} opacity="0.6" />
        </svg>
      </div>
    </div>
  );
}
