// Dash view — scannable spend breakdown for the active date range.
//
// Three sections:
//   1. KPI strip:     income · committed · extras · net
//   2. By lane:       stacked bar + per-lane rows (drill into entries)
//   3. By tag:        grouped by lane, collapsible (drill into entries)
//
// Drill state is owned by the parent (App.jsx) so the topbar can swap to
// back-arrow + title — same pattern as MoreTab.

import React, { useMemo, useState } from "react";
import { fmtINR, fmtCompact, fmtDateShort } from "../lib/format.js";
import { breakdownByLane, breakdownByTag, entriesFor } from "../lib/breakdown.js";

function dayLabel(d) {
  const wd = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
  return fmtDateShort(d) + " · " + wd;
}

function dirSymbol(dir) {
  if (dir === "in") return "+";
  return "−";
}

function StackedBar({ items, total }) {
  if (!total || !items.length) {
    return <div className="dash-bar dash-bar-empty" aria-hidden="true" />;
  }
  return (
    <div className="dash-bar" role="img" aria-label="spend mix by lane">
      {items.map(l => {
        const pct = (l.total / total) * 100;
        if (pct < 0.5) return null;
        return (
          <div key={l.kind}
               className="dash-bar-seg"
               style={{ width: pct + "%", background: `var(--b-${l.kind})` }}
               title={`${l.kind} · ${pct.toFixed(0)}%`} />
        );
      })}
    </div>
  );
}

function LaneRow({ lane, kindMeta, symbol, locale, onClick }) {
  const isIncome = lane.side === "L";
  const sign = isIncome ? "+" : "−";
  const label = kindMeta?.vocab?.light || kindMeta?.label || lane.kind;
  return (
    <button type="button" className="dash-lane-row" onClick={onClick}>
      <span className="dash-lane-swatch"
            style={{ background: kindMeta?.color || `var(--b-${lane.kind})` }} />
      <span className="dash-lane-label">{label}</span>
      <span className="dash-lane-count">
        {lane.count} {lane.count === 1 ? "tx" : "txs"}
      </span>
      <span className={`dash-lane-amt${isIncome ? " ok" : ""}`}>
        {sign}{fmtINR(lane.total, locale, symbol)}
      </span>
      <span className="dash-lane-share">
        {(lane.share * 100).toFixed(0)}%
      </span>
    </button>
  );
}

function TagGroup({ group, kindMeta, symbol, locale, onTagClick, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!group.items.length) return null;
  const isIncome = kindMeta?.side === "L";
  const sign = isIncome ? "+" : "−";
  return (
    <div className={`dash-tg${open ? " open" : ""}`}>
      <button type="button"
              className="dash-tg-head"
              onClick={() => setOpen(o => !o)}
              style={{ color: `var(--b-${group.kind})` }}>
        <span className="dash-tg-caret">{open ? "▾" : "▸"}</span>
        <span className="dash-tg-label">{group.label}</span>
        <span className="dash-tg-amt">
          {group.laneTotal > 0
            ? `${sign}${fmtINR(group.laneTotal, locale, symbol)}`
            : "—"}
        </span>
      </button>
      {open && (
        <div className="dash-tg-body">
          {group.items.map(t => (
            <button key={t.id}
                    type="button"
                    className="dash-tag-row"
                    onClick={() => onTagClick(t.id)}
                    disabled={t.count === 0}>
              <span className="dash-tag-chip"
                    style={{ color: `var(--b-${group.kind})`,
                             borderColor: `var(--b-${group.kind})` }}>
                #{t.label}
              </span>
              <span className="dash-tag-count">
                {t.count || ""}
              </span>
              <span className="dash-tag-amt">
                {t.count
                  ? `${sign}${fmtINR(t.amount, locale, symbol)}`
                  : "—"}
              </span>
              <span className="dash-tag-share">
                {t.count ? (t.share * 100).toFixed(0) + "%" : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DrillView({ entries, selector, kinds, tagById, symbol, locale, onEditEntry, onBack }) {
  const grouped = useMemo(() => {
    const out = [];
    let curKey = null, cur = null;
    for (const e of entries) {
      const d = new Date(e.when);
      const k = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
      if (k !== curKey) {
        cur = { key: k, date: d, entries: [] };
        out.push(cur);
        curKey = k;
      }
      cur.entries.push(e);
    }
    return out;
  }, [entries]);

  const meta = selector.type === "lane"
    ? (kinds.find(k => k.id === selector.id) || {})
    : (tagById[selector.id] || {});
  const titleColor = selector.type === "lane"
    ? `var(--b-${selector.id})`
    : `var(--b-${meta.kind})`;
  const title = selector.type === "lane"
    ? (meta.vocab?.light || meta.label || selector.id)
    : `#${meta.label || selector.id}`;
  const total = entries.reduce((s, e) => s + (e.dir === "in" ? e.amount : e.dir === "out" ? -e.amount : 0), 0);

  return (
    <div className="dash-drill">
      {onBack && (
        <button type="button" className="dash-drill-back" onClick={onBack}>
          ← back
        </button>
      )}
      <div className="dash-drill-head" style={{ color: titleColor }}>
        <span className="dash-drill-title">{title}</span>
        <span className="dash-drill-meta">
          {entries.length} {entries.length === 1 ? "entry" : "entries"} ·{" "}
          {total >= 0 ? "+" : "−"}{fmtINR(Math.abs(total), locale, symbol)}
        </span>
      </div>
      {grouped.length === 0 ? (
        <div className="dash-empty">no entries in this range</div>
      ) : grouped.map(g => (
        <div key={g.key} className="dash-drill-day">
          <div className="dash-drill-day-head">{dayLabel(g.date)}</div>
          {g.entries.map(e => {
            const kindColor = `var(--b-${e.kind})`;
            return (
              <button key={e.id}
                      type="button"
                      className="dash-drill-row"
                      onClick={() => onEditEntry && onEditEntry(e)}
                      style={{ borderLeftColor: kindColor }}>
                <span className="dash-dr-label">
                  <span className="dash-dr-title">{e.label}</span>
                  {e.note && <span className="dash-dr-note">{e.note}</span>}
                </span>
                <span className="dash-dr-tags">
                  {e.tags.map(tid => {
                    const ti = tagById[tid];
                    if (!ti) return null;
                    return (
                      <span key={tid}
                            className="dash-dr-tag"
                            style={{ color: `var(--b-${ti.kind})`,
                                     borderColor: `var(--b-${ti.kind})` }}>
                        #{ti.label}
                      </span>
                    );
                  })}
                </span>
                <span className="dash-dr-amt" style={{ color: kindColor }}>
                  {dirSymbol(e.dir)}{fmtINR(e.amount, locale, symbol).replace("-", "")}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function Dash({
  tweaks, config, kinds, entries, range, tagById,
  drill, setDrill,
  onEditEntry,
  // When provided, the drill view renders its own inline back button (used
  // by the desktop RightRail panel where there's no shared topbar to swap).
  // On mobile the topbar back-arrow handles this — leave it null there.
  drillBackInline = false,
}) {
  const symbol = config.currencySymbol;
  const locale = tweaks.locale;
  const kindById = useMemo(
    () => Object.fromEntries(kinds.map(k => [k.id, k])),
    [kinds]
  );

  const lane = useMemo(
    () => breakdownByLane(entries, range, kinds),
    [entries, range, kinds]
  );
  const tagGroups = useMemo(
    () => breakdownByTag(entries, range, config.tags, config.tagGroups),
    [entries, range, config.tags, config.tagGroups]
  );

  const drillEntries = useMemo(
    () => drill ? entriesFor(entries, range, drill) : null,
    [drill, entries, range]
  );

  if (drill) {
    return (
      <div className="dash-wrap" data-scroll-host>
        <DrillView entries={drillEntries}
                   selector={drill}
                   kinds={kinds}
                   tagById={tagById}
                   symbol={symbol}
                   locale={locale}
                   onEditEntry={onEditEntry}
                   onBack={drillBackInline ? () => setDrill(null) : null} />
      </div>
    );
  }

  const rangeOut = lane.totalOut;
  const spendBarLanes = lane.byLane.filter(l => l.side === "R");

  return (
    <div className="dash-wrap" data-scroll-host>
      <div className="dash-kpis">
        <div className="dash-kpi">
          <div className="dash-kpi-k">income</div>
          <div className="dash-kpi-v ok"
               title={`+${fmtINR(lane.income, locale, symbol)}`}>
            +{fmtCompact(lane.income, symbol)}
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-k">committed</div>
          <div className="dash-kpi-v"
               title={`−${fmtINR(lane.committed, locale, symbol)}`}>
            −{fmtCompact(lane.committed, symbol)}
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-k">extras</div>
          <div className="dash-kpi-v warn"
               title={`−${fmtINR(lane.extras, locale, symbol)}`}>
            −{fmtCompact(lane.extras, symbol)}
          </div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-k">net</div>
          <div className={`dash-kpi-v${lane.net < 0 ? " warn" : " ok"}`}
               title={`${lane.net >= 0 ? "+" : "−"}${fmtINR(Math.abs(lane.net), locale, symbol)}`}>
            {lane.net >= 0 ? "+" : "−"}{fmtCompact(Math.abs(lane.net), symbol)}
          </div>
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-head">
          <span>by lane</span>
          <span className="dash-card-meta">
            {rangeOut > 0
              ? `−${fmtCompact(rangeOut, symbol)} spent`
              : "no spend in range"}
          </span>
        </div>
        <StackedBar items={spendBarLanes} total={lane.spendByLane} />
        <div className="dash-lanes">
          {lane.byLane.length === 0 && (
            <div className="dash-empty">no activity in this range</div>
          )}
          {lane.byLane.map(l => (
            <LaneRow key={l.kind}
                     lane={l}
                     kindMeta={kindById[l.kind]}
                     symbol={symbol}
                     locale={locale}
                     onClick={() => setDrill({ type: "lane", id: l.kind })} />
          ))}
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-head">
          <span>by tag</span>
          <span className="dash-card-meta">grouped by lane</span>
        </div>
        <div className="dash-tags">
          {tagGroups.map(g => (
            <TagGroup key={g.kind}
                      group={g}
                      kindMeta={kindById[g.kind]}
                      symbol={symbol}
                      locale={locale}
                      defaultOpen={g.laneTotal > 0}
                      onTagClick={(id) => setDrill({ type: "tag", id })} />
          ))}
        </div>
      </div>
    </div>
  );
}
