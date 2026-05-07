import React, { useState, useRef, useEffect, useMemo } from "react";

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

// Combobox: type to filter existing tags or create a new one inline.
// Selecting an existing tag → onChange(id).
// Pressing enter on novel text → onCreate({ id, label, kind: defaultKind })
// then onChange(id).
export default function TagSelect({
  value, onChange, allTags, onCreate, defaultKind = "extras",
  placeholder = "tag",
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Reflect external value changes into the visible text when not focused
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    const t = allTags.find(x => x.id === value);
    setText(t ? t.label : "");
  }, [value, allTags]);

  // Close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const trimmed = text.trim();
  const matches = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return allTags;
    return allTags.filter(t =>
      t.id.toLowerCase().includes(q) || t.label.toLowerCase().includes(q)
    );
  }, [trimmed, allTags]);

  const exact = matches.find(t =>
    t.id.toLowerCase() === trimmed.toLowerCase() ||
    t.label.toLowerCase() === trimmed.toLowerCase()
  );
  const canCreate = !!trimmed && !exact && onCreate;
  // The "create" row sits at the end of the list when applicable.
  const optionCount = matches.length + (canCreate ? 1 : 0);

  useEffect(() => { setHighlight(0); }, [matches.length, canCreate]);

  const pickIndex = (i) => {
    if (i < matches.length) {
      const t = matches[i];
      onChange(t.id);
      setText(t.label);
    } else if (canCreate) {
      const id = slugify(trimmed) || ("tag-" + Date.now().toString(36));
      const created = { id, label: trimmed, kind: defaultKind };
      // dedupe by id — let App's onAddTag handle that, but pick the existing
      // one if its id already exists.
      const existing = allTags.find(t => t.id === id);
      if (existing) {
        onChange(existing.id);
        setText(existing.label);
      } else {
        onCreate(created);
        onChange(id);
        setText(trimmed);
      }
    }
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHighlight(h => Math.min(optionCount - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); pickIndex(highlight); }
    else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <div className="tag-select" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { setText(e.target.value); setOpen(true); }}
        onKeyDown={onKey}
        spellCheck={false}
        className="mono"
      />
      {open && optionCount > 0 && (
        <div className="tag-select-pop" role="listbox">
          {matches.map((t, i) => (
            <button key={t.id} type="button"
                    role="option"
                    aria-selected={i === highlight}
                    className={`tag-select-opt${i === highlight ? " on" : ""}`}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => { e.preventDefault(); pickIndex(i); }}>
              <span className="ts-swatch" style={{ background: `var(--b-${t.kind})` }} />
              <span className="ts-label">#{t.label}</span>
              <span className="ts-kind">{t.kind}</span>
            </button>
          ))}
          {canCreate && (
            <button type="button"
                    role="option"
                    aria-selected={highlight === matches.length}
                    className={`tag-select-opt create${highlight === matches.length ? " on" : ""}`}
                    onMouseEnter={() => setHighlight(matches.length)}
                    onMouseDown={(e) => { e.preventDefault(); pickIndex(matches.length); }}>
              <span className="ts-swatch new"
                    style={{ background: `var(--b-${defaultKind})` }} />
              <span className="ts-label">+ create #{trimmed}</span>
              <span className="ts-kind">{defaultKind}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
