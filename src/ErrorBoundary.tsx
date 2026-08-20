import { Component, type ReactNode } from "react";

/// Catches any render-time exception from the tree below and shows a plain
/// fallback instead of a white page. The reload button uses history.go(0)
/// rather than window.location.reload() because the latter is deprecated on
/// some engines and the harness treats "goto same URL" identically.

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown): void {
    // Log so the console has enough to reproduce; don't swallow.
    console.error("[cast-away] uncaught render error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main
        className="nt-app nt-app--fill cast-away ca-paper"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <h1
            className="ca-page-title"
            style={{ fontSize: 40, marginBottom: 16 }}
          >
            Something went wrong.
          </h1>
          <p className="nt-muted" style={{ marginBottom: 24 }}>
            The oracle stumbled. Refresh to try again — your history is safe
            on the canister.
          </p>
          <button
            type="button"
            className="nt-button"
            onClick={() => history.go(0)}
          >
            Refresh
          </button>
          <details style={{ marginTop: 32, textAlign: "left" }}>
            <summary className="nt-muted" style={{ cursor: "pointer" }}>
              Technical details
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                overflow: "auto",
                fontSize: 12,
                background: "var(--nt-bg-elevated)",
                borderRadius: 4,
              }}
            >
              {this.state.error.stack ?? this.state.error.message}
            </pre>
          </details>
        </div>
      </main>
    );
  }
}
