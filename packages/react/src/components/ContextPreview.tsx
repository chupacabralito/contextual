// =============================================================================
// Context Preview Panel
// =============================================================================
// Shows pre-searched local context before the pass is submitted to the agent.
// Lets the designer see what local context will be pre-attached to the
// structured prompt, and what external actions will be passed as instructions.
// =============================================================================

import React from 'react';
import type { MentionResult, ResolutionDepth } from '@contextual/shared';
import { formatOutput } from '../output/formatter.js';
import type { Annotation, StructuredOutput } from '@contextual/shared';

interface ContextPreviewProps {
  /** The current annotation */
  annotation: Annotation;
  /** Pre-searched local context results */
  resolvedContext: MentionResult[];
  /** Current depth */
  depth: ResolutionDepth;
  /** Whether we're still pre-searching */
  isResolving: boolean;
  /** Submit the structured pass to agent */
  onSubmit: () => void;
  /** Go back to edit the annotation (preserves element + text) */
  onBack: () => void;
  /** Error message */
  error: string | null;
}

export function ContextPreview({
  annotation,
  resolvedContext,
  depth,
  isResolving,
  onSubmit,
  onBack,
  error,
}: ContextPreviewProps) {
  // Generate the formatted output for preview
  const output: StructuredOutput = {
    annotation,
    resolvedContext,
    depth,
  };
  const markdown = formatOutput(output);

  // Position near the annotation element
  const { boundingBox } = annotation.element;
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(boundingBox.x, window.innerWidth - 470),
    top: Math.min(boundingBox.y + boundingBox.height + 8, window.innerHeight - 400),
    zIndex: 2147483646,
  };

  return (
    <div data-contextual="preview" style={style}>
      <div
        style={{
          width: 450,
          maxHeight: 380,
          backgroundColor: '#1a1a2e',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: '#c0c0d8' }}>
            Pass Preview
          </span>
          <span style={{ fontSize: 11, color: '#808098' }}>
            {resolvedContext.length} local context{resolvedContext.length !== 1 ? 's' : ''}{' '}
            pre-attached ({depth})
          </span>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: 11,
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}

        {/* Loading state */}
        {isResolving && (
          <div
            style={{
              padding: '20px 12px',
              textAlign: 'center',
              fontSize: 12,
              color: '#808098',
            }}
          >
            Pre-searching local context...
          </div>
        )}

        {/* Markdown preview */}
        {!isResolving && (
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 12,
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: 11,
                lineHeight: 1.6,
                color: '#c0c0d8',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily:
                  '"SF Mono", "Fira Code", "Fira Mono", Menlo, monospace',
              }}
            >
              {markdown}
            </pre>
          </div>
        )}

        {/* Footer: actions */}
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid rgba(99, 102, 241, 0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            onClick={onBack}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              color: '#808098',
              backgroundColor: 'transparent',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Edit
          </button>

          <button
            onClick={onSubmit}
            disabled={isResolving}
            style={{
              padding: '5px 16px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              backgroundColor: 'rgba(99, 102, 241, 0.8)',
              border: 'none',
              borderRadius: 4,
              cursor: isResolving ? 'wait' : 'pointer',
              opacity: isResolving ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            Submit Pass
          </button>
        </div>
      </div>
    </div>
  );
}
