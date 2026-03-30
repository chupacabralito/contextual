// =============================================================================
// Inspect Content
// =============================================================================
// Shows persisted pass history for a targeted element, including the context
// lineage: which @tool[query] actions were referenced, and any pre-attached
// context snippets that informed the design decisions.
//
// Rendered inside the SidePanel body (no outer positioning chrome).
// =============================================================================

import React, { useEffect, useState } from 'react';
import type { InspectResponse, TargetedElement } from '@contextual/shared';
import { stripMentions } from '../mentions/parser.js';

interface InspectContentProps {
  target: TargetedElement;
  serverUrl: string;
  onClose: () => void;
}

/**
 * Decision trail content for the SidePanel body.
 * Fetches and displays pass history + context lineage for the targeted element.
 */
export function InspectContent({ target, serverUrl, onClose }: InspectContentProps) {
  const [data, setData] = useState<InspectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInspectData() {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams({ selector: target.selector });
        const response = await fetch(`${serverUrl}/inspect?${query.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const payload = (await response.json()) as InspectResponse;
        setData(payload);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        const message =
          err instanceof Error ? err.message : 'Failed to load decision trail';
        setError(`Could not load inspect history. (${message})`);
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    void loadInspectData();

    return () => controller.abort();
  }, [serverUrl, target.selector]);

  const hasHistory = Boolean(
    data && (data.passes.length > 0 || data.contextHistory.length > 0)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Header: element label + close */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
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
            Decision Trail
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginTop: 3 }}>
            {target.label}
          </div>
        </div>

        <button onClick={onClose} style={closeButtonStyle}>
          Back
        </button>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'grid', gap: 12 }}>
        {loading && (
          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
            Loading decision trail...
          </div>
        )}

        {!loading && error && (
          <div style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.6 }}>{error}</div>
        )}

        {!loading && !error && !hasHistory && (
          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
            No history for this element yet.
          </div>
        )}

        {/* Passes with full context lineage */}
        {!loading && !error && data?.passes.length ? (
          <section>
            <div style={sectionTitleStyle}>Passes</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {data.passes.map((passRef) => {
                const summary =
                  stripMentions(passRef.instruction.rawText) || 'Action-only instruction';

                return (
                  <article
                    key={`${passRef.passId}-${passRef.timestamp}`}
                    style={{
                      border: '1px solid rgba(148, 163, 184, 0.14)',
                      borderRadius: 10,
                      backgroundColor: '#0f172a',
                      padding: 10,
                    }}
                  >
                    <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>
                      {new Date(passRef.timestamp).toLocaleString()}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#f8fafc',
                        lineHeight: 1.5,
                      }}
                    >
                      {summary}
                    </div>

                    {/* Action references */}
                    {passRef.instruction.actions.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>
                          Actions
                        </div>
                        {passRef.instruction.actions.map((action, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              marginRight: 4,
                              marginBottom: 3,
                              fontSize: 10,
                              color: '#93c5fd',
                              backgroundColor: 'rgba(59, 130, 246, 0.12)',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                              borderRadius: 4,
                              fontFamily: '"SF Mono", Menlo, monospace',
                            }}
                          >
                            @{action.source}[{action.instruction}]
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pre-attached context */}
                    {passRef.instruction.preAttachedContext.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>
                          Context Used
                        </div>
                        {passRef.instruction.preAttachedContext.map((snippet, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '5px 7px',
                              marginBottom: 3,
                              backgroundColor: 'rgba(34, 197, 94, 0.06)',
                              border: '1px solid rgba(34, 197, 94, 0.15)',
                              borderRadius: 6,
                            }}
                          >
                            <div style={{ fontSize: 10, color: '#86efac', marginBottom: 2 }}>
                              /{snippet.type} - {snippet.query}
                            </div>
                            <div style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 1.5 }}>
                              {snippet.content}
                            </div>
                            <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>
                              {snippet.source}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Standalone context history */}
        {!loading && !error && data?.contextHistory.length ? (
          <section>
            <div style={sectionTitleStyle}>Context History</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {data.contextHistory.map((snippet, index) => (
                <article
                  key={`${snippet.source}-${index}`}
                  style={{
                    border: '1px solid rgba(148, 163, 184, 0.14)',
                    borderRadius: 10,
                    backgroundColor: '#0f172a',
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 10, color: '#86efac', marginBottom: 4 }}>
                    /{snippet.type} - {snippet.query}
                  </div>
                  <div style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 1.6 }}>
                    {snippet.content}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
                    {snippet.source}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

const closeButtonStyle: React.CSSProperties = {
  padding: '5px 8px',
  fontSize: 11,
  color: '#cbd5e1',
  backgroundColor: 'rgba(30, 41, 59, 0.85)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 8,
};
