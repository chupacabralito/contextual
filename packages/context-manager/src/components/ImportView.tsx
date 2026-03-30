import type { ContextType, ImportSelection, PreviousProjectSummary } from '../types.js';

interface ImportViewProps {
  projects: PreviousProjectSummary[];
  selection: ImportSelection | null;
  onSelectProject: (project: PreviousProjectSummary) => void;
  onToggleType: (type: ContextType) => void;
}

export function ImportView({
  projects,
  selection,
  onSelectProject,
  onToggleType,
}: ImportViewProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 3</p>
          <h2>Import From Previous Projects</h2>
        </div>
      </div>

      <div className="grid split">
        <div className="stack-md">
          {projects.length === 0 ? (
            <div className="empty-state">
              <p>No previous projects found in the configured project root.</p>
            </div>
          ) : (
            projects.map((project) => (
              <button
                key={project.path}
                className={`project-card ${selection?.projectPath === project.path ? 'selected' : ''}`}
                onClick={() => onSelectProject(project)}
                type="button"
              >
                <strong>{project.name}</strong>
                <span className="muted">{project.path}</span>
                <span className="muted">
                  {project.groups.reduce((total, group) => total + group.fileCount, 0)} files available
                </span>
              </button>
            ))
          )}
        </div>

        <div className="card stack-md">
          {selection ? (
            <>
              <div>
                <h3>{selection.projectName}</h3>
                <p className="muted">Select which context types to copy into the new project.</p>
              </div>
              {projects
                .find((project) => project.path === selection.projectPath)
                ?.groups.map((group) => {
                  const isSelected = selection.importedTypes.includes(group.type);
                  return (
                    <label className="checkbox-row" key={group.type}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleType(group.type)}
                      />
                      <span>
                        <strong>{group.type}</strong>
                        <span className="muted">
                          {group.fileCount} files: {group.files.join(', ') || 'none'}
                        </span>
                      </span>
                    </label>
                  );
                })}
              <div className="notice">
                <strong>Will import:</strong> {selection.files.length} files into the new project's
                context folders on submit.
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>Select a previous project to preview import options.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
