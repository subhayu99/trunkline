import React from "react";

// Two pill buttons for the topbar: show upcoming + collapse future.
// They were in the Tweaks panel before; surfaced here so they're one click
// away when the future timeline is in the way.
export default function FutureToggle({ showFuture, collapseFuture, onChange }) {
  return (
    <div className="future-toggle" role="group" aria-label="future visibility">
      <button type="button"
              className={showFuture ? "on" : ""}
              title={showFuture ? "hide upcoming entries" : "show upcoming entries"}
              aria-pressed={showFuture}
              onClick={() => onChange({ showFuture: !showFuture })}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>
        </svg>
        <span className="lbl">upcoming</span>
      </button>
      <button type="button"
              className={collapseFuture ? "on" : ""}
              title={collapseFuture ? "expand future timeline" : "collapse future timeline at NOW"}
              aria-pressed={collapseFuture}
              onClick={() => onChange({ collapseFuture: !collapseFuture })}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="9" y1="7"  x2="15" y2="7"/>
          <line x1="11" y1="17" x2="13" y2="17"/>
        </svg>
        <span className="lbl">collapse</span>
      </button>
    </div>
  );
}
