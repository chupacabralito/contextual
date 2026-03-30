import { useState } from 'react';
import type { ConfiguredTool } from '../types.js';

interface ToolConfigViewProps {
  tools: ConfiguredTool[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onToggle: (name: string) => void;
  onAdd: (name: string, label: string) => void;
  onRemove: (name: string) => void;
}

export function ToolConfigView({
  tools,
  isLoading,
  isSaving,
  error,
  onToggle,
  onAdd,
  onRemove,
}: ToolConfigViewProps) {
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    const name = newName.trim().toLowerCase();
    const label = newLabel.trim();
    if (!name || !label) return;

    onAdd(name, label);
    setNewName('');
    setNewLabel('');
  };

  if (isLoading) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 5</p>
            <h2>Tool Configuration</h2>
          </div>
        </div>
        <p className="muted">Loading tools from server...</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 5</p>
          <h2>Tool Configuration</h2>
        </div>
        <p className="muted">
          {tools.length} tool{tools.length !== 1 ? 's' : ''} configured
          {isSaving && ' (saving...)'}
        </p>
      </div>

      <p className="muted" style={{ marginBottom: '1rem' }}>
        Configure external tools available as <code>@mention</code> targets in the annotation
        component. The 5 local context types (research, taste, strategy, design-system,
        stakeholders) are always available. Tools you add here (e.g., posthog, figma, hotjar) appear
        in autocomplete when designers type <code>@</code>.
      </p>

      {error && (
        <div className="error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="stack-lg">
        {tools.length === 0 && (
          <div className="empty-state">
            <p className="muted">
              No external tools configured yet. Add tools below to make them available as
              @mention targets in annotations.
            </p>
          </div>
        )}

        {tools.map((tool) => (
          <article className="card" key={tool.name}>
            <div className="row space-between align-center gap-lg">
              <div>
                <div className="row gap-sm align-center">
                  <h3>@{tool.name}</h3>
                  <span className={`badge ${tool.enabled ? '' : 'disabled'}`}>
                    {tool.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="muted">{tool.label}</p>
              </div>
              <div className="row gap-sm">
                <button
                  className={`toggle ${tool.enabled ? 'active' : ''}`}
                  onClick={() => onToggle(tool.name)}
                  type="button"
                  disabled={isSaving}
                >
                  {tool.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  className="secondary"
                  onClick={() => onRemove(tool.name)}
                  type="button"
                  disabled={isSaving}
                >
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}

        <article className="card">
          <h3 style={{ marginBottom: '0.75rem' }}>Add New Tool</h3>
          <div className="row gap-md align-start" style={{ flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1', minWidth: '160px' }}>
              <label htmlFor="tool-name" className="muted">
                Tool name (used as @mention)
              </label>
              <input
                id="tool-name"
                type="text"
                placeholder="e.g., posthog"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="field" style={{ flex: '2', minWidth: '200px' }}>
              <label htmlFor="tool-label" className="muted">
                Label (human-readable description)
              </label>
              <input
                id="tool-label"
                type="text"
                placeholder="e.g., PostHog analytics"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <button
              className="primary"
              onClick={handleAdd}
              type="button"
              disabled={isSaving || !newName.trim() || !newLabel.trim()}
              style={{ alignSelf: 'flex-end' }}
            >
              Add Tool
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
