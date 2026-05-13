import React from "react";
import { toast } from "@/hooks/use-toast";

interface State {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface Props {
  children: React.ReactNode;
  /** Optional scope label so we can show different fallbacks for different parts of the app */
  scope?: string;
}

/**
 * Global error boundary — catches any render-phase crash anywhere in the tree
 * and shows a friendly fallback instead of a blank white screen.
 *
 * Why this exists: Cel previously had zero error boundaries, so a single
 * uncaught React error (bad effect, undefined.map, failed query) would unmount
 * the entire root and leave a blank page with no way to recover.
 *
 * Note: This catches *render-phase* errors. Async errors inside event handlers
 * or promise chains still need their own try/catch, but those don't blank the
 * app — they just show a toast or fail silently. White screens come from
 * render-phase crashes, which this fully covers.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console — surfaced in browser devtools and our /tmp/cel.log when debugging
    // eslint-disable-next-line no-console
    console.error("[Cel ErrorBoundary]", this.props.scope ?? "root", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    // Soft reset: clear error state. If that's not enough, user can hard-reload.
    this.setState({ error: null, errorInfo: null });
  };

  handleHardReload = () => {
    window.location.hash = "#/dashboard";
    window.location.reload();
  };

  getErrorDetails = () => {
    const { error, errorInfo } = this.state;
    if (!error) return "";
    return [
      `${error.name}: ${error.message}`,
      error.stack,
      errorInfo?.componentStack ? `Component stack:${errorInfo.componentStack}` : "",
    ].filter(Boolean).join("\n\n");
  };

  handleCopyErrorDetails = async () => {
    const details = this.getErrorDetails();
    try {
      await navigator.clipboard.writeText(details);
      toast({ description: "Error details copied to clipboard." });
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = details;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast({ description: "Error details copied to clipboard." });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const scopeLabel = this.props.scope ? ` in ${this.props.scope}` : "";

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background:
            "radial-gradient(circle at 30% 20%, rgba(157,208,255,0.35), transparent 55%), radial-gradient(circle at 70% 80%, rgba(202,197,255,0.30), transparent 55%), #f5f8fc",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
          color: "#1a1a2e",
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: "100%",
            padding: "2rem 2.25rem",
            background: "rgba(255,255,255,0.6)",
            backdropFilter: "blur(24px) saturate(160%)",
            WebkitBackdropFilter: "blur(24px) saturate(160%)",
            border: "1px solid rgba(255,255,255,0.6)",
            borderRadius: 24,
            boxShadow:
              "inset 1px 1px 0 rgba(255,255,255,0.6), 0 16px 48px -12px rgba(20,40,80,0.18)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: "rgba(157,208,255,0.25)",
              color: "#064b73",
              marginBottom: 18,
            }}
          >
            Something cracked
          </div>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              margin: "0 0 0.5rem",
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            Cel hit an unexpected error{scopeLabel}.
          </h1>
          <p style={{ margin: "0 0 1.25rem", color: "rgba(26,26,46,0.7)", lineHeight: 1.55 }}>
            Don't worry — your data is safe. Try the buttons below. If it keeps happening,
            copy the error details and let me know.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            <button
              onClick={this.handleReload}
              style={{
                background: "#9dd0ff",
                color: "#064b73",
                fontWeight: 700,
                fontSize: 14,
                padding: "10px 20px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                boxShadow:
                  "inset 0 0 0 1px rgba(255,255,255,0.7), 0 8px 16px -4px rgba(157,208,255,0.55)",
              }}
            >
              Try again
            </button>
            <button
              onClick={this.handleCopyErrorDetails}
              style={{
                background: "rgba(255,255,255,0.55)",
                color: "#1a1a2e",
                fontWeight: 600,
                fontSize: 14,
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.6)",
                cursor: "pointer",
                backdropFilter: "blur(14px)",
              }}
              data-testid="button-copy-error-details"
            >
              Copy error details
            </button>
            <button
              onClick={this.handleHardReload}
              style={{
                background: "rgba(255,255,255,0.55)",
                color: "#1a1a2e",
                fontWeight: 600,
                fontSize: 14,
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.6)",
                cursor: "pointer",
                backdropFilter: "blur(14px)",
              }}
            >
              Go to home
            </button>
          </div>

          <details
            style={{
              fontSize: 12,
              fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
              color: "rgba(26,26,46,0.6)",
              background: "rgba(20,24,40,0.04)",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(20,24,40,0.06)",
            }}
          >
            <summary style={{ cursor: "pointer", userSelect: "none", marginBottom: 6 }}>
              Show error details
            </summary>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              <strong>{this.state.error.name}:</strong> {this.state.error.message}
              {this.state.error.stack && (
                <pre style={{ fontSize: 10, marginTop: 8, opacity: 0.7 }}>
                  {this.state.error.stack.split("\n").slice(0, 6).join("\n")}
                </pre>
              )}
            </div>
          </details>
        </div>
      </div>
    );
  }
}
