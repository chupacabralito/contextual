// =============================================================================
// Annotation Input
// =============================================================================
// Text input with @mention syntax support and autocomplete dropdown.
// Uses the useMentionParser hook for all @mention detection and completion.
// Positioned near the targeted element.
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ContextType, ResolutionDepth } from '@contextual/shared';
import { useMentionParser } from '../hooks/useMentionParser.js';

interface AnnotationInputProps {
  /** Position near the targeted element */
  position: { x: number; y: number };
  /** Called when user submits the annotation */
  onSubmit: (text: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Current depth level */
  depth: ResolutionDepth;
  /** Update depth level */
  onDepthChange: (depth: ResolutionDepth) => void;
  /** Pre-fill text when returning from preview via back button */
  initialText?: string;
}

const DEPTH_LABELS: Record<ResolutionDepth, string> = {
  light: 'Light',
  standard: 'Standard',
  detailed: 'Detailed',
  full: 'Full',
};

const DEPTHS: ResolutionDepth[] = ['light', 'standard', 'detailed', 'full'];

export function AnnotationInput({
  position,
  onSubmit,
  onCancel,
  depth,
  onDepthChange,
  initialText = '',
}: AnnotationInputProps) {
  const parser = useMentionParser();
  const [selectedCompletion, setSelectedCompletion] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize with pre-fill text (e.g. when returning from preview)
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
    (completion: ContextType) => {
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
        if (parser.text.trim()) {
          onSubmit(parser.text.trim());
        }
        return;
      }

      // Cancel on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
    },
    [parser.completions, parser.text, selectedCompletion, applyCompletion, onSubmit, onCancel]
  );

  // Position the input below the targeted element, clamped to viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 420),
    top: Math.min(position.y + 8, window.innerHeight - 280),
    zIndex: 2147483646,
  };

  return (
    <div data-contextual="input" style={style}>
      <div
        style={{
          width: 400,
          backgroundColor: '#1a1a2e',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 8,
          padding: 12,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Annotation text area */}
        <textarea
          ref={inputRef}
          value={parser.text}
          onChange={handleChange}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          placeholder='Type annotation... use @research[query] for context'
          rows={3}
          style={{
            width: '100%',
            backgroundColor: '#0d0d1a',
            color: '#e0e0e8',
            border: '1px solid rgba(99, 102, 241, 0.2)',
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
              backgroundColor: '#16162a',
              border: '1px solid rgba(99, 102, 241, 0.2)',
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
                  color: i === selectedCompletion ? '#fff' : '#a0a0b8',
                  backgroundColor:
                    i === selectedCompletion
                      ? 'rgba(99, 102, 241, 0.2)'
                      : 'transparent',
                  cursor: 'pointer',
                }}
              >
                @{type}
              </div>
            ))}
          </div>
        )}

        {/* Bottom bar: depth selector + submit hint */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          {/* Depth selector */}
          <div style={{ display: 'flex', gap: 4 }}>
            {DEPTHS.map((d) => (
              <button
                key={d}
                onClick={() => onDepthChange(d)}
                style={{
                  padding: '3px 8px',
                  fontSize: 11,
                  color: d === depth ? '#fff' : '#808098',
                  backgroundColor:
                    d === depth ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                  border:
                    d === depth
                      ? '1px solid rgba(99, 102, 241, 0.5)'
                      : '1px solid rgba(99, 102, 241, 0.15)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {DEPTH_LABELS[d]}
              </button>
            ))}
          </div>

          {/* Submit hint */}
          <span style={{ fontSize: 11, color: '#606078' }}>
            {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter to
            submit
          </span>
        </div>
      </div>
    </div>
  );
}
