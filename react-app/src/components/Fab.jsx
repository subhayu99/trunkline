// Floating action button — phone-only.
// 40px visible, 44px hit area (transparent padding around the circle).
// Auto-hides when scrolling down; reappears on scroll-up or scroll-stop.

import React from "react";
import { useScrollDirection } from "../hooks/useScrollDirection.js";

export default function Fab({ onClick, hidden = false }) {
  const dir = useScrollDirection();
  const shouldHide = hidden || dir === "down";
  return (
    <button type="button"
            className={`fab-wrap${shouldHide ? " hidden" : ""}`}
            onClick={onClick}
            aria-label="add entry">
      <span className="fab">+</span>
    </button>
  );
}
