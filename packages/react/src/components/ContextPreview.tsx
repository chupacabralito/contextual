// =============================================================================
// Context Preview Panel (DEPRECATED)
// =============================================================================
// This component is no longer used. The pre-resolution flow was removed in
// favor of queue-based annotation passes where the agent reads context at
// execution time rather than having it pre-attached during annotation.
// =============================================================================
//
// Kept for reference. Can be safely deleted.
// =============================================================================

import React from 'react';

/** @deprecated No longer part of the annotation flow. */
export function ContextPreview(): React.ReactElement {
  return <div data-contextual="preview-deprecated" />;
}
