import React, { useState, useEffect } from "react";
import { isoLocal } from "../lib/format.js";

export default function EditPanel({
  entry, onClose, onSave, onDelete, config, tagById, now,
}) {
  if (!entry) return null;
  const [label, setLabel] = useState(entry.label);
  const [amount, setAmount] = useState(String(entry.amount));
  const [note, setNote] = useState(entry.note || "");
  const [tags, setTags] = useState(entry.tags.slice());
  const [dir, setDir] = useState(entry.dir);
  const [whenISO, setWhenISO] = useState(isoLocal(new Date(entry.when)));
  const [tagInput, setTagInput] = useState("");
  const [recurOn, setRecurOn] = useState(!!entry.recur);
  const [recurFreq, setRecurFreq] = useState((entry.recur && entry.recur.freq) || "month");
  const [recurEvery, setRecurEvery] = useState((entry.recur && entry.recur.every) || 1);
  const [recurMode, setRecurMode] = useState(entry.recur ? (entry.recur.count != null ? "count" : (entry.recur.until ? "until" : "forever")) : "count");
  const [recurCount, setRecurCount] = useState((entry.recur && entry.recur.count) || 12);
  const [recurUntil, setRecurUntil] = useState(
    (entry.recur && entry.recur.until)
      ? isoLocal(new Date(entry.recur.until))
      : isoLocal(new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()))
  );

  useEffect(() => {
    setLabel(entry.label); setAmount(String(entry.amount));
    setNote(entry.note || ""); setTags(entry.tags.slice());
    setDir(entry.dir); setWhenISO(isoLocal(new Date(entry.when)));
    setRecurOn(!!entry.recur);
    if (entry.recur) {
      setRecurFreq(entry.recur.freq); setRecurEvery(entry.recur.every || 1);
      setRecurMode(entry.recur.count != null ? "count" : (entry.recur.until ? "until" : "forever"));
      if (entry.recur.count != null) setRecurCount(entry.recur.count);
      if (entry.recur.until) setRecurUntil(isoLocal(new Date(entry.recur.until)));
    }
  }, [entry]);

  const addTag = (raw) => {
    const t = raw.trim().replace(/^#/, "").toLowerCase();
    if (!t || !tagById[t]) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  };

  const save = () => {
    let recur = null;
    if (recurOn) {
      recur = { freq: recurFreq, every: parseInt(recurEvery, 10) || 1 };
      if (recurMode === "count") recur.count = parseInt(recurCount, 10) || 1;
      if (recurMode === "until") recur.until = new Date(recurUntil).toISOString();
    }
    onSave({
      ...entry,
      label: label.trim() || "untitled",
      amount: parseInt(amount, 10) || 0,
      note,
      tags: tags.length ? tags : entry.tags,
      dir,
      when: new Date(whenISO).toISOString(),
      recur,
    });
  };

  const onKey = (e) => {
    if (e.key === "Escape") onClose();
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
  };

  const tagGroups = config.tagGroups.map(g => g.key);

  return (
    <div className="edit-overlay" onClick={onClose}>
      <div className="edit-panel" onClick={e => e.stopPropagation()} onKeyDown={onKey}>
        <div className="ep-head">
          <div className="ep-id mono">{entry.id}</div>
          <div className="ep-title">edit entry</div>
          <button className="ep-close" onClick={onClose}>esc ×</button>
        </div>

        <div className="ep-grid">
          <label className="ep-row">
            <span className="ep-k">label</span>
            <input value={label} onChange={e => setLabel(e.target.value)} autoFocus />
          </label>

          <label className="ep-row">
            <span className="ep-k">amount</span>
            <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ""))} className="mono" />
          </label>

          <div className="ep-row">
            <span className="ep-k">direction</span>
            <div className="dir-toggle">
              <button type="button" className={dir === "out" ? "on" : ""} onClick={() => setDir("out")} aria-label="out">
                −<span className="dir-lbl">out</span>
              </button>
              <button type="button" className={dir === "in"  ? "on" : ""} onClick={() => setDir("in")}  aria-label="in">
                +<span className="dir-lbl">in</span>
              </button>
              <button type="button" className={dir === "merge" ? "on" : ""} onClick={() => setDir("merge")} aria-label="merge">
                ↺<span className="dir-lbl">&nbsp;merge</span>
              </button>
            </div>
          </div>

          <label className="ep-row">
            <span className="ep-k">when</span>
            <input type="datetime-local" value={whenISO} onChange={e => setWhenISO(e.target.value)} className="mono" />
          </label>

          <div className="ep-row" style={{ alignItems: "flex-start" }}>
            <span className="ep-k">repeat</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)" }}>
                <input type="checkbox" checked={recurOn} onChange={e => setRecurOn(e.target.checked)} />
                recurring entry
              </label>
              {recurOn && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "6px 8px", background: "var(--bg-2)", border: "1px solid var(--rule)", borderRadius: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)" }}>
                    <span>every</span>
                    <input type="number" min="1" max="99" value={recurEvery}
                           onChange={e => setRecurEvery(e.target.value)}
                           className="mono" style={{ width: 50, padding: "4px 6px" }} />
                    <select value={recurFreq} onChange={e => setRecurFreq(e.target.value)}
                            className="mono" style={{ padding: "4px 6px", background: "var(--surface)", border: "1px solid var(--rule)", color: "var(--ink)", borderRadius: 3 }}>
                      <option value="day">day(s)</option>
                      <option value="week">week(s)</option>
                      <option value="month">month(s)</option>
                      <option value="year">year(s)</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)" }}>
                    <span>ends</span>
                    <select value={recurMode} onChange={e => setRecurMode(e.target.value)}
                            className="mono" style={{ padding: "4px 6px", background: "var(--surface)", border: "1px solid var(--rule)", color: "var(--ink)", borderRadius: 3 }}>
                      <option value="count">after N</option>
                      <option value="until">on date</option>
                      <option value="forever">never (24mo cap)</option>
                    </select>
                    {recurMode === "count" && (
                      <input type="number" min="1" max="999" value={recurCount}
                             onChange={e => setRecurCount(e.target.value)}
                             className="mono" style={{ width: 60, padding: "4px 6px" }} />
                    )}
                    {recurMode === "count" && <span>occurrences</span>}
                    {recurMode === "until" && (
                      <input type="datetime-local" value={recurUntil}
                             onChange={e => setRecurUntil(e.target.value)}
                             className="mono" style={{ padding: "4px 6px", flex: 1 }} />
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)" }}>
                    e.g. "every 1 month, after 12" = a 1-year EMI starting from this entry's date.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="ep-row" style={{ alignItems: "flex-start" }}>
            <span className="ep-k">tags</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", minHeight: 20 }}>
                {tags.map(t => {
                  const ti = tagById[t];
                  return (
                    <span key={t} className="tag-chip-removable"
                          style={{ color: ti ? `var(--b-${ti.kind})` : "var(--ink-2)" }}>
                      #{ti ? ti.label : t}
                      <button onClick={() => setTags(tags.filter(x => x !== t))}>×</button>
                    </span>
                  );
                })}
                {!tags.length && <span style={{ color: "var(--ink-3)", fontSize: 11 }}>no tags · pick one below</span>}
              </div>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                     onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
                     placeholder="type a tag and press enter…" className="mono" style={{ fontSize: 11 }} />
              <details className="ep-tag-picker">
                <summary>browse all tags</summary>
                <div style={{ paddingTop: 6 }}>
                  {tagGroups.map(g => {
                    const items = config.tags.filter(t => t.kind === g);
                    return (
                      <div key={g} style={{ marginBottom: 6 }}>
                        <div className="mono" style={{ fontSize: 9, color: `var(--b-${g})`, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 3 }}>{g}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {items.map(t => {
                            const sel = tags.includes(t.id);
                            return (
                              <button key={t.id} type="button"
                                      onClick={() => sel ? setTags(tags.filter(x => x !== t.id)) : setTags([...tags, t.id])}
                                      className="tag-pill"
                                      style={{
                                        color: sel ? "var(--bg)" : `var(--b-${t.kind})`,
                                        background: sel ? `var(--b-${t.kind})` : "transparent",
                                        borderColor: `var(--b-${t.kind})`,
                                      }}>
                                #{t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          </div>

          <label className="ep-row" style={{ alignItems: "flex-start" }}>
            <span className="ep-k">note</span>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} />
          </label>
        </div>

        <div className="ep-foot">
          <button className="ep-del" onClick={() => onDelete(entry)}>delete</button>
          <span className="hint mono" style={{ color: "var(--ink-3)" }}>⌘↵ save · esc cancel</span>
          <button className="ep-save" onClick={save}>save changes</button>
        </div>
      </div>
    </div>
  );
}
