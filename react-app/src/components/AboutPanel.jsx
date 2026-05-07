import React from "react";

export default function AboutPanel({ onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-panel" onClick={e => e.stopPropagation()}>
        <div className="op-head">
          <span className="op-title">About</span>
          <button className="op-close" onClick={onClose}>esc ×</button>
        </div>
        <div className="op-body">
          <p>
            <b>trunkline</b> is a single-page finance tracker. Your data lives only
            in this browser's local storage — there is no server, no account, no telemetry.
          </p>
          <p>
            Use the menu to <b>export</b> a backup (JSON file) or <b>import</b> one. Use
            <b> ai prompt → json</b> to convert a bank statement into a ledger via any LLM.
          </p>
          <p className="muted">
            Data is keyed under <code className="mono">trunkline.ledger</code> in your
            browser. Clearing site data wipes it — back up regularly.
          </p>
        </div>
      </div>
    </div>
  );
}
