// Data-driven insights — compute real anomalies / forecasts / nudges from
// the live ledger instead of returning static strings from config. Each
// function below produces zero or one insight; the orchestrator filters
// out empties and returns the final list in priority order.

import { MS_PER_DAY } from "./data.js";

function fmtCompact(n, symbol = "₹") {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return sign + symbol + (abs / 1e7).toFixed(1) + "Cr";
  if (abs >= 1e5) return sign + symbol + (abs / 1e5).toFixed(1) + "L";
  if (abs >= 1e3) return sign + symbol + Math.round(abs / 1e3) + "k";
  return sign + symbol + Math.round(abs);
}

function pastEntries(entries, nowMs) {
  return entries.filter(e => new Date(e.when).getTime() <= nowMs);
}

function recentEntries(entries, nowMs, days) {
  return entries.filter(e => {
    const t = new Date(e.when).getTime();
    return t <= nowMs && t > nowMs - days * MS_PER_DAY;
  });
}

// Closing balance at the moment `tMs`.
function balanceAt(entries, initialBalance, tMs) {
  let bal = initialBalance;
  const sorted = entries.slice().sort((a, b) => new Date(a.when) - new Date(b.when));
  for (const e of sorted) {
    if (new Date(e.when).getTime() > tMs) break;
    if (e.dir === "in") bal += e.amount;
    if (e.dir === "out" || e.dir === "merge") bal -= e.amount;
  }
  return bal;
}

// 1. Extras burn-rate vs the user's own historical average.
function extrasBurn(entries, nowMs, symbol) {
  const recent = recentEntries(entries, nowMs, 7).filter(e => e.kind === "extras" && e.dir === "out");
  if (!recent.length) return null;
  const recentTotal = recent.reduce((s, e) => s + e.amount, 0);
  const dailyRecent = recentTotal / 7;

  const allPast = pastEntries(entries, nowMs).filter(e => e.kind === "extras" && e.dir === "out");
  if (allPast.length < 14) return null;
  const earliest = Math.min(...allPast.map(e => new Date(e.when).getTime()));
  const span = Math.max(7, (nowMs - earliest) / MS_PER_DAY);
  const dailyAll = allPast.reduce((s, e) => s + e.amount, 0) / span;
  if (dailyAll <= 0) return null;
  const ratio = dailyRecent / dailyAll;

  if (Math.abs(ratio - 1) < 0.15) return null;
  return {
    kind: "burn",
    title: "extras burn rate",
    body: `≈ ${fmtCompact(dailyRecent, symbol)}/day · ${ratio > 1 ? "+" : ""}${Math.round((ratio - 1) * 100)}% vs your avg`,
    severity: ratio > 1.4 ? "warn" : ratio > 1.0 ? "info" : "ok",
  };
}

// 2. Tag-frequency anomaly — find a tag whose count this week is far above
//    its long-run rate (chai 2× usual, etc).
function tagAnomaly(entries, nowMs, tagById) {
  const sevenDaysAgo = nowMs - 7 * MS_PER_DAY;
  const past = pastEntries(entries, nowMs).filter(e => e.dir === "out");
  if (past.length < 14) return null;
  const earliest = Math.min(...past.map(e => new Date(e.when).getTime()));
  const span = Math.max(7, (nowMs - earliest) / MS_PER_DAY);

  const tagCount7 = {};
  const tagCountAll = {};
  for (const e of past) {
    const tid = e.tags[0];
    if (!tid) continue;
    tagCountAll[tid] = (tagCountAll[tid] || 0) + 1;
    if (new Date(e.when).getTime() > sevenDaysAgo) {
      tagCount7[tid] = (tagCount7[tid] || 0) + 1;
    }
  }

  let best = null;
  for (const [tid, c7] of Object.entries(tagCount7)) {
    if (c7 < 3) continue;
    const allRate = (tagCountAll[tid] || 0) / span;
    if (allRate <= 0) continue;
    const ratio = (c7 / 7) / allRate;
    if (!best || ratio > best.ratio) best = { tid, c7, ratio, allRate };
  }
  if (!best || best.ratio < 1.5) return null;

  const tag = tagById[best.tid];
  const label = tag ? tag.label : best.tid;
  return {
    kind: "anomaly",
    title: `${label} ${best.ratio.toFixed(1)}× usual`,
    body: `${best.c7} ${label}s in 7 days · usually ${Math.round(best.allRate * 7)}/week.`,
    severity: best.ratio > 2 ? "warn" : "info",
  };
}

// 3. End-of-month carry projection. Walks every scheduled future entry
//    in this calendar month and shows the closing balance.
function eomForecast(entries, nowMs, initialBalance, now, symbol) {
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
  if (monthEnd <= nowMs) return null;
  const balNow = balanceAt(entries, initialBalance, nowMs);
  const balEnd = balanceAt(entries, initialBalance, monthEnd);
  const delta = balEnd - balNow;

  return {
    kind: "forecast",
    title: "end-of-month carry",
    body: `if scheduled holds, you close at ${fmtCompact(balEnd, symbol)} (${delta >= 0 ? "+" : ""}${fmtCompact(delta, symbol)} from today).`,
    severity: balEnd < 0 ? "warn" : "info",
  };
}

// 4. Next big debit in the next two weeks.
function nextBigDebit(entries, nowMs, symbol) {
  const horizon = nowMs + 14 * MS_PER_DAY;
  const upcoming = entries.filter(e => {
    const t = new Date(e.when).getTime();
    return e.dir === "out" && t > nowMs && t <= horizon;
  });
  if (!upcoming.length) return null;
  const big = upcoming.slice().sort((a, b) => b.amount - a.amount)[0];
  if (big.amount < 500) return null;
  const days = Math.max(0, Math.round((new Date(big.when).getTime() - nowMs) / MS_PER_DAY));
  return {
    kind: "nudge",
    title: "next big debit",
    body: `${big.label} · ${fmtCompact(big.amount, symbol)} in ${days === 0 ? "today" : days + " day" + (days === 1 ? "" : "s")}.`,
    severity: "ok",
  };
}

export function computeInsights({ entries, now, initialBalance, tagById, currencySymbol = "₹" }) {
  const nowMs = now.getTime();
  const built = [
    tagAnomaly(entries, nowMs, tagById),
    extrasBurn(entries, nowMs, currencySymbol),
    eomForecast(entries, nowMs, initialBalance, now, currencySymbol),
    nextBigDebit(entries, nowMs, currencySymbol),
  ].filter(Boolean);

  if (built.length === 0) {
    return [{
      kind: "nudge",
      title: "no anomalies",
      body: "nothing unusual in the data right now.",
      severity: "ok",
    }];
  }
  return built;
}
