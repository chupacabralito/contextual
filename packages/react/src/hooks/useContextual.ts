// =============================================================================
// Main Contextual Hook
// =============================================================================
// Orchestrates the annotation workflow: targeting -> queueing instructions ->
// submitting refinement passes, plus Inspect mode for element history and a
// transient post-pass Review drawer.
//
// Refined: No depth selector, no pre-resolution. Passes store raw instructions
// with @tool[query] action references. Context is read by the agent at
// execution time, not baked in at annotation time.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AnnotationMode,
  ContextType,
  CreateOutcomeRequest,
  CreatePassResponse,
  CreatePassRequest,
  Instruction,
  InstructionLearningDraft,
  InstructionReview,
  Pass,
  PassOutcome,
  QueuedInstruction,
  TargetedElement,
} from '@contextualapp/shared';
import { DEFAULT_LEARNED_FOLDERS, isContextType } from '@contextualapp/shared';
import { parseActions, stripMentions } from '../mentions/parser.js';
import { formatPass } from '../output/formatter.js';
import { useAnnotationQueue } from './useAnnotationQueue.js';

/** Workflow state machine */
export type ContextualState =
  | 'idle'
  | 'targeting'
  | 'annotating'
  | 'inspecting'
  | 'reviewing';

export interface ReviewDrawerState {
  /** The latest submitted pass being reviewed */
  pass: Pass;
  /** Persisted outcome record backing this review */
  outcome: PassOutcome;
  /** Whether the review drawer is currently visible */
  isOpen: boolean;
  /** Which instruction currently has the learning form open */
  activeLearningInstructionId: string | null;
  /** Unsaved local drafts keyed by instruction ID */
  learningDrafts: Record<string, InstructionLearningDraft>;
}

interface UseContextualOptions {
  /** Base URL for the local context server */
  serverUrl?: string;
  /** Optional project identifier to stamp onto passes and outcomes */
  project?: string;
  /** Optional context types known to be loaded for the current session/page */
  affectedContextTypes?: ContextType[];
  /** Optional relative corpus paths loaded for the current session/page */
  loadedContextPaths?: string[];
}

interface UseContextualReturn {
  /** Current workflow state */
  state: ContextualState;
  /** Current interaction mode */
  mode: AnnotationMode;
  /** Update interaction mode (also starts targeting immediately) */
  setMode: (mode: AnnotationMode) => void;
  /** Start targeting mode */
  startTargeting: () => void;
  /** Cancel and return to idle */
  cancel: () => void;
  /** The currently targeted element */
  targetedElement: TargetedElement | null;
  /** Set element from targeting hook */
  setTargetedElement: (el: TargetedElement) => void;
  /** Queue an instruction (no pre-resolution, just parse and queue) */
  queueInstruction: (annotationText: string) => void;
  /** Queue of instructions being prepared for the next pass */
  queue: QueuedInstruction[];
  /** Number of queued instructions */
  queueLength: number;
  /** Remove a queued instruction */
  removeFromQueue: (id: string) => void;
  /** Reorder queued instructions */
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  /** Clear the queue */
  clearQueue: () => void;
  /** Re-open a queued instruction for editing */
  editQueueItem: (id: string) => void;
  /** Submit the queued pass (formats output for agent) */
  submitPass: () => Promise<void>;
  /** The latest review drawer state, if any */
  review: ReviewDrawerState | null;
  /** Close the current review drawer */
  closeReview: () => void;
  /** Mark an instruction result as good */
  markInstructionLooksGood: (instructionId: string) => void;
  /** Reopen an instruction as a follow-up pass */
  requestInstructionFollowUp: (instructionId: string) => void;
  /** Open the learning form for a specific instruction */
  openLearningDraft: (instructionId: string) => void;
  /** Close the learning form for a specific instruction */
  cancelLearningDraft: () => void;
  /** Update a draft learning field */
  updateLearningDraft: (
    instructionId: string,
    patch: Partial<InstructionLearningDraft>
  ) => void;
  /** Persist a draft learning onto the reviewed instruction */
  saveLearningDraft: (instructionId: string) => Promise<void>;
  /** The last annotation text (preserved for back-to-edit) */
  lastAnnotationText: string;
  /** Error message if something went wrong */
  error: string | null;
  /** The formatted structured prompt (available after submit) */
  structuredPrompt: string | null;
  /** Stack of elements being inspected */
  inspectStack: TargetedElement[];
  /** Remove an element from the inspect stack by index */
  removeFromInspectStack: (index: number) => void;
  /** Clear all elements from the inspect stack */
  clearInspectStack: () => void;
}

let instructionCounter = 0;
let outcomeCounter = 0;

function buildInstructionId(): string {
  instructionCounter += 1;
  return `instruction_${instructionCounter}_${Date.now()}`;
}

function buildOutcomeId(): string {
  outcomeCounter += 1;
  return `outcome_${outcomeCounter}_${Date.now()}`;
}

function deriveAffectedContextTypes(
  queue: QueuedInstruction[],
  configuredTypes: ContextType[],
): ContextType[] {
  const types = new Set<ContextType>(configuredTypes);

  for (const instruction of queue) {
    for (const action of instruction.actions) {
      if (isContextType(action.source)) {
        types.add(action.source);
      }
    }
  }

  return Array.from(types);
}

function buildInstructionReviews(instructions: Instruction[]): InstructionReview[] {
  return instructions.map((instruction) => ({
    instructionId: instruction.id,
    elementLabel: instruction.element.label,
    rawText: instruction.rawText,
    status: 'pending',
  }));
}

function buildOutcomeFeedback(instructionReviews: InstructionReview[]): string | undefined {
  const notes = instructionReviews
    .filter((review) => review.feedback?.trim())
    .map((review) => `${review.elementLabel}: ${review.feedback!.trim()}`);

  return notes.length > 0 ? notes.join('\n') : undefined;
}

function buildOutcomeSummary(instructionReviews: InstructionReview[]): string {
  if (instructionReviews.length === 0) {
    return 'Awaiting review.';
  }

  const pendingCount = instructionReviews.filter((review) => review.status === 'pending').length;
  const looksGoodCount = instructionReviews.filter((review) => review.status === 'looks-good').length;
  const followUpCount = instructionReviews.filter(
    (review) => review.status === 'needs-another-pass',
  ).length;
  const learningCount = instructionReviews.filter((review) => review.learningDraft).length;

  const parts: string[] = [];
  if (looksGoodCount > 0) {
    parts.push(`${looksGoodCount} look${looksGoodCount === 1 ? 's' : ''} good`);
  }
  if (followUpCount > 0) {
    parts.push(`${followUpCount} need${followUpCount === 1 ? 's' : ''} another pass`);
  }
  if (learningCount > 0) {
    parts.push(`${learningCount} saved as learning`);
  }
  if (pendingCount > 0) {
    parts.push(`${pendingCount} pending review`);
  }

  return parts.length > 0 ? parts.join(', ') : 'Awaiting review.';
}

function buildOutcomeStatus(instructionReviews: InstructionReview[]): PassOutcome['status'] {
  if (instructionReviews.length === 0) {
    return 'pending';
  }

  const pendingCount = instructionReviews.filter((review) => review.status === 'pending').length;
  if (pendingCount === instructionReviews.length) {
    return 'pending';
  }

  const followUpCount = instructionReviews.filter(
    (review) => review.status === 'needs-another-pass',
  ).length;
  const learningCount = instructionReviews.filter((review) => review.learningDraft).length;

  if (followUpCount === instructionReviews.length) {
    return 'rejected';
  }

  if (followUpCount > 0 || learningCount > 0) {
    return 'approved-with-feedback';
  }

  return 'approved';
}

function buildDefaultLearningDraft(instruction: Instruction): InstructionLearningDraft {
  const summary = stripMentions(instruction.rawText) || instruction.rawText.trim();
  return {
    title: instruction.element.label,
    summary,
    destination: 'ui-patterns',
  };
}

function buildInitialOutcome(
  pass: Pass,
  timestamp: string,
): PassOutcome {
  const instructionReviews = buildInstructionReviews(pass.instructions);

  return {
    id: buildOutcomeId(),
    passId: pass.id,
    timestamp,
    status: 'pending',
    project: pass.project,
    affectedContextTypes: pass.affectedContextTypes,
    loadedContextPaths: pass.loadedContextPaths,
    summary: buildOutcomeSummary(instructionReviews),
    feedback: buildOutcomeFeedback(instructionReviews),
    instructionReviews,
    changedFiles: [],
    writebacks: [],
  };
}

function withDerivedOutcomeFields(outcome: PassOutcome): PassOutcome {
  const instructionReviews = Array.isArray(outcome.instructionReviews)
    ? outcome.instructionReviews
    : [];

  return {
    ...outcome,
    instructionReviews,
    status: buildOutcomeStatus(instructionReviews),
    summary: buildOutcomeSummary(instructionReviews),
    feedback: buildOutcomeFeedback(instructionReviews),
  };
}

function serializeOutcome(outcome: PassOutcome): string {
  return JSON.stringify(withDerivedOutcomeFields(outcome));
}

/**
 * Main hook that orchestrates the Contextual annotation workflow.
 */
export function useContextual({
  serverUrl = `http://localhost:4700`,
  project,
  affectedContextTypes = [],
  loadedContextPaths = [],
}: UseContextualOptions = {}): UseContextualReturn {
  const [state, setState] = useState<ContextualState>('idle');
  const [mode, setModeState] = useState<AnnotationMode>('instruct');
  const [targetedElement, setTargetedElementState] = useState<TargetedElement | null>(null);
  const [lastAnnotationText, setLastAnnotationText] = useState('');
  const [editingInstructionId, setEditingInstructionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [structuredPrompt, setStructuredPrompt] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewDrawerState | null>(null);
  const reviewSignatureRef = useRef<string | null>(null);

  const [inspectStack, setInspectStack] = useState<TargetedElement[]>([]);
  const {
    queue,
    addToQueue,
    removeFromQueue: removeFromQueueBase,
    updateInstruction,
    reorderQueue,
    clearQueue: clearQueueBase,
    queueLength,
  } = useAnnotationQueue();

  const resetSurfaceState = useCallback(() => {
    setTargetedElementState(null);
    setLastAnnotationText('');
    setEditingInstructionId(null);
  }, []);

  const persistOutcome = useCallback(
    async (outcome: PassOutcome) => {
      const payload: CreateOutcomeRequest = {
        outcome: withDerivedOutcomeFields(outcome),
      };

      const response = await fetch(`${serverUrl}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Outcome persistence failed: ${response.status}`);
      }
    },
    [serverUrl],
  );

  const fetchLatestOutcomeForPass = useCallback(
    async (passId: string): Promise<PassOutcome | null> => {
      const response = await fetch(`${serverUrl}/passes/${encodeURIComponent(passId)}/outcome`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Latest outcome fetch failed: ${response.status}`);
      }

      const outcome = (await response.json()) as PassOutcome;
      return withDerivedOutcomeFields(outcome);
    },
    [serverUrl],
  );

  const updateReviewOutcome = useCallback(
    (
      updater: (current: ReviewDrawerState) => ReviewDrawerState,
      options: { persist?: boolean } = { persist: true },
    ) => {
      // Capture the next state outside the React state updater to avoid
      // firing async work (persistence) inside a setState callback, which
      // can race with subsequent rapid updates.
      let nextOutcome: PassOutcome | null = null;

      setReview((current) => {
        if (!current) return current;
        const next = updater(current);
        nextOutcome = next.outcome;
        return next;
      });

      if (options.persist !== false && nextOutcome) {
        void persistOutcome(nextOutcome).catch(() => {
          setError('Failed to persist review state');
        });
      }
    },
    [persistOutcome],
  );

  useEffect(() => {
    reviewSignatureRef.current = review ? serializeOutcome(review.outcome) : null;
  }, [review]);

  useEffect(() => {
    if (!review) {
      return;
    }

    let isCancelled = false;

    const syncLatestOutcome = async () => {
      try {
        const latestOutcome = await fetchLatestOutcomeForPass(review.pass.id);
        if (!latestOutcome || isCancelled) {
          return;
        }

        const nextSignature = serializeOutcome(latestOutcome);
        if (reviewSignatureRef.current === nextSignature) {
          return;
        }

        reviewSignatureRef.current = nextSignature;
        setReview((current) => {
          if (!current || current.pass.id !== review.pass.id) {
            return current;
          }

          return {
            ...current,
            outcome: latestOutcome,
            isOpen: true,
          };
        });
      } catch {
        // Keep polling quietly; transient errors should not disrupt local review.
      }
    };

    void syncLatestOutcome();
    const intervalId = window.setInterval(() => {
      void syncLatestOutcome();
    }, 1500);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [fetchLatestOutcomeForPass, review]);

  const startTargeting = useCallback(() => {
    setState('targeting');
    setError(null);
    setStructuredPrompt(null);
    resetSurfaceState();
  }, [resetSurfaceState]);

  const cancel = useCallback(() => {
    setState('idle');
    setError(null);
    setStructuredPrompt(null);
    setInspectStack([]);
    setReview(null);
    resetSurfaceState();
  }, [resetSurfaceState]);

  const setMode = useCallback(
    (nextMode: AnnotationMode) => {
      setModeState(nextMode);
      setError(null);
      setStructuredPrompt(null);
      setInspectStack([]);
      resetSurfaceState();
      setState('targeting');
    },
    [resetSurfaceState],
  );

  const setTargetedElement = useCallback(
    (el: TargetedElement) => {
      setError(null);

      if (mode === 'inspect') {
        setInspectStack((prev) => [...prev, el]);
        setTargetedElementState(null);
        setState('targeting');
      } else {
        setTargetedElementState(el);
        setState('annotating');
      }
    },
    [mode],
  );

  const removeFromInspectStack = useCallback((index: number) => {
    setInspectStack((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearInspectStack = useCallback(() => {
    setInspectStack([]);
  }, []);

  const editQueueItem = useCallback(
    (id: string) => {
      const instruction = queue.find((item) => item.id === id);

      if (!instruction) {
        return;
      }

      setModeState('instruct');
      setEditingInstructionId(id);
      setTargetedElementState(instruction.element);
      setLastAnnotationText(instruction.rawText);
      setError(null);
      setState('annotating');
    },
    [queue],
  );

  const removeFromQueue = useCallback(
    (id: string) => {
      removeFromQueueBase(id);

      if (editingInstructionId === id) {
        setEditingInstructionId(null);
        setTargetedElementState(null);
        setLastAnnotationText('');

        if (state === 'annotating') {
          setState('targeting');
        }
      }
    },
    [editingInstructionId, removeFromQueueBase, state],
  );

  const clearQueue = useCallback(() => {
    clearQueueBase();

    if (state === 'annotating') {
      setState('targeting');
    }

    resetSurfaceState();
  }, [clearQueueBase, resetSurfaceState, state]);

  const queueInstruction = useCallback(
    (annotationText: string) => {
      if (!targetedElement) {
        return;
      }

      const rawText = annotationText.trim();
      const actions = parseActions(rawText);
      const existingInstruction = editingInstructionId
        ? queue.find((item) => item.id === editingInstructionId)
        : null;

      setLastAnnotationText(rawText);
      setError(null);

      const queuedInstruction: QueuedInstruction = {
        id: existingInstruction?.id ?? buildInstructionId(),
        element: targetedElement,
        rawText,
        actions,
        createdAt: existingInstruction?.createdAt ?? new Date().toISOString(),
      };

      if (existingInstruction) {
        updateInstruction(existingInstruction.id, queuedInstruction);
      } else {
        addToQueue(queuedInstruction);
      }

      setStructuredPrompt(null);
      setState('targeting');
      resetSurfaceState();
    },
    [
      addToQueue,
      editingInstructionId,
      queue,
      resetSurfaceState,
      targetedElement,
      updateInstruction,
    ],
  );

  const submitPass = useCallback(async () => {
    if (queue.length === 0) {
      return;
    }

    const timestamp = new Date().toISOString();
    const instructions: Instruction[] = queue.map((queuedInstruction) => ({
      id: queuedInstruction.id,
      element: queuedInstruction.element,
      rawText: queuedInstruction.rawText,
      actions: queuedInstruction.actions,
      preAttachedContext: [],
    }));

    const pass: Pass = {
      id: `pass_${Date.now()}`,
      timestamp,
      project,
      affectedContextTypes: deriveAffectedContextTypes(queue, affectedContextTypes),
      loadedContextPaths: [...loadedContextPaths],
      instructions,
    };

    const prompt = formatPass(queue);
    const initialOutcome = buildInitialOutcome(pass, new Date().toISOString());

    setStructuredPrompt(prompt);

    try {
      let nextError: string | null = null;

      const passPayload: CreatePassRequest = { pass };
      const passResponse = await fetch(`${serverUrl}/passes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passPayload),
      });
      if (!passResponse.ok) {
        throw new Error(`Pass persistence failed: ${passResponse.status}`);
      }
      const persistedPass = (await passResponse.json()) as CreatePassResponse;

      try {
        await persistOutcome(initialOutcome);
      } catch {
        nextError = 'Pass persisted, but failed to initialize review state';
      }

      try {
        // navigator.clipboard requires a secure context (HTTPS or localhost).
        // Fall back to execCommand for HTTP dev environments.
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(prompt);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = prompt;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
      } catch {
        nextError = nextError ?? 'Pass persisted, but failed to copy the prompt to the clipboard';
      }

      setReview({
        pass,
        outcome: initialOutcome,
        isOpen: true,
        activeLearningInstructionId: null,
        learningDrafts: {},
      });

      clearQueueBase();
      setState('reviewing');
      setTargetedElementState(null);
      setLastAnnotationText('');
      setEditingInstructionId(null);
      setStructuredPrompt(`Saved ${persistedPass.id}\n\n${prompt}`);
      setError(nextError);
    } catch {
      setError('Failed to persist refinement pass locally');
    }
  }, [
    affectedContextTypes,
    clearQueueBase,
    loadedContextPaths,
    persistOutcome,
    project,
    queue,
    serverUrl,
  ]);

  const closeReview = useCallback(() => {
    setReview((current) => (current ? { ...current, isOpen: false } : current));
    if (state === 'reviewing') {
      setState('idle');
    }
  }, [state]);

  const markInstructionLooksGood = useCallback(
    (instructionId: string) => {
      updateReviewOutcome((current) => {
        const nextReviews = current.outcome.instructionReviews?.map((reviewItem) =>
          reviewItem.instructionId === instructionId
            ? {
                ...reviewItem,
                status: 'looks-good' as const,
                reviewedAt: new Date().toISOString(),
              }
            : reviewItem
        ) ?? [];

        return {
          ...current,
          outcome: withDerivedOutcomeFields({
            ...current.outcome,
            instructionReviews: nextReviews,
          }),
        };
      });
    },
    [updateReviewOutcome],
  );

  const requestInstructionFollowUp = useCallback(
    (instructionId: string) => {
      if (!review) return;

      const instruction = review.pass.instructions.find((item) => item.id === instructionId);
      if (!instruction) return;

      updateReviewOutcome((current) => {
        const nextReviews = current.outcome.instructionReviews?.map((reviewItem) =>
          reviewItem.instructionId === instructionId
            ? {
                ...reviewItem,
                status: 'needs-another-pass' as const,
                reviewedAt: new Date().toISOString(),
              }
            : reviewItem
        ) ?? [];

        return {
          ...current,
          outcome: withDerivedOutcomeFields({
            ...current.outcome,
            instructionReviews: nextReviews,
          }),
        };
      });

      setModeState('instruct');
      setTargetedElementState(instruction.element);
      setLastAnnotationText(instruction.rawText);
      setError(null);
      setState('annotating');
    },
    [review, updateReviewOutcome],
  );

  const openLearningDraft = useCallback(
    (instructionId: string) => {
      if (!review) return;

      const instruction = review.pass.instructions.find((item) => item.id === instructionId);
      if (!instruction) return;

      setReview((current) => {
        if (!current) return current;

        return {
          ...current,
          activeLearningInstructionId: instructionId,
          learningDrafts: {
            ...current.learningDrafts,
            [instructionId]:
              current.learningDrafts[instructionId] ?? buildDefaultLearningDraft(instruction),
          },
        };
      });
    },
    [review],
  );

  const cancelLearningDraft = useCallback(() => {
    setReview((current) =>
      current
        ? {
            ...current,
            activeLearningInstructionId: null,
          }
        : current
    );
  }, []);

  const updateLearningDraft = useCallback(
    (instructionId: string, patch: Partial<InstructionLearningDraft>) => {
      setReview((current) => {
        if (!current) return current;

        const existingDraft = current.learningDrafts[instructionId];
        if (!existingDraft) return current;

        return {
          ...current,
          learningDrafts: {
            ...current.learningDrafts,
            [instructionId]: {
              ...existingDraft,
              ...patch,
            },
          },
        };
      });
    },
    [],
  );

  const saveLearningDraft = useCallback(
    async (instructionId: string) => {
      if (!review) return;

      const draft = review.learningDrafts[instructionId];
      if (!draft) return;

      const title = draft.title.trim();
      const summary = draft.summary.trim();

      if (!title || !summary) {
        setError('Learning drafts need both a title and summary');
        return;
      }

      const validDestinations: readonly string[] = DEFAULT_LEARNED_FOLDERS;
      if (!validDestinations.includes(draft.destination)) {
        setError(`Invalid learning destination: ${draft.destination}`);
        return;
      }

      setError(null);

      updateReviewOutcome((current) => {
        const nextReviews = current.outcome.instructionReviews?.map((reviewItem) =>
          reviewItem.instructionId === instructionId
            ? {
                ...reviewItem,
                status: 'looks-good' as const,
                learningDraft: {
                  ...draft,
                  title,
                  summary,
                },
                reviewedAt: new Date().toISOString(),
              }
            : reviewItem
        ) ?? [];

        return {
          ...current,
          activeLearningInstructionId: null,
          outcome: withDerivedOutcomeFields({
            ...current.outcome,
            instructionReviews: nextReviews,
          }),
        };
      });
    },
    [review, updateReviewOutcome],
  );

  return {
    state,
    mode,
    setMode,
    startTargeting,
    cancel,
    targetedElement,
    setTargetedElement,
    queueInstruction,
    queue,
    queueLength,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    editQueueItem,
    submitPass,
    review,
    closeReview,
    markInstructionLooksGood,
    requestInstructionFollowUp,
    openLearningDraft,
    cancelLearningDraft,
    updateLearningDraft,
    saveLearningDraft,
    lastAnnotationText,
    error,
    structuredPrompt,
    inspectStack,
    removeFromInspectStack,
    clearInspectStack,
  };
}
