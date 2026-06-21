interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function InlineError({ message, onRetry, retryLabel = "重试" }: InlineErrorProps) {
  return (
    <div className="inline-error" role="alert">
      <svg
        className="inline-error-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="inline-error-message">{message}</span>
      {onRetry && (
        <button className="inline-error-retry" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
