// Phone-only bottom tab bar: graph / ledger / more.
// Active state shown by a 2px accent bar at the bottom of the active item.
// Hidden on desktop via CSS.

import React from "react";

const ICONS = {
  graph: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </svg>
  ),
  ledger: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6"  x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6"  x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  more: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5"  cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </svg>
  ),
};

export default function BottomNav({ active, onChange }) {
  const items = [
    { id: "graph",  label: "graph"  },
    { id: "ledger", label: "ledger" },
    { id: "more",   label: "more"   },
  ];
  return (
    <nav className="bottom-nav" role="tablist" aria-label="primary">
      {items.map(it => (
        <button key={it.id}
                type="button"
                role="tab"
                aria-selected={active === it.id}
                className={`bn-item${active === it.id ? " active" : ""}`}
                onClick={() => onChange(it.id)}>
          <span className="bn-ic">{ICONS[it.id]}</span>
          <span className="bn-lbl">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
