import React, { useState, useMemo, useRef } from "react";
import { importLedgerJson } from "../hooks/useLedger.js";

// Two-step modal: (1) copy a canned prompt that includes the user's tag
// taxonomy + the JSON schema, paste their bank statement next to it in
// any LLM, (2) paste the LLM's output back here to import.
export default function AIPromptPanel({ onClose, onApply, config, hasExistingData }) {
  const [response, setResponse] = useState("");
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [copied, setCopied] = useState(false);
  const promptRef = useRef(null);

  const prompt = useMemo(() => buildPrompt(config), [config]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // Fallback: select-all in the textarea
      promptRef.current && promptRef.current.select();
    }
  };

  const tryParse = (raw) => {
    setError(null); setParsed(null);
    let json;
    // Tolerate the LLM wrapping the JSON in ```json ... ``` fences.
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try { json = JSON.parse(stripped); }
    catch (e) { setError("not valid JSON: " + e.message); return; }
    try { setParsed(importLedgerJson(json)); }
    catch (e) { setError(e.message); }
  };

  const apply = () => {
    if (!parsed) return;
    if (hasExistingData &&
        !confirm("This replaces all your current entries. Continue?")) return;
    onApply(parsed);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-panel wide" onClick={e => e.stopPropagation()}>
        <div className="op-head">
          <span className="op-title">Generate ledger from a statement</span>
          <button className="op-close" onClick={onClose}>esc ×</button>
        </div>
        <div className="op-body">
          <p className="op-help">
            Paste this prompt into ChatGPT / Claude / Gemini alongside your bank statement
            (text, copy-paste from PDF, or screenshot) and it'll return a JSON ledger.
            Then paste the JSON back here.
          </p>

          <div className="op-step">
            <div className="op-step-head">
              <span className="op-step-num">1</span>
              <span className="op-step-title">copy this prompt</span>
              <button className="op-btn primary small"
                      onClick={copyPrompt}>{copied ? "copied ✓" : "copy"}</button>
            </div>
            <textarea
              ref={promptRef}
              className="op-text mono small"
              readOnly
              rows={14}
              value={prompt}
              onClick={e => e.target.select()}
            />
          </div>

          <div className="op-step">
            <div className="op-step-head">
              <span className="op-step-num">2</span>
              <span className="op-step-title">paste the LLM's JSON response</span>
            </div>
            <textarea
              className="op-text mono"
              placeholder='paste here — supports raw JSON or ```json fenced ```'
              value={response}
              onChange={e => setResponse(e.target.value)}
              onBlur={() => response.trim() && tryParse(response)}
              rows={8}
            />
            {error && <div className="op-error">⚠ {error}</div>}
            {parsed && (
              <div className="op-summary">
                ✓ valid · {parsed.entries.length} entries · initial balance{" "}
                <span className="mono">₹{parsed.initialBalance.toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>
        </div>
        <div className="op-foot">
          <button className="op-btn ghost" onClick={onClose}>cancel</button>
          <button className="op-btn primary"
                  disabled={!parsed}
                  onClick={apply}>
            import {parsed ? `· ${parsed.entries.length} entries` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildPrompt(config) {
  const tags = (config.tags || []).map(t => `  - ${t.id}  (${t.kind}) — ${t.label}`).join("\n");
  return `You are converting a bank/credit-card statement into a trunkline ledger in JSON.

OUTPUT FORMAT — return ONLY valid JSON (no prose, no fences) matching this schema:

{
  "initialBalance": <number>,         // balance at the start of the statement period
  "entries": [
    {
      "id": "<short unique string>",
      "when": "<ISO 8601 datetime, e.g. 2026-05-08T10:30:00.000Z>",
      "dir": "in" | "out" | "merge",  // "merge" = credit-card auto-pay settling a charge
      "amount": <number, always positive>,
      "tags": ["<tag-id>", ...],      // first tag is the primary; pick from the taxonomy below
      "label": "<short merchant or description>",
      "note": "<optional extra note or empty string>",
      "recur": {                       // optional, only for known recurring debits/credits
        "freq": "day" | "week" | "month" | "year",
        "every": 1,
        "count": 12                    // OR omit and use "until": "<ISO datetime>"
      }
    }
  ]
}

TAG TAXONOMY — use these exact ids; pick the most-specific one. Add new tags only if nothing fits.

${tags}

RULES
1. Each statement line becomes one entry. Match the line's date/time.
2. dir = "in" for credits to the account, "out" for debits.
3. For credit-card statements, charges are "out", autopay/payment is "merge".
4. amount is always a positive number. Direction is encoded in "dir".
5. tags[0] determines the lane in the visual; choose carefully.
6. If a recurring rent/EMI/SIP appears once, mark only the first one with "recur" so the app can project the rest.
7. Skip duplicate / pending / reversed transactions.
8. For unknown/ambiguous lines, use tag "extras" and leave a clear "note".

Statement to convert below this line:
---
[PASTE YOUR STATEMENT HERE]
`;
}
