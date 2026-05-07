import React from "react";

// Shown in place of the chart/ledger when there are zero entries.
export default function EmptyState({ onLoadDemo, onImport, onAIPrompt, hasSeed }) {
  return (
    <div className="empty-state">
      <div className="es-card">
        <div className="es-headline">No entries yet.</div>
        <div className="es-tagline">
          Log your first entry below, or pick a starting point:
        </div>
        <div className="es-actions">
          {hasSeed && (
            <button className="es-btn primary" onClick={onLoadDemo}>
              load demo data
            </button>
          )}
          <button className="es-btn" onClick={onImport}>
            import a JSON file
          </button>
          <button className="es-btn" onClick={onAIPrompt}>
            generate from a statement
          </button>
        </div>
        <div className="es-hint">
          Everything stays in your browser. <kbd>⌘K</kbd> jumps to the composer.
        </div>
      </div>
    </div>
  );
}
