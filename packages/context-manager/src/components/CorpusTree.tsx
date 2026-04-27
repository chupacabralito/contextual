// =============================================================================
// CorpusTree
// =============================================================================
// Hierarchical sidebar navigation reflecting the two-level context hierarchy:
//   Product (top) -- expandable to show all 7 categories
//   Initiatives (below) -- each expandable to show their own categories
//
// Progressive disclosure:
//   - When no initiatives exist, the "Initiatives" header is hidden and a
//     single `+ New initiative` affordance appears below the product section.
//   - When at least one exists, the "Initiatives" header is rendered with a
//     small `+` button on the right.
//
// Inline create row:
//   - Clicking `+` reveals an inline edit row at the top of the (real or
//     hypothetical) Initiatives section. The user types a display title; the
//     kebab-case name is auto-derived. Enter commits, Escape/blur cancels.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import type { CorpusTypeEntry } from '../hooks/useCorpus.js';
import type { InitiativeSummary } from '../hooks/useProjects.js';
import { TYPE_LABELS } from '../hooks/useCorpus.js';
import type { ContextType } from '../hooks/useCorpus.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** What is currently selected in the sidebar */
export interface SidebarSelection {
  /** 'product' or an initiative name */
  scope: 'product' | string;
  /** null = brief/overview, string = category type */
  category: ContextType | null;
}

interface CorpusTreeProps {
  /** Product-level corpus type entries */
  types: CorpusTypeEntry[];
  /** Product name shown at top of tree */
  productName: string;
  /** Initiative list */
  initiatives: InitiativeSummary[];
  initiativesLoading: boolean;
  /** Current selection */
  selection: SidebarSelection | null;
  /** Called when user clicks a node */
  onSelect: (selection: SidebarSelection) => void;
  /**
   * Create a new initiative. Called when the inline create row commits.
   * Should resolve once the new initiative is persisted; the parent is
   * expected to refetch the list. Rejects with an Error whose message is
   * surfaced inline in the row.
   */
  onCreateInitiative: (input: { name: string; title: string }) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string): string {
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * Convert a free-text title into a server-acceptable kebab-case name.
 * Mirrors the server's regex: ^[a-z0-9]+(?:-[a-z0-9]+)*$
 */
export function deriveKebabName(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// InlineInitiativeRow
// ---------------------------------------------------------------------------

interface InlineInitiativeRowProps {
  onCommit: (input: { name: string; title: string }) => Promise<void>;
  onCancel: () => void;
}

function InlineInitiativeRow({ onCommit, onCancel }: InlineInitiativeRowProps) {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const derivedName = deriveKebabName(title);
  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0 && derivedName.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await onCommit({ name: derivedName, title: trimmedTitle });
      // Parent will re-render and unmount this row.
    } catch (err) {
      submittedRef.current = false;
      const msg = err instanceof Error ? err.message : 'Failed to create initiative';
      setError(msg);
      setSubmitting(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleSubmit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      submittedRef.current = true; // suppress blur->cancel
      onCancel();
    }
  }

  function handleBlur() {
    // Defer so click on input or programmatic refocus has a chance.
    setTimeout(() => {
      if (submittedRef.current || submitting) return;
      onCancel();
    }, 120);
  }

  return (
    <div className="tree-initiative tree-initiative-create">
      <div className="tree-initiative-create-row">
        <input
          ref={inputRef}
          type="text"
          className="tree-initiative-create-input"
          placeholder="New initiative title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={submitting}
          aria-label="New initiative title"
        />
      </div>
      {trimmedTitle.length > 0 && (
        <div className="tree-initiative-create-hint">
          {derivedName.length > 0 ? (
            <>naming as: <code>{derivedName}</code></>
          ) : (
            <span className="tree-initiative-create-error">title must include letters or numbers</span>
          )}
        </div>
      )}
      {error && (
        <div className="tree-initiative-create-error" role="alert">{error}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CorpusTree({
  types,
  productName,
  initiatives,
  initiativesLoading,
  selection,
  onSelect,
  onCreateInitiative,
}: CorpusTreeProps) {
  const [productExpanded, setProductExpanded] = useState(true);
  const [expandedInitiatives, setExpandedInitiatives] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const isProductScope = selection?.scope === 'product';
  const hasInitiatives = initiatives.length > 0;

  function toggleInitiativeExpanded(name: string) {
    setExpandedInitiatives((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function handleProductClick() {
    onSelect({ scope: 'product', category: null });
    if (!productExpanded) setProductExpanded(true);
  }

  function handleProductCategoryClick(type: ContextType) {
    onSelect({ scope: 'product', category: type });
  }

  function handleInitiativeClick(name: string) {
    onSelect({ scope: name, category: null });
    if (!expandedInitiatives.has(name)) {
      toggleInitiativeExpanded(name);
    }
  }

  function handleInitiativeCategoryClick(initiativeName: string, type: ContextType) {
    onSelect({ scope: initiativeName, category: type });
  }

  async function handleCommit(input: { name: string; title: string }) {
    await onCreateInitiative(input);
    // Success: parent refetches; close the inline row and select the new initiative.
    setCreating(false);
    setExpandedInitiatives((prev) => {
      const next = new Set(prev);
      next.add(input.name);
      return next;
    });
    onSelect({ scope: input.name, category: null });
  }

  function handleCancel() {
    setCreating(false);
  }

  return (
    <nav className="corpus-tree">
      {/* ---- Product section ---- */}
      <div className="tree-section">
        <button
          type="button"
          className={`tree-scope-header ${isProductScope && !selection?.category ? 'selected' : ''}`}
          onClick={handleProductClick}
        >
          <button
            type="button"
            className="tree-scope-toggle"
            aria-label={productExpanded ? 'Collapse product context' : 'Expand product context'}
            onClick={(e) => { e.stopPropagation(); setProductExpanded(!productExpanded); }}
          >
            {productExpanded ? '\u25BE' : '\u25B8'}
          </button>
          <span className="tree-scope-name">{productName}</span>
          <span className="tree-scope-meta">
            {types.filter((t) => t.exists).length}/{types.length}
          </span>
        </button>

        {productExpanded && (
          <div className="tree-children">
            {types.map((entry) => {
              const sources = entry.sourceCount ?? 0;
              const hasContent = entry.exists && entry.meta;
              const isSelected = isProductScope && selection?.category === entry.type;

              return (
                <button
                  key={entry.type}
                  type="button"
                  className={`tree-category ${isSelected ? 'selected' : ''} ${hasContent ? '' : 'empty'}`}
                  onClick={() => handleProductCategoryClick(entry.type)}
                >
                  <div className="tree-category-top">
                    <span className="tree-category-name">{TYPE_LABELS[entry.type]}</span>
                    <span className="tree-category-meta">
                      {hasContent ? (
                        <>{sources} source{sources !== 1 ? 's' : ''}</>
                      ) : sources > 0 ? (
                        <>{sources} uncompiled</>
                      ) : (
                        <>empty</>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Initiatives section ---- */}
      <div className="tree-section">
        {initiativesLoading && (
          <div className="tree-loading">Loading...</div>
        )}

        {/* Header is conditional on there being at least one initiative */}
        {!initiativesLoading && hasInitiatives && (
          <div className="tree-section-label tree-section-label-with-action">
            <span>Initiatives</span>
            <button
              type="button"
              className="tree-section-add"
              aria-label="New initiative"
              title="New initiative"
              onClick={() => setCreating(true)}
              disabled={creating}
            >
              +
            </button>
          </div>
        )}

        {/* Inline create row (rendered inside section regardless of header presence) */}
        {creating && (
          <InlineInitiativeRow onCommit={handleCommit} onCancel={handleCancel} />
        )}

        {/* Empty state: no header, just a single affordance */}
        {!initiativesLoading && !hasInitiatives && !creating && (
          <button
            type="button"
            className="tree-section-empty-add"
            onClick={() => setCreating(true)}
          >
            + New initiative
          </button>
        )}

        {initiatives.map((initiative) => {
          const isExpanded = expandedInitiatives.has(initiative.name);
          const isInitiativeScope = selection?.scope === initiative.name;
          const isInitiativeBrief = isInitiativeScope && !selection?.category;
          const activeTypes = new Set(initiative.activeTypes);

          return (
            <div key={initiative.name} className="tree-initiative">
              <button
                type="button"
                className={`tree-scope-header tree-initiative-header ${isInitiativeBrief ? 'selected' : ''}`}
                onClick={() => handleInitiativeClick(initiative.name)}
              >
                <button
                  type="button"
                  className="tree-scope-toggle"
                  aria-label={isExpanded ? `Collapse ${initiative.title}` : `Expand ${initiative.title}`}
                  onClick={(e) => { e.stopPropagation(); toggleInitiativeExpanded(initiative.name); }}
                >
                  {isExpanded ? '\u25BE' : '\u25B8'}
                </button>
                <span className="tree-scope-name">{initiative.title}</span>
                <span className="tree-scope-meta">
                  {formatRelativeTime(initiative.lastActivityAt)}
                </span>
              </button>

              {isExpanded && (
                <div className="tree-children">
                  {types.map((entry) => {
                    const type = entry.type;
                    const isSelected = isInitiativeScope && selection?.category === type;
                    const hasContent = activeTypes.has(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`tree-category tree-initiative-category ${isSelected ? 'selected' : ''} ${hasContent ? '' : 'empty'}`}
                        onClick={() => handleInitiativeCategoryClick(initiative.name, type)}
                      >
                        <div className="tree-category-top">
                          <span className="tree-category-name">{TYPE_LABELS[type]}</span>
                          <span className="tree-category-meta">
                            {hasContent ? 'has content' : 'empty'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
