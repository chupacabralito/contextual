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
import type { InspectResponse, TargetedElement } from '@contextualapp/shared';
import { stripMentions } from '../mentions/parser.js';
import { useTheme } from '../theme.js';

interface InspectContentProps {
  target: TargetedElement;
  serverUrl: string;
}

/**
 * Decision trail content for the SidePanel body.
 * Fetches and displays pass history + context lineage for the targeted element.
 */
export function InspectContent({ target, serverUrl }: InspectContentProps) {
  const t = useTheme();
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
        if (target.ancestorSelectors?.length) {
          query.set('ancestors', target.ancestorSelectors.join(','));
        }
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
  }, [serverUrl, target.selector, target.ancestorSelectors]);

  const hasHistory = Boolean(
    data && (data.passes.length > 0 || (data.inheritedPasses?.length ?? 0) > 0 || data.contextHistory.length > 0)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Content area */}
      <div style={{ padding: 12, display: 'grid', gap: 12 }}>
        {loading && (
          <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
            Loading decision trail...
          </div>
        )}

        {!loading && error && (
          <div style={{ fontSize: 12, color: t.errorText, lineHeight: 1.6 }}>{error}</div>
        )}

        {!loading && !error && !hasHistory && (
          <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
            No history for this element yet.
          </div>
        )}

        {/* Passes with full context lineage */}
        {!loading && !error && data?.passes.length ? (
          <section>
            <div style={sectionTitleStyle(t.textSecondary)}>Passes</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {data.passes.map((passRef) => {
                const summary =
                  stripMentions(passRef.instruction.rawText) || 'Action-only instruction';

                return (
                  <article
                    key={`${passRef.passId}-${passRef.timestamp}`}
                    style={{
                      border: `1px solid ${t.borderSubtle}`,
                      borderRadius: 10,
                      backgroundColor: t.panelSurface,
                      padding: 10,
                    }}
                  >
                    <div style={{ fontSize: 10, color: t.textSecondary, marginBottom: 4 }}>
                      {new Date(passRef.timestamp).toLocaleString()}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: t.textPrimary,
                        lineHeight: 1.5,
                      }}
                    >
                      {summary}
                    </div>

                    {/* Action references */}
                    {passRef.instruction.actions.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3 }}>
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
                              color: t.accentText,
                              backgroundColor: t.accentBg,
                              border: `1px solid ${t.accentBorder}`,
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
                        <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3 }}>
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
                            <div style={{ fontSize: 10, color: t.successText, marginBottom: 2 }}>
                              /{snippet.type} - {snippet.query}
                            </div>
                            <div style={{ fontSize: 11, color: t.inputText, lineHeight: 1.5 }}>
                              {snippet.content}
                            </div>
                            <div style={{ fontSize: 9, color: t.textMuted, marginTop: 3 }}>
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

        {/* Inherited passes from ancestor elements */}
        {!loading && !error && data?.inheritedPasses?.length ? (
          <section>
            <div style={sectionTitleStyle(t.textSecondary)}>Inherited</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {data.inheritedPasses.map((passRef) => {
                const summary =
                  stripMentions(passRef.instruction.rawText) || 'Action-only instruction';
                const ancestorLabel = passRef.inheritedFrom ?? 'ancestor';

                return (
                  <article
                    key={`inherited-${passRef.passId}-${passRef.timestamp}`}
                    style={{
                      border: `1px solid ${t.borderSubtle}`,
                      borderRadius: 10,
                      backgroundColor: t.panelSurface,
                      padding: 10,
                      opacity: 0.85,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 4,
                      }}
                    >
                      <div style={{ fontSize: 10, color: t.textSecondary }}>
                        {new Date(passRef.timestamp).toLocaleString()}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: t.textMuted,
                          padding: '1px 5px',
                          backgroundColor: 'rgba(128,128,128,0.1)',
                          borderRadius: 4,
                          fontFamily: '"SF Mono", Menlo, monospace',
                        }}
                      >
                        via {ancestorLabel}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: t.textPrimary,
                        lineHeight: 1.5,
                      }}
                    >
                      {summary}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Standalone context history */}
        {!loading && !error && data?.contextHistory.length ? (
          <section>
            <div style={sectionTitleStyle(t.textSecondary)}>Context History</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {data.contextHistory.map((snippet, index) => (
                <article
                  key={`${snippet.source}-${index}`}
                  style={{
                    border: `1px solid ${t.borderSubtle}`,
                    borderRadius: 10,
                    backgroundColor: t.panelSurface,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 10, color: t.successText, marginBottom: 4 }}>
                    /{snippet.type} - {snippet.query}
                  </div>
                  <div style={{ fontSize: 11, color: t.inputText, lineHeight: 1.6 }}>
                    {snippet.content}
                  </div>
                  <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6 }}>
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

function sectionTitleStyle(color: string): React.CSSProperties {
  return {
    fontSize: 11,
    color,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
  };
}
