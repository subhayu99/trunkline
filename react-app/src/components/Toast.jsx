import React, { useEffect } from "react";

// Single toast — fades in at top-center, auto-dismisses, optional action.
export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => onDismiss(toast.id), toast.duration ?? 5000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className={`toast ${toast.kind || ""}`} role="status" aria-live="polite">
      <span className="toast-msg">{toast.message}</span>
      {toast.actionLabel && toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => { toast.action(); onDismiss(toast.id); }}>
          {toast.actionLabel}
        </button>
      )}
      <button
        type="button"
        className="toast-close"
        aria-label="dismiss"
        onClick={() => onDismiss(toast.id)}>×</button>
    </div>
  );
}
