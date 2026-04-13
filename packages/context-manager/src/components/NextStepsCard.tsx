import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';
import type { PairingStatusResponse } from '../types.js';

function formatPairingTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function NextStepsCard() {
  const [pairing, setPairing] = useState<PairingStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const fetchPairing = useCallback(async () => {
    try {
      const response = await apiFetch('/api/pairing');
      if (!response.ok) {
        throw new Error(`Failed to fetch pairing status: ${response.status}`);
      }

      const data = (await response.json()) as PairingStatusResponse;
      setPairing(data);
      setError(null);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : 'Failed to load pairing status';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPairing();

    const interval = window.setInterval(() => {
      void fetchPairing();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [fetchPairing]);

  const handleCopyCommand = useCallback(async () => {
    if (!pairing?.suggestedCommand) {
      return;
    }

    try {
      await navigator.clipboard.writeText(pairing.suggestedCommand);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2000);
    }
  }, [pairing?.suggestedCommand]);

  return (
    <section className="next-steps-card">
      <div className="next-steps-header">
        <div>
          <h3>Start Working</h3>
        </div>
        <p className="next-steps-subtitle muted">
          Keep Contextual anchored in Claude Code, with the toolbar available for local browser UI work.
        </p>
      </div>

      <div className="next-steps-grid">
        <article className="next-step-panel">
          <div className="next-step-panel-header">
            <div>
              <h4>Work In Claude Code</h4>
              <p className="muted">
                Contextual sends passes to the Claude Code terminal paired with this repo.
              </p>
            </div>
            <span
              className={`next-step-status-badge ${
                pairing?.paired ? 'paired' : 'unpaired'
              }`}
            >
              {pairing?.paired ? 'Terminal paired' : 'Terminal not paired'}
            </span>
          </div>

          {isLoading ? (
            <p className="muted">Checking terminal pairing…</p>
          ) : error ? (
            <p className="next-step-error">{error}</p>
          ) : pairing?.paired && pairing.pairing ? (
            <div className="next-step-details">
              <div className="next-step-detail-row">
                <span className="muted">TTY</span>
                <code>{pairing.pairing.tty}</code>
              </div>
              <div className="next-step-detail-row">
                <span className="muted">Paired</span>
                <span>{formatPairingTime(pairing.pairing.pairedAt)}</span>
              </div>
              {pairing.pairing.workingDirectory && (
                <div className="next-step-detail-row">
                  <span className="muted">Started from</span>
                  <code>{pairing.pairing.workingDirectory}</code>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="next-step-copy">
                Run this in the Claude Code terminal tab you want Contextual to use for this repo.
              </p>
              <div className="next-step-command">
                <pre>{pairing?.suggestedCommand ?? 'Loading pair command…'}</pre>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => void handleCopyCommand()}
                  disabled={!pairing?.suggestedCommand}
                >
                  {copyState === 'copied'
                    ? 'Copied'
                    : copyState === 'error'
                      ? 'Copy failed'
                      : 'Copy command'}
                </button>
              </div>
            </>
          )}
        </article>

        <article className="next-step-panel">
          <div className="next-step-panel-header">
            <div>
              <h4>Make Updates In Your Local Browser</h4>
              <p className="muted">
                If this repo has a local browser UI, open that app locally and use the Contextual
                Toolbar there to point at interface elements and send passes visually.
              </p>
            </div>
            <span className="next-step-status-badge optional">Optional</span>
          </div>

          <div className="next-step-details">
            <div className="next-step-detail-row">
              <span className="muted">Step 1</span>
              <span>Start your local app and open it in the browser.</span>
            </div>
            <div className="next-step-detail-row">
              <span className="muted">Step 2</span>
              <span>Open the Contextual Toolbar in that app.</span>
            </div>
            <div className="next-step-detail-row">
              <span className="muted">Step 3</span>
              <span>Use <code>Instruct</code> mode to create passes visually.</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
