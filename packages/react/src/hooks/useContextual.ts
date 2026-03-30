// =============================================================================
// Main Contextual Hook
// =============================================================================
// Orchestrates the Gate 1 workflow: targeting -> queueing instructions ->
// submitting refinement passes, plus Inspect mode for element history.
// =============================================================================

import { useCallback, useRef, useState } from 'react';
import type {
  AnnotationMode,
  CreatePassRequest,
  Instruction,
  MentionResult,
  Pass,
  PreAttachedSnippet,
  QueuedInstruction,
  ResolutionDepth,
  TargetedElement,
} from '@contextual/shared';
import { parseActions } from '../mentions/parser.js';
import { formatPass } from '../output/formatter.js';
import { useAnnotationQueue } from './useAnnotationQueue.js';

/** Workflow state machine */
export type ContextualState =
  | 'idle'
  | 'targeting'
  | 'annotating'
  | 'inspecting'
  | 'submitted';

interface UseContextualOptions {
  /** Base URL for the local context server */
  serverUrl?: string;
  /** Default resolution depth */
  defaultDepth?: ResolutionDepth;
}

interface UseContextualReturn {
  /** Current workflow state */
  state: ContextualState;
  /** Current interaction mode */
  mode: AnnotationMode;
  /** Update interaction mode */
  setMode: (mode: AnnotationMode) => void;
  /** Start targeting mode */
  startTargeting: () => void;
  /** Cancel and return to idle */
  cancel: () => void;
  /** The currently targeted element */
  targetedElement: TargetedElement | null;
  /** Set element from targeting hook */
  setTargetedElement: (el: TargetedElement) => void;
  /** Current resolution depth */
  depth: ResolutionDepth;
  /** Update resolution depth */
  setDepth: (depth: ResolutionDepth) => void;
  /** Resolve context and add/update an instruction in the queue */
  resolveAndPreview: (annotationText: string) => Promise<void>;
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
  /** Whether context resolution is in progress */
  isResolving: boolean;
  /** Submit the queued pass (formats output for agent) */
  submitPass: () => Promise<void>;
  /** The last annotation text (preserved for back-to-edit) */
  lastAnnotationText: string;
  /** Error message if something went wrong */
  error: string | null;
  /** The formatted structured prompt (available after submit) */
  structuredPrompt: string | null;
}

let instructionCounter = 0;

function buildInstructionId(): string {
  instructionCounter += 1;
  return `instruction_${instructionCounter}_${Date.now()}`;
}

function toPreAttachedContext(resolvedContext: MentionResult[]): PreAttachedSnippet[] {
  return resolvedContext.flatMap((result) =>
    result.matches.map((match) => ({
      type: result.type,
      query: result.query,
      content: match.content,
      source: match.source,
    }))
  );
}

/**
 * Main hook that orchestrates the Contextual annotation workflow.
 */
export function useContextual({
  serverUrl = `http://localhost:4700`,
  defaultDepth = 'standard',
}: UseContextualOptions = {}): UseContextualReturn {
  const [state, setState] = useState<ContextualState>('idle');
  const [mode, setModeState] = useState<AnnotationMode>('instruct');
  const [targetedElement, setTargetedElementState] = useState<TargetedElement | null>(null);
  const [depth, setDepth] = useState<ResolutionDepth>(defaultDepth);
  const [isResolving, setIsResolving] = useState(false);
  const [lastAnnotationText, setLastAnnotationText] = useState('');
  const [editingInstructionId, setEditingInstructionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [structuredPrompt, setStructuredPrompt] = useState<string | null>(null);
  const submitResetTimeoutRef = useRef<number | null>(null);
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
    setIsResolving(false);
  }, []);

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
    resetSurfaceState();
  }, [resetSurfaceState]);

  const setMode = useCallback(
    (nextMode: AnnotationMode) => {
      if (state !== 'idle') {
        return;
      }

      setModeState(nextMode);
      setError(null);
    },
    [state]
  );

  const setTargetedElement = useCallback(
    (el: TargetedElement) => {
      setTargetedElementState(el);
      setError(null);
      setState(mode === 'inspect' ? 'inspecting' : 'annotating');
    },
    [mode]
  );

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
      setDepth(instruction.depth);
      setError(null);
      setState('annotating');
    },
    [queue]
  );

  const removeFromQueue = useCallback(
    (id: string) => {
      removeFromQueueBase(id);

      if (editingInstructionId === id) {
        setEditingInstructionId(null);
        setTargetedElementState(null);
        setLastAnnotationText('');

        if (state === 'annotating') {
          setState('idle');
        }
      }
    },
    [editingInstructionId, removeFromQueueBase, state]
  );

  const clearQueue = useCallback(() => {
    clearQueueBase();

    if (state === 'annotating') {
      setState('idle');
    }

    resetSurfaceState();
  }, [clearQueueBase, resetSurfaceState, state]);

  const resolveAndPreview = useCallback(
    async (annotationText: string) => {
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
      let resolvedContext: MentionResult[] = [];

      if (actions.length > 0) {
        setIsResolving(true);

        try {
          const response = await fetch(`${serverUrl}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mentions: actions.map((action) => ({
                type: action.source,
                query: action.instruction,
              })),
              depth,
            }),
          });

          if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
          }

          const data = (await response.json()) as { results?: MentionResult[] };
          resolvedContext = data.results ?? [];
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Failed to reach context server';
          setError(
            `Could not reach context server at ${serverUrl}. The instruction was queued without pre-attached context. (${message})`
          );
        } finally {
          setIsResolving(false);
        }
      }

      const queuedInstruction: QueuedInstruction = {
        id: existingInstruction?.id ?? buildInstructionId(),
        element: targetedElement,
        rawText,
        actions,
        depth,
        createdAt: existingInstruction?.createdAt ?? new Date().toISOString(),
        resolvedContext,
      };

      if (existingInstruction) {
        updateInstruction(existingInstruction.id, queuedInstruction);
      } else {
        addToQueue(queuedInstruction);
      }

      setStructuredPrompt(null);
      setState('idle');
      resetSurfaceState();
    },
    [
      addToQueue,
      depth,
      editingInstructionId,
      queue,
      resetSurfaceState,
      serverUrl,
      targetedElement,
      updateInstruction,
    ]
  );

  const submitPass = useCallback(async () => {
    if (queue.length === 0) {
      return;
    }

    const timestamp = new Date().toISOString();
    const instructions: Instruction[] = queue.map((queuedInstruction) => ({
      element: queuedInstruction.element,
      rawText: queuedInstruction.rawText,
      actions: queuedInstruction.actions,
      preAttachedContext: toPreAttachedContext(queuedInstruction.resolvedContext),
    }));
    const pass: Pass = {
      id: `pass_${Date.now()}`,
      timestamp,
      depth,
      instructions,
    };

    const prompt = formatPass(queue, depth);
    setStructuredPrompt(prompt);

    try {
      await navigator.clipboard.writeText(prompt);

      const payload: CreatePassRequest = { pass };
      void fetch(`${serverUrl}/passes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Best effort only. Clipboard export is the critical path for the user.
      });

      clearQueueBase();
      setError(null);
      setState('submitted');
      setTargetedElementState(null);
      setLastAnnotationText('');
      setEditingInstructionId(null);

      if (submitResetTimeoutRef.current !== null) {
        window.clearTimeout(submitResetTimeoutRef.current);
      }

      submitResetTimeoutRef.current = window.setTimeout(() => {
        setState('idle');
        setStructuredPrompt(null);
        submitResetTimeoutRef.current = null;
      }, 1500);
    } catch {
      setError('Failed to copy refinement pass to the clipboard');
    }
  }, [clearQueueBase, depth, queue, serverUrl]);

  return {
    state,
    mode,
    setMode,
    startTargeting,
    cancel,
    targetedElement,
    setTargetedElement,
    depth,
    setDepth,
    resolveAndPreview,
    queue,
    queueLength,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    editQueueItem,
    isResolving,
    submitPass,
    lastAnnotationText,
    error,
    structuredPrompt,
  };
}
