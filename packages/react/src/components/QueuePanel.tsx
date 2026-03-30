// =============================================================================
// Queue Panel
// =============================================================================
// Fixed panel showing queued refinement instructions before pass submission.
// =============================================================================

import React from 'react';
import type { QueuedInstruction, ResolutionDepth } from '@contextual/shared';
import { stripMentions } from '../mentions/parser.js';

interface QueuePanelProps {
  queue: QueuedInstruction[];
  depth: ResolutionDepth;
  onDepthChange: (depth: ResolutionDepth) => void;
  onEditInstruction: (id: string) => void;
  onRemoveInstruction: (id: string) => void;
  onReorderInstruction: (fromIndex: number, toIndex: number) => void;
  onClearQueue: () => void;
  onSubmitPass: () => void;
  error?: string | null;
}

const DEPTHS: ResolutionDepth[] = ['light', 'standard', 'detailed', 'full'];

function summarizeInstruction(instruction: QueuedInstruction): string {
  const plainText = stripMentions(instruction.rawText);
  if (plainText) {
    return plainText.split('\n')[0]!.trim();
  }

  if (instruction.actions.length > 0) {
    return `Action-only instruction (${instruction.actions.length})`;
  }

  return 'Untitled instruction';
}

export function QueuePanel({
  queue,
  depth,
  onDepthChange,
  onEditInstruction,
  onRemoveInstruction,
  onReorderInstruction,
  onClearQueue,
  onSubmitPass,
  error,
}: QueuePanelProps) {
  return (
    <aside
      data-contextual="queue-panel"
      style={{
        position: 'fixed',
        left: 20,
        top: 20,
        width: 340,
        maxHeight: 'calc(100vh - 40px)',
        zIndex: 2147483644,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#111827',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        borderRadius: 14,
        boxShadow: '0 18px 48px rgba(15, 23, 42, 0.45)',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Refinement Queue
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>
            {queue.length} instruction{queue.length === 1 ? '' : 's'}
          </div>
        </div>

        <button onClick={onClearQueue} style={secondaryButtonStyle}>
          Clear
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '10px 16px',
            fontSize: 12,
            lineHeight: 1.5,
            color: '#fca5a5',
            backgroundColor: 'rgba(127, 29, 29, 0.28)',
            borderBottom: '1px solid rgba(248, 113, 113, 0.18)',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'grid', gap: 10 }}>
        {queue.map((instruction, index) => {
          const snippetCount = instruction.resolvedContext.reduce(
            (sum, result) => sum + result.matches.length,
            0
          );

          return (
            <section
              key={instruction.id}
              style={{
                border: '1px solid rgba(148, 163, 184, 0.14)',
                borderRadius: 12,
                backgroundColor: '#0f172a',
                padding: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                    Instruction {index + 1}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#f8fafc',
                      lineHeight: 1.5,
                    }}
                  >
                    {instruction.element.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginTop: 6 }}>
                    {summarizeInstruction(instruction)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onReorderInstruction(index, index - 1)}
                    disabled={index === 0}
                    style={iconButtonStyle(index === 0)}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => onReorderInstruction(index, index + 1)}
                    disabled={index === queue.length - 1}
                    style={iconButtonStyle(index === queue.length - 1)}
                  >
                    ↓
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: '#94a3b8' }}>
                <span>
                  {instruction.actions.length} action
                  {instruction.actions.length === 1 ? '' : 's'}
                </span>
                <span>
                  {snippetCount} snippet{snippetCount === 1 ? '' : 's'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => onEditInstruction(instruction.id)} style={secondaryButtonStyle}>
                  Edit
                </button>
                <button onClick={() => onRemoveInstruction(instruction.id)} style={dangerButtonStyle}>
                  Remove
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <div
        style={{
          borderTop: '1px solid rgba(148, 163, 184, 0.12)',
          padding: 14,
          backgroundColor: '#0b1120',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {DEPTHS.map((candidateDepth) => (
            <button
              key={candidateDepth}
              onClick={() => onDepthChange(candidateDepth)}
              style={{
                padding: '5px 10px',
                fontSize: 11,
                color: candidateDepth === depth ? '#f8fafc' : '#94a3b8',
                backgroundColor:
                  candidateDepth === depth ? 'rgba(59, 130, 246, 0.24)' : 'transparent',
                border:
                  candidateDepth === depth
                    ? '1px solid rgba(96, 165, 250, 0.55)'
                    : '1px solid rgba(148, 163, 184, 0.18)',
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {candidateDepth}
            </button>
          ))}
        </div>

        <button
          onClick={onSubmitPass}
          style={{
            width: '100%',
            padding: '11px 14px',
            fontSize: 13,
            fontWeight: 700,
            color: '#eff6ff',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(59, 130, 246, 0.82))',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 10px 24px rgba(37, 99, 235, 0.24)',
          }}
        >
          Submit Pass ({queue.length} instruction{queue.length === 1 ? '' : 's'})
        </button>
      </div>
    </aside>
  );
}

function iconButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    padding: 0,
    fontSize: 12,
    color: disabled ? '#475569' : '#e2e8f0',
    backgroundColor: '#111827',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 12,
  color: '#e2e8f0',
  backgroundColor: 'rgba(30, 41, 59, 0.9)',
  border: '1px solid rgba(148, 163, 184, 0.16)',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const dangerButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  color: '#fca5a5',
  backgroundColor: 'rgba(127, 29, 29, 0.28)',
  border: '1px solid rgba(248, 113, 113, 0.18)',
};
