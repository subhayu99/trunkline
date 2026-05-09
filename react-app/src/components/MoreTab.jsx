// Mobile-only "More" tab — entry point for tags, lanes, insights, log,
// theme, future toggle, hamburger items, and about. This file renders
// the list of rows; tap actions and drill-ins are wired in Tasks 6 and 7.

import React from "react";

export default function MoreTab({
  tweaks, setTweak, themes,
  onOpenTags, onOpenLanes, onOpenInsights, onOpenLog,
  onImport, onAIPrompt, onExport, onLoadDemo, onReset, onAbout,
  counts = {},
}) {
  const themeLabel = (() => {
    const t = (themes || []).find(t => t.value === tweaks.theme);
    return t ? t.label : tweaks.theme;
  })();

  const Row = ({ label, meta, onClick, danger }) => (
    <button type="button"
            className={`mt-row${danger ? " danger" : ""}`}
            onClick={onClick}>
      <span className="mt-label">{label}</span>
      <span className="mt-meta">{meta}</span>
    </button>
  );

  return (
    <div className="more-tab">
      <div className="mt-section">browse</div>
      <Row label="tags"        meta={`${counts.tags ?? "—"} ›`}     onClick={onOpenTags} />
      <Row label="lanes"       meta={`${counts.lanes ?? "—"} ›`}    onClick={onOpenLanes} />
      <Row label="insights"    meta={`${counts.insights ?? "—"} ›`} onClick={onOpenInsights} />
      <Row label="recent log"  meta={`${counts.log ?? 0} ›`}        onClick={onOpenLog} />

      <div className="mt-section">view</div>
      <Row label="future entries"
           meta={tweaks.showFuture ? "show" : "hide"}
           onClick={() => setTweak("showFuture", !tweaks.showFuture)} />
      <Row label="theme" meta={themeLabel}
           onClick={() => {
             // Cycle through the themes list.
             const list = themes || [];
             const i = list.findIndex(t => t.value === tweaks.theme);
             const next = list[(i + 1) % list.length];
             if (next) setTweak("theme", next.value);
           }} />

      <div className="mt-section">data</div>
      <Row label="import JSON"     meta="›" onClick={onImport} />
      <Row label="AI prompt"        meta="›" onClick={onAIPrompt} />
      <Row label="export backup"    meta="›" onClick={onExport} />
      <Row label="load demo"        meta="›" onClick={onLoadDemo} />
      <Row label="reset"            meta="›" onClick={onReset} danger />

      <div className="mt-section">about</div>
      <Row label="about trunkline"  meta="›" onClick={onAbout} />
    </div>
  );
}
