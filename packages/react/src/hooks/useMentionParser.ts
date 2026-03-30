// =============================================================================
// Mention Parser Hook
// =============================================================================
// React hook wrapping the parser for use in annotation input components.
// Provides real-time parsing and autocomplete state as the user types.
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import type { ContextType, ParsedMention } from '@contextual/shared';
import { parseMentions, getTypeCompletions } from '../mentions/parser.js';

interface UseMentionParserReturn {
  /** Current annotation text */
  text: string;
  /** Update the annotation text */
  setText: (text: string) => void;
  /** Update cursor position (call on every keystroke / selection change) */
  setCursorPosition: (pos: number) => void;
  /** Parsed mentions from current text */
  mentions: ParsedMention[];
  /** Whether the cursor is inside an @mention being typed */
  isTypingMention: boolean;
  /** Autocomplete suggestions for the current partial mention */
  completions: ContextType[];
  /** The partial text being completed (after @) */
  partialMention: string;
  /** Position of the @ that started the current partial mention (-1 if not typing) */
  mentionStartIndex: number;
}

/**
 * Hook that provides @mention parsing and autocomplete for annotation input.
 */
export function useMentionParser(): UseMentionParserReturn {
  const [text, setText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  const mentions = useMemo(() => parseMentions(text), [text]);

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

  const completions = useMemo(
    () => (isTypingMention ? getTypeCompletions(partialMention) : []),
    [isTypingMention, partialMention]
  );

  const handleSetText = useCallback((newText: string) => {
    setText(newText);
  }, []);

  return {
    text,
    setText: handleSetText,
    setCursorPosition,
    mentions,
    isTypingMention,
    completions,
    partialMention,
    mentionStartIndex,
  };
}
