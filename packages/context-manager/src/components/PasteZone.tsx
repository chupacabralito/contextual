import type { ContextType, PastedEntry } from '../types.js';
import { CONTEXT_TYPES } from '../types.js';

interface PasteZoneProps {
  entries: PastedEntry[];
  onAdd: () => void;
  onChange: (id: string, field: keyof PastedEntry, value: string) => void;
  onRemove: (id: string) => void;
}

export function PasteZone({ entries, onAdd, onChange, onRemove }: PasteZoneProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2>Paste Zone</h2>
        </div>
        <button className="primary" onClick={onAdd} type="button">
          Add Entry
        </button>
      </div>

      <p className="muted">
        Paste raw research notes, stakeholder emails, brand docs, or meeting transcripts.
        The LLM will structure them later.
      </p>

      <div className="stack-lg">
        {entries.length === 0 ? (
          <div className="empty-state">
            <p>No pasted content yet. Add an entry if you want the LLM to structure raw material.</p>
          </div>
        ) : (
          entries.map((entry, index) => (
            <article className="card" key={entry.id}>
              <div className="row space-between align-center">
                <h3>Entry {index + 1}</h3>
                <button className="ghost" onClick={() => onRemove(entry.id)} type="button">
                  Remove
                </button>
              </div>
              <label className="field">
                <span>Label</span>
                <input
                  type="text"
                  value={entry.label}
                  onChange={(event) => onChange(entry.id, 'label', event.target.value)}
                  placeholder="User research notes"
                />
              </label>
              <label className="field">
                <span>Suggested Context Type</span>
                <select
                  value={entry.suggestedType}
                  onChange={(event) =>
                    onChange(entry.id, 'suggestedType', event.target.value as ContextType | '')
                  }
                >
                  <option value="">Unspecified</option>
                  {CONTEXT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Raw Content</span>
                <textarea
                  rows={8}
                  value={entry.content}
                  onChange={(event) => onChange(entry.id, 'content', event.target.value)}
                  placeholder="Paste raw content here..."
                />
              </label>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
