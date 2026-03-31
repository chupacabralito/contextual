import type { HandoffPayload, SubmitResponse } from '../types.js';
import { addSource } from './sources.js';

export async function submitHandoff(payload: HandoffPayload): Promise<SubmitResponse> {
  const copiedFiles: string[] = [];

  for (const entry of payload.pastedContent) {
    if (!entry.content.trim()) {
      continue;
    }

    const type = entry.suggestedType ?? 'research';
    const result = await addSource(type, {
      content: entry.content,
      label: entry.label,
    });
    copiedFiles.push(result.path);
  }

  return {
    handoffPath: 'filesystem-corpus',
    copiedFiles,
  };
}
