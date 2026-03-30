import { useCallback, useEffect, useState } from 'react';
import { fetchTools, saveTools } from '../api/tools.js';
import type { ConfiguredTool } from '../types.js';

export function useTools() {
  const [tools, setTools] = useState<ConfiguredTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const data = await fetchTools();
        if (!active) return;
        setTools(data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load tools');
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const updateTools = useCallback(async (nextTools: ConfiguredTool[]) => {
    setIsSaving(true);
    setError(null);
    try {
      const saved = await saveTools(nextTools);
      setTools(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tools');
    } finally {
      setIsSaving(false);
    }
  }, []);

  const toggleTool = useCallback(
    (name: string) => {
      const next = tools.map((t) =>
        t.name === name ? { ...t, enabled: !t.enabled } : t
      );
      void updateTools(next);
    },
    [tools, updateTools]
  );

  const addTool = useCallback(
    (name: string, label: string) => {
      if (tools.some((t) => t.name === name)) {
        setError(`Tool "${name}" already exists`);
        return;
      }
      const next = [...tools, { name, label, enabled: true }];
      void updateTools(next);
    },
    [tools, updateTools]
  );

  const removeTool = useCallback(
    (name: string) => {
      const next = tools.filter((t) => t.name !== name);
      void updateTools(next);
    },
    [tools, updateTools]
  );

  return { tools, isLoading, isSaving, error, toggleTool, addTool, removeTool };
}
