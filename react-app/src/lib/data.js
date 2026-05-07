// Data helpers ported from the original data.jsx — pure functions parameterized
// by the loaded config + data.

export const MS_PER_DAY = 86400000;

export function statusFor(when, now) {
  const t = new Date(when).getTime();
  const n = now.getTime();
  if (t < n - 60000) return "past";
  if (t > n + 60000) return "future";
  return "today";
}

export function computeRunningBalance(entries, initialBalance) {
  let bal = initialBalance;
  const out = [];
  for (const e of entries) {
    const before = bal;
    if (e.dir === "in")    bal += e.amount;
    if (e.dir === "out")   bal -= e.amount;
    if (e.dir === "merge") bal -= e.amount;
    out.push({ ...e, balanceBefore: before, balanceAfter: bal });
  }
  return out;
}

export function totalsByTag(entries, tags) {
  const t = {};
  for (const tag of tags) t[tag.id] = { in: 0, out: 0, count: 0 };
  for (const e of entries) {
    for (const tagId of e.tags) {
      if (!t[tagId]) continue;
      if (e.dir === "in")  t[tagId].in  += e.amount;
      if (e.dir === "out") t[tagId].out += e.amount;
      t[tagId].count += 1;
    }
  }
  return t;
}

function addPeriod(date, freq, n) {
  const d = new Date(date);
  if (freq === "day")   d.setDate(d.getDate() + n);
  if (freq === "week")  d.setDate(d.getDate() + n * 7);
  if (freq === "month") d.setMonth(d.getMonth() + n);
  if (freq === "year")  d.setFullYear(d.getFullYear() + n);
  return d;
}

// Materializes recurring entries into concrete future occurrences.
// horizonMs caps unbounded recurrences; defaults to ~2 years past now.
export function materializeRecurring(entries, now, horizonMs) {
  const HORIZON = horizonMs || (now.getTime() + 365 * MS_PER_DAY * 2);
  const out = [];
  for (const e of entries) {
    out.push(e);
    if (!e.recur) continue;
    const r = e.recur;
    const every = Math.max(1, r.every || 1);
    const maxCount = r.count != null ? r.count : 999;
    const untilMs = r.until ? new Date(r.until).getTime() : HORIZON;
    let i = 1;
    while (i < maxCount) {
      const occWhen = addPeriod(new Date(e.when), r.freq, i * every);
      const tMs = occWhen.getTime();
      if (tMs > untilMs || tMs > HORIZON) break;
      out.push({
        ...e,
        id: e.id + "_r" + i,
        when: occWhen.toISOString(),
        status: statusFor(occWhen.toISOString(), now),
        recurOccurrence: i,
        recurParentId: e.id,
      });
      i++;
    }
  }
  return out;
}

// Refreshes status fields against the current `now` anchor (entries in
// data.json carry frozen statuses that may be stale at runtime).
export function refreshStatus(entries, now) {
  return entries.map(e => ({ ...e, status: statusFor(e.when, now) }));
}
