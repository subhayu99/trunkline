// Mobile-only "More" tab — list view + drill-in container.
// When `screen` is null we render the row list. Otherwise we render the
// matching panel component filling the area; the parent (App.jsx) is
// responsible for swapping the topbar to drill-in mode (back-arrow + title).

import React from "react";
import { PanelTags, PanelLanes, PanelInsights, PanelLog } from "./RightRail.jsx";

export default function MoreTab({
  tweaks, setTweak, themes,
  screen, onOpenScreen,
  // tags
  config, tagById, hoveredKind, setHoveredKind,
  selectedTag, setSelectedTag, entries, range,
  onAddTag, onEditTag, onRemoveTag,
  // lanes
  kinds, onUpsertKind, onRemoveKind,
  // insights, log
  insights, log, onEditEntry,
  // hamburger callbacks
  onImport, onAIPrompt, onExport, onExportCustomization,
  onLoadDemo, onReset, onAbout,
  counts = {},
}) {
  if (screen === "tags") {
    return (
      <div className="more-drill" data-scroll-host>
        <PanelTags
          tweaks={tweaks}
          hoveredKind={hoveredKind} setHoveredKind={setHoveredKind}
          selectedTag={selectedTag} setSelectedTag={setSelectedTag}
          entries={entries} config={config} tagById={tagById}
          onAddTag={onAddTag} range={range}
          onEditTag={onEditTag} onRemoveTag={onRemoveTag}
        />
      </div>
    );
  }
  if (screen === "lanes") {
    return (
      <div className="more-drill" data-scroll-host>
        <PanelLanes kinds={kinds || []}
                    onUpsert={onUpsertKind}
                    onRemove={onRemoveKind} />
      </div>
    );
  }
  if (screen === "insights") {
    return (
      <div className="more-drill" data-scroll-host>
        <PanelInsights insights={insights || []} />
      </div>
    );
  }
  if (screen === "log") {
    return (
      <div className="more-drill" data-scroll-host>
        <PanelLog log={log} onEditEntry={onEditEntry}
                  tagById={tagById} tweaks={tweaks} config={config} />
      </div>
    );
  }

  const Row = ({ label, meta, onClick, danger }) => (
    <button type="button"
            className={`mt-row${danger ? " danger" : ""}`}
            onClick={onClick}>
      <span className="mt-label">{label}</span>
      <span className="mt-meta">{meta}</span>
    </button>
  );

  return (
    <div className="more-tab" data-scroll-host>
      <div className="mt-section">browse</div>
      <Row label="tags"        meta={`${counts.tags ?? "—"} ›`}     onClick={() => onOpenScreen("tags")} />
      <Row label="lanes"       meta={`${counts.lanes ?? "—"} ›`}    onClick={() => onOpenScreen("lanes")} />
      <Row label="insights"    meta={`${counts.insights ?? "—"} ›`} onClick={() => onOpenScreen("insights")} />
      <Row label="recent log"  meta={`${counts.log ?? 0} ›`}        onClick={() => onOpenScreen("log")} />

      <div className="mt-section">data</div>
      <Row label="import JSON"      meta="›" onClick={onImport} />
      <Row label="AI prompt"        meta="›" onClick={onAIPrompt} />
      <Row label="export backup"    meta="›" onClick={onExport} />
      <Row label="load demo"        meta="›" onClick={onLoadDemo} />
      <Row label="reset"            meta="›" onClick={onReset} danger />

      {onExportCustomization && (
        <>
          <div className="mt-section">customization</div>
          <Row label="export app customization" meta="›" onClick={onExportCustomization} />
          <Row label="import app customization" meta="›" onClick={onImport} />
        </>
      )}

      <div className="mt-section">about</div>
      <Row label="about trunkline"  meta="›" onClick={onAbout} />
    </div>
  );
}
