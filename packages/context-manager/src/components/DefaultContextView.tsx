import type { ContextRootResponse, ContextType } from '../types.js';

interface DefaultContextViewProps {
  data: ContextRootResponse;
  included: ContextType[];
  expanded: ContextType | null;
  onToggleInclude: (type: ContextType) => void;
  onToggleExpanded: (type: ContextType) => void;
}

export function DefaultContextView({
  data,
  included,
  expanded,
  onToggleInclude,
  onToggleExpanded,
}: DefaultContextViewProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2>Default Context Review</h2>
        </div>
        <p className="muted">
          Root: <code>{data.contextRoot}</code>
        </p>
      </div>

      <div className="stack-lg">
        {data.groups.map((group) => {
          const isIncluded = included.includes(group.type);
          const isExpanded = expanded === group.type;

          return (
            <article className="card" key={group.type}>
              <div className="row space-between align-start gap-lg">
                <div>
                  <div className="row gap-sm align-center">
                    <h3>{group.type}</h3>
                    <span className="badge">{group.fileCount} files</span>
                  </div>
                  <p className="muted">{group.summary}</p>
                </div>
                <div className="row gap-sm">
                  <button
                    className={`toggle ${isIncluded ? 'active' : ''}`}
                    onClick={() => onToggleInclude(group.type)}
                    type="button"
                  >
                    {isIncluded ? 'Included' : 'Excluded'}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => onToggleExpanded(group.type)}
                    type="button"
                  >
                    {isExpanded ? 'Hide Preview' : 'Preview'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="preview-list">
                  {group.files.length === 0 ? (
                    <p className="empty">No files in this context type yet.</p>
                  ) : (
                    group.files.map((file) => (
                      <div className="preview-item" key={file.relativePath}>
                        <div className="row space-between gap-md">
                          <strong>{file.fileName}</strong>
                          <span className="muted">{file.relativePath}</span>
                        </div>
                        <p>{file.summary}</p>
                        <pre>{file.preview}</pre>
                      </div>
                    ))
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
