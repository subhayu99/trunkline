// Floating action button — phone-only.
// 40px visible, 44px hit area (8px transparent padding around the circle).
// Hidden when the More tab is active or the composer sheet is open.
// Scroll-aware visibility wired in Task 10.

import React from "react";

export default function Fab({ onClick, hidden = false }) {
  return (
    <button type="button"
            className={`fab-wrap${hidden ? " hidden" : ""}`}
            onClick={onClick}
            aria-label="add entry">
      <span className="fab">+</span>
    </button>
  );
}
