import React, { useState, useMemo, useEffect, useCallback } from "react";

import { useConfigAndData } from "./hooks/useConfigAndData.js";
import { useLedger, exportLedger } from "./hooks/useLedger.js";
import { rangeFromPreset } from "./lib/range.js";
import {
  materializeRecurring, statusFor, refreshStatus, MS_PER_DAY,
} from "./lib/data.js";
import { computeInsights } from "./lib/insights.js";

import TopBar from "./components/TopBar.jsx";
import RightRail from "./components/RightRail.jsx";
import Composer from "./components/Composer.jsx";
import EditPanel from "./components/EditPanel.jsx";
import MoneyGraph from "./components/MoneyGraph.jsx";
import LedgerView from "./components/LedgerView.jsx";
import HamburgerMenu from "./components/HamburgerMenu.jsx";
import ImportPanel from "./components/ImportPanel.jsx";
import AIPromptPanel from "./components/AIPromptPanel.jsx";
import AboutPanel from "./components/AboutPanel.jsx";
import EmptyState from "./components/EmptyState.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Toast from "./components/Toast.jsx";
import BottomNav from "./components/BottomNav.jsx";
import MoreTab from "./components/MoreTab.jsx";

import { useTweaks } from "./components/tweaks/TweaksPanel.jsx";
import { useIsMobile } from "./hooks/useIsMobile.js";

function Loading({ children }) {
  return (
    <div style={{
      height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--ink-2, #555)",
    }}>{children}</div>
  );
}

export default function App() {
  const { config, data, error } = useConfigAndData();

  if (error) return <Loading>error loading config/data: {error}</Loading>;
  if (!config || !data) return <Loading>loading…</Loading>;

  return (
    <ErrorBoundary>
      <FinanceApp config={config} seed={data} />
    </ErrorBoundary>
  );
}

function FinanceApp({ config, seed }) {
  const now = useMemo(
    () => config.now ? new Date(config.now) : new Date(),
    [config.now]
  );

  // Ledger lives in localStorage. `seed` (data.json) is only a demo source.
  const {
    ledger, data, isEmpty,
    kinds: storedKinds,
    tagOverrides, deletedTagIds,
    unbackedCount, markBackedUp,
    setEntries, addUserTag, editTag, removeTag,
    replaceLedger, loadDemo, resetLedger,
    upsertKind, removeKind, setKinds,
  } = useLedger(seed);

  // ---- kinds ----
  // Truth = ledger.kinds when non-empty; otherwise seed from config.
  // The seed merges branchKinds order + branchLabels vocab + tagGroups
  // labels into the rich kind shape so the UI can edit them all.
  const seedKinds = useMemo(() => {
    const order = config.branchKinds || [];
    const labels = config.branchLabels || {};
    const groups = config.tagGroups || [];
    // Mirror MoneyGraph's lane layout: income → L, main → C, the rest → R.
    const sideOf = (id) => {
      if (id === "main") return "C";
      if (id === "income") return "L";
      return "R";
    };
    return order.map((id, i) => {
      const lbl = labels[id] || {};
      const grp = groups.find(g => g.key === id);
      return {
        id,
        label: lbl.light || id,
        vocab: {
          heavy: lbl.heavy || `${id}/*`,
          medium: lbl.medium || id,
          light: lbl.light || id,
        },
        groupLabel: grp?.label || id,
        color: null,
        side: sideOf(id),
        order: i,
        archived: false,
      };
    });
  }, [config.branchKinds, config.branchLabels, config.tagGroups]);

  const kinds = useMemo(
    () => (storedKinds && storedKinds.length ? storedKinds : seedKinds),
    [storedKinds, seedKinds]
  );

  // Project kinds back into the legacy config shape so existing components
  // keep working without changes. Archived kinds are hidden everywhere.
  const liveBranchKinds = useMemo(
    () => kinds.slice().sort((a, b) => a.order - b.order)
                .filter(k => !k.archived).map(k => k.id),
    [kinds]
  );
  const liveBranchLabels = useMemo(
    () => Object.fromEntries(kinds.map(k => [k.id, k.vocab])),
    [kinds]
  );
  const liveTagGroups = useMemo(
    () => kinds.filter(k => !k.archived && k.id !== "main")
                .sort((a, b) => a.order - b.order)
                .map(k => ({ key: k.id, label: k.groupLabel })),
    [kinds]
  );

  // Inline CSS variables for any kind that has a custom color set, so the
  // chart picks up the override without us touching CSS.
  const kindStyleVars = useMemo(() => {
    const s = {};
    for (const k of kinds) {
      if (k.color) s[`--b-${k.id}`] = k.color;
    }
    return s;
  }, [kinds]);

  const allTags = useMemo(() => {
    const deleted = new Set(deletedTagIds);
    const seedTagsLive = config.tags
      .filter(t => !deleted.has(t.id))
      .map(t => ({ ...t, ...(tagOverrides[t.id] || {}) }));
    const userTagsLive = ledger.userTags
      .filter(t => !deleted.has(t.id))
      .map(t => ({ ...t, ...(tagOverrides[t.id] || {}) }));
    return [...seedTagsLive, ...userTagsLive];
  }, [config.tags, ledger.userTags, tagOverrides, deletedTagIds]);
  const mergedConfig = useMemo(() => ({
    ...config,
    tags: allTags,
    branchKinds: liveBranchKinds,
    branchLabels: liveBranchLabels,
    tagGroups: liveTagGroups,
  }), [config, allTags, liveBranchKinds, liveBranchLabels, liveTagGroups]);
  const tagById = useMemo(
    () => Object.fromEntries(allTags.map(t => [t.id, t])),
    [allTags]
  );

  const horizonMs = useMemo(() => {
    const years = config.graph?.horizonYears ?? 2;
    return now.getTime() + years * 365 * MS_PER_DAY;
  }, [now, config.graph]);

  const [tweaksRaw, setTweak] = useTweaks(config.defaults);

  const tweaks = useMemo(() => ({
    ...tweaksRaw,
    vocabIntensity: "light",
    thicknessScale: "linear",
    locale: "lakh",
  }), [tweaksRaw]);

  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState(
    (tweaksRaw.viewMode || "graph") === "ledger" ? "ledger" : "graph"
  );

  const [moreScreen, setMoreScreen] = useState(null); // null | 'tags' | 'lanes' | 'insights' | 'log'

  // Keep mobileTab in sync with desktop view-toggle when user swaps views
  // from desktop and resizes down (or vice versa). Only sync graph/ledger
  // — "more" is a phone-only destination with no desktop equivalent.
  useEffect(() => {
    if (mobileTab === "more") return;
    const v = tweaks.viewMode || "graph";
    if (v !== mobileTab) setMobileTab(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tweaks.viewMode]);

  useEffect(() => {
    if (mobileTab !== "more") setMoreScreen(null);
  }, [mobileTab]);

  const onMobileTabChange = (id) => {
    setMobileTab(id);
    if (id === "graph" || id === "ledger") setTweak("viewMode", id);
  };

  const range = useMemo(
    () => rangeFromPreset(tweaks.rangePreset, tweaks.rangeStart, tweaks.rangeEnd, now),
    [tweaks.rangePreset, tweaks.rangeStart, tweaks.rangeEnd, now]
  );

  // ----- URL <-> range sync -----
  // On first mount, hydrate from ?range / ?start / ?end so a shared link
  // restores the same view. After that, mirror tweaks back to the URL
  // (replaceState — no history pollution).
  const allowedPresets = useMemo(
    () => new Set((config.rangePresets || []).map(p => p.value).concat("custom")),
    [config.rangePresets]
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const r = url.searchParams.get("range");
    if (r && allowedPresets.has(r)) {
      const edits = { rangePreset: r };
      if (r === "custom") {
        const s = url.searchParams.get("start");
        const e = url.searchParams.get("end");
        edits.rangeStart = s || null;
        edits.rangeEnd = e || null;
      } else {
        edits.rangeStart = null;
        edits.rangeEnd = null;
      }
      setTweak(edits);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (tweaks.rangePreset === "all") {
      url.searchParams.delete("range");
      url.searchParams.delete("start");
      url.searchParams.delete("end");
    } else {
      url.searchParams.set("range", tweaks.rangePreset);
      if (tweaks.rangePreset === "custom") {
        if (tweaks.rangeStart) url.searchParams.set("start", tweaks.rangeStart);
        else url.searchParams.delete("start");
        if (tweaks.rangeEnd) url.searchParams.set("end", tweaks.rangeEnd);
        else url.searchParams.delete("end");
      } else {
        url.searchParams.delete("start");
        url.searchParams.delete("end");
      }
    }
    if (url.toString() !== window.location.href) {
      window.history.replaceState(null, "", url.toString());
    }
  }, [tweaks.rangePreset, tweaks.rangeStart, tweaks.rangeEnd]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
  }, [tweaks.theme]);

  // Refresh statuses when `now` changes (config.now or first mount).
  useEffect(() => {
    setEntries(es => es.map(e => ({ ...e, status: statusFor(e.when, now) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const rawEntries = useMemo(() => refreshStatus(data.entries, now), [data.entries, now]);
  const entries = useMemo(
    () => materializeRecurring(rawEntries, now, horizonMs),
    [rawEntries, now, horizonMs]
  );

  const [hoveredKind, setHoveredKind] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [log, setLog] = useState([]);
  const [freshEntry, setFreshEntry] = useState(null);
  const [editing, setEditing] = useState(null);

  // Overlay state — only one at a time
  const [overlay, setOverlay] = useState(null); // null | 'import' | 'aiprompt' | 'about'
  const closeOverlay = () => setOverlay(null);

  // Toast state — single toast at a time. Newer toasts replace older ones.
  const [toast, setToast] = useState(null);
  const showToast = useCallback((data) => {
    setToast({ id: Date.now() + Math.random(), ...data });
  }, []);
  const dismissToast = useCallback((id) => {
    setToast(t => (t && t.id === id ? null : t));
  }, []);

  // VS-Code-style sidebar: which panel (if any) is currently open.
  // null = collapsed (icon strip only). Defaults to closed on narrow screens.
  const initialW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const [activePanel, setActivePanel] = useState(initialW < 1024 ? null : "tags");

  // ctrl-wheel zoom (debounced via rAF)
  useEffect(() => {
    let raf = null;
    const onZoom = (e) => {
      const delta = e.detail || 0;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setTweak("zoom", Math.max(0.5, Math.min(4, +(((tweaks.zoom || 1) + delta).toFixed(2)))));
      });
    };
    window.addEventListener("graph-zoom", onZoom);
    return () => { window.removeEventListener("graph-zoom", onZoom); if (raf) cancelAnimationFrame(raf); };
  }, [tweaks.zoom, setTweak]);

  const onLog = useCallback(({ label, amount, note, tags, dir, when }) => {
    const id = "e" + Math.floor(Math.random() * 100000);
    const primaryTag = tagById[tags[0]];
    const kind = primaryTag ? primaryTag.kind : "extras";
    const entry = {
      id, when: when || new Date().toISOString(),
      dir: dir || "out", amount, tags, label, note: note || "",
      status: statusFor(when || new Date().toISOString(), now),
      kind,
    };
    setEntries(es => [...es, entry]);
    setLog(l => [...l, entry]);
    setFreshEntry(entry);
    setTimeout(() => setFreshEntry(null), 800);
  }, [tagById, now, setEntries]);

  const onSaveEdit = useCallback((updated) => {
    updated.status = statusFor(updated.when, now);
    const primaryTag = tagById[updated.tags[0]];
    if (primaryTag) updated.kind = primaryTag.kind;
    const targetId = updated.recurParentId || updated.id;
    setEntries(es => es.map(e => e.id === targetId ? { ...e, ...updated, id: targetId } : e));
    setLog(l => l.map(e => e.id === updated.id ? { ...e, ...updated } : e));
    setEditing(null);
  }, [tagById, now, setEntries]);

  const onDeleteEntry = useCallback((entry) => {
    const targetId = entry.recurParentId || entry.id;
    // Snapshot the entry being removed (the parent, since we delete the
    // whole recurrence series when a child is selected) so undo can
    // restore exactly what was there. We capture from `data.entries`
    // directly (the canonical raw list) instead of the setEntries updater
    // closure — that way the snapshot is available before the toast's
    // action callback closes over it.
    const removed = data.entries.find(e => e.id === targetId) || null;
    setEntries(es => es.filter(e => e.id !== targetId));
    setLog(l => l.filter(e => e.id !== entry.id));
    setEditing(null);
    if (!removed) return;
    showToast({
      message: `Deleted "${entry.label || "entry"}"`,
      actionLabel: "undo",
      action: () => {
        setEntries(es => es.some(e => e.id === removed.id) ? es : [...es, removed]);
      },
    });
  }, [data.entries, setEntries, showToast]);

  const setZoom = (v) => setTweak("zoom", v);

  const insights = useMemo(
    () => computeInsights({
      entries, now,
      initialBalance: data.initialBalance,
      tagById,
      currencySymbol: config.currencySymbol,
    }),
    [entries, now, data.initialBalance, tagById, config.currencySymbol]
  );

  // Hamburger handlers
  const onExport = () => {
    exportLedger(ledger);
    markBackedUp();
  };
  const onReset = () => {
    if (confirm("This wipes all your entries and tags. Continue?")) {
      resetLedger();
      setLog([]);
    }
  };
  const onLoadDemo = () => {
    if (!isEmpty && !confirm("Load demo data? This replaces your current entries.")) return;
    loadDemo();
    setLog([]);
  };

  // Optional prefill text fed into the composer (used by Web Share Target).
  const [composerPrefill, setComposerPrefill] = useState(null);

  // PWA shortcut handler: read ?action= / ?view= once, dispatch, then strip
  // the param from the URL so refresh doesn't re-trigger.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const action = u.searchParams.get("action");
    const view = u.searchParams.get("view");
    let consumed = false;

    // Web Share Target: when the user shares text from another app to
    // trunkline, the OS forwards us share_title / share_text / share_url
    // as query params. Drop them straight into the composer's input.
    const shareTitle = u.searchParams.get("share_title");
    const shareText  = u.searchParams.get("share_text");
    const shareUrl   = u.searchParams.get("share_url");
    const sharePieces = [shareTitle, shareText, shareUrl]
      .filter(Boolean)
      .map(s => s.trim())
      .filter(Boolean);
    if (sharePieces.length) {
      setComposerPrefill({ text: sharePieces.join(" · "), at: Date.now() });
      ["share_title", "share_text", "share_url"].forEach(k => u.searchParams.delete(k));
      consumed = true;
    }

    if (view === "ledger" || view === "graph") {
      setTweak("viewMode", view);
      u.searchParams.delete("view");
      consumed = true;
    }
    if (action === "add") {
      // Composer focuses itself when ⌘K is dispatched.
      setTimeout(() => {
        const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
        window.dispatchEvent(ev);
      }, 80);
      u.searchParams.delete("action");
      consumed = true;
    } else if (action === "export") {
      setTimeout(() => onExport(), 80);
      u.searchParams.delete("action");
      consumed = true;
    } else if (action === "import") {
      setOverlay("import");
      u.searchParams.delete("action");
      consumed = true;
    } else if (action === "aiprompt") {
      setOverlay("aiprompt");
      u.searchParams.delete("action");
      consumed = true;
    }

    if (consumed) {
      window.history.replaceState(null, "", u.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app" style={kindStyleVars}>
      <TopBar tweaks={tweaks} setTweak={setTweak} entries={entries} range={range}
              config={mergedConfig} data={data} now={now}
              isMobile={isMobile}
              mobileTab={mobileTab}
              onBack={isMobile && mobileTab === "more" && moreScreen ? () => setMoreScreen(null) : null}
              mobileTitle={moreScreen}
              hamburger={
                <HamburgerMenu
                  hasEntries={!isEmpty}
                  unbackedCount={unbackedCount}
                  onExport={onExport}
                  onImport={() => setOverlay("import")}
                  onAIPrompt={() => setOverlay("aiprompt")}
                  onLoadDemo={onLoadDemo}
                  onAbout={() => setOverlay("about")}
                  onReset={onReset}
                />
              } />

      <div className={`main${activePanel && !isMobile ? " right-expanded" : ""}`}>
        {isMobile && mobileTab === "more" ? (
          <MoreTab
            tweaks={tweaks}
            setTweak={setTweak}
            themes={config.themes}
            screen={moreScreen}
            onOpenScreen={setMoreScreen}
            config={mergedConfig}
            tagById={tagById}
            hoveredKind={hoveredKind}
            setHoveredKind={setHoveredKind}
            selectedTag={selectedTag}
            setSelectedTag={setSelectedTag}
            entries={entries}
            range={range}
            onAddTag={addUserTag}
            onEditTag={editTag}
            onRemoveTag={removeTag}
            kinds={kinds}
            onUpsertKind={upsertKind}
            onRemoveKind={removeKind}
            insights={insights}
            log={log}
            onEditEntry={setEditing}
            onImport={() => setOverlay("import")}
            onAIPrompt={() => setOverlay("aiprompt")}
            onExport={onExport}
            onLoadDemo={onLoadDemo}
            onReset={onReset}
            onAbout={() => setOverlay("about")}
            counts={{
              tags: mergedConfig.tags.length,
              lanes: kinds.filter(k => !k.archived).length,
              insights: insights.length,
              log: log.length,
            }}
          />
        ) : isEmpty ? (
          <EmptyState
            hasSeed={Array.isArray(seed?.entries) && seed.entries.length > 0}
            onLoadDemo={onLoadDemo}
            onImport={() => setOverlay("import")}
            onAIPrompt={() => setOverlay("aiprompt")}
          />
        ) : (tweaks.viewMode || "graph") === "ledger" ? (
          <LedgerView
            tweaks={tweaks}
            setTweak={setTweak}
            range={range}
            selectedTag={selectedTag}
            onEditEntry={setEditing}
            entries={entries}
            config={mergedConfig}
            data={data}
            now={now}
            tagById={tagById}
          />
        ) : (
          <MoneyGraph
            tweaks={tweaks}
            range={range}
            freshEntry={freshEntry}
            hoveredKind={hoveredKind}
            setHoveredKind={setHoveredKind}
            selectedTag={selectedTag}
            onEditEntry={setEditing}
            entries={entries}
            config={mergedConfig}
            data={data}
            now={now}
            tagById={tagById}
            kinds={kinds}
          />
        )}
        {!isMobile && (
          <RightRail
            tweaks={tweaks}
            log={log}
            activePanel={activePanel}
            onPanelChange={setActivePanel}
            onEditEntry={setEditing}
            config={mergedConfig}
            tagById={tagById}
            insights={insights}
            selectedTag={selectedTag}
            setSelectedTag={setSelectedTag}
            hoveredKind={hoveredKind}
            setHoveredKind={setHoveredKind}
            entries={entries}
            kinds={kinds}
            onUpsertKind={upsertKind}
            onRemoveKind={removeKind}
            onAddTag={addUserTag}
            onEditTag={editTag}
            onRemoveTag={removeTag}
            range={range}
          />
        )}
      </div>

      {isMobile && (
        <BottomNav active={mobileTab} onChange={onMobileTabChange} />
      )}

      <Composer tweaks={tweaks} onLog={onLog}
                zoom={tweaks.zoom} setZoom={setZoom}
                config={mergedConfig} tagById={tagById} now={now}
                onAddTag={addUserTag} entries={entries}
                prefill={composerPrefill} />

      {editing && (
        <EditPanel entry={editing}
                   onClose={() => setEditing(null)}
                   onSave={onSaveEdit}
                   onDelete={onDeleteEntry}
                   config={mergedConfig}
                   tagById={tagById}
                   now={now} />
      )}

      {overlay === "import" && (
        <ImportPanel onClose={closeOverlay}
                     hasExistingData={!isEmpty}
                     onApply={(snap) => { replaceLedger(snap); setLog([]); }} />
      )}
      {overlay === "aiprompt" && (
        <AIPromptPanel onClose={closeOverlay}
                       config={mergedConfig}
                       hasExistingData={!isEmpty}
                       onApply={(snap) => { replaceLedger(snap); setLog([]); }} />
      )}
      {overlay === "about" && <AboutPanel onClose={closeOverlay} />}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
