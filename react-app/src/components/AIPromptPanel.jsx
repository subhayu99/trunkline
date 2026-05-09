import React, { useState, useMemo, useRef } from "react";
import { importUserDoc } from "../lib/schema.js";

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
    try { setParsed(importUserDoc(json)); }
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
                ✓ valid · {parsed.ledger.entries.length} entries · initial balance{" "}
                <span className="mono">{parsed.currencySymbol}{parsed.ledger.initialBalance.toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>
        </div>
        <div className="op-foot">
          <button className="op-btn ghost" onClick={onClose}>cancel</button>
          <button className="op-btn primary"
                  disabled={!parsed}
                  onClick={apply}>
            import {parsed ? `· ${parsed.ledger.entries.length} entries` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildPrompt(config) {
  const currency = config.currencySymbol || "₹";
  const kindLines = (config.branchKinds || [])
    .filter(id => id !== "main")
    .map(id => {
      const lbl = config.branchLabels?.[id]?.light || id;
      return `  - ${id}  — ${lbl}`;
    })
    .join("\n");
  const tagLines = (config.tags || [])
    .map(t => `  - ${t.id}  (kind: ${t.kind}) — ${t.label}`)
    .join("\n");
  return `You are converting a bank or credit-card statement into a trunkline ledger,
returned as a JSON document matching the schema below.

INTERACTION PROTOCOL — ASK BEFORE YOU GUESS

Scan the input first. If anything material is ambiguous, STOP and ask the
user one focused round of numbered questions BEFORE producing any JSON.
Do not silently encode a guess in the output — wrong guesses compound
across recurring entries and break the chart's lane assignment.

Ask when (non-exhaustive):
  • Statement period boundaries are unclear, or "initial balance" isn't
    obviously the balance just before the first listed line.
  • The currency isn't ${currency} or isn't stated explicitly.
  • A line could plausibly map to multiple taxonomy tags (e.g. "AMAZON"
    could be groceries / shopping / fun).
  • A line looks recurring (rent / EMI / SIP / subscription) but the
    period or end date isn't obvious from the source.
  • Two lines look like a merge pair (card charge + bank autopay) but the
    amounts or dates don't match cleanly.
  • A line doesn't fit any taxonomy tag and you're tempted to invent one
    — confirm the proposed id, label, and lane (kind) before doing so.
  • The source mixes the user's own accounts (transfers would otherwise
    inflate both income and spending). Ask which line is the source and
    which is the destination, or whether to drop the pair entirely.
  • Any single decision would change the lane of more than ~3 entries.

Do NOT ask about (handle silently):
  • Trivial typos or capitalisation in merchant names.
  • Time-of-day when only the date is given (use 09:00 local).
  • Whether to skip duplicate / pending / reversed transactions (always skip).

Question format — keep it tight; one round if possible:
  Q1. <yes/no>?
  Q2. <multiple choice>: (a) <opt> (b) <opt> (c) <opt>
  Q3. <free-text only when nothing else fits>

Wait for the user's answers, then emit the JSON per OUTPUT FORMAT below.
If everything was unambiguous to start with, skip the questions and emit
the JSON directly.

OUTPUT FORMAT — once questions (if any) are resolved, return ONLY the JSON
document. Code-fences are tolerated but not required. The document MUST
follow this exact shape:

{
  "schema": 2,
  "doc": "user",
  "currencySymbol": "${currency}",
  "ledger": {
    "initialBalance": <number>,        // balance at the start of the statement period
    "entries": [
      {
        "id": "<short unique string>",
        "when": "<ISO 8601 datetime, e.g. 2026-05-08T10:30:00.000Z>",
        "dir": "in" | "out" | "merge", // see RULES below
        "amount": <number, always positive>,
        "kind": "<one of the LANE ids below>",   // REQUIRED. Match the primary tag's kind.
        "tags": ["<tag-id>", ...],     // first tag is primary; pick from TAG TAXONOMY
        "label": "<short merchant or description>",
        "note": "<extra context or empty string>",
        "recur": {                      // OPTIONAL; only on the first occurrence of a recurring series
          "freq": "day" | "week" | "month" | "year",
          "every": 1,
          "count": 12                   // pick exactly one of count or until
          // OR  "until": "<ISO datetime>"
        }
      }
    ]
  },
  "tags": [                              // REQUIRED if you invented any tags below.
    { "id": "<your-new-tag-id>", "label": "<display label>", "kind": "<lane id>" }
  ]
}

LANES (kinds) — every entry's "kind" MUST be one of these ids:

${kindLines}
  - main      — the cash trunk itself; never assigned to entries directly.

TAG TAXONOMY — prefer these exact ids. The id in (kind: …) is what you
must put in the entry's "kind" field.

${tagLines}

RULES

1.  One entry per statement line. Use the line's date/time in "when".
2.  "dir":
      "in"    — money lands in the account (salary, refund, transfer-in)
      "out"   — money leaves the account (any debit / charge / payment)
      "merge" — collapse the matched pair when a credit-card charge AND
                its bank autopay both appear in the source. Mark the
                card-side line as "merge"; drop the bank-side line.
3.  "amount" is always positive. Sign is encoded by "dir", never by amount.
4.  "kind" is REQUIRED on every entry and is the lane the entry renders in.
    It MUST equal the (kind: …) of the first tag in "tags". If your primary
    tag is "salary" (kind: income), then "kind": "income".
5.  "tags": first tag determines the lane; additional tags are searchable
    but don't change rendering.
6.  Inventing tags: only after asking per the PROTOCOL above and getting
    confirmation. When confirmed, add the new tag to the top-level "tags"
    array with {id, label, kind}. NEVER use a kind id (income / fixed /
    extras / credit / loans / savings / main) as a tag id.
7.  Recurring series: emit ONLY the first occurrence with "recur" set; the
    app materializes the rest. Use "count" for finite series, "until" for
    open-ended ones with a known cutoff. Don't list the same monthly rent
    twelve times.
8.  Skip duplicate, pending, or reversed transactions.
9.  Amounts are in ${currency}, integer or with the decimals from the
    source. Don't convert currencies.
10. Unknown/ambiguous lines: use tag "misc" (kind: extras) and put context
    in "note". Do not invent random tag ids for one-off lines.
11. Omit fields the app sets automatically: "status" (derived from "when"),
    "balanceBefore" / "balanceAfter" (computed). If you include them they
    will be overwritten.

EXAMPLE OUTPUT (abridged):

{
  "schema": 2,
  "doc": "user",
  "currencySymbol": "${currency}",
  "ledger": {
    "initialBalance": 50000,
    "entries": [
      { "id": "sal-1", "when": "2026-05-01T10:00:00.000Z", "dir": "in",
        "amount": 180000, "kind": "income", "tags": ["salary"],
        "label": "Salary", "note": "May payroll",
        "recur": { "freq": "month", "every": 1, "count": 12 } },
      { "id": "rent-1", "when": "2026-05-03T09:00:00.000Z", "dir": "out",
        "amount": 16500, "kind": "fixed", "tags": ["rent"],
        "label": "Rent", "note": "" },
      { "id": "uni-1", "when": "2026-05-04T18:30:00.000Z", "dir": "merge",
        "amount": 4200, "kind": "credit", "tags": ["cc-uni"],
        "label": "UNI Card autopay", "note": "" }
    ]
  },
  "tags": [
    { "id": "cc-uni", "label": "UNI Card", "kind": "credit" }
  ]
}

Statement to convert below this line:
---
[PASTE YOUR STATEMENT HERE]
`;
}
