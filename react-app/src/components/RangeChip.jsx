import React, { useState, useRef, useEffect } from "react";
import { isoLocal } from "../lib/format.js";

export default function RangeChip({ tweaks, setTweak, range, presets, now }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const customStart = tweaks.rangeStart || isoLocal(new Date(now.getFullYear(), now.getMonth(), 1));
  const customEnd   = tweaks.rangeEnd   || isoLocal(now);
  const isAll = tweaks.rangePreset === "all";

  return (
    <div className="range-chip-wrap" ref={ref}>
      <button className={`range-chip${isAll ? "" : " active"}`}
              onClick={() => setOpen(o => !o)} title="select date range">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8"  y1="2" x2="8"  y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>{range.label}</span>
        {!isAll && (
          <span className="x" onClick={(e) => {
            e.stopPropagation();
            setTweak({ rangePreset: "all", rangeStart: null, rangeEnd: null });
          }}>×</span>
        )}
      </button>
      {open && (
        <div className="range-pop">
          <div className="rp-section">
            <div className="rp-label">presets</div>
            <div className="rp-grid">
              {presets.map(p => (
                <button key={p.value}
                        className={tweaks.rangePreset === p.value ? "on" : ""}
                        onClick={() => { setTweak({ rangePreset: p.value }); setOpen(false); }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rp-section">
            <div className="rp-label">custom range</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="rp-row"><span>from</span>
                <input type="datetime-local" value={customStart}
                       onChange={e => setTweak({ rangeStart: e.target.value, rangePreset: "custom" })}/>
              </label>
              <label className="rp-row"><span>to</span>
                <input type="datetime-local" value={customEnd}
                       onChange={e => setTweak({ rangeEnd: e.target.value, rangePreset: "custom" })}/>
              </label>
              <button className="rp-apply"
                      onClick={() => { setTweak({ rangePreset: "custom" }); setOpen(false); }}>
                apply custom range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
