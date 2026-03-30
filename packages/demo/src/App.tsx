import React from 'react';
import { ContextualProvider } from '@contextual/react';
import { MockCheckout } from './MockCheckout.js';

/**
 * Demo app wrapping a sample checkout UI in ContextualProvider.
 * Uses hardcoded mock server URL -- the annotation workflow can be tested
 * with the real server or without (graceful fallback on server errors).
 */
export function App() {
  return (
    <ContextualProvider serverUrl="http://localhost:4700" defaultDepth="standard">
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px' }}>
        <header style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Contextual Demo
          </h1>
          <p style={{ color: '#6e6e73', fontSize: 14, lineHeight: 1.6 }}>
            This is a sample checkout prototype. Use the bottom-right control or press{' '}
            <kbd style={kbdStyle}>Cmd+Shift+A</kbd> to target an element. Instruct mode
            queues multiple refinement instructions into a single pass, while Inspect
            mode shows any saved history for an element. Local repositories still
            autocomplete, but you can also type actions like{' '}
            <code style={codeStyle}>@research[checkout friction]</code> or{' '}
            <code style={codeStyle}>@posthog[find checkout dropoff evidence]</code>.
          </p>
        </header>

        <MockCheckout />
      </div>
    </ContextualProvider>
  );
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  fontSize: 12,
  fontFamily: '"SF Mono", Menlo, monospace',
  backgroundColor: '#e8e8ed',
  border: '1px solid #d2d2d7',
  borderRadius: 4,
};

const codeStyle: React.CSSProperties = {
  padding: '2px 5px',
  fontSize: 13,
  fontFamily: '"SF Mono", Menlo, monospace',
  backgroundColor: '#e8e8ed',
  borderRadius: 3,
};
