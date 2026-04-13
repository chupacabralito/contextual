// =============================================================================
// AddSourceModal
// =============================================================================
// Modal for pasting or writing new raw source content into a context type.
// User provides a label and content, which gets saved as a file in _sources/.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContextType } from '../hooks/useCorpus.js';
import { TYPE_LABELS } from '../hooks/useCorpus.js';

interface AddSourceModalProps {
  type: ContextType;
  onSubmit: (content: string, label?: string) => Promise<void>;
  onClose: () => void;
}

export function AddSourceModal({ type, onSubmit, onClose }: AddSourceModalProps) {
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Trap focus inside modal
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }

    dialog.addEventListener('keydown', handleTab);
    return () => dialog.removeEventListener('keydown', handleTab);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(content, label.trim() || undefined);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add source';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [content, label, onSubmit, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        ref={dialogRef}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Add source to ${TYPE_LABELS[type]}`}
      >
        <div className="modal-header">
          <h3>Add Source to {TYPE_LABELS[type]}</h3>
          <button type="button" className="ghost modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body stack-md">
          <div className="field">
            <label htmlFor="source-label">Label (optional)</label>
            <input
              id="source-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Q4 user research summary"
            />
          </div>

          <div className="field">
            <label htmlFor="source-content">Content</label>
            <textarea
              id="source-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste research findings, meeting notes, requirements, or any raw source material..."
              rows={14}
            />
          </div>

          {error && <div className="error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
          >
            {isSubmitting ? 'Adding...' : 'Add Source'}
          </button>
        </div>
      </div>
    </div>
  );
}
