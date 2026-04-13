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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnnotationMode, QueuedInstruction, TargetedElement } from '@contextual/shared';
import type { ContextualState, ReviewDrawerState } from '../hooks/useContextual.js';
import { InspectContent } from './InspectPanel.js';
import { ReviewDrawer } from './ReviewDrawer.js';
import { stripMentions } from '../mentions/parser.js';
import { useTheme, useThemeToggle } from '../theme.js';
import { MARIGOLD_SANS_BASE64 } from '../fonts/marigoldSans.js';

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
  /** Latest post-pass review state */
  review: ReviewDrawerState | null;
  /** Close the review drawer */
  onCloseReview: () => void;
  /** Mark a reviewed instruction as good */
  onMarkInstructionLooksGood: (instructionId: string) => void;
  /** Start a follow-up pass from a reviewed instruction */
  onRequestInstructionFollowUp: (instructionId: string) => void;
  /** Open the learning form for a reviewed instruction */
  onOpenLearningDraft: (instructionId: string) => void;
  /** Close the learning form */
  onCancelLearningDraft: () => void;
  /** Update a learning draft */
  onUpdateLearningDraft: (instructionId: string, patch: {
    title?: string;
    summary?: string;
    destination?: 'operator-preferences' | 'ui-patterns' | 'tool-routing' | 'project-decisions';
  }) => void;
  /** Save a learning draft */
  onSaveLearningDraft: (instructionId: string) => Promise<void>;
  /** Stack of inspected elements */
  inspectStack: TargetedElement[];
  /** Remove an element from inspect stack by index */
  onRemoveFromInspectStack: (index: number) => void;
  /** Clear all inspected elements */
  onClearInspectStack: () => void;
  /** Server URL for inspect API calls */
  serverUrl: string;
}

const PANEL_MAX_WIDTH = 600;
const PANEL_MIN_WIDTH = 160;
const VIEWPORT_MARGIN = 12;
const PANEL_MIN_BOTTOM_CLEARANCE = 40;

function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 1024, height: 768 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function getPanelWidth(viewportWidth: number) {
  return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2));
}

function clampPanelPosition(
  position: { x: number; y: number },
  viewport: { width: number; height: number },
  panelWidth: number
) {
  const maxX = Math.max(VIEWPORT_MARGIN, viewport.width - panelWidth - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, viewport.height - PANEL_MIN_BOTTOM_CLEARANCE);

  const nextX = Math.min(Math.max(position.x, VIEWPORT_MARGIN), maxX);
  const nextY = Math.min(Math.max(position.y, VIEWPORT_MARGIN), maxY);

  if (nextX === position.x && nextY === position.y) {
    return position;
  }

  return { x: nextX, y: nextY };
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
  review,
  onCloseReview,
  onMarkInstructionLooksGood,
  onRequestInstructionFollowUp,
  onOpenLearningDraft,
  onCancelLearningDraft,
  onUpdateLearningDraft,
  onSaveLearningDraft,
  inspectStack,
  onRemoveFromInspectStack,
  onClearInspectStack,
  serverUrl,
}: SidePanelProps) {
  const t = useTheme();
  const { isDark, toggle: toggleTheme } = useThemeToggle();
  const [viewport, setViewport] = useState(getViewportSize);
  const [panelWidth, setPanelWidth] = useState(() => getPanelWidth(getViewportSize().width));

  // -------------------------------------------------------------------------
  // Drag state (move panel)
  // -------------------------------------------------------------------------
  const [position, setPosition] = useState(() =>
    clampPanelPosition(
      { x: getViewportSize().width - PANEL_MAX_WIDTH - VIEWPORT_MARGIN, y: 20 },
      getViewportSize(),
      getPanelWidth(getViewportSize().width)
    )
  );
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
      setPosition(() =>
        clampPanelPosition(
          { x: newX, y: newY },
          { width: window.innerWidth, height: window.innerHeight },
          panelWidth
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
  }, [isDragging, panelWidth]);

  // -------------------------------------------------------------------------
  // Resize state (bottom-left drag to change width)
  // -------------------------------------------------------------------------
  // Dragging from the bottom-left: moving left widens the panel (and shifts
  // position.x left), moving right narrows it (and shifts position.x right).
  // The right edge of the panel stays anchored.
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const resizeStartPosX = useRef(0);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX.current;
      // Dragging left (negative deltaX) makes the panel wider
      const newWidth = Math.min(
        PANEL_MAX_WIDTH,
        Math.max(PANEL_MIN_WIDTH, resizeStartWidth.current - deltaX)
      );
      const widthDelta = newWidth - resizeStartWidth.current;
      // Shift position.x to keep the right edge anchored
      const newPosX = resizeStartPosX.current - widthDelta;

      setPanelWidth(newWidth);
      setPosition((prev) =>
        clampPanelPosition(
          { x: newPosX, y: prev.y },
          { width: window.innerWidth, height: window.innerHeight },
          newWidth
        )
      );
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const handleResize = () => {
      setViewport(getViewportSize());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clamp width to viewport on window resize (don't shrink below min, don't exceed viewport)
  useEffect(() => {
    const maxForViewport = Math.min(PANEL_MAX_WIDTH, viewport.width - VIEWPORT_MARGIN * 2);
    if (panelWidth > maxForViewport) {
      setPanelWidth(maxForViewport);
    }
  }, [viewport, panelWidth]);

  useEffect(() => {
    setPosition((prev) => clampPanelPosition(prev, viewport, panelWidth));
  }, [panelWidth, viewport]);

  // -------------------------------------------------------------------------
  // Collapse state
  // -------------------------------------------------------------------------
  const [isCollapsed, setIsCollapsed] = useState(false);

  const hasQueueContent = queue.length > 0;
  const hasInspectContent = inspectStack.length > 0;
  const isActive = state !== 'idle';
  const shouldShowReview = Boolean(
    review?.isOpen && mode === 'instruct' && !isCollapsed && state !== 'annotating'
  );

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // -------------------------------------------------------------------------
  // Inject MarigoldSans @font-face (once per document)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const STYLE_ID = 'contextual-marigold-font';
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `@font-face { font-family: 'MarigoldSans'; src: url('data:font/opentype;base64,${MARIGOLD_SANS_BASE64}') format('opentype'); font-weight: normal; font-style: normal; font-display: swap; }`;
    document.head.appendChild(style);
  }, []);

  // -------------------------------------------------------------------------
  // External scrollbar (custom track/thumb to the RIGHT of the panel)
  // -------------------------------------------------------------------------
  const bodyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollInfo, setScrollInfo] = useState({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });
  const [isScrollDragging, setIsScrollDragging] = useState(false);
  const scrollDragStartY = useRef(0);
  const scrollDragStartTop = useRef(0);

  const updateScrollInfo = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    setScrollInfo({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    });
  }, []);

  // Sync scroll info on scroll and resize
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateScrollInfo, { passive: true });
    const ro = new ResizeObserver(updateScrollInfo);
    ro.observe(el);
    updateScrollInfo();

    return () => {
      el.removeEventListener('scroll', updateScrollInfo);
      ro.disconnect();
    };
  }, [updateScrollInfo, isCollapsed, state]);

  // Drag handling for custom scrollbar thumb
  useEffect(() => {
    if (!isScrollDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const track = trackRef.current;
      const body = bodyRef.current;
      if (!track || !body) return;

      const trackRect = track.getBoundingClientRect();
      const trackHeight = trackRect.height;
      const deltaY = e.clientY - scrollDragStartY.current;
      const thumbRatio = body.clientHeight / body.scrollHeight;
      const thumbHeight = Math.max(24, trackHeight * thumbRatio);
      const scrollableTrack = trackHeight - thumbHeight;

      if (scrollableTrack <= 0) return;

      const newThumbTop = Math.min(Math.max(0, scrollDragStartTop.current + deltaY), scrollableTrack);
      const scrollRatio = newThumbTop / scrollableTrack;
      body.scrollTop = scrollRatio * (body.scrollHeight - body.clientHeight);
    };

    const handleMouseUp = () => {
      setIsScrollDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrollDragging]);

  const canScroll = scrollInfo.scrollHeight > scrollInfo.clientHeight;
  const thumbRatio = scrollInfo.clientHeight / (scrollInfo.scrollHeight || 1);

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
        width: panelWidth,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: (isDragging || isScrollDragging || isResizing) ? 'none' : 'auto',
        overflow: 'visible',
      }}
    >
    {/* Inner clip wrapper: holds panel chrome, clips native scrollbar */}
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${t.border}`,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: t.panelBg,
        boxShadow: t.shadowPanel,
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
          backgroundColor: t.panelDeep,
          borderBottom: `1px solid ${t.borderSubtle}`,
          cursor: isDragging ? 'grabbing' : 'grab',
          minHeight: 24,
        }}
      >
        {/* Left: status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {state === 'reviewing' && review?.isOpen && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: t.successText,
              letterSpacing: '0.02em',
            }}>
              Review Ready
            </span>
          )}
          {state === 'idle' && !isActive && (
            <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#a3e635' : '#65a30d', fontFamily: "'MarigoldSans', sans-serif" }}>
              Contextual
            </span>
          )}
          {isActive && !(state === 'reviewing' && review?.isOpen) && (
            <span style={{ fontSize: 10, color: t.textMuted }}>
              {mode === 'instruct' ? 'Instruct' : 'Inspect'} mode
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Theme toggle (always visible) */}
          <button
            onClick={toggleTheme}
            style={{
              padding: '3px 7px',
              fontSize: 15,
              color: isDark ? '#a3e635' : '#65a30d',
              backgroundColor: t.modeButtonInactiveBg,
              border: `1px solid ${t.modeButtonInactiveBorder}`,
              borderRadius: 5,
              cursor: 'pointer',
              fontFamily: 'inherit',
              lineHeight: 1,
            }}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '\u2600' : '\u263E'}
          </button>

          {/* Collapse/expand toggle (always visible) */}
          <button
            onClick={toggleCollapse}
            style={{
              padding: '3px 7px',
              fontSize: 15,
              color: isDark ? '#a3e635' : '#65a30d',
              backgroundColor: t.modeButtonInactiveBg,
              border: `1px solid ${t.modeButtonInactiveBorder}`,
              borderRadius: 5,
              cursor: 'pointer',
              fontFamily: 'inherit',
              lineHeight: 1,
            }}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '\u25BC' : '\u25B2'}
          </button>

          {/* Esc (exit mode) */}
          {isActive && !(state === 'reviewing' && review?.isOpen) && (
            <button
              onClick={onCancel}
              style={{
                padding: '3px 7px',
                fontSize: 15,
                color: isDark ? '#a3e635' : '#65a30d',
                backgroundColor: t.modeButtonInactiveBg,
                border: `1px solid ${t.modeButtonInactiveBorder}`,
                borderRadius: 5,
                cursor: 'pointer',
                fontFamily: 'inherit',
                lineHeight: 1,
              }}
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
          backgroundColor: t.modeToggleBg,
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
                color: isActiveMode ? t.accentText : t.textSecondary,
                backgroundColor: isActiveMode ? t.accentBg : t.modeButtonInactiveBg,
                border: `1px solid ${isActiveMode ? t.accentBorder : t.modeButtonInactiveBorder}`,
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
                  color: t.accentText,
                  fontWeight: 700,
                }}>
                  {queue.length}
                </span>
              )}
              {candidateMode === 'inspect' && hasInspectContent && !isActiveMode && (
                <span style={{
                  marginLeft: 4,
                  fontSize: 10,
                  color: t.accentText,
                  fontWeight: 700,
                }}>
                  {inspectStack.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {shouldShowReview && review && (
        <ReviewDrawer
          review={review}
          onClose={onCloseReview}
          onMarkInstructionLooksGood={onMarkInstructionLooksGood}
          onRequestInstructionFollowUp={onRequestInstructionFollowUp}
          onOpenLearningDraft={onOpenLearningDraft}
          onCancelLearningDraft={onCancelLearningDraft}
          onUpdateLearningDraft={onUpdateLearningDraft}
          onSaveLearningDraft={onSaveLearningDraft}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Body: Queue or Inspect content                                    */}
      {/* ----------------------------------------------------------------- */}
      {!isCollapsed && (
        <div
          ref={bodyRef}
          style={{
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'scroll',
            overflowX: 'hidden',
            marginRight: -20,
            paddingRight: 20,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: t.panelBg,
            borderTop: `1px solid ${t.borderSubtle}`,
          }}
        >
          {/* Error banner */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
                fontSize: 12,
                lineHeight: 1.5,
                color: t.errorText,
                backgroundColor: t.errorBg,
                borderBottom: `1px solid ${t.errorBorder}`,
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
                  borderBottom: `1px solid ${t.borderSubtle}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary }}>
                  {queue.length} instruction{queue.length === 1 ? '' : 's'}
                </span>
                <button onClick={onClearQueue} style={{
                  padding: '5px 8px',
                  fontSize: 11,
                  color: t.inputText,
                  backgroundColor: t.panelSurface,
                  border: `1px solid ${t.borderSubtle}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
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
                    onMoveUp={() => onReorderInstruction(index, index - 1)}
                    onMoveDown={() => onReorderInstruction(index, index + 1)}
                  />
                ))}
              </div>

              {/* Submit footer */}
              <div
                style={{
                  borderTop: `1px solid ${t.borderSubtle}`,
                  padding: 12,
                  backgroundColor: t.panelDeep,
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
                  borderBottom: `1px solid ${t.borderSubtle}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary }}>
                  {inspectStack.length} element{inspectStack.length === 1 ? '' : 's'} inspected
                </span>
                <button onClick={onClearInspectStack} style={{
                  padding: '5px 8px',
                  fontSize: 11,
                  color: t.inputText,
                  backgroundColor: t.panelSurface,
                  border: `1px solid ${t.borderSubtle}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                  Clear All
                </button>
              </div>

              {/* Scrollable inspect cards, ordered by selection */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                {inspectStack.map((target, index) => (
                  <div
                    key={`${target.selector}-${index}`}
                    style={{
                      border: `1px solid ${t.borderSubtle}`,
                      borderRadius: 10,
                      backgroundColor: t.panelSurface,
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {/* Numbered card header with remove button */}
                    <div
                      style={{
                        padding: '6px 10px',
                        borderBottom: `1px solid ${t.borderSubtle}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: t.panelDeep,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        {/* Selection order number */}
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          backgroundColor: t.accentBg,
                          border: `1px solid ${t.accentBorder}`,
                          fontSize: 10,
                          fontWeight: 700,
                          color: t.accentText,
                          flexShrink: 0,
                        }}>
                          {index + 1}
                        </span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: t.textPrimary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {target.label}
                        </span>
                      </div>
                      <button
                        onClick={() => onRemoveFromInspectStack(index)}
                        style={{
                          padding: '2px 6px',
                          fontSize: 10,
                          color: t.textMuted,
                          backgroundColor: 'transparent',
                          border: `1px solid ${t.borderSubtle}`,
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          flexShrink: 0,
                        }}
                        title={`Remove element #${index + 1}`}
                      >
                        x
                      </button>
                    </div>

                    {/* Inspect content – constrained height with internal scroll */}
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      <InspectContent
                        target={target}
                        serverUrl={serverUrl}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ---- Empty body: no content to show ---- */}
          {!hasQueueContent && !hasInspectContent && (
            <div style={{ padding: 14, fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
              {isActive
                ? mode === 'instruct'
                  ? review?.isOpen
                    ? 'Review the latest pass or click Instruct to start another pass.'
                    : 'Click elements to add instructions.'
                  : 'Click an element to see its history.'
                : 'Select a mode to begin.'}
            </div>
          )}
        </div>
      )}

    </div>
    {/* End inner clip wrapper */}

    {/* Bottom-left resize handle (perforation grip) */}
    {!isCollapsed && (
      <div
        data-contextual="resize-handle"
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: 24,
          height: 24,
          cursor: 'nesw-resize',
          zIndex: 10,
          borderBottomLeftRadius: 4,
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          resizeStartX.current = e.clientX;
          resizeStartWidth.current = panelWidth;
          resizeStartPosX.current = position.x;
          setIsResizing(true);
        }}
      >
        {/* Perforation dots in a triangular arrangement */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          style={{
            position: 'absolute',
            left: 3,
            bottom: 3,
          }}
        >
          {/* Row 1 (bottom): 3 dots */}
          <circle cx="2"  cy="16" r="1.5" fill={isDark ? '#a3e635' : '#65a30d'} opacity="0.8" />
          <circle cx="8"  cy="16" r="1.5" fill={isDark ? '#a3e635' : '#65a30d'} opacity="0.7" />
          <circle cx="14" cy="16" r="1.5" fill={isDark ? '#a3e635' : '#65a30d'} opacity="0.6" />
          {/* Row 2: 2 dots */}
          <circle cx="2"  cy="10" r="1.5" fill={isDark ? '#a3e635' : '#65a30d'} opacity="0.7" />
          <circle cx="8"  cy="10" r="1.5" fill={isDark ? '#a3e635' : '#65a30d'} opacity="0.6" />
          {/* Row 3 (top): 1 dot */}
          <circle cx="2"  cy="4" r="1.5" fill={isDark ? '#a3e635' : '#65a30d'} opacity="0.6" />
        </svg>
      </div>
    )}

    {/* External scrollbar track (to the RIGHT of the panel) */}
    {canScroll && !isCollapsed && (() => {
      const trackHeight = bodyRef.current?.clientHeight ?? 0;
      const thumbHeight = Math.max(24, trackHeight * thumbRatio);
      const scrollableRange = scrollInfo.scrollHeight - scrollInfo.clientHeight;
      const scrollFraction = scrollableRange > 0 ? scrollInfo.scrollTop / scrollableRange : 0;
      const thumbTop = scrollFraction * (trackHeight - thumbHeight);

      return (
        <div
          ref={trackRef}
          data-contextual="scrollbar-track"
          style={{
            position: 'absolute',
            right: -14,
            top: 0,
            bottom: 0,
            width: 6,
            borderRadius: 3,
            backgroundColor: 'transparent',
            cursor: 'pointer',
            zIndex: 1,
          }}
          onMouseDown={(e) => {
            // Click-to-jump: scroll to the clicked position on the track
            const body = bodyRef.current;
            const track = trackRef.current;
            if (!body || !track) return;

            const trackRect = track.getBoundingClientRect();
            const clickY = e.clientY - trackRect.top;
            const trackH = trackRect.height;
            const ratio = clickY / trackH;
            body.scrollTop = ratio * (body.scrollHeight - body.clientHeight);
          }}
        >
          {/* Thumb */}
          <div
            style={{
              position: 'absolute',
              top: thumbTop,
              left: 0,
              width: 6,
              height: thumbHeight,
              borderRadius: 3,
              backgroundColor: isDark ? 'rgba(163, 230, 53, 0.5)' : 'rgba(101, 163, 13, 0.5)',
              transition: isScrollDragging ? 'none' : 'top 0.08s ease-out',
              cursor: 'grab',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              scrollDragStartY.current = e.clientY;
              const track = trackRef.current;
              const body = bodyRef.current;
              if (track && body) {
                const trackRect = track.getBoundingClientRect();
                const trackH = trackRect.height;
                const tHeight = Math.max(24, trackH * (body.clientHeight / body.scrollHeight));
                const scrollable = body.scrollHeight - body.clientHeight;
                const fraction = scrollable > 0 ? body.scrollTop / scrollable : 0;
                scrollDragStartTop.current = fraction * (trackH - tHeight);
              }
              setIsScrollDragging(true);
            }}
          />
        </div>
      );
    })()}

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
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function QueueItem({
  instruction,
  index,
  total,
  onEdit,
  onMoveUp,
  onMoveDown,
}: QueueItemProps) {
  const t = useTheme();
  const plainText = stripMentions(instruction.rawText);
  const summary = plainText
    ? plainText.split('\n')[0]!.trim()
    : instruction.actions.length > 0
      ? `Action-only (${instruction.actions.length})`
      : 'Untitled';

  return (
    <section
      style={{
        border: `1px solid ${t.borderSubtle}`,
        borderRadius: 10,
        backgroundColor: t.panelSurface,
        padding: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 4 }}>
            {index + 1}. {instruction.element.label}
          </div>
          <div
            style={{
              fontSize: 12,
              color: t.inputText,
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
            style={{
              width: 24,
              height: 24,
              padding: 0,
              fontSize: 11,
              color: index === 0 ? t.textMuted : t.inputText,
              backgroundColor: t.panelBg,
              border: `1px solid ${t.border}`,
              borderRadius: 6,
              cursor: index === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            &uarr;
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            style={{
              width: 24,
              height: 24,
              padding: 0,
              fontSize: 11,
              color: index === total - 1 ? t.textMuted : t.inputText,
              backgroundColor: t.panelBg,
              border: `1px solid ${t.border}`,
              borderRadius: 6,
              cursor: index === total - 1 ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            &darr;
          </button>
        </div>
      </div>

      {/* Actions count + edit */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: t.textMuted }}>
          {instruction.actions.length} action{instruction.actions.length === 1 ? '' : 's'}
        </span>
        <button onClick={onEdit} style={{
          padding: '5px 8px',
          fontSize: 11,
          color: t.inputText,
          backgroundColor: t.panelSurface,
          border: `1px solid ${t.borderSubtle}`,
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>Edit</button>
      </div>
    </section>
  );
}
