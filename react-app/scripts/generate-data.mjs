// Generates public/data.json — a neutral, generic demo dataset that
// describes a fictional person's finances over ~5 months. The app's
// loadDemo() shifts every entry so the latest lands "today", so the
// absolute dates here are nominal — only relative spacing matters.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Anchor — purely cosmetic, will be re-anchored at load time. Keep a
// recent date so the unshifted file still looks plausible.
const ANCHOR = new Date();
ANCHOR.setHours(12, 0, 0, 0);
const ANCHOR_MONTH = ANCHOR.getMonth();   // 0..11
const ANCHOR_DAY = ANCHOR.getDate();
const ANCHOR_YEAR = ANCHOR.getFullYear();

let _seed = 1337;
function rand() {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 0xffffffff;
}
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

function iso(y, mo, d, h = 9, mi = 0) {
  return new Date(y, mo - 1, d, h, mi).toISOString();
}

function statusFor(when) {
  const t = new Date(when).getTime();
  const n = ANCHOR.getTime();
  if (t < n - 60000) return "past";
  if (t > n + 60000) return "future";
  return "today";
}

const TAG_KIND = {
  salary: "income", reimb: "income", split: "income", bonus: "income",
  rent: "fixed", parents: "fixed", bills: "fixed", insurance: "fixed",
  chai: "extras", food: "extras", transport: "extras", groceries: "extras",
  fun: "extras", ciggs: "extras", shopping: "extras",
  "cc-hdfc": "credit", "cc-axis": "credit", "cc-sbi": "credit",
  "loan-pl": "loans",
  rd: "savings", "mf-sip": "savings", "mf-liquid": "savings",
};

let __id = 1000;
function E(when, dir, amount, tags, label, note = "") {
  return {
    id: "e" + (++__id),
    when, dir, amount, tags, label, note,
    status: statusFor(when),
    kind: TAG_KIND[tags[0]] || "extras",
  };
}

const RAW = [];

// 5 calendar months ending at the anchor month. Each month gets a
// uniform "salary day" of the 1st, recurring fixed bills, mid-month
// extras, and end-of-month savings.
const MONTHS = [];
for (let i = 4; i >= 0; i--) {
  const d = new Date(ANCHOR_YEAR, ANCHOR_MONTH - i, 1);
  MONTHS.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
}

const SALARY_BASE = 150000;       // generic monthly salary (round number)

const LUNCH_PLACES = ["Cafe lunch", "Quick bite", "Office canteen", "Salad bar", "Local cafe"];
const TRANSPORT = ["Bus pass", "Auto ride", "Cab home", "Bike fuel", "Metro card"];
const SHOPPING_ITEMS = ["Headphones", "Backpack", "Books", "T-shirts", "Sneakers"];
const FUN_ITEMS = ["Movie night", "Drinks with friends", "Concert tickets", "Bowling", "Boardgame cafe"];

for (const { y, m } of MONTHS) {
  // Salary on the 1st of each month
  RAW.push(E(iso(y, m, 1, 10), "in",  SALARY_BASE, ["salary"], "Monthly salary credited", "Demo Co"));

  // Fixed monthly debits
  RAW.push(E(iso(y, m, 1, 11), "out", 25000, ["rent"],      "Apartment rent", ""));
  RAW.push(E(iso(y, m, 4, 10), "out", 4000,  ["insurance"], "Health insurance", ""));
  RAW.push(E(iso(y, m, 5, 10), "out", 2500,  ["bills"],     "Electricity bill", ""));
  RAW.push(E(iso(y, m, 7, 10), "out", 1000,  ["bills"],     "Internet bill", ""));
  RAW.push(E(iso(y, m, 12, 10),"out", 500,   ["bills"],     "Phone recharge", ""));

  // Personal-loan EMI on the 5th
  RAW.push(E(iso(y, m, 5, 10), "out", 12000, ["loan-pl"],   "Personal loan EMI", ""));

  // Savings — RD + SIP, only the most recent two months
  if (MONTHS.indexOf({ y, m }) >= 3 || (y === MONTHS.at(-2).y && m === MONTHS.at(-2).m) || (y === MONTHS.at(-1).y && m === MONTHS.at(-1).m)) {
    RAW.push(E(iso(y, m, 6, 10), "out", 30000, ["rd"],       "Recurring deposit", ""));
    RAW.push(E(iso(y, m, 8, 10), "out", 10000, ["mf-sip"],   "Index fund SIP", ""));
  }

  // Sprinkled day-to-day extras (deterministic via seeded rand)
  // Skip future days for the current month.
  const isCurrent = (y === ANCHOR_YEAR && m === ANCHOR_MONTH + 1);
  const dayCutoff = isCurrent ? ANCHOR_DAY : new Date(y, m, 0).getDate();
  for (let d = 1; d <= dayCutoff; d++) {
    RAW.push(E(iso(y, m, d, 8, 30), "out", 30, ["chai"], "Morning coffee", ""));
    if (d % 2 === 0) {
      RAW.push(E(iso(y, m, d, 13, 0), "out", Math.round(180 + rand() * 220), ["food"], pick(LUNCH_PLACES), ""));
    }
    if (d % 3 === 0) {
      RAW.push(E(iso(y, m, d, 19, 0), "out", Math.round(60 + rand() * 100), ["transport"], pick(TRANSPORT), ""));
    }
    if (d % 7 === 0) {
      RAW.push(E(iso(y, m, d, 11, 0), "out", Math.round(1500 + rand() * 800), ["groceries"], "Weekly groceries", ""));
    }
    if (d % 10 === 0) {
      RAW.push(E(iso(y, m, d, 20, 0), "out", Math.round(400 + rand() * 700), ["fun"], pick(FUN_ITEMS), ""));
    }
  }

  // Credit-card charges + auto-pay settlement
  RAW.push(E(iso(y, m, 6, 16),  "out",   Math.round(800 + rand() * 1500), ["cc-hdfc","shopping"], pick(SHOPPING_ITEMS) + " · online", "credit card"));
  RAW.push(E(iso(y, m, 18, 9),  "merge", 2000, ["cc-hdfc"], "Credit card autopay", "monthly"));
  RAW.push(E(iso(y, m, 3, 12),  "out",   Math.round(400 + rand() * 800), ["cc-axis","food"], "Food delivery", "credit card"));
  RAW.push(E(iso(y, m, 22, 9),  "merge", 1500, ["cc-axis"], "Credit card autopay", "monthly"));
}

// Some occasional income extras
RAW.push(E(iso(MONTHS[2].y, MONTHS[2].m, 12, 14), "in", 3500, ["reimb"], "Travel reimbursement", "expensify"));
RAW.push(E(iso(MONTHS[3].y, MONTHS[3].m, 18, 14), "in", 2000, ["split"], "Friend split settled", ""));
RAW.push(E(iso(MONTHS.at(-1).y, MONTHS.at(-1).m, 8, 14), "in", 2500, ["split"], "Lunch split settled", ""));

// Tag the personal-loan EMI in the earliest month as a recurring entry so
// the chart shows the projected EMIs into the future.
const ENTRIES = RAW.slice().sort((a, b) => new Date(a.when) - new Date(b.when));
const seen = new Set();
const dedup = ENTRIES.filter(e => {
  const key = e.when + "|" + e.dir + "|" + e.amount + "|" + (e.tags || [])[0];
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

for (const e of dedup) {
  if (e.tags && e.tags[0] === "loan-pl" && e.label && /loan/i.test(e.label)) {
    // First loan-pl entry — mark as recurring monthly for 24 months
    e.recur = { freq: "month", every: 1, count: 24 };
    break;
  }
}

const out = {
  initialBalance: 50000,
  entries: dedup,
};

const dest = path.resolve(__dirname, "..", "public", "data.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log("Wrote " + dest + " (" + dedup.length + " entries)");
