// =============================================================================
// Contextual Provider
// =============================================================================
// Top-level component that wraps the user's app. Renders the unified side panel,
// element highlights, and annotation input (near the targeted element).
//
// Usage:
//   import { ContextualProvider } from '@contextual/react';
//   <ContextualProvider>
//     <App />
//   </ContextualProvider>
// =============================================================================

import React, { useEffect } from 'react';
import { useContextual } from './hooks/useContextual.js';
import { useElementTargeting } from './hooks/useElementTargeting.js';
import { SidePanel } from './components/SidePanel.js';
import { ElementHighlight } from './components/ElementHighlight.js';
import { AnnotationInput } from './components/AnnotationInput.js';

interface ContextualProviderProps {
  children: React.ReactNode;
  /** URL of the local context server (default: http://localhost:4700) */
  serverUrl?: string;
  /** @deprecated No longer used. */
  defaultDepth?: string;
  /** Keyboard shortcut to toggle annotation mode (default: Cmd+Shift+A / Ctrl+Shift+A) */
  hotkey?: { key: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean };
}

const DEFAULT_HOTKEY = { key: 'a', shiftKey: true }; // + meta/ctrl detected at runtime

export function ContextualProvider({
  children,
  serverUrl,
  hotkey = DEFAULT_HOTKEY,
}: ContextualProviderProps) {
  const contextual = useContextual({ serverUrl });
  const resolvedServerUrl = serverUrl ?? 'http://localhost:4700';

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

  return (
    <>
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
        />
      )}

      {/* Selected element highlight (instruct mode annotation) */}
      {contextual.targetedElement &&
        contextual.state === 'annotating' && (
          <ElementHighlight
            boundingBox={contextual.targetedElement.boundingBox}
            variant="selected"
          />
        )}

      {/* Inspect stack highlights */}
      {contextual.inspectStack.map((el, index) => (
        <ElementHighlight
          key={`inspect-${el.selector}-${index}`}
          boundingBox={el.boundingBox}
          variant="selected"
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
        inspectStack={contextual.inspectStack}
        onRemoveFromInspectStack={contextual.removeFromInspectStack}
        onClearInspectStack={contextual.clearInspectStack}
        serverUrl={resolvedServerUrl}
      />
    </>
  );
}
