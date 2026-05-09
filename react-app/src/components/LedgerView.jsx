// Tabular ledger view of every entry. Honors the same range + selectedTag
// filters as the graph and shares the same edit-on-click affordance.

import React, { useMemo } from "react";
import { fmtINR, fmtDateShort } from "../lib/format.js";
import { computeRunningBalance } from "../lib/data.js";

function dayKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
         String(d.getDate()).padStart(2, "0");
}

function dayLabel(d) {
  const wd = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
  return fmtDateShort(d) + " · " + wd;
}

function timeLabel(d) {
  return String(d.getHours()).padStart(2, "0") + ":" +
         String(d.getMinutes()).padStart(2, "0");
}

function dirSymbol(dir) {
  if (dir === "in")    return "+";
  if (dir === "merge") return "↺";
  return "−";
}

export default function LedgerView({
  entries, tweaks, setTweak, range, selectedTag, onEditEntry, config, data, now, tagById,
}) {
  const symbol = config.currencySymbol;
  const order = tweaks.ledgerOrder || "newest";
  const setOrder = (v) => setTweak("ledgerOrder", v);

  // Compute running balance through ALL entries chronologically, then filter.
  // That way the balance shown for any row is correct regardless of filters.
  const showFuture = tweaks.showFuture !== false;
  const collapseFuture = !!tweaks.collapseFuture;
  const nowMs = now ? now.getTime() : Date.now();
  const rows = useMemo(() => {
    const sorted = entries.slice().sort((a, b) => new Date(a.when) - new Date(b.when));
    const withBal = computeRunningBalance(sorted, data.initialBalance);
    const filtered = withBal.filter(e => {
      const t = new Date(e.when).getTime();
      if (t < range.start || t > range.end) return false;
      if (selectedTag && !e.tags.includes(selectedTag)) return false;
      // Future-visibility toggles (matching the chart's behavior):
      //   showFuture=false  → drop entries explicitly tagged status:future
      //   collapseFuture=true → drop everything strictly after NOW
      if (!showFuture && e.status === "future") return false;
      if (collapseFuture && t > nowMs) return false;
      return true;
    });
    return order === "newest" ? filtered.reverse() : filtered;
  }, [entries, range.start, range.end, selectedTag, data.initialBalance, order,
      showFuture, collapseFuture, nowMs]);

  // Group by day for the date dividers.
  const groups = useMemo(() => {
    const out = [];
    let curKey = null, cur = null;
    for (const r of rows) {
      const d = new Date(r.when);
      const k = dayKey(d);
      if (k !== curKey) {
        cur = { key: k, date: d, entries: [], total: { in: 0, out: 0, merge: 0 } };
        out.push(cur);
        curKey = k;
      }
      cur.entries.push(r);
      if (r.dir === "in")    cur.total.in    += r.amount;
      if (r.dir === "out")   cur.total.out   += r.amount;
      if (r.dir === "merge") cur.total.merge += r.amount;
    }
    return out;
  }, [rows]);

  return (
    <div className="ledger-wrap">
      <div className="ledger-toolbar">
        <span className="ledger-count">
          {rows.length} {rows.length === 1 ? "entry" : "entries"}
          {selectedTag && tagById[selectedTag] && (
            <> · filtered <span style={{ color: `var(--b-${tagById[selectedTag].kind})` }}>
              #{tagById[selectedTag].label}
            </span></>
          )}
        </span>
        <span className="ledger-spacer" />
        <span className="ledger-order">
          <button className={order === "newest" ? "on" : ""}
                  onClick={() => setOrder("newest")}
                  type="button">newest first</button>
          <button className={order === "oldest" ? "on" : ""}
                  onClick={() => setOrder("oldest")}
                  type="button">oldest first</button>
        </span>
      </div>

      <div className="ledger" data-scroll-host>
        <div className="ledger-head">
          <div className="lh-time">time</div>
          <div className="lh-dir" />
          <div className="lh-label">label</div>
          <div className="lh-tags">tags</div>
          <div className="lh-amt">amount</div>
          <div className="lh-bal">balance</div>
        </div>

        {groups.length === 0 && (
          <div className="ledger-empty">no entries match this filter</div>
        )}

        {groups.map(g => (
          <div key={g.key} className="ledger-day">
            <div className="ld-head">
              <span className="ld-date">{dayLabel(g.date)}</span>
              <span className="ld-totals">
                {g.total.in    > 0 && <span className="ok">+{fmtINR(g.total.in,    tweaks.locale, symbol)}</span>}
                {g.total.out   > 0 && <span>−{fmtINR(g.total.out,   tweaks.locale, symbol)}</span>}
                {g.total.merge > 0 && <span style={{ color: "var(--ink-3)" }}>↺{fmtINR(g.total.merge, tweaks.locale, symbol)}</span>}
              </span>
            </div>

            {g.entries.map(e => {
              const primary = tagById[e.tags[0]];
              const kindColor = `var(--b-${e.kind})`;
              const isFuture = e.status === "future";
              const isHidden = selectedTag && !e.tags.includes(selectedTag);
              if (isHidden) return null;
              return (
                <div key={e.id}
                     className={`ledger-row${isFuture ? " future" : ""}${e.dir === "merge" ? " merge" : ""}`}
                     onClick={() => onEditEntry && onEditEntry(e)}
                     style={{ borderLeftColor: kindColor }}>
                  <div className="lr-time">{timeLabel(new Date(e.when))}</div>
                  <div className="lr-dir" style={{ color: e.dir === "in" ? "var(--ok)" : e.dir === "merge" ? "var(--ink-3)" : "var(--warn)" }}>
                    {dirSymbol(e.dir)}
                  </div>
                  <div className="lr-label">
                    <span className="lr-title">{e.label}</span>
                    {e.note && <span className="lr-note">{e.note}</span>}
                  </div>
                  <div className="lr-tags">
                    {e.tags.map(tid => {
                      const ti = tagById[tid];
                      if (!ti) return null;
                      return (
                        <span key={tid} className="lr-tag"
                              style={{ color: `var(--b-${ti.kind})`, borderColor: `var(--b-${ti.kind})` }}>
                          #{ti.label}
                        </span>
                      );
                    })}
                    {e.recur && <span className="lr-recur" title={`repeats every ${e.recur.every || 1} ${e.recur.freq}${e.recur.count ? " · " + e.recur.count + "×" : ""}`}>↻</span>}
                    {e.recurOccurrence && <span className="lr-recur-child" title={"recurrence #" + e.recurOccurrence}>·{e.recurOccurrence}</span>}
                  </div>
                  <div className="lr-amt" style={{ color: kindColor }}>
                    {dirSymbol(e.dir)}{fmtINR(e.amount, tweaks.locale, symbol).replace("-", "")}
                  </div>
                  <div className="lr-bal">{fmtINR(e.balanceAfter, tweaks.locale, symbol)}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
