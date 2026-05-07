import React, { useState, useRef } from "react";
import { importLedgerJson } from "../hooks/useLedger.js";

// Full-screen overlay for importing a ledger. Two paths: paste JSON or
// upload a .json file. Validates before applying; the user has to confirm
// when there's already data to overwrite.
export default function ImportPanel({ onClose, onApply, hasExistingData }) {
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null);
  const fileRef = useRef(null);

  const tryParse = (raw) => {
    setError(null); setParsed(null);
    let json;
    try { json = JSON.parse(raw); }
    catch (e) { setError("not valid JSON: " + e.message); return; }
    try {
      const snap = importLedgerJson(json);
      setParsed(snap);
    } catch (e) { setError(e.message); }
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
    if (hasExistingData &&
        !confirm("This replaces all your current entries. Continue?")) {
      return;
    }
    onApply(parsed);
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
            The shape can be either a full snapshot
            (<code className="mono">{`{ initialBalance, entries, userTags }`}</code>)
            or just <code className="mono">{`{ initialBalance, entries }`}</code>.
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
            placeholder='{ "initialBalance": 0, "entries": [ ... ] }'
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={() => text.trim() && tryParse(text)}
          />

          {error && <div className="op-error">⚠ {error}</div>}
          {parsed && (
            <div className="op-summary">
              ✓ valid · {parsed.entries.length} entries · initial balance{" "}
              <span className="mono">₹{parsed.initialBalance.toLocaleString("en-IN")}</span>
              {parsed.userTags.length > 0 && <> · {parsed.userTags.length} user tags</>}
            </div>
          )}
        </div>
        <div className="op-foot">
          <button className="op-btn ghost" onClick={onClose}>cancel</button>
          <button className="op-btn primary"
                  disabled={!parsed}
                  onClick={apply}>
            replace ledger
          </button>
        </div>
      </div>
    </div>
  );
}
