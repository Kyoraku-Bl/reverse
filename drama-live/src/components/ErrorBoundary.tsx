import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Last line of defence: never show a blank page, always say what broke. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Drama Live Web crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        dir="rtl"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#06060b',
          color: '#e2e8f0',
          fontFamily: 'Cairo, system-ui, sans-serif',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 560, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>وقع خطأ غير متوقع</h1>
          <p style={{ fontSize: 13, opacity: 0.75, marginTop: 8 }}>
           Unexpected error — the app did not start. Details below.
          </p>
          <pre
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              fontSize: 11,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              textAlign: 'left',
              direction: 'ltr',
            }}
          >
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              borderRadius: 12,
              border: 0,
              background: '#e11d48',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            إعادة التحميل · Reload
          </button>
        </div>
      </div>
    );
  }
}
