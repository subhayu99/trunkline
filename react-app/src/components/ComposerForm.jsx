// Shared form internals used by both the desktop anchored Composer and
// the mobile ComposerSheet. Owns: text input, dir toggle, when picker,
// tag select, quick-add chips, parse + submit logic.

import React, { useState, useRef, useEffect, useMemo } from "react";
import { fmtINR, fmtDateTime, isoLocal } from "../lib/format.js";
import TagSelect from "./TagSelect.jsx";

function deriveQuickAdd(entries, fallback) {
  const groups = new Map();
  for (const e of entries) {
    if (e.dir !== "out") continue;
    if (e.status === "future") continue;
    const label = (e.label || "").trim().toLowerCase();
    const tag = e.tags && e.tags[0];
    if (!label || !tag) continue;
    const key = label + "|" + tag;
    if (!groups.has(key)) groups.set(key, { label, tag, amounts: [] });
    groups.get(key).amounts.push(e.amount);
  }
  const ranked = [...groups.values()]
    .filter(g => g.amounts.length >= 2)
    .sort((a, b) => b.amounts.length - a.amounts.length)
    .slice(0, 6)
    .map(g => {
      const sorted = g.amounts.slice().sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      return { label: g.label, amount: Math.round(median), tag: g.tag, count: g.amounts.length };
    });
  if (ranked.length >= 3) return ranked;
  return fallback;
}

export default function ComposerForm({
  tweaks, onLog, config, tagById, now, onAddTag, entries,
  prefill, autoFocus = false, onSubmitted = null,
}) {
  const dynamicQuickAdd = useMemo(
    () => deriveQuickAdd(entries || [], config.quickAdd || []),
    [entries, config.quickAdd]
  );
  const [text, setText] = useState("");
  const [tag, setTag] = useState(config.tags[0]?.id || "chai");
  const [dir, setDir] = useState("out");
  const [whenISO, setWhenISO] = useState(isoLocal(now));
  const [whenOpen, setWhenOpen] = useState(false);
  const inputRef = useRef(null);
  const symbol = config.currencySymbol;

  const [pendingChip, setPendingChip] = useState(null);
  const [pendingAmount, setPendingAmount] = useState("");
  const pendingAmountRef = useRef(null);

  function parse(t) {
    const tokens = t.trim().split(/\s+/);
    const tags = [];
    const rest = [];
    for (const tok of tokens) {
      if (tok.startsWith("#") && tok.length > 1) tags.push(tok.slice(1).toLowerCase());
      else rest.push(tok);
    }
    if (!rest.length) return null;
    let amountIdx = -1;
    for (let i = rest.length - 1; i >= 0; i--) {
      if (/^\d+$/.test(rest[i])) { amountIdx = i; break; }
    }
    if (amountIdx === -1) return null;
    const amount = parseInt(rest[amountIdx], 10);
    const before = rest.slice(0, amountIdx).join(" ");
    const after  = rest.slice(amountIdx + 1).join(" ");
    return { label: before || "untitled", amount, note: after, tags };
  }

  const submit = (e) => {
    e && e.preventDefault();
    const parsed = parse(text);
    if (!parsed) return;
    const validTags = parsed.tags.filter(t => tagById[t]);
    const finalTags = validTags.length ? validTags : [tag];
    const when = new Date(whenISO).toISOString();
    onLog({ label: parsed.label, amount: parsed.amount, note: parsed.note, tags: finalTags, dir, when });
    setText("");
    setWhenISO(isoLocal(new Date()));
    inputRef.current && inputRef.current.focus();
    onSubmitted && onSubmitted();
  };

  const quickAdd = (q) => {
    setPendingChip(q);
    setPendingAmount(String(q.amount));
    setTimeout(() => {
      if (pendingAmountRef.current) {
        pendingAmountRef.current.focus();
        pendingAmountRef.current.select();
      }
    }, 0);
  };
  const cancelPending = () => { setPendingChip(null); setPendingAmount(""); };
  const submitPending = () => {
    if (!pendingChip) return;
    const amt = parseInt(pendingAmount, 10);
    if (!Number.isFinite(amt) || amt <= 0) return;
    onLog({
      label: pendingChip.label, amount: amt, note: "",
      tags: [pendingChip.tag], dir: "out", when: new Date().toISOString(),
    });
    cancelPending();
    onSubmitted && onSubmitted();
  };

  // Web Share Target prefill.
  useEffect(() => {
    if (!prefill || !prefill.text) return;
    setText(prefill.text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [prefill && prefill.at]);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  const whenDate = new Date(whenISO);
  const isFuture = whenDate.getTime() > now.getTime() + 60000;
  const isToday  = whenDate.toDateString() === now.toDateString();
  const whenSummary = isToday
    ? "today · " + String(whenDate.getHours()).padStart(2, "0") + ":" + String(whenDate.getMinutes()).padStart(2, "0")
    : fmtDateTime(whenDate);

  return (
    <>
      {pendingChip && (() => {
        const tobj = tagById[pendingChip.tag];
        return (
          <div className="quick-popup" role="dialog" aria-label="confirm quick add"
               style={{ borderColor: tobj ? `var(--b-${tobj.kind})` : undefined }}>
            <div className="qp-row">
              <span className="qp-label">{pendingChip.label}</span>
              <span className="qp-tag mono"
                    style={{ color: tobj ? `var(--b-${tobj.kind})` : "var(--ink-3)" }}>
                #{pendingChip.tag}
              </span>
            </div>
            <div className="qp-row">
              <span className="qp-prefix mono">{symbol}</span>
              <input
                ref={pendingAmountRef}
                type="number"
                inputMode="numeric"
                className="qp-amount mono"
                value={pendingAmount}
                onChange={e => setPendingAmount(e.target.value.replace(/[^\d]/g, ""))}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); submitPending(); }
                  if (e.key === "Escape") { e.preventDefault(); cancelPending(); }
                }}
              />
              <button type="button" className="qp-cancel" onClick={cancelPending}>cancel</button>
              <button type="button" className="qp-submit" onClick={submitPending}>add</button>
            </div>
          </div>
        );
      })()}

      <div className="chips">
        <span className="mono" style={{ color: "var(--ink-3)", padding: "5px 4px 5px 0" }}>quick:</span>
        {dynamicQuickAdd.map(q => {
          const tobj = tagById[q.tag];
          const isPending = pendingChip && pendingChip.label === q.label && pendingChip.tag === q.tag;
          return (
            <button key={q.label + "|" + q.tag}
                    className={`chip${isPending ? " pending" : ""}`}
                    onClick={() => quickAdd(q)}
                    title={q.count ? `used ${q.count}× · median amount` : undefined}
                    style={{ borderColor: tobj ? `var(--b-${tobj.kind})` : undefined }}>
              {q.emoji && <span>{q.emoji}</span>}
              <span>{q.label}</span>
              <span className="mono" style={{ color: tobj ? `var(--b-${tobj.kind})` : "var(--ink-3)", fontSize: 9 }}>#{q.tag}</span>
              <span className="amt">{fmtINR(q.amount, tweaks.locale, symbol)}</span>
            </button>
          );
        })}
      </div>

      <form className="composer-row" onSubmit={submit}>
        <span className="prompt">$ log</span>

        <div className="dir-toggle" role="group" aria-label="direction">
          <button type="button" className={dir === "out" ? "on" : ""} onClick={() => setDir("out")} aria-label="out">
            −<span className="dir-lbl">out</span>
          </button>
          <button type="button" className={dir === "in" ? "on" : ""} onClick={() => setDir("in")} aria-label="in">
            +<span className="dir-lbl">in</span>
          </button>
        </div>

        <div className="field">
          <span className="mono" style={{ color: "var(--ink-3)" }}>"</span>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder='chai 15 #chai   ·   uber 180 to office #transport   ·   swiggy 420 #food'
            spellCheck={false}
          />
          <span className="mono" style={{ color: "var(--ink-3)" }}>"</span>
        </div>

        <div className="when-wrap">
          <button type="button" className={`when-btn ${isFuture ? "future" : ""}`}
                  onClick={() => setWhenOpen(o => !o)} title="set datetime">
            <span className="mono" style={{ color: "var(--ink-3)", marginRight: 6 }}>at</span>
            {whenSummary}
          </button>
          {whenOpen && (
            <div className="when-pop">
              <input type="datetime-local" value={whenISO}
                     onChange={e => setWhenISO(e.target.value)}
                     style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "4px 6px", background: "var(--surface)", border: "1px solid var(--rule)", color: "var(--ink)", borderRadius: 3 }} />
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                <button type="button" className="when-quick" onClick={() => setWhenISO(isoLocal(new Date()))}>now</button>
                <button type="button" className="when-quick" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setWhenISO(isoLocal(d)); }}>yesterday</button>
                <button type="button" className="when-quick" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); setWhenISO(isoLocal(d)); }}>tomorrow</button>
                <button type="button" className="when-quick" style={{ marginLeft: "auto" }} onClick={() => setWhenOpen(false)}>done</button>
              </div>
            </div>
          )}
        </div>

        <TagSelect
          value={tag}
          onChange={setTag}
          allTags={config.tags}
          onCreate={onAddTag}
        />
        <button className="commit-btn" type="submit">add</button>
      </form>
    </>
  );
}

export { deriveQuickAdd };
