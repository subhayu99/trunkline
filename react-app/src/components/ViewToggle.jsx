import React from "react";

const ITEMS = [
  {
    v: "graph",
    label: "graph",
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="5" r="2"/>
        <circle cx="6" cy="19" r="2"/>
        <circle cx="18" cy="12" r="2"/>
        <path d="M6 7v10"/>
        <path d="M6 9h6a4 4 0 0 1 4 4"/>
      </svg>
    ),
  },
  {
    v: "ledger",
    label: "ledger",
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="6"  x2="20" y2="6"/>
        <line x1="4" y1="12" x2="20" y2="12"/>
        <line x1="4" y1="18" x2="20" y2="18"/>
      </svg>
    ),
  },
];

export default function ViewToggle({ value, onChange }) {
  return (
    <div className="view-toggle" role="group" aria-label="view mode">
      {ITEMS.map(it => (
        <button key={it.v}
                type="button"
                className={value === it.v ? "on" : ""}
                title={it.label}
                aria-pressed={value === it.v}
                onClick={() => onChange(it.v)}>
          <span className="ico">{it.icon}</span>
          <span className="lbl">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
