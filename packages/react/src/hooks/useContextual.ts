// =============================================================================
// Main Contextual Hook
// =============================================================================
// Orchestrates the annotation workflow: targeting -> queueing instructions ->
// submitting refinement passes, plus Inspect mode for element history.
//
// Refined: No depth selector, no pre-resolution. Passes store raw instructions
// with @tool[query] action references. Context is read by the agent at
// execution time, not baked in at annotation time.
// =============================================================================

import { useCallback, useRef, useState } from 'react';
import type {
  AnnotationMode,
  CreatePassRequest,
  Instruction,
  Pass,
  QueuedInstruction,
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

function buildInstructionId(): string {
  instructionCounter += 1;
  return `instruction_${instructionCounter}_${Date.now()}`;
}

/**
 * Main hook that orchestrates the Contextual annotation workflow.
 */
export function useContextual({
  serverUrl = `http://localhost:4700`,
}: UseContextualOptions = {}): UseContextualReturn {
  const [state, setState] = useState<ContextualState>('idle');
  const [mode, setModeState] = useState<AnnotationMode>('instruct');
  const [targetedElement, setTargetedElementState] = useState<TargetedElement | null>(null);
  const [lastAnnotationText, setLastAnnotationText] = useState('');
  const [editingInstructionId, setEditingInstructionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [structuredPrompt, setStructuredPrompt] = useState<string | null>(null);
  const submitResetTimeoutRef = useRef<number | null>(null);

  // Inspect stack: accumulates inspected elements during inspect session
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
    resetSurfaceState();
  }, [resetSurfaceState]);

  // Setting a mode immediately starts targeting (items 4 + 5)
  const setMode = useCallback(
    (nextMode: AnnotationMode) => {
      setModeState(nextMode);
      setError(null);
      setStructuredPrompt(null);
      setInspectStack([]);
      resetSurfaceState();
      setState('targeting');
    },
    [resetSurfaceState]
  );

  const setTargetedElement = useCallback(
    (el: TargetedElement) => {
      setError(null);

      if (mode === 'inspect') {
        // Append to inspect stack and stay in targeting for the next click
        setInspectStack((prev) => [...prev, el]);
        setTargetedElementState(null);
        setState('targeting');
      } else {
        setTargetedElementState(el);
        setState('annotating');
      }
    },
    [mode]
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
          setState('targeting');
        }
      }
    },
    [editingInstructionId, removeFromQueueBase, state]
  );

  const clearQueue = useCallback(() => {
    clearQueueBase();

    if (state === 'annotating') {
      setState('targeting');
    }

    resetSurfaceState();
  }, [clearQueueBase, resetSurfaceState, state]);

  // Queue an instruction: parse actions from text, no server resolution.
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
      // Return to targeting so user can immediately click the next element
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
      preAttachedContext: [], // No pre-resolution; agent reads context at execution time
    }));
    const pass: Pass = {
      id: `pass_${Date.now()}`,
      timestamp,
      instructions,
    };

    const prompt = formatPass(queue);
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
  }, [clearQueueBase, queue, serverUrl]);

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
    lastAnnotationText,
    error,
    structuredPrompt,
    inspectStack,
    removeFromInspectStack,
    clearInspectStack,
  };
}
