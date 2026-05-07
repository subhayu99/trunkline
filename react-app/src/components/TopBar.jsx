import React, { useMemo } from "react";
import { fmtINR } from "../lib/format.js";
import RangeChip from "./RangeChip.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import ViewToggle from "./ViewToggle.jsx";
import FutureToggle from "./FutureToggle.jsx";

export default function TopBar({
  tweaks, setTweak, entries, range, config, data, now, hamburger,
}) {
  const initialBalance = data.initialBalance;

  const { totals, openingBal, closingBal, balanceAtNow } = useMemo(() => {
    let inc = 0, fixed = 0, extras = 0, loans = 0, sav = 0;
    let bal = initialBalance;
    let opening = null;
    let atNow = null;
    const sorted = entries.slice().sort((a, b) => new Date(a.when) - new Date(b.when));
    for (const e of sorted) {
      const t = new Date(e.when).getTime();
      if (atNow === null && t > now.getTime()) atNow = bal;
      if (opening === null && t >= range.start) opening = bal;
      if (t >= range.start && t <= range.end) {
        if (e.dir === "in") inc += e.amount;
        else if (e.dir !== "merge") {
          if (e.kind === "fixed")   fixed  += e.amount;
          else if (e.kind === "extras" && e.status !== "future") extras += e.amount;
          else if (e.kind === "loans")   loans  += e.amount;
          else if (e.kind === "savings") sav    += e.amount;
        }
      }
      if (t <= range.end) {
        if (e.dir === "in")    bal += e.amount;
        if (e.dir === "out")   bal -= e.amount;
        if (e.dir === "merge") bal -= e.amount;
      }
    }
    if (opening === null) opening = bal;
    if (atNow === null) atNow = bal;
    return {
      totals: { inc, fixed, extras, loans, sav, spent: fixed + extras + loans + sav },
      openingBal: opening, closingBal: bal, balanceAtNow: atNow,
    };
  }, [entries, range.start, range.end, initialBalance, now]);

  const rangeIsAll = range.start === -Infinity;
  const symbol = config.currencySymbol;

  return (
    <div className="topbar">
      {hamburger}
      <div className="repo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--b-main)" }}>
          <circle cx="6" cy="3" r="2"></circle>
          <circle cx="6" cy="12" r="2"></circle>
          <circle cx="18" cy="9" r="2"></circle>
          <path d="M6 5v14"></path>
          <path d="M6 7h6a4 4 0 0 1 4 4v0"></path>
        </svg>
        <span><b>trunkline</b></span>
      </div>

      <RangeChip tweaks={tweaks} setTweak={setTweak} range={range}
                 presets={config.rangePresets} now={now} />
      <ViewToggle value={tweaks.viewMode || "graph"}
                  onChange={v => setTweak("viewMode", v)} />
      <FutureToggle showFuture={tweaks.showFuture}
                    collapseFuture={!!tweaks.collapseFuture}
                    onChange={(edits) => setTweak(edits)} />
      <ThemeToggle value={tweaks.theme} themes={config.themes}
                   onChange={v => setTweak("theme", v)} />

      <div className="stats">
        {!rangeIsAll && (
          <div className="stat">
            <div className="k">opening</div>
            <div className="v" style={{ color: "var(--ink-2)" }}>{fmtINR(openingBal, tweaks.locale, symbol)}</div>
          </div>
        )}
        <div className="stat">
          <div className="k">income · in range</div>
          <div className="v ok">+{fmtINR(totals.inc, tweaks.locale, symbol)}</div>
        </div>
        <div className="stat">
          <div className="k">committed</div>
          <div className="v">−{fmtINR(totals.spent, tweaks.locale, symbol)}</div>
        </div>
        <div className="stat">
          <div className="k">extras</div>
          <div className="v warn">−{fmtINR(totals.extras, tweaks.locale, symbol)}</div>
        </div>
        <div className="stat">
          <div className="k">{rangeIsAll ? "balance · today" : "closing balance"}</div>
          <div className="v" style={{ color: closingBal < 0 ? "var(--warn)" : "var(--ink)" }}>
            {fmtINR(rangeIsAll ? balanceAtNow : closingBal, tweaks.locale, symbol)}
          </div>
        </div>
      </div>
    </div>
  );
}
