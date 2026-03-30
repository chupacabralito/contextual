// =============================================================================
// Toolbar (DEPRECATED)
// =============================================================================
// Replaced by SidePanel which unifies the mode toggle, instruction queue,
// and inspect panel into one draggable, collapsible module.
// =============================================================================

import React from 'react';

/** @deprecated Use SidePanel instead. */
export function Toolbar(): React.ReactElement {
  return <div data-contextual="toolbar-deprecated" />;
}
