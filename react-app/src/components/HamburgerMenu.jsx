import React, { useState, useRef, useEffect } from "react";

// Tiny dropdown menu with Export / Import / AI Prompt / Load Demo / Reset.
// Doesn't need its own page — opens overlays for the heavier flows.
// Threshold at which the export item gets visually emphasised and a small
// notification dot appears on the trigger button.
const URGENT_UNBACKED = 25;

export default function HamburgerMenu({
  onExport, onImport, onAIPrompt, onLoadDemo, onReset, onAbout,
  hasEntries, unbackedCount = 0,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = (label, onClick, opts = {}) => (
    <button type="button"
            className={`hm-item${opts.danger ? " danger" : ""}${opts.urgent ? " urgent" : ""}`}
            onClick={() => { setOpen(false); onClick && onClick(); }}>
      <span className="hm-label">{label}</span>
      {opts.suffix && <span className="hm-suffix">{opts.suffix}</span>}
    </button>
  );

  const urgent = unbackedCount >= URGENT_UNBACKED;
  const exportSuffix = unbackedCount > 0 ? `${unbackedCount} unbacked` : null;

  return (
    <div className="hamburger" ref={ref}>
      <button type="button"
              className={`hamburger-btn${urgent ? " urgent" : ""}`}
              aria-label="menu"
              aria-expanded={open}
              onClick={() => setOpen(o => !o)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="7"  x2="20" y2="7"/>
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="4" y1="17" x2="20" y2="17"/>
        </svg>
        {urgent && <span className="hm-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="hm-pop" role="menu">
          {item("export data", onExport, { suffix: exportSuffix, urgent })}
          {item("import data", onImport)}
          {item("ai prompt → json", onAIPrompt)}
          {!hasEntries && item("load demo data", onLoadDemo)}
          {item("about", onAbout)}
          <div className="hm-divider" />
          {item("reset all data", onReset, { danger: true })}
        </div>
      )}
    </div>
  );
}
