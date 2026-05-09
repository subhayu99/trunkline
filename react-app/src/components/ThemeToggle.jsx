import React from "react";

const ICONS = { paper: "☼", terminal: "❯", midnight: "☾" };

export default function ThemeToggle({ value, onChange, themes, compact }) {
  if (compact) {
    const list = themes || [];
    const idx = list.indexOf(value);
    const next = list[(idx + 1) % list.length] || list[0];
    return (
      <button type="button"
              className="theme-toggle theme-toggle-cycle"
              title={`theme: ${value} (tap to cycle)`}
              aria-label={`theme: ${value}, tap to cycle`}
              onClick={() => next && onChange(next)}>
        <span className="ico">{ICONS[value] || "•"}</span>
      </button>
    );
  }
  return (
    <div className="theme-toggle" role="group" aria-label="theme">
      {themes.map(name => (
        <button key={name}
                type="button"
                className={value === name ? "on" : ""}
                title={name}
                onClick={() => onChange(name)}>
          <span className="ico">{ICONS[name] || "•"}</span>
          <span className="lbl">{name}</span>
        </button>
      ))}
    </div>
  );
}
