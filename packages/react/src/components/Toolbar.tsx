// =============================================================================
// Contextual Toolbar
// =============================================================================
// Floating toolbar that activates/deactivates annotation mode.
// Follows Agentation's precedent: minimal, non-intrusive, always accessible.
// =============================================================================

import React from 'react';
import type { ContextualState } from '../hooks/useContextual.js';

interface ToolbarProps {
  /** Current workflow state */
  state: ContextualState;
  /** Start targeting mode */
  onStartTargeting: () => void;
  /** Cancel current action */
  onCancel: () => void;
}

const STATE_LABELS: Record<ContextualState, string> = {
  idle: 'Annotate',
  targeting: 'Click an element...',
  annotating: 'Annotating',
  previewing: 'Preview',
  submitted: 'Submitted!',
};

export function Toolbar({ state, onStartTargeting, onCancel }: ToolbarProps) {
  const isActive = state !== 'idle';
  const isSubmitted = state === 'submitted';

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
        {STATE_LABELS[state]}
      </button>
    </div>
  );
}
