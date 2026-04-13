// =============================================================================
// DiscoverModal
// =============================================================================
// Scans the project directory for existing .md files, suggests context type
// categories, and lets the user review/assign them before importing.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/client.js';
import { CONTEXT_TYPES, TYPE_LABELS } from '../hooks/useCorpus.js';
import type { ContextType } from '../hooks/useCorpus.js';
import type {
  DiscoveredFile,
  DiscoverResponse,
  DiscoverImportResponse,
} from '@contextual/shared';

interface FileSelection {
  file: DiscoveredFile;
  selected: boolean;
  type: ContextType | null;
}

interface DiscoverModalProps {
  onClose: () => void;
  onImported: () => void;
}

export function DiscoverModal({ onClose, onImported }: DiscoverModalProps) {
  const [isScanning, setIsScanning] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [files, setFiles] = useState<FileSelection[]>([]);
  const [projectDir, setProjectDir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Scan on mount
  useEffect(() => {
    let cancelled = false;

    async function scan() {
      try {
        const res = await apiFetch('/api/discover');
        if (!res.ok) {
          throw new Error(`Scan failed: ${res.status}`);
        }

        const data = (await res.json()) as DiscoverResponse;
        if (cancelled) return;

        setProjectDir(data.projectDir);
        setFiles(
          data.files.map((f) => ({
            file: f,
            selected: f.suggestedType !== null,
            type: f.suggestedType,
          }))
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Scan failed');
        }
      } finally {
        if (!cancelled) setIsScanning(false);
      }
    }

    void scan();
    return () => { cancelled = true; };
  }, []);

  // Focus trap
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
  }, [isScanning]);

  const toggleFile = useCallback((index: number) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, selected: !f.selected } : f))
    );
  }, []);

  const setFileType = useCallback((index: number, type: ContextType) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, type, selected: true } : f))
    );
  }, []);

  const selectAll = useCallback(() => {
    setFiles((prev) => prev.map((f) => ({ ...f, selected: true })));
  }, []);

  const selectNone = useCallback(() => {
    setFiles((prev) => prev.map((f) => ({ ...f, selected: false })));
  }, []);

  const selectedFiles = files.filter((f) => f.selected && f.type !== null);

  const handleImport = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      const res = await apiFetch('/api/discover/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: selectedFiles.map((f) => ({
            relativePath: f.file.relativePath,
            type: f.type,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Import failed: ${res.status}`);
      }

      const data = (await res.json()) as DiscoverImportResponse;
      setResult(`Imported ${data.imported} file(s) into context`);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  }, [selectedFiles, onImported]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  /** Truncate a file path for display */
  function displayPath(relativePath: string): string {
    return relativePath.length > 60
      ? '...' + relativePath.slice(-57)
      : relativePath;
  }

  /** Format file size */
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        ref={dialogRef}
        className="modal-content modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Discover existing context"
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <h3>Discover Existing Context</h3>
          <button type="button" className="ghost modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body stack-md" style={{ overflow: 'auto', flex: 1 }}>
          {isScanning ? (
            <p className="muted">Scanning project for markdown files...</p>
          ) : error && files.length === 0 ? (
            <div className="error">{error}</div>
          ) : files.length === 0 ? (
            <p className="muted">No markdown files found in {projectDir}</p>
          ) : (
            <>
              <div className="discover-summary">
                <span className="muted">
                  Found {files.length} markdown file(s) in project.
                  Select files and assign categories to import.
                </span>
                <div className="import-types-actions">
                  <button type="button" className="ghost" onClick={selectAll}>Select all</button>
                  <button type="button" className="ghost" onClick={selectNone}>Select none</button>
                </div>
              </div>

              <div className="discover-file-list">
                {files.map((entry, index) => (
                  <div
                    key={entry.file.relativePath}
                    className={`discover-file-row${entry.selected ? ' selected' : ''}`}
                  >
                    <label className="discover-file-check">
                      <input
                        type="checkbox"
                        checked={entry.selected}
                        onChange={() => toggleFile(index)}
                      />
                    </label>

                    <div className="discover-file-info">
                      <div className="discover-file-path">
                        <code>{displayPath(entry.file.relativePath)}</code>
                        <span className="muted" style={{ fontSize: '0.75rem' }}>
                          {formatSize(entry.file.size)}
                        </span>
                      </div>
                      <div className="discover-file-preview muted">
                        {entry.file.preview.slice(0, 150).replace(/\n/g, ' ')}
                        {entry.file.preview.length > 150 ? '...' : ''}
                      </div>
                    </div>

                    <select
                      className="discover-type-select"
                      value={entry.type ?? ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setFileType(index, e.target.value as ContextType);
                        }
                      }}
                    >
                      <option value="">-- Category --</option>
                      {CONTEXT_TYPES.map((t) => (
                        <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {error && <div className="error">{error}</div>}
              {result && <div className="success">{result}</div>}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="ghost" onClick={onClose} disabled={isImporting}>
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && !isScanning && files.length > 0 && (
            <button
              type="button"
              className="primary"
              onClick={handleImport}
              disabled={isImporting || selectedFiles.length === 0}
            >
              {isImporting
                ? 'Importing...'
                : `Import ${selectedFiles.length} file(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
