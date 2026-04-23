// =============================================================================
// Contextual Provider
// =============================================================================
// Top-level component that wraps the user's app. Renders the unified side panel,
// element highlights, and annotation input (near the targeted element).
//
// Usage:
//   import { ContextualProvider } from '@contextualapp/react';
//   <ContextualProvider>
//     <App />
//   </ContextualProvider>
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useContextual } from './hooks/useContextual.js';
import { useElementTargeting } from './hooks/useElementTargeting.js';
import { SidePanel } from './components/SidePanel.js';
import { ElementHighlight } from './components/ElementHighlight.js';
import { AnnotationInput } from './components/AnnotationInput.js';
import { ThemeContext, ThemeToggleContext, darkTheme, lightTheme } from './theme.js';
import type { ContextualTheme, ThemeToggle } from './theme.js';
import type { ContextType } from '@contextualapp/shared';

interface ContextualProviderProps {
  children: React.ReactNode;
  /** URL of the local context server (default: http://localhost:4700) */
  serverUrl?: string;
  /** @deprecated No longer used. */
  defaultDepth?: string;
  /** Keyboard shortcut to toggle annotation mode (default: Cmd+Shift+A / Ctrl+Shift+A) */
  hotkey?: { key: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean };
  /** Theme: 'light', 'dark', or 'auto' (matches OS preference). Default: 'auto'. */
  theme?: 'light' | 'dark' | 'auto';
  /** Optional project identifier stamped onto submitted passes/outcomes */
  project?: string;
  /** Optional context types known to be active for the current page/session */
  affectedContextTypes?: ContextType[];
  /** Optional corpus paths loaded for the current page/session */
  loadedContextPaths?: string[];
}

const DEFAULT_HOTKEY = { key: 'a', shiftKey: true }; // + meta/ctrl detected at runtime

export function ContextualProvider({
  children,
  serverUrl,
  hotkey = DEFAULT_HOTKEY,
  theme: themeProp = 'auto',
  project,
  affectedContextTypes,
  loadedContextPaths,
}: ContextualProviderProps) {
  // -------------------------------------------------------------------------
  // SSR safety: defer all overlay rendering until after client mount so that
  // server-rendered HTML matches the initial client render (just {children}).
  // This prevents React hydration mismatches in Next.js and other SSR setups.
  // -------------------------------------------------------------------------
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const contextual = useContextual({
    serverUrl,
    project,
    affectedContextTypes,
    loadedContextPaths,
  });
  const resolvedServerUrl = serverUrl ?? 'http://localhost:4700';

  // -------------------------------------------------------------------------
  // Theme: OS detection + user override toggle
  // -------------------------------------------------------------------------
  const [osDark, setOsDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  );

  // User override: null means follow OS / prop, 'light' or 'dark' means manual
  const [userOverride, setUserOverride] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    if (themeProp !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setOsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themeProp]);

  const resolvedTheme: ContextualTheme = useMemo(() => {
    // User override takes precedence
    if (userOverride === 'light') return lightTheme;
    if (userOverride === 'dark') return darkTheme;
    // Then the prop
    if (themeProp === 'light') return lightTheme;
    if (themeProp === 'dark') return darkTheme;
    // Then OS preference
    return osDark ? darkTheme : lightTheme;
  }, [themeProp, osDark, userOverride]);

  const isDark = resolvedTheme === darkTheme;

  const themeToggle = useMemo(() => ({
    isDark,
    toggle: () => setUserOverride(isDark ? 'light' : 'dark'),
  }), [isDark]);

  const { hoveredElement } = useElementTargeting({
    enabled: contextual.state === 'targeting',
    onTarget: contextual.setTargetedElement,
  });

  // Global keyboard shortcut to toggle annotation mode (Cmd+Shift+A)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const modifierMatch =
        (hotkey.metaKey ? e.metaKey : true) &&
        (hotkey.ctrlKey ? e.ctrlKey : true) &&
        (hotkey.shiftKey ? e.shiftKey : true);

      // Default behavior: Cmd+Shift+A on Mac, Ctrl+Shift+A elsewhere
      const defaultModifier = e.shiftKey && (e.metaKey || e.ctrlKey);
      const useDefaultModifier = !hotkey.metaKey && !hotkey.ctrlKey;
      const finalModifier = useDefaultModifier ? defaultModifier : modifierMatch;

      if (e.key.toLowerCase() === hotkey.key.toLowerCase() && finalModifier) {
        e.preventDefault();
        if (contextual.state === 'idle') {
          contextual.startTargeting();
        } else {
          contextual.cancel();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [contextual.state, contextual.startTargeting, contextual.cancel, hotkey]);

  // Global Esc key to exit any active state
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Don't intercept if we're in the annotation input (it has its own Esc)
      if (contextual.state === 'annotating') return;
      if (contextual.state === 'idle') return;

      e.preventDefault();
      contextual.cancel();
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [contextual.state, contextual.cancel]);

  // ---------------------------------------------------------------------------
  // SSR: render only children until the client has mounted. This ensures the
  // server HTML and the first client render are identical, avoiding hydration
  // mismatches. Overlays, side panel, and event listeners attach after mount.
  // ---------------------------------------------------------------------------
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={resolvedTheme}>
    <ThemeToggleContext.Provider value={themeToggle}>
      {children}

      {/* Hover highlight during targeting */}
      {contextual.state === 'targeting' && hoveredElement && (
        <ElementHighlight
          boundingBox={{
            x: Math.round(hoveredElement.getBoundingClientRect().x),
            y: Math.round(hoveredElement.getBoundingClientRect().y),
            width: Math.round(hoveredElement.getBoundingClientRect().width),
            height: Math.round(hoveredElement.getBoundingClientRect().height),
          }}
          variant="hover"
          element={hoveredElement}
        />
      )}

      {/* Selected element highlight (instruct mode annotation) */}
      {contextual.targetedElement &&
        contextual.state === 'annotating' && (
          <ElementHighlight
            boundingBox={contextual.targetedElement.boundingBox}
            variant="selected"
            element={document.querySelector<HTMLElement>(contextual.targetedElement.selector)}
          />
        )}

      {/* Inspect stack highlights (numbered badges match toolbar card order) */}
      {contextual.inspectStack.map((el, index) => (
        <ElementHighlight
          key={`inspect-${el.selector}-${index}`}
          boundingBox={el.boundingBox}
          variant="selected"
          element={document.querySelector<HTMLElement>(el.selector)}
          badge={index + 1}
        />
      ))}

      {/* Annotation input (positioned near the targeted element) */}
      {contextual.state === 'annotating' &&
        contextual.mode === 'instruct' &&
        contextual.targetedElement && (
        <AnnotationInput
          position={{
            x: contextual.targetedElement.boundingBox.x,
            y:
              contextual.targetedElement.boundingBox.y +
              contextual.targetedElement.boundingBox.height,
          }}
          serverUrl={resolvedServerUrl}
          onSubmit={contextual.queueInstruction}
          onCancel={contextual.cancel}
          initialText={contextual.lastAnnotationText}
        />
      )}

      {/* Unified side panel: mode toggle + queue + inspect */}
      <SidePanel
        state={contextual.state}
        mode={contextual.mode}
        onModeChange={contextual.setMode}
        onCancel={contextual.cancel}
        queue={contextual.queue}
        onEditInstruction={contextual.editQueueItem}
        onRemoveInstruction={contextual.removeFromQueue}
        onReorderInstruction={contextual.reorderQueue}
        onClearQueue={contextual.clearQueue}
        onSubmitPass={contextual.submitPass}
        error={contextual.error}
        review={contextual.review}
        onCloseReview={contextual.closeReview}
        onMarkInstructionLooksGood={contextual.markInstructionLooksGood}
        onRequestInstructionFollowUp={contextual.requestInstructionFollowUp}
        onOpenLearningDraft={contextual.openLearningDraft}
        onCancelLearningDraft={contextual.cancelLearningDraft}
        onUpdateLearningDraft={contextual.updateLearningDraft}
        onSaveLearningDraft={contextual.saveLearningDraft}
        inspectStack={contextual.inspectStack}
        onRemoveFromInspectStack={contextual.removeFromInspectStack}
        onClearInspectStack={contextual.clearInspectStack}
        serverUrl={resolvedServerUrl}
      />
    </ThemeToggleContext.Provider>
    </ThemeContext.Provider>
  );
}
