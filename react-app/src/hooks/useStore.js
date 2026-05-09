// Owns the v2 unified document store. Two localStorage keys:
//   trunkline.user.v2          — the user doc (data + tweaks + currency)
//   trunkline.customization.v2 — the customization doc (graph + enums)
//
// On first load, migrates anything found under the old keys
// (trunkline.ledger / finance-tracker.ledger / trunkline.tweaks /
// finance-tracker.tweaks) into the user doc, then deletes the old keys.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  STORAGE_KEYS, SCHEMA_VERSION, DEFAULT_TWEAKS,
  defaultUserDoc, defaultCustomizationDoc,
  importUserDoc, importCustomizationDoc,
} from "../lib/schema.js";

const UNBACKED_KEY = "trunkline.unbacked";
const LEGACY_UNBACKED_KEY = "finance-tracker.unbacked";
const EXPORT_FILENAME_PREFIX = "trunkline";

function readDoc(storageKey, importer) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return importer(JSON.parse(raw));
  } catch (e) { return null; }
}

function writeDoc(storageKey, doc) {
  try { localStorage.setItem(storageKey, JSON.stringify(doc)); }
  catch (e) { /* quota exceeded etc. — fail silently */ }
}

function migrateLegacyUserDoc() {
  if (typeof window === "undefined") return null;
  const ledgerRaw =
    localStorage.getItem(STORAGE_KEYS.legacyLedger) ||
    localStorage.getItem(STORAGE_KEYS.legacyLedgerOlder);
  const tweaksRaw =
    localStorage.getItem(STORAGE_KEYS.legacyTweaks) ||
    localStorage.getItem(STORAGE_KEYS.legacyTweaksOlder);
  if (!ledgerRaw && !tweaksRaw) return null;

  let parsedLedger = null;
  if (ledgerRaw) {
    try { parsedLedger = JSON.parse(ledgerRaw); } catch (e) { /* ignore */ }
  }
  let parsedTweaks = null;
  if (tweaksRaw) {
    try { parsedTweaks = JSON.parse(tweaksRaw); } catch (e) { /* ignore */ }
  }

  let migrated;
  try {
    migrated = importUserDoc(parsedLedger || {});
  } catch (e) {
    // Legacy data was malformed — start fresh rather than blocking the app.
    migrated = defaultUserDoc();
  }
  if (parsedTweaks && typeof parsedTweaks === "object") {
    migrated.tweaks = { ...migrated.tweaks, ...parsedTweaks };
  }

  writeDoc(STORAGE_KEYS.user, migrated);
  // Don't delete legacy keys — keeps a recovery breadcrumb if migration was
  // wrong. They're harmless once the new key exists.
  return migrated;
}

function initialUser() {
  return readDoc(STORAGE_KEYS.user, importUserDoc)
      || migrateLegacyUserDoc()
      || defaultUserDoc();
}
function initialCustomization() {
  return readDoc(STORAGE_KEYS.customization, importCustomizationDoc)
      || defaultCustomizationDoc();
}

export function useStore() {
  const [user, setUserState] = useState(initialUser);
  const [customization, setCustomState] = useState(initialCustomization);

  // Suppress the localStorage write that would otherwise fire when we mirror
  // a sibling tab's update — without this, both tabs ping-pong indefinitely.
  const skipWriteRef = useRef({ user: false, customization: false });

  // ── unbacked-changes counter (drives the "you have N unbacked changes" UI) ──
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

  // ── persistence ──
  useEffect(() => {
    if (skipWriteRef.current.user) { skipWriteRef.current.user = false; return; }
    writeDoc(STORAGE_KEYS.user, user);
  }, [user]);
  useEffect(() => {
    if (skipWriteRef.current.customization) { skipWriteRef.current.customization = false; return; }
    writeDoc(STORAGE_KEYS.customization, customization);
  }, [customization]);

  // ── multi-tab sync ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e) => {
      if (!e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (e.key === STORAGE_KEYS.user) {
          skipWriteRef.current.user = true;
          setUserState(importUserDoc(parsed));
        } else if (e.key === STORAGE_KEYS.customization) {
          skipWriteRef.current.customization = true;
          setCustomState(importCustomizationDoc(parsed));
        }
      } catch (err) { /* ignore */ }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── user-doc mutators ──
  // Every mutation also bumps the unbacked-changes counter.
  const updateUser = useCallback((updater) => {
    setUserState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return { ...next, schema: SCHEMA_VERSION, doc: "user", updatedAt: new Date().toISOString() };
    });
    bumpUnbacked();
  }, [bumpUnbacked]);

  const setEntries = useCallback((updater) => {
    updateUser(prev => {
      const next = typeof updater === "function" ? updater(prev.ledger.entries) : updater;
      return { ...prev, ledger: { ...prev.ledger, entries: next } };
    });
  }, [updateUser]);

  const setInitialBalance = useCallback((bal) => {
    updateUser(prev => ({
      ...prev,
      ledger: { ...prev.ledger, initialBalance: Number(bal) || 0 },
    }));
  }, [updateUser]);

  const setTags = useCallback((updater) => {
    updateUser(prev => ({
      ...prev,
      tags: typeof updater === "function" ? updater(prev.tags) : updater,
    }));
  }, [updateUser]);

  const addUserTag = useCallback((tag) => {
    setTags(list => list.some(t => t.id === tag.id) ? list : [...list, tag]);
  }, [setTags]);

  const editTag = useCallback((id, updates) => {
    setTags(list => list.map(t => t.id === id ? { ...t, ...updates } : t));
  }, [setTags]);

  const removeTag = useCallback((id) => {
    setTags(list => list.filter(t => t.id !== id));
  }, [setTags]);

  const setKinds = useCallback((updater) => {
    updateUser(prev => ({
      ...prev,
      kinds: typeof updater === "function" ? updater(prev.kinds) : updater,
    }));
  }, [updateUser]);

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
    if (id === "main") return;
    updateUser(prev => {
      const tags = prev.tags.map(t => t.kind === id ? { ...t, kind: fallbackKindId } : t);
      const kinds = prev.kinds.filter(k => k.id !== id);
      const entries = prev.ledger.entries.map(e =>
        e.kind === id ? { ...e, kind: fallbackKindId } : e
      );
      return { ...prev, tags, kinds, ledger: { ...prev.ledger, entries } };
    });
  }, [updateUser]);

  const setTweak = useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === "object" && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    updateUser(prev => ({ ...prev, tweaks: { ...prev.tweaks, ...edits } }));
  }, [updateUser]);

  const setCurrencySymbol = useCallback((sym) => {
    updateUser(prev => ({ ...prev, currencySymbol: sym || "₹" }));
  }, [updateUser]);

  const setQuickAdd = useCallback((updater) => {
    updateUser(prev => ({
      ...prev,
      quickAdd: typeof updater === "function" ? updater(prev.quickAdd) : updater,
    }));
  }, [updateUser]);

  // Replace the entire user doc (used by Import / Reset / Load Demo).
  // The new doc is the canonical truth, so the unbacked counter resets.
  const replaceUser = useCallback((doc) => {
    setUserState({
      ...doc, schema: SCHEMA_VERSION, doc: "user",
      updatedAt: new Date().toISOString(),
    });
    markBackedUp();
  }, [markBackedUp]);

  const resetUser = useCallback(() => {
    replaceUser(defaultUserDoc());
  }, [replaceUser]);

  // ── customization-doc mutators ──
  const replaceCustomization = useCallback((doc) => {
    setCustomState({
      ...doc, schema: SCHEMA_VERSION, doc: "customization",
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const resetCustomization = useCallback(() => {
    replaceCustomization(defaultCustomizationDoc());
  }, [replaceCustomization]);

  return {
    user, customization,
    isEmpty: user.ledger.entries.length === 0,
    unbackedCount, markBackedUp,
    setEntries, setInitialBalance,
    setTags, addUserTag, editTag, removeTag,
    setKinds, upsertKind, removeKind,
    setTweak, setCurrencySymbol, setQuickAdd,
    replaceUser, resetUser,
    replaceCustomization, resetCustomization,
  };
}

// ── Export ────────────────────────────────────────────────────────────────
// Single helper that handles both doc kinds. The filename signals the type.
export function exportDoc(doc, kind /* "user" | "customization" */) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `${EXPORT_FILENAME_PREFIX}-${kind}-${stamp}.json`;
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
  return filename;
}

// Re-exported so consumers don't have to know about the dual hook + schema split.
export { DEFAULT_TWEAKS };
