// =============================================================================
// Mention Parser Hook
// =============================================================================
// React hook wrapping the parser for use in annotation input components.
// Provides real-time parsing and autocomplete state as the user types.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ParsedAction } from '@contextual/shared';
import { parseActions } from '../mentions/parser.js';

interface UseMentionParserReturn {
  /** Current annotation text */
  text: string;
  /** Update the annotation text */
  setText: (text: string) => void;
  /** Update cursor position (call on every keystroke / selection change) */
  setCursorPosition: (pos: number) => void;
  /** Parsed actions from current text */
  actions: ParsedAction[];
  /** Whether the cursor is inside an @mention being typed */
  isTypingMention: boolean;
  /** Autocomplete suggestions for the current partial mention */
  completions: string[];
  /** The partial text being completed (after @) */
  partialMention: string;
  /** Position of the @ that started the current partial mention (-1 if not typing) */
  mentionStartIndex: number;
}

interface UseMentionParserOptions {
  serverUrl?: string;
}

/**
 * Hook that provides @mention parsing and autocomplete for annotation input.
 */
export function useMentionParser({
  serverUrl = 'http://localhost:4700',
}: UseMentionParserOptions = {}): UseMentionParserReturn {
  const [text, setText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [remoteCompletions, setRemoteCompletions] = useState<string[]>([]);

  const actions = useMemo(() => parseActions(text), [text]);

  // Detect if user is currently typing an @mention
  const { isTypingMention, partialMention, mentionStartIndex } = useMemo(() => {
    // Look backwards from cursor for an unfinished @mention
    const beforeCursor = text.slice(0, cursorPosition);
    const atIndex = beforeCursor.lastIndexOf('@');

    if (atIndex === -1) {
      return { isTypingMention: false, partialMention: '', mentionStartIndex: -1 };
    }

    // Check if there's a completed mention between @ and cursor
    const afterAt = beforeCursor.slice(atIndex + 1);

    // If there's a closing bracket, the mention is complete
    if (afterAt.includes(']')) {
      return { isTypingMention: false, partialMention: '', mentionStartIndex: -1 };
    }

    // Extract the partial type (before the [)
    const bracketIndex = afterAt.indexOf('[');
    const partial = bracketIndex === -1 ? afterAt : afterAt.slice(0, bracketIndex);

    return {
      isTypingMention: true,
      partialMention: partial,
      mentionStartIndex: atIndex,
    };
  }, [text, cursorPosition]);

  useEffect(() => {
    if (!isTypingMention || !partialMention.trim()) {
      setRemoteCompletions([]);
      return;
    }

    const controller = new AbortController();

    async function loadSuggestions() {
      try {
        const params = new URLSearchParams({ partial: partialMention.trim() });
        const response = await fetch(`${serverUrl}/suggest?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = (await response.json()) as {
          suggestions?: Array<{ text: string }>;
        };

        setRemoteCompletions(
          Array.from(
            new Set((data.suggestions ?? []).map((suggestion) => suggestion.text.trim()))
          ).filter(Boolean)
        );
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }

        // Local completions still work; remote tool suggestions are best-effort.
        setRemoteCompletions([]);
      }
    }

    void loadSuggestions();

    return () => controller.abort();
  }, [isTypingMention, partialMention, serverUrl]);

  const completions = remoteCompletions;

  const handleSetText = useCallback((newText: string) => {
    setText(newText);
  }, []);

  return {
    text,
    setText: handleSetText,
    setCursorPosition,
    actions,
    isTypingMention,
    completions,
    partialMention,
    mentionStartIndex,
  };
}
