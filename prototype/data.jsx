// Continuous-timeline data model.
// Entries have ISO datetimes. History runs from Jan 2026 → today (May 6 2026 ~ noon).
// Future entries (scheduled) extend forward.

const NOW = new Date("2026-05-06T14:30:00");
const MS_PER_DAY = 86400000;

function iso(y, mo, d, h = 9, mi = 0) {
  const dt = new Date(y, mo - 1, d, h, mi);
  return dt.toISOString();
}

// ---------- Tags (first-class) ----------
const TAGS = [
  // income
  { id: "salary",    label: "salary",     kind: "income" },
  { id: "reimb",     label: "reimburse",  kind: "income" },
  { id: "split",     label: "split",      kind: "income" },
  { id: "bonus",     label: "bonus",      kind: "income" },
  // fixed
  { id: "rent",      label: "rent",       kind: "fixed" },
  { id: "parents",   label: "to parents", kind: "fixed" },
  { id: "bills",     label: "bills",      kind: "fixed" },
  { id: "insurance", label: "insurance",  kind: "fixed" },
  // extras
  { id: "chai",      label: "chai",       kind: "extras" },
  { id: "food",      label: "food",       kind: "extras" },
  { id: "transport", label: "transport",  kind: "extras" },
  { id: "groceries", label: "groceries",  kind: "extras" },
  { id: "fun",       label: "fun",        kind: "extras" },
  { id: "ciggs",     label: "ciggs",      kind: "extras" },
  { id: "shopping",  label: "shopping",   kind: "extras" },
  // credit
  { id: "cc-hdfc",   label: "hdfc card",  kind: "credit" },
  { id: "cc-axis",   label: "axis card",  kind: "credit" },
  { id: "cc-sbi",    label: "sbi card",   kind: "credit" },
  // loans
  { id: "loan-pl",   label: "personal loan", kind: "loans" },
  // savings
  { id: "rd",        label: "RD",         kind: "savings" },
  { id: "mf-sip",    label: "MF SIP",     kind: "savings" },
  { id: "mf-liquid", label: "liquid MF",  kind: "savings" },
];
const TAG_BY_ID = Object.fromEntries(TAGS.map(t => [t.id, t]));

const BRANCH_KINDS = ["main","income","fixed","extras","credit","loans","savings"];
const BRANCH_LABELS = {
  main:    { heavy: "main",      medium: "main · cash", light: "Cash" },
  income:  { heavy: "income/*",  medium: "income",      light: "Other income" },
  fixed:   { heavy: "fixed/*",   medium: "fixed",       light: "Committed" },
  extras:  { heavy: "extras/*",  medium: "extras",      light: "Day-to-day" },
  credit:  { heavy: "credit/*",  medium: "credit",      light: "Credit cards" },
  loans:   { heavy: "loans/*",   medium: "loans",       light: "Loans · EMIs" },
  savings: { heavy: "savings/*", medium: "savings",     light: "Savings" },
};

// Helpers for status
function statusFor(when) {
  const t = new Date(when).getTime();
  const n = NOW.getTime();
  if (t < n - 60000) return "past";
  if (t > n + 60000) return "future";
  return "today";
}

// ---------- Generate 4 months of history ----------
let __id = 1000;
function E(when, dir, amount, tags, label, note = "") {
  return {
    id: "e" + (++__id),
    when, dir, amount, tags, label, note,
    status: statusFor(when),
    kind: TAG_BY_ID[tags[0]] ? TAG_BY_ID[tags[0]].kind : "extras",
  };
}

const RAW = [];

// Recurring monthly fixed for Jan-May
for (const [m, days] of [[1,31],[2,28],[3,31],[4,30],[5,31]]) {
  RAW.push(E(iso(2026, m, 1, 10), "in",  m === 5 ? 229941 : (m === 1 ? 178846 : (m === 2 ? 193008 : (m === 3 ? 193109 : 229941))), ["salary"],   "salary credited", "Acme Corp"));
  RAW.push(E(iso(2026, m, 1, 11), "out", 50000,  ["parents"],   "to parents",     "monthly"));
  RAW.push(E(iso(2026, m, 2, 10), "out", m === 1 ? 23000 : (m === 2 ? 16500 : (m === 3 ? 16500 : (m === 4 ? 16500 : 17500))), ["rent"], "kolkata rent", ""));
  RAW.push(E(iso(2026, m, 1, 9),  "out", 15000,  ["rent"],      "blr rent",       ""));
  RAW.push(E(iso(2026, m, 5, 10), "out", 4812,   ["insurance"], "term insurance", "hdfc life"));
  RAW.push(E(iso(2026, m, 7, 10), "out", 470,    ["bills"],     "wifi · airtel",  ""));
  RAW.push(E(iso(2026, m, 8, 10), "out", 2000,   ["bills"],     "electric bill",  ""));
  RAW.push(E(iso(2026, m, 12, 10),"out", 1000,   ["bills"],     "mobile recharge","jio"));
  RAW.push(E(iso(2026, m, 5, 10), "out", 19938,  ["loan-pl"],   "hdfc PL · EMI",  "personal loan"));
  RAW.push(E(iso(2026, m, 5, 10), "out", 743,    ["loan-pl"],   "nivabupa premium","loan-linked"));
  if (m >= 4) {
    RAW.push(E(iso(2026, m, 7, 10), "out", 80600, ["rd"], "RD · auto-debit", ""));
    RAW.push(E(iso(2026, m, 10, 10),"out", 10000, ["mf-sip"], "MF SIP · long term", "axis bluechip"));
    RAW.push(E(iso(2026, m, 10, 10),"out", 20000, ["mf-liquid"], "MF · liquid", "parking"));
  }

  // Extras — sprinkled throughout the month
  const dayCutoff = m === 5 ? 6 : days; // current month only past entries
  for (let d = 1; d <= dayCutoff; d++) {
    if (d % 1 === 0) RAW.push(E(iso(2026, m, d, 8, 30), "out", 30, ["chai"], "morning chai", ""));
    if (d % 2 === 0) RAW.push(E(iso(2026, m, d, 13, 0), "out", Math.round(180 + Math.random()*240), ["food"], "lunch out", ""));
    if (d % 3 === 0) RAW.push(E(iso(2026, m, d, 19, 0), "out", Math.round(80 + Math.random()*120), ["transport"], "auto / uber", ""));
    if (d % 5 === 0) RAW.push(E(iso(2026, m, d, 21, 0), "out", 350, ["ciggs"], "ciggs", ""));
    if (d % 7 === 0) RAW.push(E(iso(2026, m, d, 11, 0), "out", Math.round(1500 + Math.random()*1200), ["groceries"], "blinkit", ""));
    if (d % 10 === 0) RAW.push(E(iso(2026, m, d, 20, 0), "out", Math.round(500 + Math.random()*900), ["fun"], "movie / drinks", ""));
  }

  // A few credit-card charges per month
  RAW.push(E(iso(2026, m, 4, 16), "out", 2100, ["cc-hdfc","shopping"], "amazon · headphones", "on hdfc card"));
  RAW.push(E(iso(2026, m, 15, 9), "merge", 2100, ["cc-hdfc"], "hdfc card · settled", "auto-pay"));
  if (m <= 4) {
    RAW.push(E(iso(2026, m, 2, 14), "out", 7103, ["cc-axis","shopping"], "flipkart · monitor", "on axis card"));
    RAW.push(E(iso(2026, m, 18, 9), "merge", 7103, ["cc-axis"], "axis card · settled", "due 18th"));
  }
  RAW.push(E(iso(2026, m, 3, 12), "out", 1240, ["cc-sbi","food"], "swiggy · multiple", "on sbi card"));
  RAW.push(E(iso(2026, m, 22, 9), "merge", 4586, ["cc-sbi"], "sbi card · settled", "due 22nd"));
}

// Some income extras
RAW.push(E(iso(2026, 3, 5, 14), "in", 5000, ["reimb"], "reimb · march travel", "expensify"));
RAW.push(E(iso(2026, 4, 12, 14),"in", 3000, ["split"], "vipul · split settled", ""));
RAW.push(E(iso(2026, 5, 3, 14), "in", 3000, ["split"], "vipul · lunch split", ""));
RAW.push(E(iso(2026, 5, 5, 14), "in", 5000, ["reimb"], "reimb · march travel", ""));

// Future / scheduled
RAW.push(E(iso(2026, 5, 7, 10), "out", 80600, ["rd"],      "RD · auto-debit", "scheduled"));
RAW.push(E(iso(2026, 5, 8, 10), "out", 2000,  ["bills"],   "electric bill", "expected"));
RAW.push(E(iso(2026, 5, 10, 10),"out", 10000, ["mf-sip"],  "MF SIP", "scheduled"));
RAW.push(E(iso(2026, 5, 10, 10),"out", 20000, ["mf-liquid"], "MF · liquid", "scheduled"));
RAW.push(E(iso(2026, 5, 12, 10),"out", 1000,  ["bills"],   "mobile recharge", "expected"));
RAW.push(E(iso(2026, 5, 15, 10),"merge",2100, ["cc-hdfc"], "hdfc card · settled", "auto"));
RAW.push(E(iso(2026, 5, 18, 14),"in", 5000,   ["reimb"],   "reimb · q2 travel", "expected"));
RAW.push(E(iso(2026, 5, 22, 9), "merge",4586, ["cc-sbi"],  "sbi card · settled", "due 22nd"));

// Sort chronologically (oldest first)
const ENTRIES = RAW.slice().sort((a, b) => new Date(a.when) - new Date(b.when));

// Tag the existing personal-loan EMI as recurring (12 months from April)
for (const e of ENTRIES) {
  if (e.tags && e.tags[0] === "loan-pl" && e.label && e.label.includes("PL · EMI") && new Date(e.when).getMonth() === 3) {
    e.recur = { freq: "month", every: 1, count: 12 };
    break;
  }
}

// Initial balance assumed at start of dataset (Jan 1)
const INITIAL_BALANCE = 7835;

function computeRunningBalance(entries) {
  let bal = INITIAL_BALANCE;
  const out = [];
  for (const e of entries) {
    const before = bal;
    if (e.dir === "in")  bal += e.amount;
    if (e.dir === "out") bal -= e.amount;
    if (e.dir === "merge") bal -= e.amount;
    out.push({ ...e, balanceBefore: before, balanceAfter: bal });
  }
  return out;
}

function totalsByTag(entries = ENTRIES) {
  const t = {};
  for (const tag of TAGS) t[tag.id] = { in: 0, out: 0, count: 0 };
  for (const e of entries) {
    for (const tagId of e.tags) {
      if (!t[tagId]) continue;
      if (e.dir === "in")  t[tagId].in += e.amount;
      if (e.dir === "out") t[tagId].out += e.amount;
      t[tagId].count += 1;
    }
  }
  return t;
}

// Constants for top bar (current month)
const SALARY = 229941;
const TOTAL_FIXED   = ENTRIES.filter(e => e.kind === "fixed"   && e.dir === "out" && new Date(e.when).getMonth() === 4).reduce((s,e)=>s+e.amount,0);
const TOTAL_EXTRAS  = ENTRIES.filter(e => e.kind === "extras"  && e.dir === "out" && new Date(e.when).getMonth() === 4 && e.status === "past").reduce((s,e)=>s+e.amount,0);
const TOTAL_LOANS   = ENTRIES.filter(e => e.kind === "loans"   && e.dir === "out" && new Date(e.when).getMonth() === 4).reduce((s,e)=>s+e.amount,0);
const TOTAL_SAVINGS = ENTRIES.filter(e => e.kind === "savings" && e.dir === "out" && new Date(e.when).getMonth() === 4).reduce((s,e)=>s+e.amount,0);
const PROJECTED_CARRY = SALARY + INITIAL_BALANCE - TOTAL_FIXED - TOTAL_LOANS - TOTAL_SAVINGS - TOTAL_EXTRAS;

// ---------- Recurrence ----------
// A recurring entry has a `recur` field: { freq, every, count?, until? }
//   freq:  "day" | "week" | "month" | "year"
//   every: integer step (1 = every period)
//   count: total occurrences (incl. seed). optional.
//   until: ISO datetime cap. optional.
// If neither count nor until is set, materializeRecurring caps at 24 months.
function addPeriod(date, freq, n) {
  const d = new Date(date);
  if (freq === "day")   d.setDate(d.getDate() + n);
  if (freq === "week")  d.setDate(d.getDate() + n * 7);
  if (freq === "month") d.setMonth(d.getMonth() + n);
  if (freq === "year")  d.setFullYear(d.getFullYear() + n);
  return d;
}
function materializeRecurring(entries, horizonMs) {
  const HORIZON = horizonMs || (NOW.getTime() + 365 * MS_PER_DAY * 2);
  const out = [];
  for (const e of entries) {
    out.push(e);
    if (!e.recur) continue;
    const r = e.recur;
    const every = Math.max(1, r.every || 1);
    const maxCount = r.count != null ? r.count : 999;
    const untilMs = r.until ? new Date(r.until).getTime() : HORIZON;
    let i = 1;
    while (i < maxCount) {
      const occWhen = addPeriod(new Date(e.when), r.freq, i * every);
      const tMs = occWhen.getTime();
      if (tMs > untilMs || tMs > HORIZON) break;
      out.push({
        ...e,
        id: e.id + "_r" + i,
        when: occWhen.toISOString(),
        status: statusFor(occWhen.toISOString()),
        recurOccurrence: i,
        recurParentId: e.id,
      });
      i++;
    }
  }
  return out;
}

Object.assign(window, { addPeriod, materializeRecurring });

const QUICK_ADD = [
  { label: "chai",   amount: 15,  tag: "chai",      emoji: "☕" },
  { label: "auto",   amount: 80,  tag: "transport", emoji: "🛺" },
  { label: "lunch",  amount: 250, tag: "food",      emoji: "🍱" },
  { label: "ciggs",  amount: 350, tag: "ciggs",     emoji: "🚬" },
  { label: "snacks", amount: 80,  tag: "food",      emoji: "🍪" },
  { label: "swiggy", amount: 400, tag: "food",      emoji: "🛵" },
];

const INSIGHTS = [
  { kind: "anomaly", title: "chai 2× usual", body: "6 chais in 6 days. last month avg was 3/day.", severity: "warn" },
  { kind: "burn",    title: "extras burn rate", body: "≈ ₹770/day vs ₹500 budget. +54%.", severity: "warn" },
  { kind: "forecast",title: "end-of-month carry", body: "if pace holds, you close may with ₹6,400.", severity: "info" },
  { kind: "nudge",   title: "balance trend", body: "balance is recovering fast post-salary. RD on the 7th is the next big drop.", severity: "ok" },
];

const MONTH_LABEL = "may '26";
const TODAY = NOW.getDate(); // for legacy components

Object.assign(window, {
  NOW, MS_PER_DAY, TODAY, MONTH_LABEL,
  TAGS, TAG_BY_ID, BRANCH_KINDS, BRANCH_LABELS,
  ENTRIES, INITIAL_BALANCE,
  computeRunningBalance, totalsByTag, statusFor,
  SALARY, TOTAL_FIXED, TOTAL_EXTRAS, TOTAL_LOANS, TOTAL_SAVINGS, PROJECTED_CARRY,
  QUICK_ADD, INSIGHTS,
});
