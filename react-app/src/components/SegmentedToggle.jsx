import React from "react";

// Generic 2/3-option pill toggle in the same style as ThemeToggle / ViewToggle.
// Used in the topbar for vocabulary, thickness scale, and number format.
export default function SegmentedToggle({
  value, onChange, options, ariaLabel, title, className = "segmented-toggle",
}) {
  return (
    <div className={className} role="group" aria-label={ariaLabel}>
      {options.map(o => {
        const v = typeof o === "object" ? o.value : o;
        const lbl = typeof o === "object" ? o.label : o;
        const tip = typeof o === "object" && o.title ? o.title : title;
        return (
          <button key={v}
                  type="button"
                  className={value === v ? "on" : ""}
                  title={tip}
                  aria-pressed={value === v}
                  onClick={() => onChange(v)}>
            <span className="lbl">{lbl}</span>
          </button>
        );
      })}
    </div>
  );
}
