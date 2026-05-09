// Aggregations for the dash view: per-lane and per-tag rollups over a
// date range. Pure functions — no React, no DOM. Mirrors the spend logic
// the topbar uses (skips `merge` direction so card-payment settlements
// aren't double-counted) and adds the bits the topbar leaves out
// (per-lane totals, count, and percentage shares).

const COMMITTED_KINDS = new Set(["fixed", "loans", "savings"]);

function inRange(e, range) {
  const t = new Date(e.when).getTime();
  return t >= range.start && t <= range.end;
}

// Returns:
//   {
//     income, committed, extras, net,        // KPIs (match topbar scope)
//     totalOut,                              // sum of all dir=out (non-merge)
//     byLane: [{ kind, side, total, count, share }],   // sorted desc by total
//     spendByLane: total of R-side lanes (basis for the stacked bar)
//   }
//
// `kinds` is the full kind list (not filtered) so we can map kind → side.
export function breakdownByLane(entries, range, kinds) {
  const sideOf = Object.fromEntries(kinds.map(k => [k.id, k.side]));
  const order  = Object.fromEntries(kinds.map(k => [k.id, k.order ?? 0]));

  let income = 0, committed = 0, extras = 0, totalOut = 0;
  const lanes = {}; // kind → { total, count }

  for (const e of entries) {
    if (!inRange(e, range)) continue;
    if (e.dir === "merge") continue;

    if (e.dir === "in") {
      income += e.amount;
      // L-side income lanes also tally here so they show up in byLane.
      const k = e.kind || "income";
      lanes[k] = lanes[k] || { total: 0, count: 0 };
      lanes[k].total += e.amount;
      lanes[k].count += 1;
      continue;
    }

    if (e.dir === "out") {
      totalOut += e.amount;
      const k = e.kind || "extras";
      lanes[k] = lanes[k] || { total: 0, count: 0 };
      lanes[k].total += e.amount;
      lanes[k].count += 1;

      if (COMMITTED_KINDS.has(k)) committed += e.amount;
      else if (k === "extras" && e.status !== "future") extras += e.amount;
    }
  }

  const net = income - totalOut;

  const byLane = Object.entries(lanes)
    .map(([kind, v]) => ({
      kind,
      side: sideOf[kind] || "R",
      total: v.total,
      count: v.count,
      share: 0,
      order: order[kind] ?? 99,
    }))
    .filter(l => l.kind !== "main")
    .sort((a, b) => b.total - a.total);

  const spendByLane = byLane
    .filter(l => l.side === "R")
    .reduce((s, l) => s + l.total, 0);

  for (const l of byLane) {
    if (l.side === "R" && spendByLane > 0) l.share = l.total / spendByLane;
    else if (l.side === "L" && income > 0)  l.share = l.total / income;
  }

  return { income, committed, extras, totalOut, net, byLane, spendByLane };
}

// Tag rollup grouped by lane (kind). For each tag in `tags`, compute total
// (out for spending kinds, in for income kinds), count, and % of its lane.
// Returns a list of groups: [{ kind, label, laneTotal, items: [...] }].
export function breakdownByTag(entries, range, tags, tagGroups) {
  const totals = {};
  for (const t of tags) totals[t.id] = { in: 0, out: 0, count: 0 };

  for (const e of entries) {
    if (!inRange(e, range)) continue;
    if (e.dir === "merge") continue;
    for (const tagId of e.tags) {
      if (!totals[tagId]) continue;
      if (e.dir === "in")  totals[tagId].in  += e.amount;
      if (e.dir === "out") totals[tagId].out += e.amount;
      totals[tagId].count += 1;
    }
  }

  const tagsByKind = {};
  for (const t of tags) {
    (tagsByKind[t.kind] = tagsByKind[t.kind] || []).push(t);
  }

  return tagGroups.map(g => {
    const items = (tagsByKind[g.key] || []).map(t => {
      const tot = totals[t.id];
      const amount = tot.out || tot.in;
      return { id: t.id, label: t.label, amount, count: tot.count };
    });
    const laneTotal = items.reduce((s, i) => s + i.amount, 0);
    items.forEach(i => { i.share = laneTotal > 0 ? i.amount / laneTotal : 0; });
    items.sort((a, b) => b.amount - a.amount);
    return { kind: g.key, label: g.label, laneTotal, items };
  });
}

// Filter entries to drill into a specific lane or tag in the active range.
// `selector` is { type: "lane", id } or { type: "tag", id }.
export function entriesFor(entries, range, selector) {
  const out = [];
  for (const e of entries) {
    if (!inRange(e, range)) continue;
    if (e.dir === "merge") continue;
    if (selector.type === "lane" && e.kind !== selector.id) continue;
    if (selector.type === "tag"  && !e.tags.includes(selector.id)) continue;
    out.push(e);
  }
  out.sort((a, b) => new Date(b.when) - new Date(a.when));
  return out;
}
