// =============================================================================
// Annotation Input
// =============================================================================
// Text input with @mention syntax support and autocomplete dropdown.
// Uses the useMentionParser hook for all @mention detection and completion.
// Positioned near the targeted element.
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMentionParser } from '../hooks/useMentionParser.js';

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
  const parser = useMentionParser({ serverUrl });
  const [selectedCompletion, setSelectedCompletion] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
          placeholder='Write an instruction... use @tool[query] for agent actions'
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

        <div style={{ marginTop: 6, fontSize: 11, color: '#606078', lineHeight: 1.5 }}>
          Use{' '}
          <code style={{ fontFamily: '"SF Mono", Menlo, monospace', color: '#8fb7ff' }}>
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
          <span style={{ fontSize: 11, color: '#606078' }}>
            {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter
          </span>

          <button
            onClick={handleSubmit}
            style={{
              padding: '7px 20px',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              backgroundColor: 'rgba(99, 102, 241, 0.8)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
