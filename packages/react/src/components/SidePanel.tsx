// =============================================================================
// Side Panel
// =============================================================================
// Unified floating panel that combines mode toggle, instruction queue, and
// inspect (decision trail) into one draggable, collapsible module.
//
// Layout:
//   Header: [Instruct | Inspect] toggle + collapse chevron + Esc
//   Body:   Queue list (instruct mode) or Decision Trail (inspect mode)
//   Footer: Submit Pass button (when queue has items)
//
// Drag: Header doubles as drag handle (mousedown -> mousemove -> mouseup).
// Collapse: Auto-collapses when queue is empty and no inspect data.
//           Stays expanded when content exists; manual collapse via chevron.
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AnnotationMode, QueuedInstruction, TargetedElement } from '@contextual/shared';
import type { ContextualState } from '../hooks/useContextual.js';
import { InspectContent } from './InspectPanel.js';
import { stripMentions } from '../mentions/parser.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SidePanelProps {
  /** Current workflow state */
  state: ContextualState;
  /** Current interaction mode */
  mode: AnnotationMode;
  /** Update interaction mode (immediately starts targeting) */
  onModeChange: (mode: AnnotationMode) => void;
  /** Cancel current action (return to idle) */
  onCancel: () => void;
  /** Instruction queue */
  queue: QueuedInstruction[];
  /** Edit a queued instruction */
  onEditInstruction: (id: string) => void;
  /** Remove a queued instruction */
  onRemoveInstruction: (id: string) => void;
  /** Reorder instructions */
  onReorderInstruction: (fromIndex: number, toIndex: number) => void;
  /** Clear all queued instructions */
  onClearQueue: () => void;
  /** Submit the pass */
  onSubmitPass: () => void;
  /** Error message */
  error?: string | null;
  /** Stack of inspected elements */
  inspectStack: TargetedElement[];
  /** Remove an element from inspect stack by index */
  onRemoveFromInspectStack: (index: number) => void;
  /** Clear all inspected elements */
  onClearInspectStack: () => void;
  /** Server URL for inspect API calls */
  serverUrl: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SidePanel({
  state,
  mode,
  onModeChange,
  onCancel,
  queue,
  onEditInstruction,
  onRemoveInstruction,
  onReorderInstruction,
  onClearQueue,
  onSubmitPass,
  error,
  inspectStack,
  onRemoveFromInspectStack,
  onClearInspectStack,
  serverUrl,
}: SidePanelProps) {
  // -------------------------------------------------------------------------
  // Drag state
  // -------------------------------------------------------------------------
  const [position, setPosition] = useState({ x: window.innerWidth - 380, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from the header area, not from buttons inside it
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      // Clamp so panel header stays reachable
      setPosition({
        x: Math.max(-300, Math.min(newX, window.innerWidth - 60)),
        y: Math.max(0, Math.min(newY, window.innerHeight - 40)),
      });
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
  }, [isDragging]);

  // -------------------------------------------------------------------------
  // Collapse state
  // -------------------------------------------------------------------------
  const [isCollapsed, setIsCollapsed] = useState(false);

  const hasQueueContent = queue.length > 0;
  const hasInspectContent = inspectStack.length > 0;
  const isActive = state !== 'idle';

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // -------------------------------------------------------------------------
  // Submitted flash state
  // -------------------------------------------------------------------------
  const isSubmitted = state === 'submitted';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      ref={panelRef}
      data-contextual="side-panel"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 2147483647,
        width: 360,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      {/* ----------------------------------------------------------------- */}
      {/* Action bar: drag handle + top-level actions (Esc, expand/collapse) */}
      {/* ----------------------------------------------------------------- */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '3px 8px',
          backgroundColor: '#0d1321',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderBottom: 'none',
          borderRadius: '12px 12px 0 0',
          cursor: isDragging ? 'grabbing' : 'grab',
          minHeight: 24,
        }}
      >
        {/* Left: status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isSubmitted && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#4ade80',
              letterSpacing: '0.02em',
            }}>
              Pass Copied
            </span>
          )}
          {!isSubmitted && !isActive && (
            <span style={{ fontSize: 10, color: '#475569' }}>
              Contextual
            </span>
          )}
          {isActive && !isSubmitted && (
            <span style={{ fontSize: 10, color: '#64748b' }}>
              {mode === 'instruct' ? 'Instruct' : 'Inspect'} mode
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Collapse/expand toggle (always visible) */}
          <button
            onClick={toggleCollapse}
            style={actionBarButtonStyle}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '\u25BC' : '\u25B2'}
          </button>

          {/* Esc (exit mode) */}
          {isActive && !isSubmitted && (
            <button
              onClick={onCancel}
              style={actionBarButtonStyle}
              title="Exit mode (Esc)"
            >
              Esc
            </button>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Mode toggle: full-width Instruct | Inspect                        */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '4px',
          backgroundColor: '#111827',
          borderLeft: '1px solid rgba(148, 163, 184, 0.18)',
          borderRight: '1px solid rgba(148, 163, 184, 0.18)',
          borderBottom: isCollapsed ? '1px solid rgba(148, 163, 184, 0.18)' : 'none',
          borderRadius: isCollapsed ? '0 0 12px 12px' : 0,
          boxShadow: isCollapsed ? '0 4px 16px rgba(0, 0, 0, 0.25)' : 'none',
        }}
      >
        {(['instruct', 'inspect'] as const).map((candidateMode) => {
          const isActiveMode = mode === candidateMode && isActive;
          return (
            <button
              key={candidateMode}
              onClick={() => onModeChange(candidateMode)}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                color: isActiveMode ? '#f8fafc' : '#94a3b8',
                backgroundColor: isActiveMode
                  ? 'rgba(59, 130, 246, 0.28)'
                  : 'transparent',
                border: isActiveMode
                  ? '1px solid rgba(96, 165, 250, 0.45)'
                  : '1px solid transparent',
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'center',
              }}
            >
              {candidateMode === 'instruct' ? 'Instruct' : 'Inspect'}
              {candidateMode === 'instruct' && hasQueueContent && !isActiveMode && (
                <span style={{
                  marginLeft: 4,
                  fontSize: 10,
                  color: '#93c5fd',
                  fontWeight: 700,
                }}>
                  {queue.length}
                </span>
              )}
              {candidateMode === 'inspect' && hasInspectContent && !isActiveMode && (
                <span style={{
                  marginLeft: 4,
                  fontSize: 10,
                  color: '#93c5fd',
                  fontWeight: 700,
                }}>
                  {inspectStack.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Body: Queue or Inspect content                                    */}
      {/* ----------------------------------------------------------------- */}
      {!isCollapsed && (
        <div
          style={{
            maxHeight: 'calc(100vh - 120px)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#111827',
            borderLeft: '1px solid rgba(148, 163, 184, 0.18)',
            borderRight: '1px solid rgba(148, 163, 184, 0.18)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: '0 0 12px 12px',
            boxShadow: '0 18px 48px rgba(15, 23, 42, 0.45)',
          }}
        >
          {/* Error banner */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
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

          {/* ---- Instruct mode: Queue list ---- */}
          {mode === 'instruct' && hasQueueContent && (
            <>
              {/* Queue header */}
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                  {queue.length} instruction{queue.length === 1 ? '' : 's'}
                </span>
                <button onClick={onClearQueue} style={secondaryButtonStyle}>
                  Clear
                </button>
              </div>

              {/* Queue items */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
                {queue.map((instruction, index) => (
                  <QueueItem
                    key={instruction.id}
                    instruction={instruction}
                    index={index}
                    total={queue.length}
                    onEdit={() => onEditInstruction(instruction.id)}
                    onRemove={() => onRemoveInstruction(instruction.id)}
                    onMoveUp={() => onReorderInstruction(index, index - 1)}
                    onMoveDown={() => onReorderInstruction(index, index + 1)}
                  />
                ))}
              </div>

              {/* Submit footer */}
              <div
                style={{
                  borderTop: '1px solid rgba(148, 163, 184, 0.12)',
                  padding: 12,
                  backgroundColor: '#0b1120',
                  borderRadius: '0 0 12px 12px',
                }}
              >
                <button
                  onClick={onSubmitPass}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#eff6ff',
                    background:
                      'linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(59, 130, 246, 0.82))',
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
            </>
          )}

          {/* ---- Inspect mode: Stacked context cards ---- */}
          {mode === 'inspect' && hasInspectContent && (
            <>
              {/* Inspect header */}
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                  {inspectStack.length} element{inspectStack.length === 1 ? '' : 's'}
                </span>
                <button onClick={onClearInspectStack} style={secondaryButtonStyle}>
                  Clear
                </button>
              </div>

              {/* Stacked inspect cards */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
                {inspectStack.map((target, index) => (
                  <div
                    key={`${target.selector}-${index}`}
                    style={{
                      border: '1px solid rgba(148, 163, 184, 0.14)',
                      borderRadius: 10,
                      backgroundColor: '#0f172a',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Card label + remove */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {index + 1}. {target.label}
                      </span>
                      <button
                        onClick={() => onRemoveFromInspectStack(index)}
                        style={dangerButtonStyle}
                      >
                        Remove
                      </button>
                    </div>

                    {/* Inspect content for this element */}
                    <InspectContent
                      target={target}
                      serverUrl={serverUrl}
                      onClose={() => onRemoveFromInspectStack(index)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ---- Empty body: no content to show ---- */}
          {!hasQueueContent && !hasInspectContent && (
            <div style={{ padding: 14, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              {isActive
                ? mode === 'instruct'
                  ? 'Click elements to add instructions.'
                  : 'Click an element to see its history.'
                : 'Select a mode to begin.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue Item Sub-component
// ---------------------------------------------------------------------------

interface QueueItemProps {
  instruction: QueuedInstruction;
  index: number;
  total: number;
  onEdit: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function QueueItem({
  instruction,
  index,
  total,
  onEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
}: QueueItemProps) {
  const plainText = stripMentions(instruction.rawText);
  const summary = plainText
    ? plainText.split('\n')[0]!.trim()
    : instruction.actions.length > 0
      ? `Action-only (${instruction.actions.length})`
      : 'Untitled';

  return (
    <section
      style={{
        border: '1px solid rgba(148, 163, 184, 0.14)',
        borderRadius: 10,
        backgroundColor: '#0f172a',
        padding: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            {index + 1}. {instruction.element.label}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#e2e8f0',
              lineHeight: 1.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {summary}
          </div>
        </div>

        {/* Reorder arrows */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            style={iconBtnStyle(index === 0)}
          >
            &uarr;
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            style={iconBtnStyle(index === total - 1)}
          >
            &darr;
          </button>
        </div>
      </div>

      {/* Actions count + edit/remove */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          {instruction.actions.length} action{instruction.actions.length === 1 ? '' : 's'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onEdit} style={secondaryButtonStyle}>Edit</button>
          <button onClick={onRemove} style={dangerButtonStyle}>Remove</button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    padding: 0,
    fontSize: 11,
    color: disabled ? '#475569' : '#e2e8f0',
    backgroundColor: '#111827',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '5px 8px',
  fontSize: 11,
  color: '#e2e8f0',
  backgroundColor: 'rgba(30, 41, 59, 0.9)',
  border: '1px solid rgba(148, 163, 184, 0.16)',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const dangerButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  color: '#fca5a5',
  backgroundColor: 'rgba(127, 29, 29, 0.28)',
  border: '1px solid rgba(248, 113, 113, 0.18)',
};

const actionBarButtonStyle: React.CSSProperties = {
  padding: '2px 6px',
  fontSize: 10,
  color: '#64748b',
  backgroundColor: 'transparent',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
  lineHeight: 1,
};
