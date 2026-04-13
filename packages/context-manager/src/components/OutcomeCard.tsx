// =============================================================================
// OutcomeCard
// =============================================================================
// Compact card for rendering a single outcome in the context manager.
// Used at both the product (home) and project levels.
// Read-only -- no mutation actions.
// =============================================================================

interface OutcomeCardData {
  id: string;
  passId: string;
  timestamp: string;
  status: string;
  project?: string;
  affectedContextTypes?: string[];
  summary?: string;
  feedback?: string;
  changedFileCount?: number;
  writebackCount?: number;
}

interface OutcomeCardProps {
  outcome: OutcomeCardData;
  /** Whether to show the project badge (hidden at project level since it's redundant) */
  showProject?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  approved: { label: 'Approved', className: 'outcome-status-approved' },
  'approved-with-feedback': { label: 'Approved w/ feedback', className: 'outcome-status-approved-feedback' },
  rejected: { label: 'Rejected', className: 'outcome-status-rejected' },
  pending: { label: 'Pending', className: 'outcome-status-pending' },
};

function formatOutcomeTime(iso: string): string {
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function OutcomeCard({ outcome, showProject = true }: OutcomeCardProps) {
  const statusInfo = STATUS_CONFIG[outcome.status] ?? STATUS_CONFIG.pending;
  const changedCount = outcome.changedFileCount ?? 0;
  const wbCount = outcome.writebackCount ?? 0;

  return (
    <div className="outcome-card">
      {/* Top row: status + time + optional project */}
      <div className="outcome-card-header">
        <span className={`outcome-status-badge ${statusInfo.className}`}>
          {statusInfo.label}
        </span>
        <span className="outcome-card-time">
          {formatOutcomeTime(outcome.timestamp)}
        </span>
        {showProject && outcome.project && (
          <span className="outcome-card-project">{outcome.project}</span>
        )}
      </div>

      {/* Summary */}
      {outcome.summary && (
        <p className="outcome-card-summary">{outcome.summary}</p>
      )}

      {/* Feedback */}
      {outcome.feedback && (
        <div className="outcome-card-feedback">
          <span className="outcome-card-feedback-label">Feedback</span>
          <p className="outcome-card-feedback-text">{outcome.feedback}</p>
        </div>
      )}

      {/* Meta row: changed files, writebacks, pass linkage */}
      <div className="outcome-card-meta">
        {changedCount > 0 && (
          <span className="outcome-card-stat">
            {changedCount} file{changedCount !== 1 ? 's' : ''} changed
          </span>
        )}
        {wbCount > 0 && (
          <span className="outcome-card-stat">
            {wbCount} writeback{wbCount !== 1 ? 's' : ''}
          </span>
        )}
        <span className="outcome-card-pass-link" title={outcome.passId}>
          Pass {outcome.passId.slice(-8)}
        </span>
      </div>
    </div>
  );
}
