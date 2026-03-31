// =============================================================================
// ImportModal
// =============================================================================
// Modal for importing context from another project's context root.
// User specifies the source path and selects which types to import.
// =============================================================================

import { useCallback, useState } from 'react';
import { CONTEXT_TYPES, TYPE_LABELS } from '../hooks/useCorpus.js';
import type { ContextType } from '../hooks/useCorpus.js';

interface ImportModalProps {
  onImport: (sourcePath: string, types: ContextType[]) => Promise<void>;
  onClose: () => void;
}

export function ImportModal({ onImport, onClose }: ImportModalProps) {
  const [sourcePath, setSourcePath] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<ContextType[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const toggleType = useCallback((type: ContextType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedTypes([...CONTEXT_TYPES]);
  }, []);

  const selectNone = useCallback(() => {
    setSelectedTypes([]);
  }, []);

  const handleImport = useCallback(async () => {
    if (!sourcePath.trim()) {
      setError('Source path is required');
      return;
    }
    if (selectedTypes.length === 0) {
      setError('Select at least one context type to import');
      return;
    }

    setIsImporting(true);
    setError(null);
    setResult(null);

    try {
      await onImport(sourcePath.trim(), selectedTypes);
      setResult(`Imported ${selectedTypes.length} type(s) from ${sourcePath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(message);
    } finally {
      setIsImporting(false);
    }
  }, [sourcePath, selectedTypes, onImport]);

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
        className="modal-content modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Import context from another project"
      >
        <div className="modal-header">
          <h3>Import Context</h3>
          <button type="button" className="ghost modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body stack-md">
          <div className="field">
            <label htmlFor="import-path">Source context root path</label>
            <input
              id="import-path"
              type="text"
              value={sourcePath}
              onChange={(e) => setSourcePath(e.target.value)}
              placeholder="e.g., /path/to/previous-project/context"
            />
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              Path to the context root directory of the project you want to import from.
            </span>
          </div>

          <div className="field">
            <div className="import-types-header">
              <label>Context types to import</label>
              <div className="import-types-actions">
                <button type="button" className="ghost" onClick={selectAll}>All</button>
                <button type="button" className="ghost" onClick={selectNone}>None</button>
              </div>
            </div>
            <div className="import-types-grid">
              {CONTEXT_TYPES.map((type) => (
                <label key={type} className="import-type-option">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type)}
                    onChange={() => toggleType(type)}
                  />
                  <span>{TYPE_LABELS[type]}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <div className="error">{error}</div>}
          {result && <div className="success">{result}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="ghost" onClick={onClose} disabled={isImporting}>
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              className="primary"
              onClick={handleImport}
              disabled={isImporting || !sourcePath.trim() || selectedTypes.length === 0}
            >
              {isImporting ? 'Importing...' : `Import ${selectedTypes.length} type(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
