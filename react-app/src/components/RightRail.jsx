// VS-Code-style right rail: a thin icon strip on the far edge with a
// content panel that expands to its left when one of the icons is active.
// Click an icon to open that panel; click again to close. Only one panel
// open at a time.

import React, { useMemo, useState } from "react";
import { fmtINR } from "../lib/format.js";
import { totalsByTag } from "../lib/data.js";
import Dash from "./Dash.jsx";

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

const ICONS = {
  tags: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  lanes: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6"  y1="3" x2="6"  y2="21"/>
      <line x1="12" y1="3" x2="12" y2="21"/>
      <line x1="18" y1="3" x2="18" y2="21"/>
    </svg>
  ),
  insights: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21h6"/>
      <path d="M12 17v4"/>
      <path d="M9 17h6"/>
      <path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z"/>
    </svg>
  ),
  log: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6"  x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6"  x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  dash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="20" x2="4" y2="13"/>
      <line x1="10" y1="20" x2="10" y2="9"/>
      <line x1="16" y1="20" x2="16" y2="15"/>
      <line x1="22" y1="20" x2="22" y2="6"/>
    </svg>
  ),
};

// Convert any CSS color to a hex string the native picker accepts. Falls
// back to a neutral grey for non-standard colors (e.g. oklch is not parseable
// by the picker on most browsers — we keep it as a string when saved).
function toHex(color) {
  if (!color) return "";
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return "#" + color.slice(1).split("").map(c => c + c).join("");
  }
  // Try canvas trick for named/rgb/oklch values
  if (typeof document === "undefined") return "";
  const ctx = document.createElement("canvas").getContext("2d");
  try {
    ctx.fillStyle = color;
    const computed = ctx.fillStyle;
    if (/^#[0-9a-fA-F]{6}$/.test(computed)) return computed;
  } catch (e) { /* ignore */ }
  return "";
}

export function PanelLanes({ kinds, onUpsert, onRemove }) {
  const [editing, setEditing] = useState(null); // kind id being edited
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ id: "", label: "", groupLabel: "", color: "", side: "R" });
  const sorted = kinds.slice().sort((a, b) => a.order - b.order);

  const startEdit = (k) => {
    setAdding(false);
    setEditing(k.id);
    setDraft({
      id: k.id,
      label: k.vocab?.light || k.label || "",
      groupLabel: k.groupLabel || "",
      color: k.color || "",
      side: k.side || "R",
    });
  };
  const startAdd = () => {
    setEditing(null);
    setAdding(true);
    setDraft({ id: "", label: "", groupLabel: "", color: "", side: "R" });
  };
  const cancel = () => { setEditing(null); setAdding(false); };
  const save = () => {
    const label = draft.label.trim();
    if (!label) return;
    if (adding) {
      let id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
      if (!id) id = "kind-" + Date.now().toString(36);
      let suffix = 2;
      while (kinds.some(k => k.id === id)) id = id.replace(/-\d+$/, "") + "-" + suffix++;
      onUpsert({
        id,
        label,
        vocab: { heavy: id + "/*", medium: label, light: label },
        groupLabel: draft.groupLabel || label,
        color: draft.color || null,
        side: draft.side === "C" ? "R" : draft.side,  // C is reserved for the cash trunk
        order: kinds.length,
        archived: false,
      });
    } else {
      const k = kinds.find(x => x.id === editing);
      if (!k) return;
      onUpsert({
        ...k,
        label,
        vocab: { ...k.vocab, light: label, medium: label },
        groupLabel: draft.groupLabel || label,
        color: draft.color || null,
        side: k.id === "main" ? "C" : draft.side,  // main always C
      });
    }
    cancel();
  };

  const deleteKind = (k) => {
    if (k.id === "main") return;
    if (!confirm(`Delete the "${k.label}" lane? Tags and entries using it will move to "extras".`)) return;
    onRemove(k.id);
    cancel();
  };

  const renderEditor = (isMain) => (
    <div className="lane-editor">
      <label className="le-row">
        <span className="le-k">label</span>
        <input className="mono" autoFocus placeholder="eg. side hustle"
               value={draft.label}
               onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} />
      </label>
      <label className="le-row">
        <span className="le-k">group</span>
        <input className="mono" placeholder="section header in tag list"
               value={draft.groupLabel}
               onChange={e => setDraft(d => ({ ...d, groupLabel: e.target.value }))} />
      </label>
      <label className="le-row">
        <span className="le-k">color</span>
        <span className="le-color">
          <input type="color"
                 value={toHex(draft.color) || "#888888"}
                 onChange={e => setDraft(d => ({ ...d, color: e.target.value }))} />
          {draft.color && (
            <button type="button" className="le-color-clear" title="reset to theme default"
                    onClick={() => setDraft(d => ({ ...d, color: "" }))}>↺</button>
          )}
        </span>
      </label>
      {!isMain && (
        <div className="le-row">
          <span className="le-k">side</span>
          <div className="le-side">
            {["L", "R"].map(s => (
              <button key={s} type="button"
                      className={draft.side === s ? "on" : ""}
                      title={s === "L" ? "Left of the cash trunk" : "Right of the cash trunk"}
                      onClick={() => setDraft(d => ({ ...d, side: s }))}>
                {s === "L" ? "← left" : "right →"}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="lane-editor-row">
        {!adding && !isMain && (
          <button className="lane-del" onClick={() => deleteKind(kinds.find(x => x.id === editing))}>delete</button>
        )}
        <button className="lane-cancel" onClick={cancel}>cancel</button>
        <button className="lane-save" onClick={save} disabled={!draft.label.trim()}>
          {adding ? "add" : "save"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="rail-panel-body">
      <div className="rail-header sticky">
        <span>lanes</span>
        <span className="count">{sorted.length}</span>
      </div>
      {sorted.map(k => {
        const isEditing = editing === k.id;
        if (isEditing) return <React.Fragment key={k.id}>{renderEditor(k.id === "main")}</React.Fragment>;
        return (
          <div key={k.id} className="lane-row" onClick={() => startEdit(k)}>
            <span className="lane-swatch"
                  style={{ background: k.color || `var(--b-${k.id})` }} />
            <span className="lane-label">{k.label}</span>
            <span className="lane-meta">{k.id === "main" ? "center" : (k.side === "L" ? "left" : "right")}</span>
          </div>
        );
      })}

      {adding ? renderEditor(false) : (
        <div className="new-tag">
          <button type="button" className="new-tag-btn" onClick={startAdd}>
            + new lane
          </button>
        </div>
      )}
    </div>
  );
}

export function PanelTags({
  tweaks, hoveredKind, setHoveredKind, selectedTag, setSelectedTag, entries,
  config, tagById, onAddTag, range, onEditTag, onRemoveTag,
}) {
  const [editingTag, setEditingTag] = useState(null); // tag id being edited
  const [tagDraft, setTagDraft] = useState({ label: "", kind: "" });

  const startEditTag = (t, e) => {
    if (e) e.stopPropagation();
    setEditingTag(t.id);
    setTagDraft({ label: t.label, kind: t.kind });
  };
  const cancelEditTag = () => setEditingTag(null);
  const saveEditTag = () => {
    const label = tagDraft.label.trim();
    if (!label || !editingTag) return;
    onEditTag && onEditTag(editingTag, { label, kind: tagDraft.kind });
    cancelEditTag();
  };
  const deleteTag = (t) => {
    if (!confirm(`Delete tag "#${t.label}"? Existing entries keep the tag id but it'll show as "${t.id}" until reassigned.`)) return;
    onRemoveTag && onRemoveTag(t.id);
    cancelEditTag();
  };
  // Totals scope to the active date range so the user sees what each tag
  // contributed within the same window the chart/stats are showing.
  const inRangeEntries = useMemo(() => {
    if (!range || (!isFinite(range.start) && !isFinite(range.end))) return entries || [];
    return (entries || []).filter(e => {
      const t = new Date(e.when).getTime();
      return t >= range.start && t <= range.end;
    });
  }, [entries, range]);
  const tagTotals = useMemo(
    () => totalsByTag(inRangeEntries, config.tags),
    [inRangeEntries, config.tags]
  );
  const symbol = config.currencySymbol;

  const kindOptions = (config.branchKinds || []).filter(k => k !== "main");
  const [newOpen, setNewOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState(kindOptions[0] || "extras");

  const submitNewTag = () => {
    const label = newLabel.trim();
    if (!label) return;
    let id = slugify(label);
    if (!id) return;
    let suffix = 2;
    while (tagById[id]) id = slugify(label) + "-" + suffix++;
    onAddTag && onAddTag({ id, label, kind: newKind });
    setNewLabel("");
    setNewOpen(false);
  };

  return (
    <div className="rail-panel-body">
      <div className="rail-header sticky">
        <span>tags</span>
        <span className="count">{config.tags.length}</span>
      </div>

      {selectedTag && (
        <div className="rail-clear-filter">
          <button onClick={() => setSelectedTag && setSelectedTag(null)}>
            clear filter · #{tagById[selectedTag] && tagById[selectedTag].label}
          </button>
        </div>
      )}

      {config.tagGroups.map(g => {
        const items = config.tags.filter(t => t.kind === g.key);
        if (!items.length) return null;
        return (
          <div key={g.key}>
            <div className="section-divider" style={{ color: `var(--b-${g.key})` }}>{g.label}</div>
            {items.map(t => {
              const isEditing = editingTag === t.id;
              if (isEditing) {
                const kindOptions = (config.branchKinds || []).filter(k => k !== "main");
                return (
                  <div key={t.id} className="tag-editor">
                    <input className="mono" autoFocus
                           value={tagDraft.label}
                           onChange={e => setTagDraft(d => ({ ...d, label: e.target.value }))}
                           onKeyDown={e => {
                             if (e.key === "Enter") saveEditTag();
                             if (e.key === "Escape") cancelEditTag();
                           }} />
                    <select className="mono" value={tagDraft.kind}
                            onChange={e => setTagDraft(d => ({ ...d, kind: e.target.value }))}>
                      {kindOptions.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <div className="tag-editor-row">
                      <button className="lane-del" onClick={() => deleteTag(t)}>delete</button>
                      <button className="lane-cancel" onClick={cancelEditTag}>cancel</button>
                      <button className="lane-save" onClick={saveEditTag}
                              disabled={!tagDraft.label.trim()}>save</button>
                    </div>
                  </div>
                );
              }
              const tot = tagTotals[t.id];
              const amt = tot.out || tot.in;
              const isSel = selectedTag === t.id;
              return (
                <div
                  key={t.id}
                  className={`branch-row${isSel ? " active" : ""}`}
                  style={{ color: `var(--b-${t.kind})` }}
                  onMouseEnter={() => setHoveredKind && setHoveredKind(t.kind)}
                  onMouseLeave={() => setHoveredKind && setHoveredKind(null)}
                  onClick={() => setSelectedTag && setSelectedTag(s => s === t.id ? null : t.id)}
                >
                  <div className="swatch"></div>
                  <div className="label" style={{ color: "var(--ink)" }}>#{t.label}</div>
                  <div className="amt">{tot.count ? fmtINR(amt, tweaks.locale, symbol) : "—"}</div>
                  {onEditTag && (
                    <button type="button" className="branch-edit"
                            title="edit tag"
                            onClick={(e) => startEditTag(t, e)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {onAddTag && (
        <div className="new-tag">
          {!newOpen ? (
            <button type="button" className="new-tag-btn" onClick={() => setNewOpen(true)}>
              + new tag
            </button>
          ) : (
            <div className="new-tag-form">
              <input
                autoFocus
                className="mono"
                placeholder="tag label, e.g. coffee"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") submitNewTag();
                  if (e.key === "Escape") { setNewLabel(""); setNewOpen(false); }
                }}
              />
              <select className="mono" value={newKind} onChange={e => setNewKind(e.target.value)}>
                {kindOptions.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <div className="new-tag-row">
                <button type="button" className="new-tag-cancel"
                        onClick={() => { setNewLabel(""); setNewOpen(false); }}>
                  cancel
                </button>
                <button type="button" className="new-tag-add"
                        onClick={submitNewTag}
                        disabled={!newLabel.trim()}>
                  add
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PanelInsights({ insights }) {
  return (
    <div className="rail-panel-body">
      <div className="rail-header sticky">
        <span>insights</span>
        <span className="count">{insights.length}</span>
      </div>
      {insights.map((ins, i) => (
        <div key={i} className={`insight ${ins.severity}`}>
          <div className="head">
            <span>{ins.kind}</span>
            <span className="mono" style={{ color: "var(--ink-3)" }}>auto</span>
          </div>
          <div className="title">{ins.title}</div>
          <div className="body">{ins.body}</div>
        </div>
      ))}
      {insights.length === 0 && (
        <div className="rail-empty">no insights yet</div>
      )}
    </div>
  );
}

export function PanelLog({ log, onEditEntry, tagById, tweaks, config }) {
  const symbol = config.currencySymbol;
  return (
    <div className="rail-panel-body">
      <div className="rail-header sticky">
        <span>recent log</span>
        <span className="count">{log.length}</span>
      </div>
      {log.length === 0 ? (
        <div className="rail-empty">nothing logged yet · try the composer below</div>
      ) : (
        log.slice().reverse().map((e, i) => {
          const tag = tagById[e.tags[0]];
          return (
            <div key={e.id || i}
                 onClick={() => onEditEntry(e)}
                 className="rail-log-row">
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div className="mono" style={{ fontSize: 11 }}>{e.label}</div>
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>
                  {tag && <span style={{ color: `var(--b-${tag.kind})` }}>#{tag.label}</span>} · {e.id}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink)" }}>
                {e.dir === "in" ? "+" : "−"}{fmtINR(e.amount, tweaks.locale, symbol).replace("-", "")}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function RightRail({
  tweaks, log, onEditEntry,
  config, tagById, insights: insightsProp,
  selectedTag, setSelectedTag, hoveredKind, setHoveredKind,
  entries, onAddTag, onEditTag, onRemoveTag,
  activePanel, onPanelChange,
  kinds, onUpsertKind, onRemoveKind,
  range,
  dashDrill, setDashDrill,
}) {
  const insights = insightsProp || config.insights || [];
  const panels = [
    { id: "dash",     label: "Dash",         icon: ICONS.dash },
    { id: "tags",     label: "Tags",         icon: ICONS.tags },
    { id: "lanes",    label: "Lanes",        icon: ICONS.lanes },
    { id: "insights", label: "Insights",     icon: ICONS.insights },
    { id: "log",      label: "Recent log",   icon: ICONS.log },
  ];

  const togglePanel = (id) => onPanelChange(activePanel === id ? null : id);

  const activeMeta = panels.find(p => p.id === activePanel);

  return (
    <aside className={`right-rail-stack${activePanel ? " open" : ""}`}>
      {activePanel && (
        <div className="rail-panel" data-panel={activePanel}>
          <div className="rail-panel-head">
            <span>{activeMeta?.label}</span>
            <button type="button" className="rail-panel-close"
                    onClick={() => onPanelChange(null)}
                    title="close panel">×</button>
          </div>
          <div className="rail-panel-scroll">
            {activePanel === "dash" && (
              <Dash
                tweaks={tweaks}
                config={config}
                kinds={kinds || []}
                entries={entries}
                range={range}
                tagById={tagById}
                drill={dashDrill}
                setDrill={setDashDrill}
                onEditEntry={onEditEntry}
                drillBackInline
              />
            )}
            {activePanel === "tags" && (
              <PanelTags
                tweaks={tweaks}
                hoveredKind={hoveredKind} setHoveredKind={setHoveredKind}
                selectedTag={selectedTag} setSelectedTag={setSelectedTag}
                entries={entries} config={config} tagById={tagById}
                onAddTag={onAddTag} range={range}
                onEditTag={onEditTag} onRemoveTag={onRemoveTag}
              />
            )}
            {activePanel === "lanes" && (
              <PanelLanes kinds={kinds || []}
                          onUpsert={onUpsertKind}
                          onRemove={onRemoveKind} />
            )}
            {activePanel === "insights" && <PanelInsights insights={insights} />}
            {activePanel === "log" && (
              <PanelLog log={log} onEditEntry={onEditEntry}
                        tagById={tagById} tweaks={tweaks} config={config} />
            )}
          </div>
        </div>
      )}
      <div className="rail-icons" role="tablist" aria-label="sidebar">
        {panels.map(p => {
          const isActive = activePanel === p.id;
          // Show a tag-color hint dot on the tags icon when filter is on.
          const indicator = p.id === "tags" && selectedTag;
          return (
            <button key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`rail-panel-${p.id}`}
                    title={p.label}
                    className={`rail-icon-btn${isActive ? " active" : ""}`}
                    onClick={() => togglePanel(p.id)}>
              {p.icon}
              {indicator && <span className="rail-icon-dot" />}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
