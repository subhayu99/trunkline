import React from "react";

const ICONS = { paper: "☼", terminal: "❯", midnight: "☾" };

export default function ThemeToggle({ value, onChange, themes }) {
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
