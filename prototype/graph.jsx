// Continuous-timeline money graph.
// Y axis is real time. Past below, NOW in the middle, future above.
// Initial viewport ≈ 1 week around today. Scroll up = into future. Scroll down = into past.
// Trunk width = running balance (breathes at every event).

const { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } = React;

// ---------- formatting ----------
function fmtINR(n, locale) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (locale === "lakh") {
    const s = abs.toFixed(0);
    const lastThree = s.slice(-3);
    const rest = s.slice(0, -3);
    const formatted = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree : lastThree;
    return (n < 0 ? "-" : "") + "₹" + formatted;
  }
  return (n < 0 ? "-" : "") + "₹" + abs.toLocaleString("en-US");
}
function fmtCompact(n) {
  const abs = Math.abs(n);
  if (abs >= 1e7) return "₹" + (n / 1e7).toFixed(1) + "Cr";
  if (abs >= 1e5) return "₹" + (n / 1e5).toFixed(1) + "L";
  if (abs >= 1e3) return "₹" + (n / 1e3).toFixed(1) + "k";
  return "₹" + n;
}
function branchLabel(kind, intensity) {
  return BRANCH_LABELS[kind] ? (BRANCH_LABELS[kind][intensity] || BRANCH_LABELS[kind].medium) : kind;
}

const MONTH_NAMES = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
function fmtDateShort(d) {
  return String(d.getDate()).padStart(2,"0") + " " + MONTH_NAMES[d.getMonth()];
}
function fmtDateTime(d) {
  return fmtDateShort(d) + " · " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
}
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

// ---------- Sankey thickness for a single flow ----------
function thicknessFor(amount, scale, ref) {
  const a = Math.max(1, amount);
  if (scale === "linear") return Math.max(0.8, Math.min(20, (a / ref) * 20));
  if (scale === "log")    return Math.max(0.8, Math.min(20, Math.log(a + 1) * 1.7));
  return Math.max(0.8, Math.min(20, Math.sqrt(a) * 0.18));
}

// ---------- Trunk width from running balance ----------
function trunkWidthFor(balance, peak) {
  const minW = 3;
  const maxW = 38;
  if (peak <= 0) return minW;
  const ratio = Math.max(0, balance) / peak;
  return minW + (maxW - minW) * Math.sqrt(ratio);
}

// ---------- main component ----------
function MoneyGraph({ tweaks, range, freshEntry, hoveredKind, setHoveredKind, selectedTag, onEditEntry, entries }) {
  const { vocabIntensity, thicknessScale, showFuture, locale, zoom } = tweaks;

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
  // If a range is set (not "all"), use it directly. Else anchor on data extents.
  const timeline = useMemo(() => {
    if (range && isFinite(range.start) && isFinite(range.end)) {
      return { startMs: range.start, endMs: range.end };
    }
    if (!entries.length) {
      const start = new Date(NOW); start.setDate(start.getDate() - 7);
      const end   = new Date(NOW); end.setDate(end.getDate() + 7);
      return { startMs: start.getTime(), endMs: end.getTime() };
    }
    const sorted = entries.slice().sort((a,b) => new Date(a.when) - new Date(b.when));
    const first = startOfDay(new Date(sorted[0].when)); first.setDate(first.getDate() - 1);
    const last  = new Date(sorted[sorted.length - 1].when);
    const future = new Date(NOW); future.setDate(future.getDate() + 21);
    const end = last > future ? last : future;
    end.setHours(23,59,59,999);
    return { startMs: first.getTime(), endMs: end.getTime() };
  }, [entries, range && range.start, range && range.end]);

  // ----- vertical scale -----
  // Base: at zoom=1, 7 days fills the viewport.
  const headerH = 32;
  const footerH = 28;
  const viewportH = containerH - headerH - footerH;
  const baseDayPx = Math.max(40, viewportH / 7);
  const dayPx = baseDayPx * zoom;
  const totalDays = Math.max(1, (timeline.endMs - timeline.startMs) / MS_PER_DAY);
  const totalH = headerH + totalDays * dayPx + footerH;

  // y for time (in ms). Time UP means LATER → higher y values are EARLIER.
  // y = headerH + (endMs - t) / MS_PER_DAY * dayPx
  const yForTime = useCallback((tMs) => headerH + ((timeline.endMs - tMs) / MS_PER_DAY) * dayPx, [timeline, dayPx]);
  const yNow = yForTime(NOW.getTime());

  // ----- horizontal: lanes -----
  const lanes = [
    { kind: "income",  side: "L" },
    { kind: "main",    side: "C" },
    { kind: "fixed",   side: "R" },
    { kind: "extras",  side: "R" },
    { kind: "credit",  side: "R" },
    { kind: "loans",   side: "R" },
    { kind: "savings", side: "R" },
  ];
  const leftPad = 64;
  const rightPad = 24;
  const usableW = Math.max(560, containerW) - leftPad - rightPad;
  const mainLaneW = Math.min(120, usableW * 0.16);
  const sideLaneW = (usableW - mainLaneW) / (lanes.length - 1);
  const xForLane = (i) => {
    let x = leftPad;
    for (let k = 0; k < i; k++) x += (lanes[k].kind === "main" ? mainLaneW : sideLaneW);
    x += (lanes[i].kind === "main" ? mainLaneW : sideLaneW) / 2;
    return x;
  };
  const xForKind = (kind) => xForLane(lanes.findIndex(l => l.kind === kind));
  const xMain = xForKind("main");

  // ----- Running balance -----
  const sortedEntries = useMemo(() =>
    entries.slice().sort((a,b) => new Date(a.when) - new Date(b.when)),
    [entries]);
  const withBalance = useMemo(() =>
    computeRunningBalance(sortedEntries),
    [sortedEntries]);

  const peakBalance = useMemo(() => {
    let p = 0;
    for (const e of withBalance) p = Math.max(p, e.balanceAfter, e.balanceBefore);
    return Math.max(p, 50000);
  }, [withBalance]);

  // ----- Build trunk polygon: traverse withBalance to build left/right edges -----
  const trunkPolygon = useMemo(() => {
    if (!withBalance.length) return "";
    // Bottom anchor at the EARLIEST event minus a tiny bit
    const startMs = withBalance[0].balanceBefore !== undefined ? new Date(withBalance[0].when).getTime() : timeline.startMs;
    const xc = xMain;
    const left = [], right = [];
    // Start at very bottom (earliest visible time)
    left.push([xc - trunkWidthFor(INITIAL_BALANCE, peakBalance) / 2, yForTime(timeline.startMs)]);
    right.push([xc + trunkWidthFor(INITIAL_BALANCE, peakBalance) / 2, yForTime(timeline.startMs)]);

    // Walk in chronological order: at each event, jump width
    for (const e of withBalance) {
      const t = new Date(e.when).getTime();
      const y = yForTime(t);
      const wB = trunkWidthFor(e.balanceBefore, peakBalance);
      const wA = trunkWidthFor(e.balanceAfter, peakBalance);
      // step below/above for the change
      const half = Math.min(4, dayPx * 0.04);
      // "below" in y means later in source; but time UP, so y smaller = later. The walk continues from bottom up.
      // We're building from earliest→latest, which goes from larger y → smaller y.
      // Add point just BELOW (larger y) the event with wBefore, then jump to ABOVE (smaller y) with wAfter.
      left.push([xc - wB / 2, y + half]);
      right.push([xc + wB / 2, y + half]);
      left.push([xc - wA / 2, y - half]);
      right.push([xc + wA / 2, y - half]);
    }
    // Top anchor — extend at last balance up to timeline end
    const last = withBalance[withBalance.length - 1];
    const wTop = trunkWidthFor(last.balanceAfter, peakBalance);
    left.push([xc - wTop / 2, yForTime(timeline.endMs)]);
    right.push([xc + wTop / 2, yForTime(timeline.endMs)]);

    const points = [...left, ...right.slice().reverse()];
    return points.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  }, [withBalance, dayPx, xMain, peakBalance, timeline]);

  // ----- Day rules + month bands -----
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

  // ----- Initial scroll: place NOW in middle viewport -----
  // Re-center whenever totalH changes meaningfully (new recurring entries can extend timeline)
  // until the user has scrolled themselves.
  const didInit = useRef(false);
  const userScrolled = useRef(false);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onUserScroll = (e) => {
      // ignore programmatic scrolls (no event source) — heuristic: any wheel/touch/keydown sets the flag
    };
    const onWheel = () => { userScrolled.current = true; };
    const onTouch = () => { userScrolled.current = true; };
    const onKey   = (e) => { if (["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," "].includes(e.key)) userScrolled.current = true; };
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
    didInit.current = true;
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

  // ----- live "balance at scroll center" -----
  const [scrollCenterMs, setScrollCenterMs] = useState(NOW.getTime());
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = null;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const center = el.scrollTop + el.clientHeight / 2;
        const tMs = timeline.endMs - ((center - headerH) / dayPx) * MS_PER_DAY;
        setScrollCenterMs(tMs);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { el.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [timeline, dayPx]);

  const balanceAt = useCallback((tMs) => {
    let bal = INITIAL_BALANCE;
    for (const e of withBalance) {
      if (new Date(e.when).getTime() <= tMs) bal = e.balanceAfter;
      else break;
    }
    return bal;
  }, [withBalance]);

  // ----- hover/edit -----
  const [hover, setHover] = useState(null);

  const dim = (kind) => {
    if (selectedTag) {
      const tagKind = TAG_BY_ID[selectedTag] && TAG_BY_ID[selectedTag].kind;
      return tagKind === kind || kind === "main" ? 1 : 0.12;
    }
    if (hoveredKind && hoveredKind !== kind && kind !== "main") return 0.18;
    return 1;
  };
  const refAmt = 30000;
  const t = (a) => thicknessFor(a, thicknessScale, refAmt);

  // ----- only render entries within the visible y range (perf) -----
  // Plus ~200px padding for smooth scroll
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

  // ----- entry rendering -----
  const renderEntry = (e) => {
    if (!showFuture && e.status === "future") return null;
    const t0 = new Date(e.when).getTime();
    const y = yForTime(t0);
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

    const tagObj = TAG_BY_ID[e.tags[0]];
    const isFresh = freshEntry && freshEntry.id === e.id;
    const isRecurChild = !!e.recurOccurrence;
    const isRecurParent = !!e.recur && !isRecurChild;

    return (
      <g key={e.id} style={{ opacity: op }} className={isFresh ? "flow fresh" : "flow"}>
        <path
          d={path} fill="none" stroke={color}
          strokeWidth={w} strokeLinecap="round"
          strokeDasharray={isFuture ? "4 5" : "0"}
          opacity={isFuture ? 0.6 : 0.9}
          style={{ cursor: "pointer", pointerEvents: "stroke" }}
          onMouseEnter={(ev) => { setHover({ entry: e, x: ev.clientX, y: ev.clientY }); setHoveredKind(e.kind); }}
          onMouseMove={(ev) => setHover(h => h ? { ...h, x: ev.clientX, y: ev.clientY } : null)}
          onMouseLeave={() => { setHover(null); setHoveredKind(null); }}
          onClick={() => onEditEntry && onEditEntry(e)}
        />
        <circle
          cx={xK} cy={y}
          r={isMerge ? 0 : Math.max(2.2, Math.min(6, 2 + w * 0.22))}
          fill={isFuture ? "var(--bg)" : color}
          stroke={color} strokeWidth={isFuture ? 1.2 : 0.8}
          strokeDasharray={isFuture ? "2 2" : "0"}
          style={{ cursor: "pointer" }}
          onClick={() => onEditEntry && onEditEntry(e)}
        />
        {isMerge && (
          <rect x={xM - 4} y={y - 4} width={8} height={8}
                transform={`rotate(45 ${xM} ${y})`}
                fill={color} stroke="var(--bg)" strokeWidth="1" pointerEvents="none" />
        )}
        {dayPx >= 60 && tagObj && !isMerge && (
          <text
            x={xK + (e.dir === "in" || xK < xMain ? -8 : 8)}
            y={y + 3}
            className="mono"
            textAnchor={e.dir === "in" || xK < xMain ? "end" : "start"}
            fontSize="9.5"
            fill="var(--ink-2)"
            pointerEvents="none"
          >
            #{tagObj.label}{e.amount >= 1000 ? " · " + fmtCompact(e.amount) : ""}
          </text>
        )}
      </g>
    );
  };

  // ----- Day labels -----
  const dayLabelStep = dayPx >= 50 ? 1 : dayPx >= 28 ? 2 : dayPx >= 18 ? 5 : 7;

  // ----- balance at center of viewport (for HUD) -----
  const liveBal = balanceAt(scrollCenterMs);
  const liveDate = new Date(scrollCenterMs);
  const isAtNow = Math.abs(scrollCenterMs - NOW.getTime()) < MS_PER_DAY * 0.3;

  // ----- background month band colors -----
  const bandColors = ["var(--surface)", "var(--bg)"];

  return (
    <div className="graph-wrap" ref={wrapRef}>
      {/* sticky balance HUD (DOM, not SVG, so it stays put while scrolling) */}
      <div className="balance-hud">
        <div className="hud-label">{isAtNow ? "balance now" : "balance on " + fmtDateShort(liveDate)}</div>
        <div className="hud-amt">{fmtINR(liveBal, locale)}</div>
        {!isAtNow && (
          <button className="hud-jump" onClick={() => {
            if (!wrapRef.current) return;
            const target = yNow - wrapRef.current.clientHeight / 2;
            wrapRef.current.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
          }}>jump to now ↺</button>
        )}
      </div>

      <svg className="graph-svg" width={Math.max(containerW, leftPad + rightPad + mainLaneW + sideLaneW * (lanes.length - 1))} height={totalH}>
        {/* alternating month bands */}
        {monthBands.map((b, i) => {
          const yTop = yForTime(b.endMs);
          const yBot = yForTime(b.startMs);
          if (yBot < visibleYTop || yTop > visibleYBot) return null;
          return (
            <g key={`band-${b.year}-${b.month}`}>
              <rect x={leftPad - 28} y={yTop} width={containerW} height={yBot - yTop}
                    fill={i % 2 ? bandColors[1] : bandColors[0]} opacity={0.6} />
              <text x={leftPad - 12} y={yTop + 14} className="mono" fontSize="10"
                    fill="var(--ink-3)" fontWeight="600" textAnchor="end" style={{ textTransform: "uppercase", letterSpacing: ".12em" }}>
                {MONTH_NAMES[b.month]} '{String(b.year).slice(-2)}
              </text>
            </g>
          );
        })}

        {/* day rules */}
        {dayList.map((d, i) => {
          const y = yForTime(d.getTime());
          if (y < visibleYTop || y > visibleYBot) return null;
          const dow = d.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isFirst = d.getDate() === 1;
          const showLabel = i % dayLabelStep === 0 || isFirst;
          return (
            <g key={"d-"+i}>
              <line className={`day-rule${isWeekend ? " weekend" : ""}`}
                    x1={leftPad - 24} x2={containerW - 8}
                    y1={y} y2={y} />
              {showLabel && (
                <text className="day-marker" x={14} y={y + 3} textAnchor="start"
                      fontWeight={isFirst ? 700 : 400}>
                  {String(d.getDate()).padStart(2,"0")}
                </text>
              )}
            </g>
          );
        })}

        {/* lane headers — sticky-ish: drawn at top */}
        {lanes.map((l, i) => {
          const x = xForLane(i);
          const label = branchLabel(l.kind, vocabIntensity);
          return (
            <g key={l.kind}>
              <text x={x} y={headerH - 12} textAnchor="middle"
                    className="mono" fontSize="10.5"
                    fill={`var(--b-${l.kind})`} fontWeight="600"
                    style={{ cursor: "pointer", opacity: hoveredKind && hoveredKind !== l.kind ? 0.4 : 1 }}
                    onMouseEnter={() => setHoveredKind(l.kind)}
                    onMouseLeave={() => setHoveredKind(null)}>
                {label}
              </text>
            </g>
          );
        })}

        {/* trunk — past + future split via clip */}
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

        {/* sparse balance labels along trunk */}
        {dayPx >= 70 && withBalance.filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length/30)) === 0).map(seg => {
          const tMs = new Date(seg.when).getTime();
          const y = yForTime(tMs);
          if (y < visibleYTop || y > visibleYBot) return null;
          return (
            <text key={"bal-"+seg.id} x={xMain + (trunkWidthFor(seg.balanceAfter, peakBalance) / 2) + 6}
                  y={y + 3} className="mono" fontSize="9" fill="var(--ink-3)"
                  style={{ opacity: seg.status === "future" ? 0.5 : 0.85 }}
                  pointerEvents="none">
              {fmtCompact(seg.balanceAfter)}
            </text>
          );
        })}

        {/* entries (flows) */}
        {sortedEntries.map(renderEntry)}

        {/* "now" line */}
        <g>
          <line x1={leftPad - 30} x2={containerW - 8} y1={yNow} y2={yNow}
                stroke="var(--ink)" strokeWidth="1.1" strokeDasharray="6 4" />
          <rect x={leftPad - 32} y={yNow - 9} width={32} height={18} rx={3} fill="var(--ink)" />
          <text className="mono" x={leftPad - 16} y={yNow + 4} textAnchor="middle" fontSize="10" fill="var(--bg)" fontWeight="700">
            now
          </text>
          <text className="mono" x={containerW - 12} y={yNow - 6} textAnchor="end" fontSize="10" fill="var(--ink-2)">
            {fmtDateTime(NOW)}
          </text>
        </g>
      </svg>

      {hover && hover.entry && (
        <div className="commit-card" style={{
          left: Math.min(window.innerWidth - 280, hover.x + 16),
          top: Math.min(window.innerHeight - 200, hover.y + 12),
        }}>
          <div className="sha">{hover.entry.id} · {hover.entry.dir}</div>
          <div className="title">{hover.entry.label}</div>
          <div className="meta">
            {hover.entry.tags.map(tid => {
              const ti = TAG_BY_ID[tid];
              if (!ti) return null;
              return <span key={tid} className="tag-chip" style={{ color: `var(--b-${ti.kind})`, borderColor: `var(--b-${ti.kind})` }}>#{ti.label}</span>;
            })}
          </div>
          {hover.entry.note && <div className="meta" style={{ marginTop: 4, color: "var(--ink-3)" }}>{hover.entry.note}</div>}
          <div className="meta" style={{ marginTop: 4, color: "var(--ink-3)" }}>
            {fmtDateTime(new Date(hover.entry.when))}
          </div>
          <div className="amt">
            {hover.entry.dir === "in" ? "+" : hover.entry.dir === "merge" ? "↺ " : "−"}{fmtINR(hover.entry.amount, locale).replace("-", "")}
          </div>
          <div className="meta" style={{ marginTop: 4, color: "var(--ink-3)", fontSize: 10 }}>
            click to edit
          </div>
        </div>
      )}
    </div>
  );
}

window.MoneyGraph = MoneyGraph;
window.fmtINR = fmtINR;
window.fmtCompact = fmtCompact;
window.fmtDateTime = fmtDateTime;
window.fmtDateShort = fmtDateShort;
window.branchLabelFor = branchLabel;
