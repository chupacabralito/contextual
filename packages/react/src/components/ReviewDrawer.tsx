// =============================================================================
// Review Drawer
// =============================================================================
// Transient post-pass drawer rendered under the Instruct / Inspect controls.
// The drawer is pass-scoped, but each card represents one instruction review.
// =============================================================================

import React from 'react';
import { DEFAULT_LEARNED_FOLDERS } from '@contextualapp/shared';
import type { InstructionLearningDraft } from '@contextualapp/shared';
import type { ReviewDrawerState } from '../hooks/useContextual.js';
import { stripMentions } from '../mentions/parser.js';
import { useTheme } from '../theme.js';

interface ReviewDrawerProps {
  review: ReviewDrawerState;
  onClose: () => void;
  onMarkInstructionLooksGood: (instructionId: string) => void;
  onRequestInstructionFollowUp: (instructionId: string) => void;
  onOpenLearningDraft: (instructionId: string) => void;
  onCancelLearningDraft: () => void;
  onUpdateLearningDraft: (
    instructionId: string,
    patch: Partial<InstructionLearningDraft>,
  ) => void;
  onSaveLearningDraft: (instructionId: string) => Promise<void>;
}

function formatPassTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusLabel(status: ReviewDrawerState['outcome']['status']): string {
  switch (status) {
    case 'approved':
      return 'Looks good';
    case 'approved-with-feedback':
      return 'Reviewed with notes';
    case 'rejected':
      return 'Needs follow-up';
    default:
      return 'Review pending';
  }
}

export function ReviewDrawer({
  review,
  onClose,
  onMarkInstructionLooksGood,
  onRequestInstructionFollowUp,
  onOpenLearningDraft,
  onCancelLearningDraft,
  onUpdateLearningDraft,
  onSaveLearningDraft,
}: ReviewDrawerProps) {
  const t = useTheme();
  const instructionReviewMap = new Map(
    (review.outcome.instructionReviews ?? []).map((item) => [item.instructionId, item]),
  );

  return (
    <div
      style={{
        backgroundColor: t.panelBg,
        borderLeft: `1px solid ${t.border}`,
        borderRight: `1px solid ${t.border}`,
        borderBottom: `1px solid ${t.border}`,
        padding: 10,
        display: 'grid',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          padding: '2px 2px 0',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.textPrimary }}>
            Review
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.5 }}>
            Latest pass submitted at {formatPassTimestamp(review.pass.timestamp)}
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>
            {review.pass.instructions.length} instruction{review.pass.instructions.length === 1 ? '' : 's'} · {statusLabel(review.outcome.status)}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '5px 8px',
            fontSize: 11,
            color: t.inputText,
            backgroundColor: t.panelSurface,
            border: `1px solid ${t.borderSubtle}`,
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          Close
        </button>
      </div>

      <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
        {review.pass.instructions.map((instruction, index) => {
          const reviewItem = instructionReviewMap.get(instruction.id);
          const plainText = stripMentions(instruction.rawText) || instruction.rawText.trim();
          const draft = review.learningDrafts[instruction.id];
          const isLearningOpen = review.activeLearningInstructionId === instruction.id;

          return (
            <article
              key={instruction.id}
              style={{
                border: `1px solid ${t.borderSubtle}`,
                borderRadius: 10,
                backgroundColor: t.panelSurface,
                padding: 10,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 4 }}>
                    {index + 1}. {instruction.element.label}
                  </div>
                  <div style={{ fontSize: 12, color: t.textPrimary, lineHeight: 1.5 }}>
                    {plainText || 'Action-only instruction'}
                  </div>
                </div>
                <InstructionStatusPill status={reviewItem?.status ?? 'pending'} />
              </div>

              {reviewItem?.learningDraft && (
                <div
                  style={{
                    padding: '8px 9px',
                    backgroundColor: t.accentBg,
                    border: `1px solid ${t.accentBorder}`,
                    borderRadius: 8,
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 10, color: t.accentText, fontWeight: 700 }}>
                    Learning draft
                  </div>
                  <div style={{ fontSize: 12, color: t.textPrimary }}>{reviewItem.learningDraft.title}</div>
                  <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.5 }}>
                    {reviewItem.learningDraft.summary}
                  </div>
                  <div style={{ fontSize: 10, color: t.textMuted }}>
                    learned/{reviewItem.learningDraft.destination}/
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <ActionButton
                  label="Looks good"
                  onClick={() => onMarkInstructionLooksGood(instruction.id)}
                />
                <ActionButton
                  label="Needs another pass"
                  onClick={() => onRequestInstructionFollowUp(instruction.id)}
                />
                <ActionButton
                  label={reviewItem?.learningDraft ? 'Edit learning' : 'Save as learning'}
                  onClick={() => onOpenLearningDraft(instruction.id)}
                />
              </div>

              {isLearningOpen && draft && (
                <div
                  style={{
                    borderTop: `1px solid ${t.borderSubtle}`,
                    paddingTop: 8,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <label style={fieldLabelStyle}>
                    <span style={{ color: t.textSecondary }}>Title</span>
                    <input
                      value={draft.title}
                      onChange={(event) =>
                        onUpdateLearningDraft(instruction.id, { title: event.target.value })
                      }
                      style={inputStyle(t)}
                      placeholder="What should the system remember?"
                    />
                  </label>

                  <label style={fieldLabelStyle}>
                    <span style={{ color: t.textSecondary }}>Distilled lesson</span>
                    <textarea
                      value={draft.summary}
                      onChange={(event) =>
                        onUpdateLearningDraft(instruction.id, { summary: event.target.value })
                      }
                      style={textareaStyle(t)}
                      placeholder="Write the reusable rule, not the literal diff."
                    />
                  </label>

                  <label style={fieldLabelStyle}>
                    <span style={{ color: t.textSecondary }}>Destination</span>
                    <select
                      value={draft.destination}
                      onChange={(event) =>
                        onUpdateLearningDraft(instruction.id, {
                          destination: event.target.value as InstructionLearningDraft['destination'],
                        })
                      }
                      style={inputStyle(t)}
                    >
                      {DEFAULT_LEARNED_FOLDERS.map((folder) => (
                        <option key={folder} value={folder}>
                          learned/{folder}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <ActionButton label="Cancel" onClick={onCancelLearningDraft} />
                    <ActionButton
                      label="Save draft"
                      accent
                      onClick={() => {
                        void onSaveLearningDraft(instruction.id);
                      }}
                    />
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function InstructionStatusPill({
  status,
}: {
  status: 'pending' | 'looks-good' | 'needs-another-pass';
}) {
  const t = useTheme();

  const palette = {
    pending: {
      text: t.textSecondary,
      background: t.panelBg,
      border: t.borderSubtle,
      label: 'Pending',
    },
    'looks-good': {
      text: t.successText,
      background: 'rgba(34, 197, 94, 0.08)',
      border: 'rgba(34, 197, 94, 0.18)',
      label: 'Looks good',
    },
    'needs-another-pass': {
      text: t.errorText,
      background: t.errorBg,
      border: t.errorBorder,
      label: 'Needs another pass',
    },
  } as const;

  const token = palette[status];

  return (
    <div
      style={{
        padding: '4px 7px',
        borderRadius: 999,
        border: `1px solid ${token.border}`,
        backgroundColor: token.background,
        color: token.text,
        fontSize: 10,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}
    >
      {token.label}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  accent = false,
}: {
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  const t = useTheme();

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 9px',
        fontSize: 11,
        fontWeight: 600,
        color: accent ? '#eff6ff' : t.inputText,
        backgroundColor: accent ? 'rgba(37, 99, 235, 0.9)' : t.panelBg,
        border: accent ? 'none' : `1px solid ${t.borderSubtle}`,
        borderRadius: 7,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 5,
  fontSize: 11,
  lineHeight: 1.4,
};

function inputStyle(t: ReturnType<typeof useTheme>): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 9px',
    fontSize: 12,
    color: t.inputText,
    backgroundColor: t.inputBg,
    border: `1px solid ${t.inputBorder}`,
    borderRadius: 8,
    fontFamily: 'inherit',
  };
}

function textareaStyle(t: ReturnType<typeof useTheme>): React.CSSProperties {
  return {
    ...inputStyle(t),
    minHeight: 84,
    resize: 'vertical',
    lineHeight: 1.5,
  };
}
