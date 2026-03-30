// =============================================================================
// Contextual Toolbar
// =============================================================================
// Floating toolbar that activates/deactivates annotation mode.
// Follows Agentation's precedent: minimal, non-intrusive, always accessible.
// =============================================================================

import React from 'react';
import type { AnnotationMode } from '@contextual/shared';
import type { ContextualState } from '../hooks/useContextual.js';

interface ToolbarProps {
  /** Current workflow state */
  state: ContextualState;
  /** Current interaction mode */
  mode: AnnotationMode;
  /** Update interaction mode */
  onModeChange: (mode: AnnotationMode) => void;
  /** Start targeting mode */
  onStartTargeting: () => void;
  /** Cancel current action */
  onCancel: () => void;
  /** Current queued instruction count */
  queueLength: number;
}

export function Toolbar({
  state,
  mode,
  onModeChange,
  onStartTargeting,
  onCancel,
  queueLength,
}: ToolbarProps) {
  const isActive = state !== 'idle';
  const isSubmitted = state === 'submitted';
  const mainLabel = getMainLabel(state, mode, queueLength);

  return (
    <div
      data-contextual="toolbar"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {state === 'idle' && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            backgroundColor: '#111827',
            border: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
          }}
        >
          {(['instruct', 'inspect'] as const).map((candidateMode) => (
            <button
              key={candidateMode}
              onClick={() => onModeChange(candidateMode)}
              style={{
                padding: '7px 10px',
                fontSize: 12,
                fontWeight: 600,
                color: mode === candidateMode ? '#f8fafc' : '#94a3b8',
                backgroundColor:
                  mode === candidateMode ? 'rgba(59, 130, 246, 0.28)' : 'transparent',
                border:
                  mode === candidateMode
                    ? '1px solid rgba(96, 165, 250, 0.45)'
                    : '1px solid transparent',
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {candidateMode === 'instruct' ? 'Instruct' : 'Inspect'}
            </button>
          ))}
        </div>
      )}

      {/* Cancel button (when active) */}
      {isActive && !isSubmitted && (
        <button
          onClick={onCancel}
          style={{
            padding: '8px 12px',
            fontSize: 12,
            color: '#808098',
            backgroundColor: '#1a1a2e',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Esc
        </button>
      )}

      {/* Main action button */}
      <button
        onClick={isActive ? undefined : onStartTargeting}
        style={{
          padding: '10px 20px',
          fontSize: 13,
          fontWeight: 600,
          color: '#fff',
          backgroundColor: isSubmitted
            ? 'rgba(34, 197, 94, 0.8)'
            : isActive
              ? 'rgba(99, 102, 241, 0.6)'
              : 'rgba(99, 102, 241, 0.8)',
          border: 'none',
          borderRadius: 8,
          cursor: isActive ? 'default' : 'pointer',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.15s ease',
          fontFamily: 'inherit',
          letterSpacing: '0.02em',
        }}
      >
        {mainLabel}
      </button>
    </div>
  );
}

function getMainLabel(
  state: ContextualState,
  mode: AnnotationMode,
  queueLength: number
): string {
  switch (state) {
    case 'idle':
      if (mode === 'inspect') {
        return 'Inspect Element';
      }
      return queueLength > 0 ? `Add Instruction (${queueLength} queued)` : 'Add Instruction';
    case 'targeting':
      return mode === 'inspect' ? 'Select an Element...' : 'Click an Element...';
    case 'annotating':
      return 'Write Instruction';
    case 'inspecting':
      return 'Decision Trail';
    case 'submitted':
      return 'Pass Copied';
    default:
      return 'Contextual';
  }
}
