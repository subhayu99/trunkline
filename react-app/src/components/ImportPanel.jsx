import React, { useState, useRef } from "react";
import {
  importUserDoc, importCustomizationDoc, detectDocType,
} from "../lib/schema.js";

// Full-screen overlay for importing JSON. Two paths: paste JSON or upload
// a .json file. The same panel transparently accepts either a user doc or
// a customization doc — the file's `doc` field decides where it lands.
//
// onApply(parsed, kind) where kind is "user" | "customization".
export default function ImportPanel({ onClose, onApply, hasExistingData }) {
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  // parsed = { kind: "user" | "customization", value: <doc> }
  const [parsed, setParsed] = useState(null);
  const fileRef = useRef(null);

  const tryParse = (raw) => {
    setError(null); setParsed(null);
    let json;
    // Tolerate the LLM wrapping the JSON in ```json ... ``` fences.
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try { json = JSON.parse(stripped); }
    catch (e) { setError("not valid JSON: " + e.message); return; }
    const kind = detectDocType(json);
    if (kind === "customization") {
      try { setParsed({ kind, value: importCustomizationDoc(json) }); }
      catch (e) { setError(e.message); }
      return;
    }
    // Default to user doc — covers explicit "user", legacy snapshots, and
    // bare {initialBalance, entries} shapes.
    try { setParsed({ kind: "user", value: importUserDoc(json) }); }
    catch (e) { setError(e.message); }
  };

  const onFileChosen = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const raw = String(r.result || "");
      setText(raw);
      tryParse(raw);
    };
    r.readAsText(f);
  };

  const apply = () => {
    if (!parsed) return;
    if (parsed.kind === "user" && hasExistingData &&
        !confirm("This replaces all your current entries. Continue?")) return;
    if (parsed.kind === "customization" &&
        !confirm("Apply customization (graph dimensions + picker enums)? Your data is unaffected.")) return;
    onApply(parsed.value, parsed.kind);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-panel wide" onClick={e => e.stopPropagation()}>
        <div className="op-head">
          <span className="op-title">Import data</span>
          <button className="op-close" onClick={onClose}>esc ×</button>
        </div>
        <div className="op-body">
          <p className="op-help">
            Paste a JSON ledger below, or upload a previously-exported file.
            The panel accepts <strong>user</strong> docs (your data) or{" "}
            <strong>customization</strong> docs (graph + picker enums) and
            routes them automatically.
          </p>

          <div className="op-row">
            <button className="op-btn" onClick={() => fileRef.current && fileRef.current.click()}>
              upload .json file
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json"
                   style={{ display: "none" }} onChange={onFileChosen} />
            <span className="op-or">or paste below</span>
          </div>

          <textarea
            className="op-text mono"
            placeholder='{ "schema": 2, "doc": "user", "ledger": { ... } }'
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={() => text.trim() && tryParse(text)}
          />

          {error && <div className="op-error">⚠ {error}</div>}
          {parsed && parsed.kind === "user" && (
            <div className="op-summary">
              ✓ user doc · {parsed.value.ledger.entries.length} entries · initial balance{" "}
              <span className="mono">
                {parsed.value.currencySymbol}
                {parsed.value.ledger.initialBalance.toLocaleString("en-IN")}
              </span>
              {parsed.value.tags.length > 0 && <> · {parsed.value.tags.length} tags</>}
            </div>
          )}
          {parsed && parsed.kind === "customization" && (
            <div className="op-summary">
              ✓ customization doc · {parsed.value.enums.themes.length} themes ·{" "}
              {parsed.value.enums.locales.length} locales ·{" "}
              {parsed.value.enums.rangePresets.length} range presets
            </div>
          )}
        </div>
        <div className="op-foot">
          <button className="op-btn ghost" onClick={onClose}>cancel</button>
          <button className="op-btn primary"
                  disabled={!parsed}
                  onClick={apply}>
            {parsed?.kind === "customization" ? "apply customization" : "replace ledger"}
          </button>
        </div>
      </div>
    </div>
  );
}
