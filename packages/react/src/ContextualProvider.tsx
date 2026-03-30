// =============================================================================
// Contextual Provider
// =============================================================================
// Top-level component that wraps the user's app. Renders the toolbar,
// element highlights, annotation input, and context preview.
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
import { ContextPreview } from './components/ContextPreview.js';

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
        (contextual.state === 'annotating' || contextual.state === 'previewing') && (
          <ElementHighlight
            boundingBox={contextual.targetedElement.boundingBox}
            variant="selected"
          />
        )}

      {/* Annotation input */}
      {contextual.state === 'annotating' && contextual.targetedElement && (
        <AnnotationInput
          position={{
            x: contextual.targetedElement.boundingBox.x,
            y:
              contextual.targetedElement.boundingBox.y +
              contextual.targetedElement.boundingBox.height,
          }}
          onSubmit={contextual.resolveAndPreview}
          onCancel={contextual.cancel}
          depth={contextual.depth}
          onDepthChange={contextual.setDepth}
          initialText={contextual.lastAnnotationText}
        />
      )}

      {/* Context preview */}
      {contextual.state === 'previewing' && contextual.currentAnnotation && (
        <ContextPreview
          annotation={contextual.currentAnnotation}
          resolvedContext={contextual.resolvedContext}
          depth={contextual.depth}
          isResolving={contextual.isResolving}
          onSubmit={contextual.submitPass}
          onBack={contextual.backToAnnotating}
          error={contextual.error}
        />
      )}

      {/* Toolbar */}
      <Toolbar
        state={contextual.state}
        onStartTargeting={contextual.startTargeting}
        onCancel={contextual.cancel}
      />
    </>
  );
}
