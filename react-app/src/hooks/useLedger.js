// Ledger persistence hook — owns entries, user tags, and initial balance
// in localStorage so trunkline actually behaves like a finance tracker (data
// survives reloads). On first run it seeds from the bundled data.json.
//
// Multi-tab safety: listens to the `storage` event so two open tabs stay
// in sync. Versioned envelope so future schema changes can migrate.

import { useState, useEffect, useCallback, useRef } from "react";

const SCHEMA_VERSION = 1;
const STORAGE_KEY = "trunkline.ledger";
const UNBACKED_KEY = "trunkline.unbacked";
const EXPORT_FILENAME_PREFIX = "trunkline";

// Legacy keys from when the app was called "finance-tracker". Auto-migrate
// once on read so users who saved data on the old name don't lose anything.
const LEGACY_STORAGE_KEY = "finance-tracker.ledger";
const LEGACY_UNBACKED_KEY = "finance-tracker.unbacked";

function readSnapshot() {
  if (typeof window === "undefined") return null;
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        raw = legacy;
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SCHEMA_VERSION) return null;
    return parsed;
  } catch (e) { return null; }
}

function writeSnapshot(snapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) { /* quota exceeded etc. — fail silently */ }
}

function emptySnapshot() {
  return {
    version: SCHEMA_VERSION,
    initialBalance: 0,
    entries: [],
    userTags: [],
    kinds: [],   // empty = use config's seed; non-empty = user-customized
    seeded: false,
    updatedAt: new Date().toISOString(),
  };
}

function fromSeed(seed) {
  const entries = Array.isArray(seed?.entries) ? seed.entries : [];
  // Anchor the demo to "today" by shifting every entry so the latest one
  // lands at the current moment. Keeps the chart fresh whenever someone
  // loads the demo, regardless of when the data file was generated.
  let shifted = entries;
  if (entries.length) {
    let latestMs = -Infinity;
    for (const e of entries) {
      const t = new Date(e.when).getTime();
      if (Number.isFinite(t) && t > latestMs) latestMs = t;
    }
    const offsetMs = Date.now() - latestMs;
    if (Math.abs(offsetMs) > 24 * 60 * 60 * 1000) {
      shifted = entries.map(e => ({
        ...e,
        when: new Date(new Date(e.when).getTime() + offsetMs).toISOString(),
      }));
    }
  }
  return {
    version: SCHEMA_VERSION,
    initialBalance: Number(seed?.initialBalance || 0),
    entries: shifted,
    userTags: [],
    kinds: [],
    seeded: true,
    updatedAt: new Date().toISOString(),
  };
}

export function useLedger(seedData) {
  // Initialise: prefer existing snapshot; otherwise start empty (no auto-seed
  // from data.json — first run shows empty state with a "load demo" button).
  const [ledger, setLedger] = useState(() => readSnapshot() || emptySnapshot());
  const skipNextWriteRef = useRef(false);

  // Track mutations since the last successful export — drives the
  // "you have N unbacked changes" reminder UI.
  const [unbackedCount, setUnbackedCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    let v = Number(localStorage.getItem(UNBACKED_KEY));
    if (!Number.isFinite(v) || v < 0) {
      const legacy = Number(localStorage.getItem(LEGACY_UNBACKED_KEY));
      if (Number.isFinite(legacy) && legacy >= 0) {
        v = legacy;
        try {
          localStorage.setItem(UNBACKED_KEY, String(legacy));
          localStorage.removeItem(LEGACY_UNBACKED_KEY);
        } catch (e) { /* ignore */ }
      }
    }
    return Number.isFinite(v) && v >= 0 ? v : 0;
  });
  const bumpUnbacked = useCallback(() => {
    setUnbackedCount(c => {
      const next = c + 1;
      try { localStorage.setItem(UNBACKED_KEY, String(next)); } catch (e) { /* ignore */ }
      return next;
    });
  }, []);
  const markBackedUp = useCallback(() => {
    setUnbackedCount(0);
    try { localStorage.setItem(UNBACKED_KEY, "0"); } catch (e) { /* ignore */ }
  }, []);

  // Persist on every change.
  useEffect(() => {
    if (skipNextWriteRef.current) {
      skipNextWriteRef.current = false;
      return;
    }
    writeSnapshot(ledger);
  }, [ledger]);

  // Multi-tab sync: when another tab writes, mirror the new state without
  // re-persisting (avoids feedback loops).
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue);
        if (next && next.version === SCHEMA_VERSION) {
          skipNextWriteRef.current = true;
          setLedger(next);
        }
      } catch (err) { /* ignore */ }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setEntries = useCallback((updater) => {
    setLedger(prev => {
      const next = typeof updater === "function" ? updater(prev.entries) : updater;
      return { ...prev, entries: next, updatedAt: new Date().toISOString() };
    });
    bumpUnbacked();
  }, [bumpUnbacked]);

  const addUserTag = useCallback((tag) => {
    setLedger(prev => {
      if (prev.userTags.some(t => t.id === tag.id)) return prev;
      return {
        ...prev,
        userTags: [...prev.userTags, tag],
        updatedAt: new Date().toISOString(),
      };
    });
    bumpUnbacked();
  }, [bumpUnbacked]);

  // ---- tag edits ----
  // For seed tags (from config), we record an "override" patch keyed by id.
  // For user-added tags, we mutate userTags directly. Deletes for seed tags
  // record the id in `deletedTagIds`; for user-added tags they're spliced.
  const editTag = useCallback((id, updates) => {
    setLedger(prev => {
      const isUserTag = prev.userTags.some(t => t.id === id);
      if (isUserTag) {
        return {
          ...prev,
          userTags: prev.userTags.map(t => t.id === id ? { ...t, ...updates } : t),
          updatedAt: new Date().toISOString(),
        };
      }
      const overrides = prev.tagOverrides || {};
      return {
        ...prev,
        tagOverrides: { ...overrides, [id]: { ...(overrides[id] || {}), ...updates } },
        updatedAt: new Date().toISOString(),
      };
    });
    bumpUnbacked();
  }, [bumpUnbacked]);

  const removeTag = useCallback((id) => {
    setLedger(prev => {
      const isUserTag = prev.userTags.some(t => t.id === id);
      if (isUserTag) {
        return {
          ...prev,
          userTags: prev.userTags.filter(t => t.id !== id),
          updatedAt: new Date().toISOString(),
        };
      }
      const deleted = prev.deletedTagIds || [];
      if (deleted.includes(id)) return prev;
      return {
        ...prev,
        deletedTagIds: [...deleted, id],
        updatedAt: new Date().toISOString(),
      };
    });
    bumpUnbacked();
  }, [bumpUnbacked]);

  // ---- kinds (lanes) ----
  // The ledger's `kinds` array is the source of truth once non-empty.
  // App.jsx seeds it from config when empty so first-run users see the
  // built-in lanes.

  const setKinds = useCallback((updater) => {
    setLedger(prev => {
      const next = typeof updater === "function" ? updater(prev.kinds || []) : updater;
      return { ...prev, kinds: next, updatedAt: new Date().toISOString() };
    });
    bumpUnbacked();
  }, [bumpUnbacked]);

  const upsertKind = useCallback((kind) => {
    setKinds(list => {
      const idx = list.findIndex(k => k.id === kind.id);
      if (idx === -1) {
        const order = (kind.order != null) ? kind.order : list.length;
        return [...list, { ...kind, order }];
      }
      const next = list.slice();
      next[idx] = { ...next[idx], ...kind };
      return next;
    });
  }, [setKinds]);

  const removeKind = useCallback((id, fallbackKindId = "extras") => {
    if (id === "main") return;        // never remove the cash trunk
    // Cascade: tags using this kind get reassigned to the fallback.
    setLedger(prev => {
      const userTags = prev.userTags.map(t =>
        t.kind === id ? { ...t, kind: fallbackKindId } : t
      );
      const kinds = (prev.kinds || []).filter(k => k.id !== id);
      // Entries that primarily belong to this kind also need their `kind`
      // updated so the lane resolution works.
      const entries = prev.entries.map(e =>
        e.kind === id ? { ...e, kind: fallbackKindId } : e
      );
      return {
        ...prev, userTags, kinds, entries,
        updatedAt: new Date().toISOString(),
      };
    });
    bumpUnbacked();
  }, [bumpUnbacked]);

  const setInitialBalance = useCallback((bal) => {
    setLedger(prev => ({
      ...prev,
      initialBalance: Number(bal) || 0,
      updatedAt: new Date().toISOString(),
    }));
    bumpUnbacked();
  }, [bumpUnbacked]);

  // Replace everything (used by Import / Reset / Load Demo). The new
  // snapshot is treated as the canonical "current truth" — the user
  // either just imported a backup, loaded the demo, or reset; no diff
  // exists yet to back up.
  const replaceLedger = useCallback((nextSnapshot) => {
    setLedger({
      ...emptySnapshot(),
      ...nextSnapshot,
      version: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    });
    markBackedUp();
  }, [markBackedUp]);

  const loadDemo = useCallback(() => {
    if (!seedData) return;
    replaceLedger(fromSeed(seedData));
  }, [seedData, replaceLedger]);

  const resetLedger = useCallback(() => {
    replaceLedger(emptySnapshot());
  }, [replaceLedger]);

  // Exposed shape mimics the old `data` prop so the rest of the app barely changes.
  return {
    ledger,
    data: {
      initialBalance: ledger.initialBalance,
      entries: ledger.entries,
    },
    userTags: ledger.userTags,
    tagOverrides: ledger.tagOverrides || {},
    deletedTagIds: ledger.deletedTagIds || [],
    kinds: ledger.kinds || [],
    isEmpty: ledger.entries.length === 0,
    unbackedCount,
    markBackedUp,
    setEntries,
    addUserTag,
    editTag,
    removeTag,
    setInitialBalance,
    setKinds,
    upsertKind,
    removeKind,
    replaceLedger,
    loadDemo,
    resetLedger,
  };
}

export function exportLedger(ledger) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `${EXPORT_FILENAME_PREFIX}-${stamp}.json`;
  const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
  return filename;
}

// Validate + normalise an arbitrary JSON object into a ledger snapshot.
// Accepts either a full ledger envelope or a bare `{ initialBalance, entries }`.
export function importLedgerJson(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("expected an object");
  }
  const initialBalance = Number(raw.initialBalance);
  if (!Number.isFinite(initialBalance)) {
    throw new Error("missing or invalid initialBalance (must be a number)");
  }
  if (!Array.isArray(raw.entries)) {
    throw new Error("missing entries array");
  }
  const entries = raw.entries.map((e, i) => {
    if (!e || typeof e !== "object") throw new Error(`entry #${i}: not an object`);
    if (typeof e.when !== "string") throw new Error(`entry #${i}: missing 'when' (ISO string)`);
    const parsed = Date.parse(e.when);
    if (Number.isNaN(parsed)) throw new Error(`entry #${i}: invalid 'when' (not ISO datetime)`);
    if (!["in", "out", "merge"].includes(e.dir)) throw new Error(`entry #${i}: 'dir' must be in/out/merge`);
    if (typeof e.amount !== "number" || !Number.isFinite(e.amount)) throw new Error(`entry #${i}: 'amount' must be a number`);
    if (!Array.isArray(e.tags) || e.tags.length === 0) throw new Error(`entry #${i}: 'tags' must be a non-empty array`);
    return {
      id: e.id || ("e" + Math.floor(Math.random() * 1e9).toString(36)),
      when: e.when,
      dir: e.dir,
      amount: e.amount,
      tags: e.tags.slice(),
      label: typeof e.label === "string" ? e.label : "untitled",
      note: typeof e.note === "string" ? e.note : "",
      kind: typeof e.kind === "string" ? e.kind : undefined,
      status: typeof e.status === "string" ? e.status : undefined,
      ...(e.recur ? { recur: e.recur } : {}),
    };
  });
  const userTags = Array.isArray(raw.userTags) ? raw.userTags.filter(t =>
    t && typeof t.id === "string" && typeof t.label === "string" && typeof t.kind === "string"
  ) : [];
  return {
    version: SCHEMA_VERSION,
    initialBalance,
    entries,
    userTags,
    seeded: false,
    updatedAt: new Date().toISOString(),
  };
}
