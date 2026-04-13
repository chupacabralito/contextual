// =============================================================================
// CorpusTree
// =============================================================================
// Hierarchical sidebar navigation reflecting the two-level context hierarchy:
//   Product (top) -- expandable to show all 7 categories
//   Projects (below) -- each expandable to show their own categories
//
// Replaces the old flat CorpusHealth + ProjectPicker with a single tree view.
// =============================================================================

import { useState } from 'react';
import type { CorpusTypeEntry } from '../hooks/useCorpus.js';
import type { ProjectSummary } from '../hooks/useProjects.js';
import { TYPE_LABELS } from '../hooks/useCorpus.js';
import type { ContextType } from '../hooks/useCorpus.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** What is currently selected in the sidebar */
export interface SidebarSelection {
  /** 'product' or a project name */
  scope: 'product' | string;
  /** null = brief/overview, string = category type */
  category: ContextType | null;
}

interface CorpusTreeProps {
  /** Product-level corpus type entries */
  types: CorpusTypeEntry[];
  /** Product name shown at top of tree */
  productName: string;
  /** Project list */
  projects: ProjectSummary[];
  projectsLoading: boolean;
  /** Current selection */
  selection: SidebarSelection | null;
  /** Called when user clicks a node */
  onSelect: (selection: SidebarSelection) => void;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CorpusTree({
  types,
  productName,
  projects,
  projectsLoading,
  selection,
  onSelect,
}: CorpusTreeProps) {
  const [productExpanded, setProductExpanded] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const isProductScope = selection?.scope === 'product';

  function toggleProjectExpanded(name: string) {
    setExpandedProjects((prev) => {
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

  function handleProjectClick(name: string) {
    onSelect({ scope: name, category: null });
    if (!expandedProjects.has(name)) {
      toggleProjectExpanded(name);
    }
  }

  function handleProjectCategoryClick(projectName: string, type: ContextType) {
    onSelect({ scope: projectName, category: type });
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

      {/* ---- Projects section ---- */}
      <div className="tree-section">
        <div className="tree-section-label">
          <span>Projects</span>
        </div>

        {projectsLoading && (
          <div className="tree-loading">Loading...</div>
        )}

        {!projectsLoading && projects.length === 0 && (
          <div className="tree-empty">No projects yet</div>
        )}

        {projects.map((project) => {
          const isExpanded = expandedProjects.has(project.name);
          const isProjectScope = selection?.scope === project.name;
          const isProjectBrief = isProjectScope && !selection?.category;
          const projectTypes =
            project.activeTypes.length > 0
              ? project.activeTypes
              : types.filter((entry) => entry.exists).map((entry) => entry.type);

          return (
            <div key={project.name} className="tree-project">
              <button
                type="button"
                className={`tree-scope-header tree-project-header ${isProjectBrief ? 'selected' : ''}`}
                onClick={() => handleProjectClick(project.name)}
              >
                <button
                  type="button"
                  className="tree-scope-toggle"
                  aria-label={isExpanded ? `Collapse ${project.title}` : `Expand ${project.title}`}
                  onClick={(e) => { e.stopPropagation(); toggleProjectExpanded(project.name); }}
                >
                  {isExpanded ? '\u25BE' : '\u25B8'}
                </button>
                <span className="tree-scope-name">{project.title}</span>
                <span className="tree-scope-meta">
                  {formatRelativeTime(project.lastActivityAt)}
                </span>
              </button>

              {isExpanded && (
                <div className="tree-children">
                  {projectTypes.map((type) => {
                    const isSelected = isProjectScope && selection?.category === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`tree-category tree-project-category ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleProjectCategoryClick(project.name, type)}
                      >
                        <div className="tree-category-top">
                          <span className="tree-category-name">{TYPE_LABELS[type]}</span>
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
