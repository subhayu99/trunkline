// Mobile-only bottom-sheet wrapping ComposerForm.
// - Slides up from the bottom when `open` flips true.
// - Dim backdrop closes on tap.
// - Drag the grab handle down >80px to dismiss.
// - Keyboard-aware via 100dvh + interactive-widget=resizes-content meta.

import React, { useEffect, useRef, useState } from "react";
import ComposerForm from "./ComposerForm.jsx";

export default function ComposerSheet({
  open, onClose,
  tweaks, onLog, config, tagById, now, onAddTag, entries, prefill,
}) {
  const sheetRef = useRef(null);
  const dragStartY = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (!open) setDragOffset(0);
  }, [open]);

  // Esc to close (works when a hardware keyboard is attached).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Drag handle: track touchstart/touchmove/touchend.
  const onGrabStart = (e) => {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartY.current = y;
  };
  const onGrabMove = (e) => {
    if (dragStartY.current == null) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = Math.max(0, y - dragStartY.current);
    setDragOffset(dy);
  };
  const onGrabEnd = () => {
    if (dragStartY.current == null) return;
    if (dragOffset > 80) onClose();
    else setDragOffset(0);
    dragStartY.current = null;
  };

  if (!open) return null;

  return (
    <div className="cs-root" role="dialog" aria-modal="true" aria-label="add entry">
      <div className="cs-backdrop" onClick={onClose} />
      <div className="cs-sheet" ref={sheetRef}
           style={{ transform: `translateY(${dragOffset}px)` }}>
        <div className="cs-grab"
             onTouchStart={onGrabStart}
             onTouchMove={onGrabMove}
             onTouchEnd={onGrabEnd}
             onMouseDown={onGrabStart}
             onMouseMove={onGrabMove}
             onMouseUp={onGrabEnd}>
          <span className="cs-grab-bar" />
        </div>
        <div className="cs-body">
          <ComposerForm
            tweaks={tweaks} onLog={onLog}
            config={config} tagById={tagById} now={now}
            onAddTag={onAddTag} entries={entries}
            prefill={prefill}
            autoFocus
            onSubmitted={onClose}
          />
        </div>
      </div>
    </div>
  );
}
