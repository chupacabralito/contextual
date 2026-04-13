// =============================================================================
// ProjectPicker
// =============================================================================
// "Pick up recent or start new" -- shows most recent projects with a
// create-new option. Not a full project management surface; just enough
// to select context for the current session.
// =============================================================================

import { useCallback, useState } from 'react';
import type { ProjectSummary, CreateProjectRequest } from '../hooks/useProjects.js';

interface ProjectPickerProps {
  projects: ProjectSummary[];
  isLoading: boolean;
  error: string | null;
  activeProject: string | null;
  onSelectProject: (name: string) => void;
  onCreateProject: (request: CreateProjectRequest) => Promise<void>;
}

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

export function ProjectPicker({
  projects,
  isLoading,
  error,
  activeProject,
  onSelectProject,
  onCreateProject,
}: ProjectPickerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    const name = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const title = newTitle.trim() || name;

    if (!name) {
      setCreateError('Project name is required');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      await onCreateProject({ name, title });
      setNewName('');
      setNewTitle('');
      setShowCreate(false);
      onSelectProject(name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  }, [newName, newTitle, onCreateProject, onSelectProject]);

  return (
    <div className="project-picker">
      <div className="project-picker-header">
        <h3>Projects</h3>
        <button
          type="button"
          className="ghost"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? 'Cancel' : '+ New'}
        </button>
      </div>

      {showCreate && (
        <div className="project-create-form">
          <input
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setCreateError(null);
            }}
            placeholder="project-name (kebab-case)"
            disabled={isCreating}
          />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Display title (optional)"
            disabled={isCreating}
          />
          {createError && <span className="error">{createError}</span>}
          <button
            type="button"
            className="primary"
            onClick={handleCreate}
            disabled={isCreating || !newName.trim()}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      {isLoading && <div className="loading">Loading projects...</div>}
      {error && <div className="error">{error}</div>}

      {!isLoading && projects.length === 0 && !showCreate && (
        <div className="empty-state">
          <p className="muted">No projects yet.</p>
        </div>
      )}

      {projects.length > 0 && (
        <div className="project-list">
          {projects.map((project) => (
            <button
              key={project.name}
              type="button"
              className={`project-item ${activeProject === project.name ? 'active' : ''}`}
              onClick={() => onSelectProject(project.name)}
            >
              <div className="project-item-header">
                <span className="project-item-title">{project.title}</span>
                <span className="project-item-time">
                  {formatRelativeTime(project.lastActivityAt)}
                </span>
              </div>
              <div className="project-item-meta">
                {project.passCount} pass{project.passCount !== 1 ? 'es' : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
