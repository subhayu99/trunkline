// App shell: top bar, tag rail, composer, edit panel, tweaks, zoom controls.

const { useState, useMemo, useEffect, useRef, useCallback } = React;

const DEFAULT_TWEAKS = /*EDITMODE-BEGIN*/{
  "theme": "midnight",
  "vocabIntensity": "light",
  "thicknessScale": "linear",
  "showFuture": true,
  "locale": "lakh",
  "zoom": 1,
  "rangePreset": "all",
  "rangeStart": null,
  "rangeEnd": null
}/*EDITMODE-END*/;

// ---------- range presets ----------
function rangeFromPreset(preset, customStart, customEnd) {
  const now = new Date(NOW);
  const today = new Date(now); today.setHours(23,59,59,999);
  if (preset === "custom" && customStart && customEnd) {
    const s = new Date(customStart); s.setHours(0,0,0,0);
    const e = new Date(customEnd); e.setHours(23,59,59,999);
    return { start: s.getTime(), end: e.getTime(), label: fmtDateShort(s) + " → " + fmtDateShort(e) };
  }
  if (preset === "7d") {
    const s = new Date(now); s.setDate(s.getDate() - 6); s.setHours(0,0,0,0);
    return { start: s.getTime(), end: today.getTime(), label: "last 7 days" };
  }
  if (preset === "30d") {
    const s = new Date(now); s.setDate(s.getDate() - 29); s.setHours(0,0,0,0);
    return { start: s.getTime(), end: today.getTime(), label: "last 30 days" };
  }
  if (preset === "thisMonth") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59);
    return { start: s.getTime(), end: e.getTime(), label: "this month" };
  }
  if (preset === "lastMonth") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0,0,0);
    const e = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59);
    return { start: s.getTime(), end: e.getTime(), label: "last month" };
  }
  if (preset === "ytd") {
    const s = new Date(now.getFullYear(), 0, 1, 0,0,0);
    return { start: s.getTime(), end: today.getTime(), label: "year to date" };
  }
  if (preset === "futureOnly") {
    const s = new Date(now); s.setMinutes(s.getMinutes() + 1);
    const e = new Date(now); e.setDate(e.getDate() + 60);
    return { start: s.getTime(), end: e.getTime(), label: "upcoming · 60d" };
  }
  return { start: -Infinity, end: Infinity, label: "all time" };
}

// ---------- helpers ----------
function isoLocal(d) {
  // local YYYY-MM-DDTHH:mm for <input type="datetime-local">
  const pad = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()) +
         "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

// ---------- theme toggle (3-way) ----------
function ThemeToggle({ value, onChange }) {
  const items = [
    { v: "paper",    label: "paper",    icon: "☼" },
    { v: "terminal", label: "terminal", icon: "❯" },
    { v: "midnight", label: "midnight", icon: "☾" },
  ];
  return (
    <div className="theme-toggle" role="group" aria-label="theme">
      {items.map(it => (
        <button key={it.v}
                type="button"
                className={value === it.v ? "on" : ""}
                title={it.label}
                onClick={() => onChange(it.v)}>
          <span className="ico">{it.icon}</span>
          <span className="lbl">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- range chip (with popover for custom range + presets) ----------
function RangeChip({ tweaks, setTweak, range }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const presets = [
    { v: "all",        l: "all time" },
    { v: "7d",         l: "last 7 days" },
    { v: "30d",        l: "last 30 days" },
    { v: "thisMonth",  l: "this month" },
    { v: "lastMonth",  l: "last month" },
    { v: "ytd",        l: "year to date" },
    { v: "futureOnly", l: "upcoming only" },
  ];

  const customStart = tweaks.rangeStart || isoLocal(new Date(NOW.getFullYear(), NOW.getMonth(), 1));
  const customEnd   = tweaks.rangeEnd   || isoLocal(NOW);
  const isAll = tweaks.rangePreset === "all";

  return (
    <div className="range-chip-wrap" ref={ref}>
      <button className={`range-chip${isAll ? "" : " active"}`} onClick={() => setOpen(o => !o)} title="select date range">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8"  y1="2" x2="8"  y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>{range.label}</span>
        {!isAll && <span className="x" onClick={(e) => { e.stopPropagation(); setTweak({ rangePreset: "all", rangeStart: null, rangeEnd: null }); }}>×</span>}
      </button>
      {open && (
        <div className="range-pop">
          <div className="rp-section">
            <div className="rp-label">presets</div>
            <div className="rp-grid">
              {presets.map(p => (
                <button key={p.v}
                        className={tweaks.rangePreset === p.v ? "on" : ""}
                        onClick={() => { setTweak({ rangePreset: p.v }); setOpen(false); }}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>
          <div className="rp-section">
            <div className="rp-label">custom range</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="rp-row"><span>from</span>
                <input type="datetime-local" value={customStart}
                       onChange={e => setTweak({ rangeStart: e.target.value, rangePreset: "custom" })}/>
              </label>
              <label className="rp-row"><span>to</span>
                <input type="datetime-local" value={customEnd}
                       onChange={e => setTweak({ rangeEnd: e.target.value, rangePreset: "custom" })}/>
              </label>
              <button className="rp-apply" onClick={() => { setTweak({ rangePreset: "custom" }); setOpen(false); }}>
                apply custom range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- top bar ----------
function TopBar({ tweaks, setTweak, entries, range }) {
  // Stats are computed for the SELECTED RANGE.
  // "opening balance" = balance at start of range (after walking history before it).
  // "projected close"  = balance at end of range (after applying everything in the range).
  const { totals, openingBal, closingBal, balanceAtNow } = useMemo(() => {
    let inc = 0, fixed = 0, extras = 0, loans = 0, sav = 0;
    let bal = INITIAL_BALANCE;
    let opening = null;
    let atNow = null;
    const sorted = entries.slice().sort((a,b) => new Date(a.when) - new Date(b.when));
    for (const e of sorted) {
      const t = new Date(e.when).getTime();
      if (atNow === null && t > NOW.getTime()) atNow = bal;
      if (opening === null && t >= range.start) opening = bal;
      if (t >= range.start && t <= range.end) {
        if (e.dir === "in") inc += e.amount;
        else if (e.dir !== "merge") {
          if (e.kind === "fixed")        fixed  += e.amount;
          else if (e.kind === "extras" && e.status !== "future") extras += e.amount;
          else if (e.kind === "loans")   loans  += e.amount;
          else if (e.kind === "savings") sav    += e.amount;
        }
      }
      if (t <= range.end) {
        if (e.dir === "in")  bal += e.amount;
        if (e.dir === "out") bal -= e.amount;
        if (e.dir === "merge") bal -= e.amount;
      }
    }
    if (opening === null) opening = bal;
    if (atNow === null) atNow = bal;
    return {
      totals: { inc, fixed, extras, loans, sav, spent: fixed + extras + loans + sav },
      openingBal: opening, closingBal: bal, balanceAtNow: atNow,
    };
  }, [entries, range.start, range.end]);

  const rangeIsAll = range.start === -Infinity;

  return (
    <div className="topbar">
      <div className="repo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--b-main)" }}>
          <circle cx="6" cy="3" r="2"></circle>
          <circle cx="6" cy="12" r="2"></circle>
          <circle cx="18" cy="9" r="2"></circle>
          <path d="M6 5v14"></path>
          <path d="M6 7h6a4 4 0 0 1 4 4v0"></path>
        </svg>
        <span><b>~/finance</b></span>
      </div>

      <RangeChip tweaks={tweaks} setTweak={setTweak} range={range} />
      <ThemeToggle value={tweaks.theme} onChange={v => setTweak("theme", v)} />

      <div className="stats">
        {!rangeIsAll && (
          <div className="stat">
            <div className="k">opening</div>
            <div className="v" style={{ color: "var(--ink-2)" }}>{fmtINR(openingBal, tweaks.locale)}</div>
          </div>
        )}
        <div className="stat">
          <div className="k">income · in range</div>
          <div className="v ok">+{fmtINR(totals.inc, tweaks.locale)}</div>
        </div>
        <div className="stat">
          <div className="k">committed</div>
          <div className="v">−{fmtINR(totals.spent, tweaks.locale)}</div>
        </div>
        <div className="stat">
          <div className="k">extras</div>
          <div className="v warn">−{fmtINR(totals.extras, tweaks.locale)}</div>
        </div>
        <div className="stat">
          <div className="k">{rangeIsAll ? "balance · today" : "closing balance"}</div>
          <div className="v" style={{ color: closingBal < 0 ? "var(--warn)" : "var(--ink)" }}>{fmtINR(rangeIsAll ? balanceAtNow : closingBal, tweaks.locale)}</div>
        </div>
      </div>
    </div>
  );
}

// ---------- tag rail ----------
function TagRail({ tweaks, hoveredKind, setHoveredKind, selectedTag, setSelectedTag, entries, collapsed, onToggleCollapse }) {
  const tagTotals = useMemo(() => totalsByTag(entries), [entries]);

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
          {TAGS.map(t => (
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

  const groups = [
    { key: "income",  label: "incoming" },
    { key: "fixed",   label: "fixed · committed" },
    { key: "extras",  label: "extras · day-to-day" },
    { key: "credit",  label: "credit cards" },
    { key: "loans",   label: "loans · EMIs" },
    { key: "savings", label: "savings" },
  ];

  return (
    <div className="left-rail">
      <div className="rail-header">
        <button onClick={onToggleCollapse} title="collapse"
          style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, padding: 0 }}>
          ‹
        </button>
        <span>tags</span>
        <span className="count">{TAGS.length}</span>
      </div>

      {selectedTag && (
        <div style={{ padding: "0 16px 8px" }}>
          <button onClick={() => setSelectedTag(null)}
            style={{ width: "100%", background: "var(--ink)", color: "var(--bg)", border: "none",
              fontFamily: "var(--font-mono)", fontSize: 10, padding: "5px", cursor: "pointer", borderRadius: 3 }}>
            clear filter · #{TAG_BY_ID[selectedTag] && TAG_BY_ID[selectedTag].label}
          </button>
        </div>
      )}

      {groups.map(g => {
        const items = TAGS.filter(t => t.kind === g.key);
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
                  <div className="amt">{tot.count ? fmtINR(amt, tweaks.locale) : "—"}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ---------- right rail (insights + recent log) ----------
function RightRail({ tweaks, log, collapsed, onToggleCollapse, onEditEntry }) {
  if (collapsed) {
    return (
      <div className="right-rail" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" }}>
        <button onClick={onToggleCollapse} title="expand insights"
          style={{
            background: "var(--surface)", border: "1px solid var(--rule)", color: "var(--ink-2)",
            fontFamily: "var(--font-mono)", fontSize: 10, padding: "6px 4px", cursor: "pointer",
            borderRadius: 4, writingMode: "vertical-rl", letterSpacing: ".1em", textTransform: "uppercase",
          }}>
          ‹ insights
        </button>
      </div>
    );
  }
  return (
    <div className="right-rail">
      <div className="rail-header">
        <span>insights</span>
        <button onClick={onToggleCollapse} title="collapse"
          style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          ›
        </button>
      </div>

      {INSIGHTS.map((ins, i) => (
        <div key={i} className={`insight ${ins.severity}`}>
          <div className="head">
            <span>{ins.kind}</span>
            <span className="mono" style={{ color: "var(--ink-3)" }}>auto</span>
          </div>
          <div className="title">{ins.title}</div>
          <div className="body">{ins.body}</div>
        </div>
      ))}

      <div className="rail-header" style={{ marginTop: 12 }}>
        <span>recent log</span>
        <span className="count">{log.length}</span>
      </div>
      {log.length === 0 ? (
        <div style={{ padding: "0 16px 12px", color: "var(--ink-3)", fontSize: 12 }}>
          nothing logged yet · try the composer below
        </div>
      ) : (
        log.slice().reverse().map((e, i) => {
          const tag = TAG_BY_ID[e.tags[0]];
          return (
            <div key={e.id || i}
                 onClick={() => onEditEntry(e)}
                 style={{ padding: "6px 16px", borderTop: "1px dashed var(--rule)", display: "flex", justifyContent: "space-between", gap: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div className="mono" style={{ fontSize: 11 }}>{e.label}</div>
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>
                  {tag && <span style={{ color: `var(--b-${tag.kind})` }}>#{tag.label}</span>} · {e.id}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink)" }}>
                {e.dir === "in" ? "+" : "−"}{fmtINR(e.amount, tweaks.locale).replace("-","")}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---------- Composer ----------
function Composer({ tweaks, onLog, zoom, setZoom }) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState("chai");
  const [dir, setDir] = useState("out"); // out | in
  const [whenISO, setWhenISO] = useState(isoLocal(NOW));
  const [whenOpen, setWhenOpen] = useState(false);
  const inputRef = useRef(null);

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
    const after = rest.slice(amountIdx + 1).join(" ");
    return { label: before || "untitled", amount, note: after, tags };
  }

  const submit = (e) => {
    e && e.preventDefault();
    const parsed = parse(text);
    if (!parsed) return;
    const validTags = parsed.tags.filter(t => TAG_BY_ID[t]);
    const finalTags = validTags.length ? validTags : [tag];
    const when = new Date(whenISO).toISOString();
    onLog({ label: parsed.label, amount: parsed.amount, note: parsed.note, tags: finalTags, dir, when });
    setText("");
    // reset datetime to now after each entry, leave tag selection
    setWhenISO(isoLocal(new Date()));
    inputRef.current && inputRef.current.focus();
  };

  const quickAdd = (q) => {
    onLog({ label: q.label, amount: q.amount, note: "", tags: [q.tag], dir: "out", when: new Date().toISOString() });
  };

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current && inputRef.current.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // friendly when-label
  const whenDate = new Date(whenISO);
  const isFuture = whenDate.getTime() > NOW.getTime() + 60000;
  const isToday  = whenDate.toDateString() === NOW.toDateString();
  const whenSummary = isToday
    ? "today · " + String(whenDate.getHours()).padStart(2,"0") + ":" + String(whenDate.getMinutes()).padStart(2,"0")
    : fmtDateTime(whenDate);

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

      <div className="chips">
        <span className="mono" style={{ color: "var(--ink-3)", padding: "5px 4px 5px 0" }}>quick:</span>
        {QUICK_ADD.map(q => {
          const tobj = TAG_BY_ID[q.tag];
          return (
            <button key={q.label} className="chip" onClick={() => quickAdd(q)} style={{ borderColor: tobj ? `var(--b-${tobj.kind})` : undefined }}>
              <span>{q.emoji}</span>
              <span>{q.label}</span>
              <span className="mono" style={{ color: tobj ? `var(--b-${tobj.kind})` : "var(--ink-3)", fontSize: 9 }}>#{q.tag}</span>
              <span className="amt">{fmtINR(q.amount, tweaks.locale)}</span>
            </button>
          );
        })}
      </div>

      <form className="composer-row" onSubmit={submit}>
        <span className="prompt">$ log</span>

        <div className="dir-toggle" role="group" aria-label="direction">
          <button type="button" className={dir === "out" ? "on" : ""} onClick={() => setDir("out")}>−out</button>
          <button type="button" className={dir === "in" ? "on" : ""} onClick={() => setDir("in")}>+in</button>
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
          <button type="button" className={`when-btn ${isFuture ? "future" : ""}`} onClick={() => setWhenOpen(o => !o)} title="set datetime">
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
                <button type="button" className="when-quick" onClick={() => { const d=new Date(); d.setDate(d.getDate()-1); setWhenISO(isoLocal(d)); }}>yesterday</button>
                <button type="button" className="when-quick" onClick={() => { const d=new Date(); d.setDate(d.getDate()+1); setWhenISO(isoLocal(d)); }}>tomorrow</button>
                <button type="button" className="when-quick" style={{ marginLeft: "auto" }} onClick={() => setWhenOpen(false)}>done</button>
              </div>
            </div>
          )}
        </div>

        <select className="branch-select" value={tag} onChange={e => setTag(e.target.value)} title="default tag if none in text">
          {TAGS.map(t => (
            <option key={t.id} value={t.id}>#{t.label}</option>
          ))}
        </select>
        <button className="commit-btn" type="submit">add</button>
      </form>
      <div className="hint-row">
        <span className="hint">⌘K focus · ctrl-wheel zoom · scroll up = future · click an entry to edit</span>
      </div>
    </div>
  );
}

// ---------- Edit Panel ----------
function EditPanel({ entry, onClose, onSave, onDelete, tweaks }) {
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
  const [recurUntil, setRecurUntil] = useState((entry.recur && entry.recur.until) ? isoLocal(new Date(entry.recur.until)) : isoLocal(new Date(NOW.getFullYear()+1, NOW.getMonth(), NOW.getDate())));

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
    if (!t || !TAG_BY_ID[t]) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  };

  const save = () => {
    let recur = null;
    if (recurOn) {
      recur = { freq: recurFreq, every: parseInt(recurEvery,10) || 1 };
      if (recurMode === "count") recur.count = parseInt(recurCount,10) || 1;
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

  // group tags for the picker
  const tagGroups = ["income","fixed","extras","credit","loans","savings"];

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
            <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g,""))} className="mono" />
          </label>

          <div className="ep-row">
            <span className="ep-k">direction</span>
            <div className="dir-toggle">
              <button type="button" className={dir === "out" ? "on" : ""} onClick={() => setDir("out")}>−out</button>
              <button type="button" className={dir === "in" ? "on" : ""} onClick={() => setDir("in")}>+in</button>
              <button type="button" className={dir === "merge" ? "on" : ""} onClick={() => setDir("merge")}>↺ merge</button>
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
                  const ti = TAG_BY_ID[t];
                  return (
                    <span key={t} className="tag-chip-removable" style={{ color: ti ? `var(--b-${ti.kind})` : "var(--ink-2)" }}>
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
                    const items = TAGS.filter(t => t.kind === g);
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

// ---------- App ----------
function App() {
  const [tweaks, setTweak] = useTweaks(DEFAULT_TWEAKS);
  const range = useMemo(
    () => rangeFromPreset(tweaks.rangePreset, tweaks.rangeStart, tweaks.rangeEnd),
    [tweaks.rangePreset, tweaks.rangeStart, tweaks.rangeEnd]
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
  }, [tweaks.theme]);

  // entries — start as ENTRIES, mutate via state
  const [rawEntries, setRawEntries] = useState(() => ENTRIES.slice());
  // Materialize recurring entries into concrete future occurrences
  const entries = useMemo(() => materializeRecurring(rawEntries), [rawEntries]);
  const [hoveredKind, setHoveredKind] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [log, setLog] = useState([]);
  const [freshEntry, setFreshEntry] = useState(null);
  const [editing, setEditing] = useState(null);
  const initialW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const [rightCollapsed, setRightCollapsed] = useState(initialW < 1280);
  const [leftCollapsed, setLeftCollapsed] = useState(initialW < 1024);

  // ctrl-wheel zoom (debounced via rAF)
  useEffect(() => {
    let raf = null;
    const onZoom = (e) => {
      const delta = e.detail || 0;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setTweak("zoom", Math.max(0.5, Math.min(4, +(((tweaks.zoom || 1) + delta).toFixed(2)))));
      });
    };
    window.addEventListener("graph-zoom", onZoom);
    return () => { window.removeEventListener("graph-zoom", onZoom); if (raf) cancelAnimationFrame(raf); };
  }, [tweaks.zoom]);

  const onLog = useCallback(({ label, amount, note, tags, dir, when }) => {
    const id = "e" + Math.floor(Math.random() * 100000);
    const primaryTag = TAG_BY_ID[tags[0]];
    const kind = primaryTag ? primaryTag.kind : "extras";
    const entry = {
      id, when: when || new Date().toISOString(),
      dir: dir || "out", amount, tags, label, note: note || "",
      status: statusFor(when || new Date().toISOString()),
      kind,
    };
    setRawEntries(es => [...es, entry]);
    setLog(l => [...l, entry]);
    setFreshEntry(entry);
    setTimeout(() => setFreshEntry(null), 800);
  }, []);

  const onSaveEdit = useCallback((updated) => {
    updated.status = statusFor(updated.when);
    const primaryTag = TAG_BY_ID[updated.tags[0]];
    if (primaryTag) updated.kind = primaryTag.kind;
    // edits to a recurring child apply to its parent
    const targetId = updated.recurParentId || updated.id;
    setRawEntries(es => es.map(e => e.id === targetId ? { ...e, ...updated, id: targetId } : e));
    setLog(l => l.map(e => e.id === updated.id ? { ...e, ...updated } : e));
    setEditing(null);
  }, []);

  const onDeleteEntry = useCallback((entry) => {
    const targetId = entry.recurParentId || entry.id;
    setRawEntries(es => es.filter(e => e.id !== targetId));
    setLog(l => l.filter(e => e.id !== entry.id));
    setEditing(null);
  }, []);

  const setZoom = (v) => setTweak("zoom", v);

  return (
    <div className="app">
      <TopBar tweaks={tweaks} setTweak={setTweak} entries={entries} range={range} />

      <div className={`main${leftCollapsed ? "" : " left-expanded"}${rightCollapsed ? "" : " right-expanded"}`}>
        <TagRail
          tweaks={tweaks}
          hoveredKind={hoveredKind}
          setHoveredKind={setHoveredKind}
          selectedTag={selectedTag}
          setSelectedTag={setSelectedTag}
          entries={entries}
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed(c => !c)}
        />
        <MoneyGraph
          tweaks={tweaks}
          range={range}
          freshEntry={freshEntry}
          hoveredKind={hoveredKind}
          setHoveredKind={setHoveredKind}
          selectedTag={selectedTag}
          onEditEntry={setEditing}
          entries={entries}
        />
        <RightRail
          tweaks={tweaks}
          log={log}
          collapsed={rightCollapsed}
          onToggleCollapse={() => setRightCollapsed(c => !c)}
          onEditEntry={setEditing}
        />
      </div>

      <Composer tweaks={tweaks} onLog={onLog} zoom={tweaks.zoom} setZoom={setZoom} />

      {editing && (
        <EditPanel entry={editing}
                   tweaks={tweaks}
                   onClose={() => setEditing(null)}
                   onSave={onSaveEdit}
                   onDelete={onDeleteEntry} />
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakRadio
            label="Theme"
            value={tweaks.theme}
            onChange={v => setTweak("theme", v)}
            options={[
              { value: "paper", label: "paper" },
              { value: "terminal", label: "terminal" },
              { value: "midnight", label: "midnight" },
            ]}
          />
        </TweakSection>

        <TweakSection label="Vocabulary">
          <TweakRadio
            label="Intensity"
            value={tweaks.vocabIntensity}
            onChange={v => setTweak("vocabIntensity", v)}
            options={[
              { value: "heavy", label: "heavy" },
              { value: "medium", label: "medium" },
              { value: "light", label: "light" },
            ]}
          />
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4 }}>
            heavy · git-style refs (income/*, extras/*)<br />
            medium · friendly labels<br />
            light · plain language
          </div>
        </TweakSection>

        <TweakSection label="Graph">
          <TweakRadio
            label="Flow thickness scale"
            value={tweaks.thicknessScale}
            onChange={v => setTweak("thicknessScale", v)}
            options={[
              { value: "sqrt", label: "sqrt" },
              { value: "linear", label: "linear" },
              { value: "log", label: "log" },
            ]}
          />
          <TweakToggle
            label="Show upcoming"
            value={tweaks.showFuture}
            onChange={v => setTweak("showFuture", v)}
          />
          <TweakSlider
            label="Zoom (vertical)"
            value={tweaks.zoom}
            min={0.5} max={4} step={0.1}
            onChange={v => setTweak("zoom", v)}
          />
        </TweakSection>

        <TweakSection label="Format">
          <TweakRadio
            label="Number format"
            value={tweaks.locale}
            onChange={v => setTweak("locale", v)}
            options={[
              { value: "lakh", label: "1,20,000" },
              { value: "western", label: "120,000" },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
