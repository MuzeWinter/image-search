import { useToast } from "../../contexts/ToastContext";

const typeIcons: Record<string, string> = {
  success: "\u2714",
  error:   "\u2716",
  warning: "\u26A0",
  info:    "\u2139",
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}${t.exiting ? " toast-exit" : ""}`}
          role="alert"
          onClick={() => removeToast(t.id)}
        >
          <span className="toast-icon">{typeIcons[t.type]}</span>
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
