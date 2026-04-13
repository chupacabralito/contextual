// =============================================================================
// ProductBriefView
// =============================================================================
// Displays the product-level brief.md and allows inline editing, matching the
// text-block pattern used by other brief surfaces in the app.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';

interface BriefData {
  title: string;
  description: string;
  content: string;
}

export function ProductBriefView() {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchBrief = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/corpus/brief');
      if (!res.ok) throw new Error(`Failed to fetch brief: ${res.status}`);
      const data: BriefData = await res.json();
      setBrief(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load brief';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBrief();
  }, [fetchBrief]);

  const startEditing = useCallback(() => {
    setEditContent(brief?.content ?? '');
    setIsEditing(true);
    setSaveError(null);
  }, [brief?.content]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditContent('');
    setSaveError(null);
  }, []);

  const saveEdits = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await apiFetch('/api/corpus/brief', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) throw new Error(`Failed to save brief: ${res.status}`);
      setBrief((prev) => (prev ? { ...prev, content: editContent } : prev));
      setIsEditing(false);
      setEditContent('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save brief';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }, [editContent]);

  const regenerateBrief = useCallback(async () => {
    setIsRegenerating(true);
    setSaveError(null);
    try {
      const res = await apiFetch('/api/corpus/brief/regenerate', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Failed: ${res.status}` }));
        throw new Error(data.error ?? `Failed to regenerate brief: ${res.status}`);
      }
      // Dispatched to agent — poll for the updated brief
      let attempts = 0;
      const maxAttempts = 30; // ~60 seconds
      const originalContent = brief?.content ?? '';
      const poll = setInterval(async () => {
        attempts++;
        try {
          const pollRes = await apiFetch('/api/corpus/brief');
          if (pollRes.ok) {
            const data: BriefData = await pollRes.json();
            if (data.content && data.content !== originalContent) {
              clearInterval(poll);
              setBrief(data);
              setIsRegenerating(false);
            }
          }
        } catch { /* keep polling */ }
        if (attempts >= maxAttempts) {
          clearInterval(poll);
          setIsRegenerating(false);
        }
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to regenerate brief';
      setSaveError(message);
      setIsRegenerating(false);
    }
  }, [brief?.content]);

  if (isLoading) {
    return (
      <div className="product-brief">
        <div className="loading">Loading brief...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="product-brief">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!brief) {
    return null;
  }

  return (
    <div className="product-brief">
      <div className="product-brief-header">
        <div>
          <h3>Product Brief</h3>
          {brief.description && (
            <span className="product-brief-description muted">
              {brief.description}
            </span>
          )}
        </div>
        <div className="compiled-view-actions">
          {!isEditing ? (
            <>
              <button
                type="button"
                className="ghost"
                onClick={regenerateBrief}
                disabled={isRegenerating}
              >
                {isRegenerating ? 'Generating via agent...' : 'Regenerate'}
              </button>
              <button type="button" className="secondary" onClick={startEditing}>
                Edit
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ghost"
                onClick={cancelEditing}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={saveEdits}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {saveError && <div className="error" style={{ marginBottom: '0.75rem' }}>{saveError}</div>}

      {isEditing ? (
        <textarea
          className="compiled-editor"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={20}
          spellCheck={false}
        />
      ) : brief.content ? (
        <pre className="product-brief-content">{brief.content}</pre>
      ) : (
        <div className="empty-state">
          <p className="muted">No product brief yet.</p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            A brief will be created automatically when you add context sources.
          </p>
        </div>
      )}
    </div>
  );
}
