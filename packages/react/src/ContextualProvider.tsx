// =============================================================================
// Contextual Provider
// =============================================================================
// Top-level component that wraps the user's app. Renders the toolbar,
// element highlights, annotation input, queue panel, and inspect panel.
//
// Usage:
//   import { ContextualProvider } from '@contextual/react';
//   <ContextualProvider>
//     <App />
//   </ContextualProvider>
// =============================================================================

import React, { useEffect } from 'react';
import type { ResolutionDepth } from '@contextual/shared';
import { useContextual } from './hooks/useContextual.js';
import { useElementTargeting } from './hooks/useElementTargeting.js';
import { Toolbar } from './components/Toolbar.js';
import { ElementHighlight } from './components/ElementHighlight.js';
import { AnnotationInput } from './components/AnnotationInput.js';
import { QueuePanel } from './components/QueuePanel.js';
import { InspectPanel } from './components/InspectPanel.js';

interface ContextualProviderProps {
  children: React.ReactNode;
  /** URL of the local context server (default: http://localhost:4700) */
  serverUrl?: string;
  /** Default resolution depth (default: 'standard') */
  defaultDepth?: ResolutionDepth;
  /** Keyboard shortcut to toggle annotation mode (default: Cmd+Shift+A / Ctrl+Shift+A) */
  hotkey?: { key: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean };
}

const DEFAULT_HOTKEY = { key: 'a', shiftKey: true }; // + meta/ctrl detected at runtime

export function ContextualProvider({
  children,
  serverUrl,
  defaultDepth,
  hotkey = DEFAULT_HOTKEY,
}: ContextualProviderProps) {
  const contextual = useContextual({ serverUrl, defaultDepth });

  const { hoveredElement } = useElementTargeting({
    enabled: contextual.state === 'targeting',
    onTarget: contextual.setTargetedElement,
  });

  // Global keyboard shortcut to toggle annotation mode
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

      {/* Selected element highlight */}
      {contextual.targetedElement &&
        (contextual.state === 'annotating' || contextual.state === 'inspecting') && (
          <ElementHighlight
            boundingBox={contextual.targetedElement.boundingBox}
            variant="selected"
          />
        )}

      {/* Annotation input */}
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
          serverUrl={serverUrl ?? 'http://localhost:4700'}
          onSubmit={contextual.resolveAndPreview}
          onCancel={contextual.cancel}
          depth={contextual.depth}
          onDepthChange={contextual.setDepth}
          initialText={contextual.lastAnnotationText}
        />
      )}

      {/* Queue panel */}
      {contextual.queueLength > 0 && (
        <QueuePanel
          queue={contextual.queue}
          depth={contextual.depth}
          onDepthChange={contextual.setDepth}
          onEditInstruction={contextual.editQueueItem}
          onRemoveInstruction={contextual.removeFromQueue}
          onReorderInstruction={contextual.reorderQueue}
          onClearQueue={contextual.clearQueue}
          onSubmitPass={contextual.submitPass}
          error={contextual.error}
        />
      )}

      {/* Inspect panel */}
      {contextual.state === 'inspecting' && contextual.targetedElement && (
        <InspectPanel
          target={contextual.targetedElement}
          serverUrl={serverUrl ?? 'http://localhost:4700'}
          onClose={contextual.cancel}
        />
      )}

      {/* Toolbar */}
      <Toolbar
        state={contextual.state}
        mode={contextual.mode}
        onModeChange={contextual.setMode}
        onStartTargeting={contextual.startTargeting}
        onCancel={contextual.cancel}
        queueLength={contextual.queueLength}
      />
    </>
  );
}
