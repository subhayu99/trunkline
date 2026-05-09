// Single source of truth for the trunkline data model (schema v2).
//
// Two documents are persisted in localStorage and exportable as standalone
// JSON files:
//
//   user           — your data: ledger entries + kinds + tags + quickAdd +
//                    UI tweaks + currency. Lives behind the main Export /
//                    Import flow in the hamburger menu. This is what most
//                    people will ever touch.
//
//   customization  — the app's shape: graph dimensions and picker enums
//                    (themes, locales, range presets, etc.). Lives behind
//                    a separate flow under More. Most users never touch it.
//
// Both docs carry a `doc` discriminator so the import UI can route either
// file to the right target automatically.

export const SCHEMA_VERSION = 2;

export const STORAGE_KEYS = {
  user: "trunkline.user.v2",
  customization: "trunkline.customization.v2",
  // Legacy keys read once for migration, then deleted.
  legacyLedger: "trunkline.ledger",
  legacyLedgerOlder: "finance-tracker.ledger",
  legacyTweaks: "trunkline.tweaks",
  legacyTweaksOlder: "finance-tracker.tweaks",
};

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_KINDS = [
  { id: "main",    label: "Cash",         side: "C", order: 0,
    vocab: { heavy: "main",      medium: "main · cash", light: "Cash"         },
    groupLabel: "main",                color: null, archived: false },
  { id: "income",  label: "Other income", side: "L", order: 1,
    vocab: { heavy: "income/*",  medium: "income",      light: "Other income" },
    groupLabel: "incoming",            color: null, archived: false },
  { id: "fixed",   label: "Committed",    side: "R", order: 2,
    vocab: { heavy: "fixed/*",   medium: "fixed",       light: "Committed"    },
    groupLabel: "fixed · committed",   color: null, archived: false },
  { id: "extras",  label: "Day-to-day",   side: "R", order: 3,
    vocab: { heavy: "extras/*",  medium: "extras",      light: "Day-to-day"   },
    groupLabel: "extras · day-to-day", color: null, archived: false },
  { id: "credit",  label: "Credit cards", side: "R", order: 4,
    vocab: { heavy: "credit/*",  medium: "credit",      light: "Credit cards" },
    groupLabel: "credit cards",        color: null, archived: false },
  { id: "loans",   label: "Loans · EMIs", side: "R", order: 5,
    vocab: { heavy: "loans/*",   medium: "loans",       light: "Loans · EMIs" },
    groupLabel: "loans · EMIs",        color: null, archived: false },
  { id: "savings", label: "Savings",      side: "R", order: 6,
    vocab: { heavy: "savings/*", medium: "savings",     light: "Savings"      },
    groupLabel: "savings",             color: null, archived: false },
];

const DEFAULT_TAGS = [
  { id: "salary",    label: "salary",        kind: "income"  },
  { id: "reimb",     label: "reimburse",     kind: "income"  },
  { id: "split",     label: "split",         kind: "income"  },
  { id: "bonus",     label: "bonus",         kind: "income"  },
  { id: "rent",      label: "rent",          kind: "fixed"   },
  { id: "parents",   label: "to parents",    kind: "fixed"   },
  { id: "bills",     label: "bills",         kind: "fixed"   },
  { id: "insurance", label: "insurance",     kind: "fixed"   },
  { id: "chai",      label: "chai",          kind: "extras"  },
  { id: "food",      label: "food",          kind: "extras"  },
  { id: "transport", label: "transport",     kind: "extras"  },
  { id: "groceries", label: "groceries",     kind: "extras"  },
  { id: "fun",       label: "fun",           kind: "extras"  },
  { id: "ciggs",     label: "ciggs",         kind: "extras"  },
  { id: "shopping",  label: "shopping",      kind: "extras"  },
  { id: "misc",      label: "misc",          kind: "extras"  },
  { id: "cc-hdfc",   label: "hdfc card",     kind: "credit"  },
  { id: "cc-axis",   label: "axis card",     kind: "credit"  },
  { id: "cc-sbi",    label: "sbi card",      kind: "credit"  },
  { id: "loan-pl",   label: "personal loan", kind: "loans"   },
  { id: "rd",        label: "RD",            kind: "savings" },
  { id: "mf-sip",    label: "MF SIP",        kind: "savings" },
  { id: "mf-liquid", label: "liquid MF",     kind: "savings" },
];

const DEFAULT_QUICKADD = [
  { label: "chai",   amount: 15,  tag: "chai",      emoji: "☕" },
  { label: "auto",   amount: 80,  tag: "transport", emoji: "🛺" },
  { label: "lunch",  amount: 250, tag: "food",      emoji: "🍱" },
  { label: "ciggs",  amount: 350, tag: "ciggs",     emoji: "🚬" },
  { label: "snacks", amount: 80,  tag: "food",      emoji: "🍪" },
  { label: "swiggy", amount: 400, tag: "food",      emoji: "🛵" },
];

export const DEFAULT_TWEAKS = {
  theme: "midnight",
  vocabIntensity: "light",
  thicknessScale: "linear",
  showFuture: true,
  collapseFuture: false,
  locale: "lakh",
  zoom: 1,
  rangePreset: "all",
  rangeStart: null,
  rangeEnd: null,
  viewMode: "graph",
  ledgerOrder: "newest",
};

const DEFAULT_GRAPH = {
  trunkMinWidth: 3,
  trunkMaxWidth: 38,
  laneTrunkMinWidth: 0.8,
  laneTrunkMaxWidth: 14,
  flowMinWidth: 1,
  flowMaxWidth: 22,
  initialDaysInViewport: 7,
  horizonYears: 2,
};

const DEFAULT_ENUMS = {
  themes: ["paper", "terminal", "midnight"],
  vocabIntensities: ["heavy", "medium", "light"],
  thicknessScales: ["sqrt", "linear", "log"],
  locales: [
    { value: "lakh",    label: "1,20,000" },
    { value: "western", label: "120,000"  },
  ],
  rangePresets: [
    { value: "all",        label: "all time" },
    { value: "7d",         label: "last 7 days" },
    { value: "30d",        label: "last 30 days" },
    { value: "thisMonth",  label: "this month" },
    { value: "lastMonth",  label: "last month" },
    { value: "ytd",        label: "year to date" },
    { value: "futureOnly", label: "upcoming · 60d" },
  ],
};

const clone = (x) => JSON.parse(JSON.stringify(x));

export function defaultUserDoc() {
  return {
    schema: SCHEMA_VERSION,
    doc: "user",
    updatedAt: new Date().toISOString(),
    currencySymbol: "₹",
    tweaks: { ...DEFAULT_TWEAKS },
    kinds: clone(DEFAULT_KINDS),
    tags: clone(DEFAULT_TAGS),
    quickAdd: clone(DEFAULT_QUICKADD),
    ledger: { initialBalance: 0, entries: [] },
  };
}

export function defaultCustomizationDoc() {
  return {
    schema: SCHEMA_VERSION,
    doc: "customization",
    updatedAt: new Date().toISOString(),
    now: null,
    graph: { ...DEFAULT_GRAPH },
    enums: clone(DEFAULT_ENUMS),
  };
}

// ── Type detection ────────────────────────────────────────────────────────
//
// Returns "user" | "customization" | null based on the shape of the JSON.
// Used by the import UI to route an unlabeled / cross-uploaded file.
export function detectDocType(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.doc === "user" || raw.doc === "customization") return raw.doc;
  // Heuristics for legacy / bare-shape JSONs.
  if (raw.ledger && Array.isArray(raw.ledger.entries)) return "user";
  if (Array.isArray(raw.entries) && "initialBalance" in raw) return "user";
  if (raw.enums || raw.graph) return "customization";
  return null;
}

// ── Normalizers ───────────────────────────────────────────────────────────

const DIRS = new Set(["in", "out", "merge"]);

function normalizeEntry(e, i) {
  if (!e || typeof e !== "object") throw new Error(`entry #${i}: not an object`);
  if (typeof e.when !== "string" || Number.isNaN(Date.parse(e.when)))
    throw new Error(`entry #${i}: invalid 'when' (expected ISO datetime string)`);
  if (!DIRS.has(e.dir)) throw new Error(`entry #${i}: 'dir' must be in/out/merge`);
  if (typeof e.amount !== "number" || !Number.isFinite(e.amount))
    throw new Error(`entry #${i}: 'amount' must be a finite number`);
  if (!Array.isArray(e.tags) || e.tags.length === 0)
    throw new Error(`entry #${i}: 'tags' must be a non-empty array`);
  return {
    id: e.id || ("e" + Math.floor(Math.random() * 1e9).toString(36)),
    when: e.when,
    dir: e.dir,
    amount: e.amount,
    tags: e.tags.slice(),
    label: typeof e.label === "string" ? e.label : "untitled",
    note:  typeof e.note  === "string" ? e.note  : "",
    kind:  typeof e.kind  === "string" ? e.kind  : undefined,
    ...(e.recur ? { recur: e.recur } : {}),
  };
}

function normalizeKind(k, i) {
  if (!k || typeof k !== "object" || typeof k.id !== "string")
    throw new Error(`kind #${i}: missing id`);
  return {
    id: k.id,
    label: typeof k.label === "string" ? k.label : k.id,
    side: k.side === "L" || k.side === "C" || k.side === "R" ? k.side : "R",
    order: Number.isFinite(k.order) ? k.order : i,
    vocab: {
      heavy:  k.vocab?.heavy  || `${k.id}/*`,
      medium: k.vocab?.medium || k.id,
      light:  k.vocab?.light  || k.id,
    },
    groupLabel: typeof k.groupLabel === "string" ? k.groupLabel : k.id,
    color:      typeof k.color === "string" ? k.color : null,
    archived:   !!k.archived,
  };
}

function normalizeTag(t, i) {
  if (!t || typeof t !== "object" || typeof t.id !== "string")
    throw new Error(`tag #${i}: missing id`);
  return {
    id: t.id,
    label: typeof t.label === "string" ? t.label : t.id,
    kind:  typeof t.kind  === "string" ? t.kind  : "extras",
  };
}

function normalizeQuickAdd(q, i) {
  if (!q || typeof q !== "object") throw new Error(`quickAdd #${i}: not an object`);
  return {
    label:  typeof q.label === "string" ? q.label : "item",
    amount: Number(q.amount) || 0,
    tag:    typeof q.tag === "string" ? q.tag : "misc",
    emoji:  typeof q.emoji === "string" ? q.emoji : "•",
  };
}

// ── Importers ─────────────────────────────────────────────────────────────
//
// Both importers are tolerant: missing fields fall back to defaults. They
// throw only on shape errors that would otherwise corrupt rendering.

// Accepts:
//   v2 user doc  · { schema:2, doc:"user", currencySymbol, tweaks, kinds,
//                    tags, quickAdd, ledger:{initialBalance, entries} }
//   v1 ledger    · { version:1, initialBalance, entries, userTags, kinds,
//                    tagOverrides, deletedTagIds }
//   bare shape   · { initialBalance, entries }
export function importUserDoc(raw) {
  if (!raw || typeof raw !== "object") throw new Error("expected an object");

  const isV2 = raw.schema === SCHEMA_VERSION && raw.doc === "user";

  // initialBalance & entries can live at either the top level (legacy/bare)
  // or under .ledger (v2).
  const initialBalance = Number(
    raw.ledger?.initialBalance ?? raw.initialBalance ?? 0
  );
  if (!Number.isFinite(initialBalance))
    throw new Error("missing or invalid initialBalance (must be a number)");

  const entriesRaw = isV2
    ? (Array.isArray(raw.ledger?.entries) ? raw.ledger.entries : [])
    : (Array.isArray(raw.entries) ? raw.entries : []);

  // Reconstruct the kinds + tags arrays.
  // For v1 we have to merge userTags/tagOverrides/deletedTagIds against the
  // baked-in default seed, since those legacy snapshots only stored deltas.
  let kinds, tags;
  if (isV2) {
    kinds = Array.isArray(raw.kinds) && raw.kinds.length
      ? raw.kinds.map(normalizeKind) : defaultUserDoc().kinds;
    tags = Array.isArray(raw.tags) && raw.tags.length
      ? raw.tags.map(normalizeTag) : defaultUserDoc().tags;
  } else {
    const def = defaultUserDoc();
    kinds = Array.isArray(raw.kinds) && raw.kinds.length
      ? raw.kinds.map(normalizeKind) : def.kinds;
    const seedTags = def.tags;
    const userTags = Array.isArray(raw.userTags) ? raw.userTags.map(normalizeTag) : [];
    const overrides = (raw.tagOverrides && typeof raw.tagOverrides === "object")
      ? raw.tagOverrides : {};
    const deleted = new Set(Array.isArray(raw.deletedTagIds) ? raw.deletedTagIds : []);
    tags = [
      ...seedTags
        .filter(t => !deleted.has(t.id))
        .map(t => ({ ...t, ...(overrides[t.id] || {}) })),
      ...userTags.filter(t => !deleted.has(t.id)),
    ];
  }

  // Derive `kind` for entries that lack it (or reference an unknown kind),
  // using the entry's primary tag → kind mapping. Falls back to "extras".
  // Without this, MoneyGraph crashes on import.
  const tagKind = Object.fromEntries(tags.map(t => [t.id, t.kind]));
  const validKinds = new Set(kinds.filter(k => !k.archived).map(k => k.id));
  const fallback = validKinds.has("extras") ? "extras"
                  : (kinds.find(k => !k.archived && k.id !== "main")?.id || "main");

  const entries = entriesRaw.map((e, i) => {
    const norm = normalizeEntry(e, i);
    if (!norm.kind || !validKinds.has(norm.kind)) {
      const primary = norm.tags.length ? tagKind[norm.tags[0]] : null;
      norm.kind = (primary && validKinds.has(primary)) ? primary : fallback;
    }
    return norm;
  });

  const tweaks = isV2 && raw.tweaks && typeof raw.tweaks === "object"
    ? { ...DEFAULT_TWEAKS, ...raw.tweaks }
    : { ...DEFAULT_TWEAKS };

  const quickAdd = isV2 && Array.isArray(raw.quickAdd)
    ? raw.quickAdd.map(normalizeQuickAdd)
    : clone(DEFAULT_QUICKADD);

  const currencySymbol = typeof raw.currencySymbol === "string"
    ? raw.currencySymbol : "₹";

  return {
    schema: SCHEMA_VERSION,
    doc: "user",
    updatedAt: new Date().toISOString(),
    currencySymbol,
    tweaks,
    kinds,
    tags,
    quickAdd,
    ledger: { initialBalance, entries },
  };
}

export function importCustomizationDoc(raw) {
  if (!raw || typeof raw !== "object") throw new Error("expected an object");
  const def = defaultCustomizationDoc();
  const e = (raw.enums && typeof raw.enums === "object") ? raw.enums : {};
  return {
    schema: SCHEMA_VERSION,
    doc: "customization",
    updatedAt: new Date().toISOString(),
    now: typeof raw.now === "string" ? raw.now : null,
    graph: {
      ...def.graph,
      ...(raw.graph && typeof raw.graph === "object" ? raw.graph : {}),
    },
    enums: {
      themes:           Array.isArray(e.themes)           ? e.themes.filter(s => typeof s === "string")           : def.enums.themes,
      vocabIntensities: Array.isArray(e.vocabIntensities) ? e.vocabIntensities.filter(s => typeof s === "string") : def.enums.vocabIntensities,
      thicknessScales:  Array.isArray(e.thicknessScales)  ? e.thicknessScales.filter(s => typeof s === "string")  : def.enums.thicknessScales,
      locales:          Array.isArray(e.locales)          ? e.locales.filter(l => l && typeof l.value === "string") : def.enums.locales,
      rangePresets:     Array.isArray(e.rangePresets)     ? e.rangePresets.filter(p => p && typeof p.value === "string") : def.enums.rangePresets,
    },
  };
}

// ── Projection helpers ────────────────────────────────────────────────────
//
// Turn the user/customization docs back into the "config + data" prop shape
// that the rest of the components were built against. This keeps the rest
// of the UI unchanged through the schema migration.
//
// The fields here intentionally cover *every* `config.X` access in the
// codebase — if you add a new component reading a config field, add a
// projection here too.
export function projectConfig(user, customization) {
  const visibleKinds = user.kinds
    .filter(k => !k.archived)
    .slice()
    .sort((a, b) => a.order - b.order);
  return {
    currencySymbol: user.currencySymbol,
    now: customization.now,
    monthLabel: null,                   // unused at runtime — drop noise
    defaults: { ...DEFAULT_TWEAKS },     // for legacy seed paths
    themes:           customization.enums.themes,
    vocabIntensities: customization.enums.vocabIntensities,
    thicknessScales:  customization.enums.thicknessScales,
    locales:          customization.enums.locales,
    rangePresets:     customization.enums.rangePresets,
    branchKinds:      visibleKinds.map(k => k.id),
    branchLabels:     Object.fromEntries(user.kinds.map(k => [k.id, k.vocab])),
    tagGroups:        visibleKinds
                        .filter(k => k.id !== "main")
                        .map(k => ({ key: k.id, label: k.groupLabel })),
    tags:             user.tags,
    quickAdd:         user.quickAdd,
    graph:            customization.graph,
  };
}

export function projectData(user) {
  return {
    initialBalance: user.ledger.initialBalance,
    entries: user.ledger.entries,
  };
}
