// =============================================================================
// PasteZone (Inline Add Context)
// =============================================================================
// Slim inline module for adding context to the corpus.
// Collapsed by default: shows a single-line "Add context" trigger.
// Expands to show compact textarea + submit button.
// Auto-categorizes based on the current context type selection.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import type { ContextType } from '../hooks/useCorpus.js';
import { CONTEXT_TYPES, TYPE_LABELS } from '../hooks/useCorpus.js';

// ---------------------------------------------------------------------------
// Keyword-based type inference for drag-and-dropped files
// ---------------------------------------------------------------------------

/** Keyword lists mapped to each context type (checked against filename + content) */
const TYPE_KEYWORDS: Record<ContextType, string[]> = {
  research: [
    'research', 'user-research', 'competitive', 'competitor', 'market-insight',
    'survey', 'interview', 'usability', 'findings', 'persona', 'user-needs',
    'discovery', 'ethnograph', 'diary-study',
  ],
  taste: [
    'taste', 'brand', 'visual', 'tone', 'voice', 'aesthetic', 'moodboard',
    'mood-board', 'style-guide', 'typography', 'color-palette', 'inspiration',
    'look-and-feel', 'identity',
  ],
  strategy: [
    'strategy', 'roadmap', 'positioning', 'vision', 'mission', 'okr',
    'north-star', 'go-to-market', 'gtm', 'product-strategy', 'brief',
    'initiative', 'product-plan',
  ],
  'design-system': [
    'design-system', 'component', 'token', 'pattern', 'guideline',
    'ui-kit', 'spacing', 'grid', 'layout', 'accessibility', 'a11y',
    'design-principle', 'atomic',
  ],
  stakeholders: [
    'stakeholder', 'feedback', 'approval', 'review', 'sign-off', 'signoff',
    'requirement', 'exec', 'leadership', 'steering', 'sponsor', 'governance',
  ],
  technical: [
    'technical', 'architecture', 'api', 'endpoint', 'schema', 'database',
    'infrastructure', 'devops', 'cicd', 'deployment', 'performance',
    'security', 'constraint', 'spec', 'rfc', 'adr',
  ],
  business: [
    'business', 'revenue', 'pricing', 'model', 'cost', 'budget', 'roi',
    'kpi', 'metric', 'conversion', 'monetization', 'unit-economics',
    'financial', 'forecast',
  ],
};

/**
 * Infer the best-fit context type from a file's name and content.
 * Returns the type with the highest keyword score, or 'research' as fallback.
 */
function inferContextType(filename: string, content: string): ContextType {
  const haystack = `${filename} ${content.slice(0, 2000)}`.toLowerCase();

  let bestType: ContextType = 'research';
  let bestScore = 0;

  for (const type of CONTEXT_TYPES) {
    let score = 0;
    for (const kw of TYPE_KEYWORDS[type]) {
      if (haystack.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestType;
}

interface PasteZoneProps {
  onSubmit: (content: string, type: ContextType, label?: string, filename?: string) => Promise<void>;
  /** When set (sidebar selection), PasteZone targets this type directly */
  defaultType?: ContextType;
  onImport?: () => void;
  onDiscover?: () => void;
  /** Called after files are dropped to trigger compilation for affected types */
  onCompileTypes?: (types: ContextType[]) => Promise<void>;
}

export function PasteZone({ onSubmit, defaultType, onImport, onDiscover, onCompileTypes }: PasteZoneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The type used for submission: sidebar type if set, otherwise 'research'
  const targetType: ContextType = defaultType ?? 'research';

  // Focus textarea when opening
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      setError('Paste some content first');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await onSubmit(content.trim(), targetType, undefined);
      setSuccess(`Added to ${TYPE_LABELS[targetType]}`);
      setContent('');
      setTimeout(() => {
        setSuccess(null);
        setIsOpen(false);
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add content';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [content, targetType, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleSubmit();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [handleSubmit]
  );

  // Drag/drop handlers for .md files
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.endsWith('.md') || f.name.endsWith('.markdown') || f.name.endsWith('.txt')
      );

      if (files.length === 0) {
        setError('Drop .md or .txt files to add context');
        return;
      }

      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      try {
        let added = 0;
        const affectedTypes = new Set<ContextType>();

        for (const file of files) {
          const text = await file.text();
          if (text.trim()) {
            const label = file.name.replace(/\.(md|markdown|txt)$/, '');
            // If a sidebar type is selected, use it; otherwise infer from filename + content
            const fileType = defaultType ?? inferContextType(file.name, text);
            affectedTypes.add(fileType);
            // Pass original filename so files keep their names on disk
            await onSubmit(text.trim(), fileType, label, file.name);
            added++;
          }
        }

        // Build human-readable summary of where files went
        const typeNames = Array.from(affectedTypes).map((t) => TYPE_LABELS[t]);
        const typeSummary = typeNames.length === 1
          ? typeNames[0]
          : `${typeNames.slice(0, -1).join(', ')} & ${typeNames[typeNames.length - 1]}`;

        setSuccess(`Added ${added} file${added !== 1 ? 's' : ''} to ${typeSummary}`);
        setContent('');

        // Auto-compile affected types so sections get populated immediately
        if (onCompileTypes && affectedTypes.size > 0) {
          void onCompileTypes(Array.from(affectedTypes));
        }

        setTimeout(() => {
          setSuccess(null);
          setIsOpen(false);
        }, 2000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add dropped files';
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [defaultType, onSubmit, onCompileTypes]
  );

  const hasSidebarType = !!defaultType;

  // Collapsed state: single-line trigger
  if (!isOpen) {
    return (
      <div className="paste-zone-inline">
        <button
          type="button"
          className="paste-zone-inline-trigger"
          onClick={() => setIsOpen(true)}
        >
          <span className="paste-zone-inline-icon">+</span>
          <span className="paste-zone-inline-copy">
            <span className="paste-zone-inline-title">
              Add context{hasSidebarType ? ` to ${TYPE_LABELS[targetType]}` : ''}
            </span>
            <span className="paste-zone-inline-hint">
              Paste notes, decisions, or research without leaving the flow.
            </span>
          </span>
        </button>
        {(onImport || onDiscover) && (
          <div className="paste-zone-inline-actions">
            {onDiscover && (
              <button type="button" className="ghost small" onClick={onDiscover}>
                Discover
              </button>
            )}
            {onImport && (
              <button type="button" className="ghost small" onClick={onImport}>
                Import
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Expanded state: compact textarea + controls
  return (
    <div
      className={`paste-zone-inline expanded${isDragOver ? ' drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="paste-zone-inline-topline">
        <span className="paste-zone-inline-topline-label">
          Add context{hasSidebarType ? ` to ${TYPE_LABELS[targetType]}` : ''}
        </span>
        <span className="paste-zone-inline-topline-hint">Cmd/Ctrl+Enter to save &middot; Drop .md files</span>
      </div>

      <textarea
        ref={textareaRef}
        className="paste-zone-inline-input"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setError(null);
          setSuccess(null);
        }}
        onKeyDown={handleKeyDown}
        placeholder={
          hasSidebarType
            ? `Paste or drop .md files for ${TYPE_LABELS[targetType]}...`
            : 'Paste or drop .md files here...'
        }
        rows={3}
        disabled={isSubmitting}
      />

      <div className="paste-zone-inline-controls">
        <div className="paste-zone-inline-right">
          {error && <span className="paste-zone-error">{error}</span>}
          {success && <span className="paste-zone-success">{success}</span>}
          <button
            type="button"
            className="ghost small"
            onClick={() => {
              setIsOpen(false);
              setContent('');
              setError(null);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary small"
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
          >
            {isSubmitting ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
