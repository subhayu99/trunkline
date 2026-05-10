// Continuous-timeline money graph.
// Y axis is real time. Past below, NOW in the middle, future above.
// Initial viewport ≈ 1 week around today. Scroll up = into future, down = past.
// Trunk width = running balance.

import React, {
  useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback,
} from "react";
import {
  fmtINR, fmtCompact, fmtDateShort, fmtDateTime, branchLabel,
  MONTH_NAMES, startOfDay,
} from "../lib/format.js";
import { computeRunningBalance, MS_PER_DAY } from "../lib/data.js";

// Stroke width for a single flow.
// Scaled against the largest amount in the dataset so widths are directly
// proportional to amount (linear), or normalized via sqrt / log curves.
function thicknessFor(amount, scale, maxAmount, minW, maxW) {
  const a = Math.max(0, amount);
  const m = Math.max(1, maxAmount);
  let ratio;
  if (scale === "log")       ratio = Math.log(a + 1) / Math.log(m + 1);
  else if (scale === "sqrt") ratio = Math.sqrt(a) / Math.sqrt(m);
  else                       ratio = a / m;        // linear · directly proportional
  ratio = Math.max(0, Math.min(1, ratio));
  return minW + (maxW - minW) * ratio;
}

function trunkWidthFor(balance, peak, minW, maxW) {
  if (peak <= 0) return minW;
  const ratio = Math.max(0, balance) / peak;
  return minW + (maxW - minW) * Math.sqrt(ratio);
}

export default function MoneyGraph({
  tweaks, range, freshEntry, hoveredKind, setHoveredKind, selectedTag,
  onEditEntry, entries,
  config, data, now, tagById, kinds,
}) {
  const { vocabIntensity, thicknessScale, showFuture, locale, zoom } = tweaks;
  const collapseFuture = !!tweaks.collapseFuture;
  const branchLabels = config.branchLabels;
  const initialBalance = data.initialBalance;
  const trunkMinWidth = config.graph?.trunkMinWidth ?? 3;
  const trunkMaxWidth = config.graph?.trunkMaxWidth ?? 38;
  const laneTrunkMinWidth = config.graph?.laneTrunkMinWidth ?? 0.8;
  const laneTrunkMaxWidth = config.graph?.laneTrunkMaxWidth ?? 14;
  const flowMinWidth = config.graph?.flowMinWidth ?? 1;
  const flowMaxWidth = config.graph?.flowMaxWidth ?? 22;
  const initialDays = config.graph?.initialDaysInViewport ?? 7;

  // ----- container measurement -----
  const wrapRef = useRef(null);
  const [containerW, setContainerW] = useState(900);
  const [containerH, setContainerH] = useState(700);
  useEffect(() => {
    if (!wrapRef.current) return;
    let raf = null;
    const update = () => {
      if (!wrapRef.current) return;
      const w = Math.round(wrapRef.current.clientWidth / 4) * 4;
      const h = Math.round(wrapRef.current.clientHeight / 4) * 4;
      setContainerW(p => Math.abs(p - w) >= 4 ? w : p);
      setContainerH(p => Math.abs(p - h) >= 4 ? h : p);
    };
    const ro = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });
    ro.observe(wrapRef.current);
    update();
    return () => { ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // ----- timeline range -----
  // collapseFuture caps endMs at NOW so the chart doesn't reserve space for
  // months/years of upcoming entries that dwarf the past timeline.
  const timeline = useMemo(() => {
    let startMs, endMs;
    if (range && isFinite(range.start) && isFinite(range.end)) {
      startMs = range.start;
      endMs = range.end;
    } else if (!entries.length) {
      const start = new Date(now); start.setDate(start.getDate() - 7);
      const end   = new Date(now); end.setDate(end.getDate() + 7);
      startMs = start.getTime();
      endMs = end.getTime();
    } else {
      const sorted = entries.slice().sort((a, b) => new Date(a.when) - new Date(b.when));
      const first = startOfDay(new Date(sorted[0].when)); first.setDate(first.getDate() - 1);
      const last  = new Date(sorted[sorted.length - 1].when);
      const future = new Date(now); future.setDate(future.getDate() + 21);
      const end = last > future ? last : future;
      end.setHours(23, 59, 59, 999);
      startMs = first.getTime();
      endMs = end.getTime();
    }
    if (collapseFuture) {
      const nowEod = new Date(now); nowEod.setHours(23, 59, 59, 999);
      endMs = Math.min(endMs, nowEod.getTime());
    }
    return { startMs, endMs };
  }, [entries, range && range.start, range && range.end, now, collapseFuture]);

  // ----- vertical scale -----
  const headerH = 44;
  const footerH = 28;
  const viewportH = containerH - headerH - footerH;
  const baseDayPx = Math.max(40, viewportH / initialDays);
  const dayPx = baseDayPx * zoom;
  const totalDays = Math.max(1, (timeline.endMs - timeline.startMs) / MS_PER_DAY);
  const totalH = headerH + totalDays * dayPx + footerH;

  const yForTime = useCallback(
    (tMs) => headerH + ((timeline.endMs - tMs) / MS_PER_DAY) * dayPx,
    [timeline, dayPx]
  );
  const yNow = yForTime(now.getTime());

  // ----- horizontal: lanes -----
  // Derived from `kinds` so user-edited lane order/side actually flows
  // through here. Falls back to the legacy static layout if kinds is missing.
  const lanes = useMemo(() => {
    if (!Array.isArray(kinds) || kinds.length === 0) {
      return [
        { kind: "income",  side: "L" },
        { kind: "main",    side: "C" },
        { kind: "fixed",   side: "R" },
        { kind: "extras",  side: "R" },
        { kind: "credit",  side: "R" },
        { kind: "loans",   side: "R" },
        { kind: "savings", side: "R" },
      ];
    }
    const visible = kinds.filter(k => !k.archived);
    const sortByOrder = (a, b) => (a.order || 0) - (b.order || 0);
    const Ls = visible.filter(k => k.side === "L").sort(sortByOrder);
    const Cs = visible.filter(k => k.side === "C" || k.id === "main").sort(sortByOrder);
    const Rs = visible.filter(k => k.side === "R" || (k.id !== "main" && k.side !== "L" && k.side !== "C")).sort(sortByOrder);
    return [...Ls, ...Cs, ...Rs].map(k => ({ kind: k.id, side: k.side || (k.id === "main" ? "C" : "R") }));
  }, [kinds]);
  // Mobile/tablet: shrink padding and remove the 560px usableW floor so the
  // chart fits even on a 320px-wide viewport without horizontal clipping.
  const isNarrow = containerW < 600;
  const leftPad = isNarrow ? 32 : 64;
  const rightPad = isNarrow ? 8 : 24;
  const usableW = isNarrow
    ? Math.max(220, containerW) - leftPad - rightPad
    : Math.max(560, containerW) - leftPad - rightPad;
  const mainLaneW = Math.min(120, usableW * (isNarrow ? 0.20 : 0.16));
  const sideLaneW = (usableW - mainLaneW) / (lanes.length - 1);
  const xForLane = (i) => {
    // Unknown kind (i = -1) would otherwise dereference lanes[-1].kind and
    // crash the whole chart. Anchor it to the main lane as a safe fallback.
    if (i < 0 || i >= lanes.length) {
      const mi = lanes.findIndex(l => l.kind === "main");
      if (mi < 0) return leftPad;
      i = mi;
    }
    let x = leftPad;
    for (let k = 0; k < i; k++) x += (lanes[k].kind === "main" ? mainLaneW : sideLaneW);
    x += (lanes[i].kind === "main" ? mainLaneW : sideLaneW) / 2;
    return x;
  };
  const xForKind = (kind) => xForLane(lanes.findIndex(l => l.kind === kind));
  const xMain = xForKind("main");

  // ----- running balance -----
  const sortedEntries = useMemo(
    () => entries.slice().sort((a, b) => new Date(a.when) - new Date(b.when)),
    [entries]
  );
  const withBalance = useMemo(
    () => computeRunningBalance(sortedEntries, initialBalance),
    [sortedEntries, initialBalance]
  );

  // Two entries on the same lane at the same instant (e.g. MF SIP and
  // MF liquid both at May 10 10:00) would otherwise stack and the larger
  // amount would hide the smaller. Stagger collisions vertically: largest
  // amount stays put, smaller ones fan out alternately above/below.
  const entryYOffset = useMemo(() => {
    const groups = new Map();
    for (const e of sortedEntries) {
      const key = e.kind + "|" + e.when;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    const map = new Map();
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      list.sort((a, b) => b.amount - a.amount);
      list.forEach((e, i) => {
        const offset = i === 0 ? 0 : (i % 2 === 1 ? -1 : 1) * Math.ceil(i / 2) * 9;
        map.set(e.id, offset);
      });
    }
    return map;
  }, [sortedEntries]);

  const peakBalance = useMemo(() => {
    let p = 0;
    for (const e of withBalance) p = Math.max(p, e.balanceAfter, e.balanceBefore);
    return Math.max(p, 50000);
  }, [withBalance]);

  // Largest single-entry amount — used to scale flow stroke widths so they
  // are directly proportional to the amount (linear) or normalized via sqrt/log.
  const maxAmount = useMemo(() => {
    let m = 0;
    for (const e of entries) if (e.amount > m) m = e.amount;
    return Math.max(m, 1);
  }, [entries]);

  // Per-lane cumulative totals over time. Each entry on a lane adds its
  // amount to the running total for that kind; the lane trunk then breathes
  // (widens) at every event, mirroring how the main trunk reflects balance.
  // Direction is intentionally ignored: the trunk visualizes total flow
  // through the lane, so a credit-card "merge" still pumps the same volume
  // through the lane that the matching "out" did.
  //
  // Accumulation is restricted to the selected range — switching to "this
  // month" or "last 7 days" restarts each lane from 0 at the range start.
  const laneAccumulation = useMemo(() => {
    const lanes = {};
    let peak = 0;
    for (const l of [
      { kind: "income" }, { kind: "fixed" }, { kind: "extras" },
      { kind: "credit" }, { kind: "loans" }, { kind: "savings" },
    ]) {
      let total = 0;
      const points = [];
      for (const e of sortedEntries) {
        if (e.kind !== l.kind) continue;
        const t = new Date(e.when).getTime();
        if (t < range.start || t > range.end) continue;
        const before = total;
        total += e.amount;
        points.push({ when: e.when, before, after: total, status: e.status });
      }
      lanes[l.kind] = { points, total };
      if (total > peak) peak = total;
    }
    return { lanes, peak: Math.max(peak, 1) };
  }, [sortedEntries, range.start, range.end]);

  // Build a polygon per lane: starts at the FIRST entry on that lane (no
  // visible trunk before it), steps up at each entry's y by (before -> after)
  // cumulative, and continues at the final width all the way to the timeline
  // end so the lane "flows" forward.
  const laneTrunkPolygons = useMemo(() => {
    const out = {};
    for (const kind of Object.keys(laneAccumulation.lanes)) {
      const xc = xForKind(kind);
      const lane = laneAccumulation.lanes[kind];
      if (!lane.points.length) { out[kind] = ""; continue; }

      const left = [], right = [];

      for (const p of lane.points) {
        const t = new Date(p.when).getTime();
        const y = yForTime(t);
        const wB = trunkWidthFor(p.before, laneAccumulation.peak, laneTrunkMinWidth, laneTrunkMaxWidth);
        const wA = trunkWidthFor(p.after,  laneAccumulation.peak, laneTrunkMinWidth, laneTrunkMaxWidth);
        const half = Math.min(4, dayPx * 0.04);
        left.push([xc - wB / 2, y + half]);
        right.push([xc + wB / 2, y + half]);
        left.push([xc - wA / 2, y - half]);
        right.push([xc + wA / 2, y - half]);
      }

      const wFinal = trunkWidthFor(lane.total, laneAccumulation.peak, laneTrunkMinWidth, laneTrunkMaxWidth);
      left.push([xc - wFinal / 2, yForTime(timeline.endMs)]);
      right.push([xc + wFinal / 2, yForTime(timeline.endMs)]);

      const points = [...left, ...right.slice().reverse()];
      out[kind] = points.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    }
    return out;
  }, [laneAccumulation, dayPx, timeline, containerW, laneTrunkMinWidth, laneTrunkMaxWidth]);

  // Cumulative lane total at a given time. Used for the lane hover tooltip.
  const cumulativeAt = useCallback((kind, tMs) => {
    const lane = laneAccumulation.lanes[kind];
    if (!lane || !lane.points.length) return { total: 0, count: 0 };
    let total = 0, count = 0;
    for (const p of lane.points) {
      if (new Date(p.when).getTime() <= tMs) { total = p.after; count++; }
      else break;
    }
    return { total, count };
  }, [laneAccumulation]);

  // Group every recurring series so we can draw a connector line through them.
  // Key = parent id; entries collected = parent + all materialized children.
  const recurGroups = useMemo(() => {
    const map = new Map();
    for (const e of sortedEntries) {
      if (!e.recur && !e.recurParentId) continue;
      const key = e.recurParentId || e.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return [...map.entries()]
      .map(([key, list]) => ({ key, list }))
      .filter(g => g.list.length > 1);
  }, [sortedEntries]);

  // ----- trunk polygon -----
  const trunkPolygon = useMemo(() => {
    if (!withBalance.length) return "";
    const xc = xMain;
    const left = [], right = [];
    left.push([xc - trunkWidthFor(initialBalance, peakBalance, trunkMinWidth, trunkMaxWidth) / 2, yForTime(timeline.startMs)]);
    right.push([xc + trunkWidthFor(initialBalance, peakBalance, trunkMinWidth, trunkMaxWidth) / 2, yForTime(timeline.startMs)]);

    for (const e of withBalance) {
      const t = new Date(e.when).getTime();
      const y = yForTime(t);
      const wB = trunkWidthFor(e.balanceBefore, peakBalance, trunkMinWidth, trunkMaxWidth);
      const wA = trunkWidthFor(e.balanceAfter,  peakBalance, trunkMinWidth, trunkMaxWidth);
      const half = Math.min(4, dayPx * 0.04);
      left.push([xc - wB / 2, y + half]);
      right.push([xc + wB / 2, y + half]);
      left.push([xc - wA / 2, y - half]);
      right.push([xc + wA / 2, y - half]);
    }
    const last = withBalance[withBalance.length - 1];
    const wTop = trunkWidthFor(last.balanceAfter, peakBalance, trunkMinWidth, trunkMaxWidth);
    left.push([xc - wTop / 2, yForTime(timeline.endMs)]);
    right.push([xc + wTop / 2, yForTime(timeline.endMs)]);

    const points = [...left, ...right.slice().reverse()];
    return points.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  }, [withBalance, dayPx, xMain, peakBalance, timeline, initialBalance, trunkMinWidth, trunkMaxWidth, yForTime]);

  // ----- day rules + month bands -----
  const dayList = useMemo(() => {
    const arr = [];
    let cur = startOfDay(new Date(timeline.startMs));
    const endD = new Date(timeline.endMs);
    while (cur <= endD) {
      arr.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }, [timeline]);

  const monthBands = useMemo(() => {
    const bands = [];
    let curMonth = -1;
    let bandStart = null;
    for (const d of dayList) {
      const m = d.getMonth();
      if (m !== curMonth) {
        if (bandStart !== null) bands.push({ month: curMonth, year: bandStart.getFullYear(), startMs: bandStart.getTime(), endMs: d.getTime() });
        curMonth = m;
        bandStart = d;
      }
    }
    if (bandStart) bands.push({ month: curMonth, year: bandStart.getFullYear(), startMs: bandStart.getTime(), endMs: timeline.endMs });
    return bands;
  }, [dayList, timeline]);

  // ----- initial scroll: place NOW in middle viewport -----
  const userScrolled = useRef(false);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = () => { userScrolled.current = true; };
    const onTouch = () => { userScrolled.current = true; };
    const onKey = (e) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) userScrolled.current = true; };
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouch);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  useLayoutEffect(() => {
    if (userScrolled.current) return;
    if (!wrapRef.current) return;
    const ch = wrapRef.current.clientHeight;
    if (ch < 100) return;
    const target = yNow - ch / 2;
    wrapRef.current.scrollTop = Math.max(0, Math.min(totalH - ch, target));
  }, [yNow, totalH, containerH]);

  // ----- ctrl-wheel zoom -----
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      window.dispatchEvent(new CustomEvent("graph-zoom", { detail: delta }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ----- pinch-zoom (touch) -----
  // Two-finger pinch on the graph dispatches incremental graph-zoom events
  // so the existing zoom slider/handler in App.jsx stays the single source
  // of truth. CSS sets touch-action: pan-y on .graph-wrap, so the browser
  // doesn't fight us for the gesture.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    let startDist = null;
    let lastDelta = 0;

    const dist = (touches) => {
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      return Math.hypot(dx, dy);
    };

    const onStart = (e) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        lastDelta = 0;
        e.preventDefault();
      }
    };
    const onMove = (e) => {
      if (e.touches.length !== 2 || startDist == null) return;
      e.preventDefault();
      const ratio = dist(e.touches) / startDist;
      // Target cumulative delta from start of gesture.
      const target = ratio - 1;
      // Dispatch only the increment since last event so the global handler
      // (which adds delta to current zoom) integrates correctly.
      const inc = target - lastDelta;
      if (Math.abs(inc) > 0.005) {
        window.dispatchEvent(new CustomEvent("graph-zoom", { detail: inc }));
        lastDelta = target;
      }
    };
    const onEnd = (e) => {
      if (e.touches.length < 2) { startDist = null; lastDelta = 0; }
    };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  // ----- visibility of "now" -----
  // Tracks where NOW sits relative to the viewport so we can show a
  // "jump to now" button only when the user has scrolled past it.
  const [nowOffscreen, setNowOffscreen] = useState(null); // null | "past" | "future"
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = null;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const top = el.scrollTop;
        const ch = el.clientHeight;
        if (yNow < top) setNowOffscreen("past");
        else if (yNow > top + ch) setNowOffscreen("future");
        else setNowOffscreen(null);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { el.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [yNow]);

  const balanceAt = useCallback((tMs) => {
    let bal = initialBalance;
    for (const e of withBalance) {
      if (new Date(e.when).getTime() <= tMs) bal = e.balanceAfter;
      else break;
    }
    return bal;
  }, [withBalance, initialBalance]);

  const [hover, setHover] = useState(null);
  const [laneHover, setLaneHover] = useState(null);
  // `selected` is the pinned details card after a click/tap. Without this,
  // tapping a flow on mobile (no hover) jumped straight to the edit panel.
  // Now: tap → preview card with explicit edit / close actions.
  const [selected, setSelected] = useState(null);

  const onLaneMove = useCallback((ev, kind) => {
    const svg = ev.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const yInSvg = ev.clientY - rect.top;
    const tMs = timeline.endMs - ((yInSvg - headerH) / dayPx) * MS_PER_DAY;
    const info = cumulativeAt(kind, tMs);
    setLaneHover({
      kind,
      x: ev.clientX, y: ev.clientY,
      total: info.total,
      count: info.count,
      atMs: tMs,
    });
    setHoveredKind(kind);
  }, [cumulativeAt, timeline.endMs, dayPx, setHoveredKind]);

  const dim = (kind) => {
    if (selectedTag) {
      const tagKind = tagById[selectedTag] && tagById[selectedTag].kind;
      return tagKind === kind || kind === "main" ? 1 : 0.12;
    }
    if (hoveredKind && hoveredKind !== kind && kind !== "main") return 0.18;
    return 1;
  };
  const t = (a) => thicknessFor(a, thicknessScale, maxAmount, flowMinWidth, flowMaxWidth);

  // ----- viewport culling -----
  const [scrollTop, setScrollTop] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = null;
    const onS = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollTop(el.scrollTop));
    };
    el.addEventListener("scroll", onS, { passive: true });
    return () => { el.removeEventListener("scroll", onS); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const visibleYTop = scrollTop - 300;
  const visibleYBot = scrollTop + containerH + 300;

  // Two-pass render so dots stay tappable even when paths from neighbouring
  // lanes overlap them. SVG draws later siblings on top, so the old single-
  // <g>-per-entry layout meant a wide stroke from the last-rendered entry
  // would shadow earlier dots — visible to the eye, but its hit area got
  // stolen by the path on top. Splitting into "all paths first, all dots
  // and labels second" puts every dot above every path.
  //
  // computeFlowGeometry is shared so the two passes don't drift; both passes
  // call it with the same entry and produce the same coordinates.
  const computeFlowGeometry = (e) => {
    if (!showFuture && e.status === "future") return null;
    const t0 = new Date(e.when).getTime();
    const y = yForTime(t0) + (entryYOffset.get(e.id) || 0);
    if (y < visibleYTop || y > visibleYBot) return null;

    const xK = xForKind(e.kind);
    const xM = xMain;
    const w = t(e.amount);
    const isFuture = e.status === "future";
    const isMerge = e.dir === "merge";
    const isHidden = selectedTag && !e.tags.includes(selectedTag);
    const op = isHidden ? 0.06 : dim(e.kind);
    const color = `var(--b-${e.kind})`;
    const bow = 18;

    let path = "";
    if (e.dir === "out") {
      path = `M ${xM} ${y} C ${xM + (xK > xM ? bow : -bow)} ${y}, ${xK - (xK > xM ? bow : -bow)} ${y}, ${xK} ${y}`;
    } else if (e.dir === "in") {
      path = `M ${xK} ${y} C ${xK + (xK > xM ? -bow : bow)} ${y}, ${xM - (xK > xM ? -bow : bow)} ${y}, ${xM} ${y}`;
    } else if (isMerge) {
      path = `M ${xK} ${y} C ${xK - 24} ${y}, ${xM + 24} ${y}, ${xM} ${y}`;
    }

    return { e, y, xK, xM, w, isFuture, isMerge, op, color, path };
  };

  // Tap or click → pin the details card. Tapping the same flow again
  // dismisses it. stopPropagation prevents the SVG-level click handler
  // from clearing the selection we just set.
  const onEntrySelect = (e) => (ev) => {
    ev.stopPropagation();
    setSelected(prev =>
      prev && prev.entry.id === e.id
        ? null
        : { entry: e, x: ev.clientX, y: ev.clientY }
    );
    setHover(null);
  };

  const renderFlowPath = (e) => {
    const g = computeFlowGeometry(e);
    if (!g) return null;
    const isFresh = freshEntry && freshEntry.id === e.id;
    return (
      <g key={`p-${e.id}`} style={{ opacity: g.op }} className={isFresh ? "flow fresh" : "flow"}>
        <path
          d={g.path} fill="none" stroke={g.color}
          strokeWidth={g.w} strokeLinecap="round"
          strokeDasharray={g.isFuture ? "4 5" : "0"}
          opacity={g.isFuture ? 0.6 : 0.9}
          style={{ cursor: "pointer", pointerEvents: "stroke" }}
          onMouseEnter={(ev) => { setHover({ entry: e, x: ev.clientX, y: ev.clientY }); setHoveredKind(e.kind); }}
          onMouseMove={(ev) => setHover(h => h ? { ...h, x: ev.clientX, y: ev.clientY } : null)}
          onMouseLeave={() => { setHover(null); setHoveredKind(null); }}
          onClick={onEntrySelect(e)}
        />
      </g>
    );
  };

  const renderFlowDot = (e) => {
    const g = computeFlowGeometry(e);
    if (!g) return null;
    const tagObj = tagById[e.tags[0]];
    // Merge entries put the visual marker (and the hit target) at the trunk
    // — the diamond at xMain — rather than at xK on the lane.
    const hitX = g.isMerge ? g.xM : g.xK;
    const dotR = g.isMerge ? 0 : Math.max(2.2, Math.min(6, 2 + g.w * 0.22));
    // Transparent hit ring so taps land reliably on touch devices and
    // the dot isn't shadowed by overlapping paths from neighbouring lanes.
    // Sized to ~22px diameter — smaller than Apple's 44pt guideline but
    // larger hit zones overlapped neighbours when entries cluster on a
    // day, causing the wrong dot to fire.
    const hitR = Math.max(dotR + 5, 11);
    return (
      <g key={`d-${e.id}`} style={{ opacity: g.op }}>
        <circle
          cx={hitX} cy={g.y} r={hitR}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onClick={onEntrySelect(e)}
        />
        <circle
          cx={g.xK} cy={g.y} r={dotR}
          fill={g.isFuture ? "var(--bg)" : g.color}
          stroke={g.color} strokeWidth={g.isFuture ? 1.2 : 0.8}
          strokeDasharray={g.isFuture ? "2 2" : "0"}
          pointerEvents="none"
        />
        {g.isMerge && (
          <rect x={g.xM - 4} y={g.y - 4} width={8} height={8}
                transform={`rotate(45 ${g.xM} ${g.y})`}
                fill={g.color} stroke="var(--bg)" strokeWidth="1"
                pointerEvents="none" />
        )}
        {dayPx >= 60 && tagObj && !g.isMerge && (
          <text
            x={g.xK + (e.dir === "in" || g.xK < xMain ? -8 : 8)}
            y={g.y + 3}
            className="mono"
            textAnchor={e.dir === "in" || g.xK < xMain ? "end" : "start"}
            fontSize="9.5"
            fill="var(--ink-2)"
            pointerEvents="none"
          >
            #{tagObj.label}{e.amount >= 1000 ? " · " + fmtCompact(e.amount, config.currencySymbol) : ""}
          </text>
        )}
      </g>
    );
  };

  const dayLabelStep = dayPx >= 50 ? 1 : dayPx >= 28 ? 2 : dayPx >= 18 ? 5 : 7;
  const bandColors = ["var(--surface)", "var(--bg)"];

  const jumpToNow = () => {
    if (!wrapRef.current) return;
    const target = yNow - wrapRef.current.clientHeight / 2;
    wrapRef.current.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  };

  return (
    <div className="graph-wrap" ref={wrapRef}>
      {nowOffscreen && (
        <button className="jump-to-now-btn"
                style={{ top: scrollTop + 56 }}
                onClick={jumpToNow}
                title={nowOffscreen === "past" ? "jump forward to now" : "jump back to now"}>
          {nowOffscreen === "past" ? "↑ jump to now" : "↓ jump to now"}
        </button>
      )}

      <div className="lane-headers"
           style={{
             width: Math.max(containerW, leftPad + rightPad + mainLaneW + sideLaneW * (lanes.length - 1)),
             height: headerH,
             marginBottom: -headerH,
           }}>
        {lanes.map((l, i) => {
          const x = xForLane(i);
          const label = branchLabel(l.kind, vocabIntensity, branchLabels);
          // Side lanes show their cumulative total in the selected range.
          // The cash lane shows balance at min(range.end, NOW) so the chart
          // doesn't project years of recurring EMIs into a negative number.
          // Always display the cash number (incl. 0 / negative) so the lane
          // doesn't go blank when scheduled debits sink the projection.
          let amount = null;
          let alwaysShow = false;
          if (l.kind === "main") {
            const endMs = isFinite(range.end) ? range.end : timeline.endMs;
            const anchorMs = Math.min(endMs, now.getTime());
            amount = balanceAt(anchorMs);
            alwaysShow = true;
          } else {
            amount = laneAccumulation.lanes[l.kind]?.total ?? 0;
          }
          const laneW = l.kind === "main" ? mainLaneW : sideLaneW;
          return (
            <span key={l.kind}
                  className="lane-header-label"
                  style={{
                    left: x,
                    opacity: hoveredKind && hoveredKind !== l.kind ? 0.4 : 1,
                    maxWidth: Math.max(28, laneW - 2),
                  }}
                  onMouseEnter={() => setHoveredKind(l.kind)}
                  onMouseLeave={() => setHoveredKind(null)}>
              <span className="lh-label" style={{ color: `var(--b-${l.kind})` }}>
                {label}
              </span>
              <span className="lh-total"
                    style={alwaysShow && amount < 0 ? { color: "var(--warn)" } : undefined}>
                {alwaysShow || amount > 0
                  ? fmtCompact(amount, config.currencySymbol)
                  : "—"}
              </span>
            </span>
          );
        })}
      </div>

      <svg className="graph-svg"
           width={Math.max(containerW, leftPad + rightPad + mainLaneW + sideLaneW * (lanes.length - 1))}
           height={totalH}
           onClick={() => setSelected(null)}>
        {monthBands.map((b, i) => {
          const yTop = yForTime(b.endMs);
          const yBot = yForTime(b.startMs);
          if (yBot < visibleYTop || yTop > visibleYBot) return null;
          return (
            <g key={`band-${b.year}-${b.month}`}>
              <rect x={leftPad - 28} y={yTop} width={containerW} height={yBot - yTop}
                    fill={i % 2 ? bandColors[1] : bandColors[0]} opacity={0.6} />
              {isNarrow ? (
                // Narrow: stack month and year vertically, left-anchored at
                // x=2 so they fit in the 32px leftPad without clipping.
                <>
                  <text x={2} y={yTop + 12} className="mono" fontSize="9"
                        fill="var(--ink-3)" fontWeight="600" textAnchor="start"
                        style={{ textTransform: "uppercase", letterSpacing: ".08em" }}>
                    {MONTH_NAMES[b.month]}
                  </text>
                  <text x={2} y={yTop + 23} className="mono" fontSize="8"
                        fill="var(--ink-3)" textAnchor="start"
                        style={{ letterSpacing: ".04em" }}>
                    '{String(b.year).slice(-2)}
                  </text>
                </>
              ) : (
                <text x={leftPad - 12} y={yTop + 14} className="mono" fontSize="10"
                      fill="var(--ink-3)" fontWeight="600" textAnchor="end"
                      style={{ textTransform: "uppercase", letterSpacing: ".12em" }}>
                  {MONTH_NAMES[b.month]} '{String(b.year).slice(-2)}
                </text>
              )}
            </g>
          );
        })}

        {dayList.map((d, i) => {
          const y = yForTime(d.getTime());
          if (y < visibleYTop || y > visibleYBot) return null;
          const dow = d.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isFirst = d.getDate() === 1;
          const showLabel = i % dayLabelStep === 0 || isFirst;
          return (
            <g key={"d-" + i}>
              <line className={`day-rule${isWeekend ? " weekend" : ""}`}
                    x1={leftPad - 24} x2={containerW - 8}
                    y1={y} y2={y} />
              {showLabel && (
                <text className="day-marker" x={14} y={y + 3} textAnchor="start"
                      fontWeight={isFirst ? 700 : 400}>
                  {String(d.getDate()).padStart(2, "0")}
                </text>
              )}
            </g>
          );
        })}

        {/* lane headers are rendered as a sticky HTML overlay above the SVG */}

        <defs>
          <clipPath id="pastClip">
            <rect x={0} y={yNow} width={containerW + 200} height={totalH - yNow} />
          </clipPath>
          <clipPath id="futureClip">
            <rect x={0} y={0} width={containerW + 200} height={yNow} />
          </clipPath>
        </defs>
        <g style={{ opacity: dim("main") }}>
          <polygon points={trunkPolygon} fill="var(--b-main)" opacity={0.92} clipPath="url(#pastClip)" />
          {showFuture && (
            <polygon points={trunkPolygon} fill="var(--b-main)" opacity={0.32} clipPath="url(#futureClip)" />
          )}
          <polygon points={trunkPolygon} fill="none" stroke="var(--b-main)" strokeWidth="0.6" opacity={0.4} />
        </g>

        {/* per-lane accumulating trunks · grow at every event, hold the
         * final width to the timeline end. clipped past/future like main.
         * Kept light so flow strokes & dots stay dominant. */}
        {Object.keys(laneTrunkPolygons).map(kind => {
          const pts = laneTrunkPolygons[kind];
          if (!pts) return null;
          const fill = `var(--b-${kind})`;
          return (
            <g key={"lane-trunk-" + kind}
               style={{ opacity: dim(kind), cursor: "crosshair" }}
               onMouseMove={(ev) => onLaneMove(ev, kind)}
               onMouseLeave={() => { setLaneHover(null); setHoveredKind(null); }}>
              <polygon points={pts} fill={fill} opacity={0.28} clipPath="url(#pastClip)" />
              {showFuture && (
                <polygon points={pts} fill={fill} opacity={0.10} clipPath="url(#futureClip)" />
              )}
            </g>
          );
        })}

        {dayPx >= 70 && withBalance
          .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 30)) === 0)
          .map(seg => {
            const tMs = new Date(seg.when).getTime();
            const y = yForTime(tMs);
            if (y < visibleYTop || y > visibleYBot) return null;
            return (
              <text key={"bal-" + seg.id}
                    x={xMain + (trunkWidthFor(seg.balanceAfter, peakBalance, trunkMinWidth, trunkMaxWidth) / 2) + 6}
                    y={y + 3} className="mono" fontSize="9" fill="var(--ink-3)"
                    style={{ opacity: seg.status === "future" ? 0.5 : 0.85 }}
                    pointerEvents="none">
                {fmtCompact(seg.balanceAfter, config.currencySymbol)}
              </text>
            );
          })}

        {/* connector lines that link every entry in a recurring series */}
        {recurGroups.map(g => {
          const visible = g.list.filter(e => showFuture || e.status !== "future");
          if (visible.length < 2) return null;
          const xK = xForKind(visible[0].kind);
          const ys = visible.map(e => yForTime(new Date(e.when).getTime()));
          const yMin = Math.min(...ys);
          const yMax = Math.max(...ys);
          if (yMax < visibleYTop || yMin > visibleYBot) return null;
          const isHidden = selectedTag && !visible[0].tags.includes(selectedTag);
          return (
            <line key={"recur-" + g.key}
                  x1={xK} x2={xK} y1={yMin} y2={yMax}
                  stroke={`var(--b-${visible[0].kind})`}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                  opacity={isHidden ? 0.05 : 0.35 * dim(visible[0].kind)}
                  pointerEvents="none" />
          );
        })}

        {/* Pass 1: every flow path. Drawn first so dots in pass 2 render on
            top and stay tappable even when paths from neighbouring lanes
            overlap them. */}
        {sortedEntries.map(renderFlowPath)}
        {/* Pass 2: every dot, merge diamond, and tag label. */}
        {sortedEntries.map(renderFlowDot)}

        <g>
          <line x1={leftPad - 30} x2={containerW - 8} y1={yNow} y2={yNow}
                stroke="var(--ink)" strokeWidth="1.1" strokeDasharray="6 4" />
          <rect x={leftPad - 32} y={yNow - 9} width={32} height={18} rx={3} fill="var(--ink)" />
          <text className="mono" x={leftPad - 16} y={yNow + 4} textAnchor="middle" fontSize="10"
                fill="var(--bg)" fontWeight="700">
            now
          </text>
          <text className="mono" x={containerW - 12} y={yNow - 6} textAnchor="end" fontSize="10"
                fill="var(--ink-2)">
            {fmtDateTime(now)}
          </text>
        </g>
      </svg>

      {(() => {
        // Pinned (selected) takes precedence over hover preview so the two
        // never compete. Pinned shows explicit edit/close buttons; hover
        // keeps the lightweight "tap to view" hint.
        const card = selected || hover;
        if (!card || !card.entry) return null;
        const isPinned = !!selected;
        return (
          <div className="commit-card" style={{
            left: Math.min(window.innerWidth - 280, card.x + 16),
            top:  Math.min(window.innerHeight - 220, card.y + 12),
            // .commit-card has pointer-events: none in CSS so the hover
            // preview doesn't block hovering paths underneath. When the card
            // is pinned (selected) it has interactive buttons, so reactivate
            // pointer events for that case.
            pointerEvents: isPinned ? "auto" : "none",
          }}
            onClick={(ev) => ev.stopPropagation()}>
            <div className="sha">{card.entry.id} · {card.entry.dir}</div>
            <div className="title">{card.entry.label}</div>
            <div className="meta">
              {card.entry.tags.map(tid => {
                const ti = tagById[tid];
                if (!ti) return null;
                return <span key={tid} className="tag-chip"
                             style={{ color: `var(--b-${ti.kind})`, borderColor: `var(--b-${ti.kind})` }}>
                         #{ti.label}
                       </span>;
              })}
            </div>
            {card.entry.note && <div className="meta" style={{ marginTop: 4, color: "var(--ink-3)" }}>{card.entry.note}</div>}
            <div className="meta" style={{ marginTop: 4, color: "var(--ink-3)" }}>
              {fmtDateTime(new Date(card.entry.when))}
            </div>
            <div className="amt">
              {card.entry.dir === "in" ? "+" : card.entry.dir === "merge" ? "↺ " : "−"}
              {fmtINR(card.entry.amount, locale, config.currencySymbol).replace("-", "")}
            </div>
            {isPinned ? (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button type="button"
                  onClick={() => { onEditEntry && onEditEntry(selected.entry); setSelected(null); }}
                  style={{
                    flex: 1, minHeight: 32, padding: "6px 10px",
                    border: "1px solid var(--rule)", borderRadius: 6,
                    background: "var(--surface)", color: "var(--ink)",
                    font: "inherit", fontSize: 11, cursor: "pointer",
                  }}>edit</button>
                <button type="button"
                  onClick={() => setSelected(null)}
                  style={{
                    minHeight: 32, padding: "6px 12px",
                    border: "1px solid var(--rule)", borderRadius: 6,
                    background: "transparent", color: "var(--ink-2)",
                    font: "inherit", fontSize: 11, cursor: "pointer",
                  }}>close</button>
              </div>
            ) : (
              <div className="meta" style={{ marginTop: 4, color: "var(--ink-3)", fontSize: 10 }}>
                tap to view
              </div>
            )}
          </div>
        );
      })()}

      {/* lane cumulative tooltip — shown only when not hovering an entry */}
      {laneHover && !(hover && hover.entry) && !selected && (
        <div className="lane-hud-tip" style={{
          left: Math.min(window.innerWidth - 240, laneHover.x + 16),
          top:  Math.min(window.innerHeight - 110, laneHover.y + 12),
        }}>
          <div className="lh-kind" style={{ color: `var(--b-${laneHover.kind})` }}>
            {branchLabel(laneHover.kind, vocabIntensity, branchLabels)}
          </div>
          <div className="lh-amt">
            {fmtINR(laneHover.total, locale, config.currencySymbol)}
          </div>
          <div className="lh-meta">
            cumulative through {fmtDateShort(new Date(laneHover.atMs))}
            {" · "}{laneHover.count} {laneHover.count === 1 ? "entry" : "entries"}
          </div>
        </div>
      )}
    </div>
  );
}
