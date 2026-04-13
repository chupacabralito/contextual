import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<Record<string, unknown>>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<Record<string, unknown>>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="shell" style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
