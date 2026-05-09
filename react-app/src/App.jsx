import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";

import { useStore, exportDoc } from "./hooks/useStore.js";
import {
  projectConfig, projectData, importUserDoc,
} from "./lib/schema.js";
import { rangeFromPreset } from "./lib/range.js";
import {
  materializeRecurring, statusFor, refreshStatus, MS_PER_DAY,
} from "./lib/data.js";
import { computeInsights } from "./lib/insights.js";

import TopBar from "./components/TopBar.jsx";
import RightRail from "./components/RightRail.jsx";
import Composer from "./components/Composer.jsx";
import ComposerSheet from "./components/ComposerSheet.jsx";
import Fab from "./components/Fab.jsx";
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
import Dash from "./components/Dash.jsx";

import { useIsMobile, isMobileNow } from "./hooks/useIsMobile.js";

export default function App() {
  return (
    <ErrorBoundary>
      <FinanceApp />
    </ErrorBoundary>
  );
}

function FinanceApp() {
  // ── store ──
  // The whole app reads/writes through the unified store. Two docs:
  //   user           — entries, kinds, tags, quickAdd, tweaks, currency
  //   customization  — graph dimensions + picker enums (themes, locales, …)
  const {
    user, customization, isEmpty,
    unbackedCount, markBackedUp,
    setEntries, addUserTag, editTag, removeTag,
    upsertKind, removeKind,
    setTweak,
    replaceUser, resetUser, replaceCustomization,
  } = useStore();

  // ── projections ──
  // The rest of the app was built against `config` + `data` props with a
  // specific shape. Project the store back into that shape so components
  // don't need any changes.
  const config = useMemo(() => projectConfig(user, customization),
    [user, customization]);
  const data = useMemo(() => projectData(user), [user]);
  const tweaks = user.tweaks;
  const kinds = user.kinds;

  // Tag lookup map — used everywhere a tag id needs to be resolved.
  const tagById = useMemo(
    () => Object.fromEntries(user.tags.map(t => [t.id, t])),
    [user.tags]
  );

  // Inline CSS variables for any kind that has a custom color set, so the
  // chart picks up the override without us touching CSS.
  const kindStyleVars = useMemo(() => {
    const s = {};
    for (const k of user.kinds) {
      if (k.color) s[`--b-${k.id}`] = k.color;
    }
    return s;
  }, [user.kinds]);

  const now = useMemo(
    () => customization.now ? new Date(customization.now) : new Date(),
    [customization.now]
  );

  const horizonMs = useMemo(() => {
    const years = customization.graph?.horizonYears ?? 2;
    return now.getTime() + years * 365 * MS_PER_DAY;
  }, [now, customization.graph]);

  // ── mobile / view tab state ──
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState(
    (tweaks.viewMode || "graph") === "ledger" ? "ledger" : "graph"
  );

  const [moreScreen, setMoreScreen] = useState(null);
  const [dashDrill, setDashDrill] = useState(null);
  const [composerSheetOpen, setComposerSheetOpen] = useState(false);

  useEffect(() => {
    if (mobileTab === "more" || mobileTab === "dash") return;
    const v = tweaks.viewMode || "graph";
    if (v !== mobileTab) setMobileTab(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tweaks.viewMode]);

  useEffect(() => {
    if (mobileTab !== "more") setMoreScreen(null);
    if (mobileTab !== "dash") setDashDrill(null);
  }, [mobileTab]);

  const onMobileTabChange = (id) => {
    setMobileTab(id);
    if (id === "graph" || id === "ledger") setTweak("viewMode", id);
  };

  const range = useMemo(
    () => rangeFromPreset(tweaks.rangePreset, tweaks.rangeStart, tweaks.rangeEnd, now),
    [tweaks.rangePreset, tweaks.rangeStart, tweaks.rangeEnd, now]
  );

  // ── URL <-> range sync ──
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

  // Refresh statuses when `now` changes.
  useEffect(() => {
    setEntries(es => es.map(e => ({ ...e, status: statusFor(e.when, now) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // Imported JSON / older snapshots may not carry `kind` on each entry.
  // schema.importUserDoc derives it on import, but defend anyway in case
  // an entry slips through (e.g. legacy in-memory data) — avoids crashing
  // MoneyGraph's lane lookup.
  const rawEntries = useMemo(() => {
    const refreshed = refreshStatus(data.entries, now);
    return refreshed.map(e => {
      if (e.kind) return e;
      const primary = e.tags && e.tags.length ? tagById[e.tags[0]] : null;
      return { ...e, kind: primary ? primary.kind : "extras" };
    });
  }, [data.entries, now, tagById]);
  const entries = useMemo(
    () => materializeRecurring(rawEntries, now, horizonMs),
    [rawEntries, now, horizonMs]
  );

  const [hoveredKind, setHoveredKind] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [log, setLog] = useState([]);
  const [freshEntry, setFreshEntry] = useState(null);
  const [editing, setEditing] = useState(null);

  const [overlay, setOverlay] = useState(null); // null | 'import' | 'aiprompt' | 'about' | 'customization'
  const closeOverlay = () => setOverlay(null);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((data) => {
    setToast({ id: Date.now() + Math.random(), ...data });
  }, []);
  const dismissToast = useCallback((id) => {
    setToast(t => (t && t.id === id ? null : t));
  }, []);

  const initialW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const [activePanel, setActivePanel] = useState(initialW < 1024 ? null : "tags");

  // ctrl-wheel zoom
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

  // ── exports ──
  // Two flows:
  //   onExport            — main "your data" download (user doc).
  //   onExportCustomization — hidden in More, downloads the customization doc.
  const onExport = useCallback(() => {
    exportDoc(user, "user");
    markBackedUp();
  }, [user, markBackedUp]);
  const onExportCustomization = useCallback(() => {
    exportDoc(customization, "customization");
  }, [customization]);

  // ── imports ──
  // Single entry-point: route by detected doc type. The ImportPanel's
  // user-facing copy still says "Import data" but it transparently handles
  // a customization file too (with a confirmation and a different toast).
  const onApplyImport = useCallback((parsed, kind) => {
    if (kind === "customization") {
      replaceCustomization(parsed);
      showToast({ message: "Customization applied" });
      return;
    }
    replaceUser(parsed);
    setLog([]);
    showToast({ message: `Imported · ${parsed.ledger.entries.length} entries` });
  }, [replaceCustomization, replaceUser, showToast]);

  // ── reset / load demo ──
  const onReset = () => {
    if (confirm("This wipes all your entries and tags. Continue?")) {
      resetUser();
      setLog([]);
    }
  };
  const onLoadDemo = async () => {
    if (!isEmpty && !confirm("Load demo data? This replaces your current entries.")) return;
    try {
      const r = await fetch("demo.json", { cache: "no-cache" });
      if (!r.ok) throw new Error("demo.json: " + r.status);
      const raw = await r.json();
      const parsed = importUserDoc(raw);
      replaceUser(parsed);
      setLog([]);
    } catch (err) {
      showToast({ message: `Failed to load demo: ${err.message}` });
    }
  };

  const [composerPrefill, setComposerPrefill] = useState(null);

  // ── hardware back gesture trap ──
  // Without this, Android's back button / edge-swipe pops the only history
  // entry and exits the app (or PWA) immediately. We push a sentinel entry
  // on mount and intercept popstate: each back tap closes the topmost open
  // UI layer (overlay → edit panel → composer sheet → More drill-in →
  // non-graph tab) and re-pushes the sentinel. Only when nothing remains
  // open do we let the next back propagate, exiting the app cleanly.
  //
  // State is read through a ref so the listener doesn't need to be torn
  // down on every state change.
  const navStateRef = useRef({});
  navStateRef.current = {
    overlay, editing, composerSheetOpen, moreScreen, mobileTab,
  };
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.pushState({ trunklineTrap: true }, "");
    const onPop = () => {
      const s = navStateRef.current;
      let handled = false;
      if (s.overlay) {
        setOverlay(null);
        handled = true;
      } else if (s.editing) {
        setEditing(null);
        handled = true;
      } else if (s.composerSheetOpen) {
        setComposerSheetOpen(false);
        setComposerPrefill(null);
        handled = true;
      } else if (s.moreScreen) {
        setMoreScreen(null);
        handled = true;
      } else if (s.mobileTab && s.mobileTab !== "graph") {
        setMobileTab("graph");
        setTweak("viewMode", "graph");
        handled = true;
      }
      if (handled) {
        window.history.pushState({ trunklineTrap: true }, "");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PWA shortcut handler
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const action = u.searchParams.get("action");
    const view = u.searchParams.get("view");
    let consumed = false;

    const shareTitle = u.searchParams.get("share_title");
    const shareText  = u.searchParams.get("share_text");
    const shareUrl   = u.searchParams.get("share_url");
    const sharePieces = [shareTitle, shareText, shareUrl]
      .filter(Boolean).map(s => s.trim()).filter(Boolean);
    if (sharePieces.length) {
      setComposerPrefill({ text: sharePieces.join(" · "), at: Date.now() });
      if (isMobileNow()) setComposerSheetOpen(true);
      ["share_title", "share_text", "share_url"].forEach(k => u.searchParams.delete(k));
      consumed = true;
    }

    if (view === "ledger" || view === "graph") {
      setTweak("viewMode", view);
      u.searchParams.delete("view");
      consumed = true;
    }
    if (action === "add") {
      if (isMobileNow()) {
        setComposerSheetOpen(true);
      } else {
        setTimeout(() => {
          const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
          window.dispatchEvent(ev);
        }, 80);
      }
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
              config={config} data={data} now={now}
              isMobile={isMobile}
              mobileTab={mobileTab}
              onBack={
                isMobile && mobileTab === "more" && moreScreen
                  ? () => setMoreScreen(null)
                : isMobile && mobileTab === "dash" && dashDrill
                  ? () => setDashDrill(null)
                  : null
              }
              mobileTitle={
                mobileTab === "more" ? moreScreen
                : mobileTab === "dash" && dashDrill
                  ? (dashDrill.type === "tag"
                      ? `#${tagById[dashDrill.id]?.label || dashDrill.id}`
                      : (kinds.find(k => k.id === dashDrill.id)?.vocab?.light
                         || kinds.find(k => k.id === dashDrill.id)?.label
                         || dashDrill.id))
                : null
              }
              hamburger={
                <HamburgerMenu
                  hasEntries={!isEmpty}
                  unbackedCount={unbackedCount}
                  onExport={onExport}
                  onExportCustomization={onExportCustomization}
                  onImport={() => setOverlay("import")}
                  onAIPrompt={() => setOverlay("aiprompt")}
                  onLoadDemo={onLoadDemo}
                  onAbout={() => setOverlay("about")}
                  onReset={onReset}
                />
              } />

      <div className={`main${activePanel && !isMobile ? " right-expanded" : ""}`}>
        {isMobile && mobileTab === "dash" ? (
          <Dash
            tweaks={tweaks}
            config={config}
            kinds={kinds}
            entries={entries}
            range={range}
            tagById={tagById}
            data={data}
            now={now}
            drill={dashDrill}
            setDrill={setDashDrill}
            onEditEntry={setEditing}
          />
        ) : isMobile && mobileTab === "more" ? (
          <MoreTab
            tweaks={tweaks}
            setTweak={setTweak}
            themes={config.themes}
            screen={moreScreen}
            onOpenScreen={setMoreScreen}
            config={config}
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
            onExportCustomization={onExportCustomization}
            onLoadDemo={onLoadDemo}
            onReset={onReset}
            onAbout={() => setOverlay("about")}
            counts={{
              tags: config.tags.length,
              lanes: kinds.filter(k => !k.archived).length,
              insights: insights.length,
              log: log.length,
            }}
          />
        ) : isEmpty ? (
          <EmptyState
            hasSeed={true}
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
            config={config}
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
            config={config}
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
            config={config}
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
            data={data}
            now={now}
            dashDrill={dashDrill}
            setDashDrill={setDashDrill}
          />
        )}
      </div>

      {isMobile && (
        <BottomNav active={mobileTab} onChange={onMobileTabChange} />
      )}

      <Composer tweaks={tweaks} onLog={onLog}
                zoom={tweaks.zoom} setZoom={setZoom}
                config={config} tagById={tagById} now={now}
                onAddTag={addUserTag} entries={entries}
                prefill={composerPrefill} />

      {isMobile && (
        <>
          <Fab
            onClick={() => setComposerSheetOpen(true)}
            hidden={mobileTab === "more" || composerSheetOpen || !!editing}
          />
          <ComposerSheet
            open={composerSheetOpen}
            onClose={() => { setComposerSheetOpen(false); setComposerPrefill(null); }}
            tweaks={tweaks}
            onLog={onLog}
            config={config}
            tagById={tagById}
            now={now}
            onAddTag={addUserTag}
            entries={entries}
            prefill={composerPrefill}
          />
        </>
      )}

      {editing && (
        <EditPanel entry={editing}
                   onClose={() => setEditing(null)}
                   onSave={onSaveEdit}
                   onDelete={onDeleteEntry}
                   config={config}
                   tagById={tagById}
                   now={now} />
      )}

      {overlay === "import" && (
        <ImportPanel onClose={closeOverlay}
                     hasExistingData={!isEmpty}
                     onApply={onApplyImport} />
      )}
      {overlay === "aiprompt" && (
        <AIPromptPanel onClose={closeOverlay}
                       config={config}
                       hasExistingData={!isEmpty}
                       onApply={(parsed) => onApplyImport(parsed, "user")} />
      )}
      {overlay === "about" && <AboutPanel onClose={closeOverlay} />}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
