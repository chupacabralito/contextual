// =============================================================================
// Main Contextual Hook
// =============================================================================
// Orchestrates the full annotation workflow: targeting -> annotating ->
// resolving -> previewing -> submitting pass to agent.
// =============================================================================

import { useCallback, useState } from 'react';
import type {
  Annotation,
  MentionResult,
  ResolutionDepth,
  StructuredOutput,
  TargetedElement,
} from '@contextual/shared';
import { parseMentions } from '../mentions/parser.js';
import { formatOutput } from '../output/formatter.js';

/** Workflow state machine */
export type ContextualState =
  | 'idle'          // Toolbar visible, not targeting
  | 'targeting'     // Waiting for element click/selection
  | 'annotating'    // Element selected, typing annotation
  | 'previewing'    // Context pre-searched, showing preview before submission
  | 'submitted';    // Pass submitted to agent

interface UseContextualOptions {
  /** Base URL for the local context server */
  serverUrl?: string;
  /** Default resolution depth */
  defaultDepth?: ResolutionDepth;
}

interface UseContextualReturn {
  /** Current workflow state */
  state: ContextualState;
  /** Start targeting mode */
  startTargeting: () => void;
  /** Cancel and return to idle */
  cancel: () => void;
  /** Go back to annotating from preview, preserving element + text */
  backToAnnotating: () => void;
  /** The currently targeted element */
  targetedElement: TargetedElement | null;
  /** Set element from targeting hook */
  setTargetedElement: (el: TargetedElement) => void;
  /** Current resolution depth */
  depth: ResolutionDepth;
  /** Update resolution depth */
  setDepth: (depth: ResolutionDepth) => void;
  /** Pre-search local context and show preview */
  resolveAndPreview: (annotationText: string) => Promise<void>;
  /** Pre-searched local context results */
  resolvedContext: MentionResult[];
  /** Whether pre-search is in progress */
  isResolving: boolean;
  /** Submit the structured pass (formats output for agent) */
  submitPass: () => Promise<void>;
  /** The current annotation (after resolve) */
  currentAnnotation: Annotation | null;
  /** The last annotation text (preserved for back-to-edit) */
  lastAnnotationText: string;
  /** Error message if something went wrong */
  error: string | null;
  /** The formatted structured prompt (available after submit) */
  structuredPrompt: string | null;
}

let annotationCounter = 0;

/**
 * Main hook that orchestrates the Contextual annotation workflow.
 */
export function useContextual({
  serverUrl = `http://localhost:4700`,
  defaultDepth = 'standard',
}: UseContextualOptions = {}): UseContextualReturn {
  const [state, setState] = useState<ContextualState>('idle');
  const [targetedElement, setTargetedElementState] = useState<TargetedElement | null>(null);
  const [depth, setDepth] = useState<ResolutionDepth>(defaultDepth);
  const [resolvedContext, setResolvedContext] = useState<MentionResult[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [lastAnnotationText, setLastAnnotationText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [structuredPrompt, setStructuredPrompt] = useState<string | null>(null);

  const startTargeting = useCallback(() => {
    setState('targeting');
    setTargetedElementState(null);
    setResolvedContext([]);
    setCurrentAnnotation(null);
    setLastAnnotationText('');
    setError(null);
    setStructuredPrompt(null);
  }, []);

  const cancel = useCallback(() => {
    setState('idle');
    setTargetedElementState(null);
    setResolvedContext([]);
    setCurrentAnnotation(null);
    setLastAnnotationText('');
    setError(null);
    setStructuredPrompt(null);
  }, []);

  // Go back to annotating from preview -- preserves element and annotation text
  const backToAnnotating = useCallback(() => {
    setState('annotating');
    setResolvedContext([]);
    setError(null);
    // targetedElement and lastAnnotationText are preserved
  }, []);

  const setTargetedElement = useCallback((el: TargetedElement) => {
    setTargetedElementState(el);
    setState('annotating');
  }, []);

  const resolveAndPreview = useCallback(
    async (annotationText: string) => {
      if (!targetedElement) return;

      setLastAnnotationText(annotationText);
      const mentions = parseMentions(annotationText);

      // Build the annotation object
      const annotation: Annotation = {
        id: `ann_${++annotationCounter}_${Date.now()}`,
        element: targetedElement,
        rawText: annotationText,
        mentions,
        depth,
        createdAt: new Date().toISOString(),
      };

      setCurrentAnnotation(annotation);

      // If no @mentions, skip pre-search -- just go to preview with no context
      if (mentions.length === 0) {
        setResolvedContext([]);
        setState('previewing');
        return;
      }

      // Pre-search local context via the server
      setIsResolving(true);
      setError(null);

      try {
        const response = await fetch(`${serverUrl}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mentions: mentions.map((m) => ({ type: m.type, query: m.query })),
            depth,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        setResolvedContext(data.results);
        setState('previewing');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to reach context server';
        setError(
          `Could not reach context server at ${serverUrl}. Is it running? (${message})`
        );
        // Still show preview -- designer can submit without pre-attached context
        setResolvedContext([]);
        setState('previewing');
      } finally {
        setIsResolving(false);
      }
    },
    [targetedElement, depth, serverUrl]
  );

  // Submit the structured pass for the agent
  const submitPass = useCallback(async () => {
    if (!currentAnnotation) return;

    const output: StructuredOutput = {
      annotation: currentAnnotation,
      resolvedContext,
      depth,
    };

    const prompt = formatOutput(output);
    setStructuredPrompt(prompt);

    try {
      await navigator.clipboard.writeText(prompt);
      setState('submitted');

      // Reset after a brief moment
      setTimeout(() => {
        setState('idle');
        setTargetedElementState(null);
        setResolvedContext([]);
        setCurrentAnnotation(null);
        setLastAnnotationText('');
        setStructuredPrompt(null);
      }, 1500);
    } catch {
      setError('Failed to copy structured prompt');
    }
  }, [currentAnnotation, resolvedContext, depth]);

  return {
    state,
    startTargeting,
    cancel,
    backToAnnotating,
    targetedElement,
    setTargetedElement,
    depth,
    setDepth,
    resolveAndPreview,
    resolvedContext,
    isResolving,
    submitPass,
    currentAnnotation,
    lastAnnotationText,
    error,
    structuredPrompt,
  };
}
