// Desktop anchored composer. Hosts the legend (zoom controls + tooltips)
// and wraps the shared ComposerForm. The mobile equivalent is
// ComposerSheet, which also wraps ComposerForm but inside a bottom-sheet.

import React, { useEffect } from "react";
import ComposerForm from "./ComposerForm.jsx";

export default function Composer({
  tweaks, onLog, zoom, setZoom, config, tagById, now, onAddTag, entries,
  prefill,
}) {
  useEffect(() => {
    const handler = (e) => {
      // Desktop-only ⌘K — gated by viewport so phones don't grab the key.
      if (typeof window !== "undefined" &&
          window.matchMedia("(max-width: 768px)").matches) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Re-focus the topmost text input inside the form.
        const inp = document.querySelector(".composer .field input");
        if (inp) inp.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="composer">
      <div className="legend">
        <span className="item"><span className="swatch solid"></span> already happened</span>
        <span className="item"><span className="swatch dashed"></span> upcoming</span>
        <span className="item">trunk width = balance</span>
        <span className="item">flow width ∝ amount</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "var(--ink-3)" }}>zoom</span>
          <button className="zoom-btn" onClick={() => setZoom(Math.max(0.5, +(zoom - 0.2).toFixed(2)))}>−</button>
          <input type="range" min="0.5" max="4" step="0.1" value={zoom}
                 onChange={e => setZoom(parseFloat(e.target.value))}
                 style={{ width: 100, accentColor: "var(--ink)" }} />
          <button className="zoom-btn" onClick={() => setZoom(Math.min(4, +(zoom + 0.2).toFixed(2)))}>+</button>
          <span className="mono" style={{ color: "var(--ink-2)", minWidth: 36, textAlign: "right" }}>{zoom.toFixed(1)}×</span>
        </span>
      </div>

      <ComposerForm
        tweaks={tweaks} onLog={onLog}
        config={config} tagById={tagById} now={now}
        onAddTag={onAddTag} entries={entries}
        prefill={prefill}
      />

      <div className="hint-row">
        <span className="hint">⌘K focus · ctrl-wheel zoom · scroll up = future · click an entry to edit</span>
      </div>
    </div>
  );
}
