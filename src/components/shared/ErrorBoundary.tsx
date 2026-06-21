import { Component, type ReactNode } from "react";
import { useI18n } from "../../i18n/context";

interface ErrorBoundaryInnerProps {
  children: ReactNode;
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends Component<ErrorBoundaryInnerProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryInnerProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            minHeight: 320,
            padding: 40,
            textAlign: "center",
            userSelect: "none",
          }}
        >
          <div
            style={{
              fontSize: 48,
              marginBottom: 16,
              opacity: 0.4,
            }}
          >
            !
          </div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              margin: "0 0 8px",
              color: "var(--color-text-primary, #1a1a1a)",
            }}
          >
            {this.props.t("errorBoundary.title")}
          </h2>
          <p
            style={{
              fontSize: 14,
              margin: "0 0 24px",
              color: "var(--color-text-secondary, #666)",
              maxWidth: 400,
              lineHeight: 1.6,
            }}
          >
            {this.props.t("errorBoundary.description")}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: "8px 24px",
              fontSize: 14,
              fontWeight: 500,
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              color: "#fff",
              backgroundColor: "var(--color-accent, #4a90d9)",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {this.props.t("common.retry")}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return <ErrorBoundaryInner t={t}>{children}</ErrorBoundaryInner>;
}
