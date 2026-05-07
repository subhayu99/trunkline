import { fmtDateShort } from "./format.js";

export function rangeFromPreset(preset, customStart, customEnd, now) {
  const today = new Date(now); today.setHours(23, 59, 59, 999);

  if (preset === "custom" && customStart && customEnd) {
    const s = new Date(customStart); s.setHours(0, 0, 0, 0);
    const e = new Date(customEnd); e.setHours(23, 59, 59, 999);
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
