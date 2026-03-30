import type { ContextRootResponse, ImportSelection, PastedEntry, SubmitResponse } from '../types.js';

interface SummaryViewProps {
  data: ContextRootResponse;
  included: string[];
  excluded: string[];
  pastedEntries: PastedEntry[];
  importSelection: ImportSelection | null;
  isSubmitting: boolean;
  submitResult: SubmitResponse | null;
  error: string | null;
  onSubmit: () => void;
}

export function SummaryView({
  data,
  included,
  excluded,
  pastedEntries,
  importSelection,
  isSubmitting,
  submitResult,
  error,
  onSubmit,
}: SummaryViewProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 4</p>
          <h2>Summary + Submit</h2>
        </div>
        <button className="primary" disabled={isSubmitting} onClick={onSubmit} type="button">
          {isSubmitting ? 'Submitting...' : 'Write Handoff File'}
        </button>
      </div>

      <div className="summary-grid">
        <article className="card">
          <h3>Default Context</h3>
          <p><strong>Included:</strong> {included.join(', ') || 'None'}</p>
          <p><strong>Excluded:</strong> {excluded.join(', ') || 'None'}</p>
        </article>

        <article className="card">
          <h3>Pasted Content</h3>
          <p>{pastedEntries.filter((entry) => entry.content.trim()).length} entries ready for the LLM.</p>
        </article>

        <article className="card">
          <h3>Imports</h3>
          {importSelection ? (
            <>
              <p><strong>Project:</strong> {importSelection.projectName}</p>
              <p><strong>Types:</strong> {importSelection.importedTypes.join(', ') || 'None selected'}</p>
              <p><strong>Files:</strong> {importSelection.files.length}</p>
            </>
          ) : (
            <p>No previous project imports selected.</p>
          )}
        </article>
      </div>

      <div className="card stack-sm">
        <h3>Output</h3>
        <p className="muted">
          On submit, the app writes <code>{`${data.projectPath}/.contextual/handoff.json`}</code> and
          copies any selected imports into the new project's context folders.
        </p>
        {submitResult && (
          <div className="success">
            <strong>Sent.</strong> Handoff written to <code>{submitResult.handoffPath}</code>. Copied{' '}
            {submitResult.copiedFiles.length} files.
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>
    </section>
  );
}
