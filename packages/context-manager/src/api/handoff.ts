import type { HandoffPayload, SubmitResponse } from '../types.js';

export async function submitHandoff(payload: HandoffPayload): Promise<SubmitResponse> {
  const response = await fetch('/api/handoff', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to submit handoff');
  }

  return response.json() as Promise<SubmitResponse>;
}
