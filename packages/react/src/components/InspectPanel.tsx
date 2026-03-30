// =============================================================================
// Inspect Panel
// =============================================================================
// Shows persisted pass history for a targeted element.
// =============================================================================

import React, { useEffect, useState } from 'react';
import type { InspectResponse, TargetedElement } from '@contextual/shared';
import { stripMentions } from '../mentions/parser.js';

interface InspectPanelProps {
  target: TargetedElement;
  serverUrl: string;
  onClose: () => void;
}

export function InspectPanel({ target, serverUrl, onClose }: InspectPanelProps) {
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

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(target.boundingBox.x, window.innerWidth - 420),
    top: Math.min(
      target.boundingBox.y + target.boundingBox.height + 8,
      window.innerHeight - 420
    ),
    zIndex: 2147483646,
  };

  const hasHistory = Boolean(
    data && (data.passes.length > 0 || data.contextHistory.length > 0)
  );

  return (
    <div data-contextual="inspect-panel" style={style}>
      <div
        style={{
          width: 400,
          maxHeight: 400,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#111827',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: 14,
          boxShadow: '0 18px 48px rgba(15, 23, 42, 0.45)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
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
              Inspect
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>
              {target.label}
            </div>
          </div>

          <button onClick={onClose} style={closeButtonStyle}>
            Close
          </button>
        </div>

        <div style={{ padding: 14, overflowY: 'auto', display: 'grid', gap: 14 }}>
          {loading && (
            <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
              Loading decision trail...
            </div>
          )}

          {!loading && error && (
            <div style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.6 }}>{error}</div>
          )}

          {!loading && !error && !hasHistory && (
            <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
              No history for this element yet.
            </div>
          )}

          {!loading && !error && data?.passes.length ? (
            <section>
              <div style={sectionTitleStyle}>Passes</div>
              <div style={{ display: 'grid', gap: 10 }}>
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
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                        {new Date(passRef.timestamp).toLocaleString()}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#f8fafc',
                          lineHeight: 1.5,
                        }}
                      >
                        {summary}
                      </div>
                      {passRef.instruction.actions.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
                          {passRef.instruction.actions
                            .map((action) => `@${action.source}[${action.instruction}]`)
                            .join(', ')}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {!loading && !error && data?.contextHistory.length ? (
            <section>
              <div style={sectionTitleStyle}>Context History</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {data.contextHistory.map((snippet, index) => (
                  <article
                    key={`${snippet.source}-${index}`}
                    style={{
                      border: '1px solid rgba(148, 163, 184, 0.14)',
                      borderRadius: 10,
                      backgroundColor: '#0f172a',
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                      @{snippet.type}[{snippet.query}]
                    </div>
                    <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.6 }}>
                      {snippet.content}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                      {snippet.source}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const closeButtonStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 11,
  color: '#cbd5e1',
  backgroundColor: 'rgba(30, 41, 59, 0.85)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 10,
};
