// =============================================================================
// Annotation Queue Hook
// =============================================================================
// Queue management for multi-instruction refinement passes.
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import type { QueuedInstruction } from '@contextual/shared';

export interface UseAnnotationQueueReturn {
  queue: QueuedInstruction[];
  addToQueue: (instruction: QueuedInstruction) => void;
  removeFromQueue: (id: string) => void;
  updateInstruction: (id: string, updates: Partial<QueuedInstruction>) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  queueLength: number;
}

export function useAnnotationQueue(): UseAnnotationQueueReturn {
  const [queue, setQueue] = useState<QueuedInstruction[]>([]);

  const addToQueue = useCallback((instruction: QueuedInstruction) => {
    setQueue((current) => [...current, instruction]);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((current) => current.filter((item) => item.id !== id));
  }, []);

  const updateInstruction = useCallback(
    (id: string, updates: Partial<QueuedInstruction>) => {
      setQueue((current) =>
        current.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    []
  );

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((current) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length ||
        fromIndex === toIndex
      ) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);

      if (!moved) {
        return current;
      }

      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const queueLength = useMemo(() => queue.length, [queue]);

  return {
    queue,
    addToQueue,
    removeFromQueue,
    updateInstruction,
    reorderQueue,
    clearQueue,
    queueLength,
  };
}
