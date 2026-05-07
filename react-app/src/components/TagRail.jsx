import React, { useMemo, useState } from "react";
import { fmtINR } from "../lib/format.js";
import { totalsByTag } from "../lib/data.js";

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export default function TagRail({
  tweaks, hoveredKind, setHoveredKind, selectedTag, setSelectedTag, entries,
  collapsed, onToggleCollapse, config, tagById, onAddTag,
}) {
  const tagTotals = useMemo(() => totalsByTag(entries, config.tags), [entries, config.tags]);
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

  if (collapsed) {
    return (
      <div className="left-rail" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", gap: 8 }}>
        <button onClick={onToggleCollapse} title="expand tags"
          style={{
            background: "var(--surface)", border: "1px solid var(--rule)", color: "var(--ink-2)",
            fontFamily: "var(--font-mono)", fontSize: 10, padding: "6px 4px", cursor: "pointer",
            borderRadius: 4, writingMode: "vertical-rl", letterSpacing: ".1em", textTransform: "uppercase",
          }}>
          tags ›
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
          {config.tags.map(t => (
            <div key={t.id} title={"#" + t.label}
              onMouseEnter={() => setHoveredKind(t.kind)}
              onMouseLeave={() => setHoveredKind(null)}
              onClick={() => setSelectedTag(s => s === t.id ? null : t.id)}
              style={{ width: 10, height: 10, borderRadius: 2, background: `var(--b-${t.kind})`,
                cursor: "pointer", margin: "0 auto",
                outline: selectedTag === t.id ? "2px solid var(--ink)" : "none", outlineOffset: 1 }}/>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="left-rail">
      <div className="rail-header">
        <button onClick={onToggleCollapse} title="collapse"
          style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, padding: 0 }}>
          ‹
        </button>
        <span>tags</span>
        <span className="count">{config.tags.length}</span>
      </div>

      {selectedTag && (
        <div style={{ padding: "0 16px 8px" }}>
          <button onClick={() => setSelectedTag(null)}
            style={{ width: "100%", background: "var(--ink)", color: "var(--bg)", border: "none",
              fontFamily: "var(--font-mono)", fontSize: 10, padding: "5px", cursor: "pointer", borderRadius: 3 }}>
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
              const tot = tagTotals[t.id];
              const amt = tot.out || tot.in;
              const isSel = selectedTag === t.id;
              return (
                <div
                  key={t.id}
                  className={`branch-row${isSel ? " active" : ""}`}
                  style={{ color: `var(--b-${t.kind})` }}
                  onMouseEnter={() => setHoveredKind(t.kind)}
                  onMouseLeave={() => setHoveredKind(null)}
                  onClick={() => setSelectedTag(s => s === t.id ? null : t.id)}
                >
                  <div className="swatch"></div>
                  <div className="label" style={{ color: "var(--ink)" }}>#{t.label}</div>
                  <div className="amt">{tot.count ? fmtINR(amt, tweaks.locale, symbol) : "—"}</div>
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
