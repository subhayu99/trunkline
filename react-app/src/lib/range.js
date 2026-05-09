import { fmtDateShort } from "./format.js";

export function rangeFromPreset(preset, customStart, customEnd, now) {
  const today = new Date(now); today.setHours(23, 59, 59, 999);

  if (preset === "custom") {
    // Either end can be missing — typing only "from" or only "to" used to
    // silently fall through to "all time" (no filter at all). Default the
    // missing side instead so the filter still applies as the user expects:
    //   from-only → up to today
    //   to-only   → from the start of the current month
    //   neither   → start of current month → today
    const s = customStart
      ? new Date(customStart)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    s.setHours(0, 0, 0, 0);
    const e = customEnd ? new Date(customEnd) : new Date(now);
    e.setHours(23, 59, 59, 999);
    return { start: s.getTime(), end: e.getTime(), label: fmtDateShort(s) + " → " + fmtDateShort(e) };
  }
  if (preset === "7d") {
    const s = new Date(now); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0);
    return { start: s.getTime(), end: today.getTime(), label: "last 7 days" };
  }
  if (preset === "30d") {
    const s = new Date(now); s.setDate(s.getDate() - 29); s.setHours(0, 0, 0, 0);
    return { start: s.getTime(), end: today.getTime(), label: "last 30 days" };
  }
  if (preset === "thisMonth") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start: s.getTime(), end: e.getTime(), label: "this month" };
  }
  if (preset === "lastMonth") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
    const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { start: s.getTime(), end: e.getTime(), label: "last month" };
  }
  if (preset === "ytd") {
    const s = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    return { start: s.getTime(), end: today.getTime(), label: "year to date" };
  }
  if (preset === "futureOnly") {
    const s = new Date(now); s.setMinutes(s.getMinutes() + 1);
    const e = new Date(now); e.setDate(e.getDate() + 60);
    return { start: s.getTime(), end: e.getTime(), label: "upcoming · 60d" };
  }
  return { start: -Infinity, end: Infinity, label: "all time" };
}
