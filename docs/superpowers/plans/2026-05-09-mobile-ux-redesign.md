# Mobile UX redesign — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the trunkline UI at viewports ≤768px into a native-feeling phone shell — bottom-tab nav, FAB-triggered composer sheet, full-screen edit, More-tab drill-ins for the right-rail panels — while leaving desktop pixel-identical.

**Architecture:** Single CSS breakpoint at 768px; one new viewport-aware hook (`useIsMobile`); three new components (`BottomNav`, `ComposerSheet`, `MoreTab`, `Fab`) plus an extracted `ComposerForm`; existing `RightRail`, `TopBar`, `EditPanel`, `Composer`, `App` modified in place. No new runtime dependencies.

**Tech Stack:** React 18 (functional components, hooks), Vite 5, plain CSS in `react-app/src/styles.css`, no test framework in repo (verification = `npm run build` + manual `npm run dev` + optional Playwright per project CLAUDE.md).

**Source spec:** `docs/superpowers/specs/2026-05-09-mobile-ux-design.md`.

---

## File map

**New files:**
- `react-app/src/hooks/useIsMobile.js` — viewport-aware boolean hook
- `react-app/src/hooks/useScrollDirection.js` — scroll-direction tracker for FAB
- `react-app/src/components/BottomNav.jsx` — 3-item phone tab bar
- `react-app/src/components/MoreTab.jsx` — More tab content + drill-in router
- `react-app/src/components/ComposerForm.jsx` — extracted form internals shared by Composer and ComposerSheet
- `react-app/src/components/ComposerSheet.jsx` — bottom-sheet wrapper around ComposerForm
- `react-app/src/components/Fab.jsx` — scroll-aware floating add button

**Modified files:**
- `react-app/index.html` — viewport meta tag
- `react-app/src/App.jsx` — adds mobileTab/composerSheetOpen/moreScreen state, gates layout by `useIsMobile`
- `react-app/src/components/TopBar.jsx` — mobile mode (3 stats? no, 4 stats; drop toggles; "more" title; back arrow on drill-ins)
- `react-app/src/components/RightRail.jsx` — exports `PanelTags`, `PanelLanes`, `PanelInsights`, `PanelLog` for reuse in MoreTab
- `react-app/src/components/Composer.jsx` — extracts form into ComposerForm; ⌘K listener gated to desktop
- `react-app/src/components/EditPanel.jsx` — full-screen modal styling on mobile + back-arrow header
- `react-app/src/styles.css` — appends a "===== mobile shell =====" section at the bottom with all new mobile rules

**Out of scope:** desktop styling, MoneyGraph SVG internals, data model, PWA manifest, service worker.

---

## Conventions for every task

- Run `npm install` once at the start if `node_modules` is missing.
- Always run from `react-app/` directory: `cd react-app` (or run commands with `npm --prefix react-app run …`).
- After each task: `npm --prefix react-app run build` must succeed before commit (catches import/syntax errors).
- After each task: open `npm --prefix react-app run dev` (defaults to `http://localhost:5173`), resize the browser to 360px wide, and run the manual verification listed in the task. Capture in conversation notes if anything looks off.
- Commit message style: short imperative subject + 1-3 line body. Match existing repo style (see `git log --oneline`).

---

## Task 1: Foundation — useIsMobile hook + viewport meta

**Files:**
- Create: `react-app/src/hooks/useIsMobile.js`
- Modify: `react-app/index.html:5` (viewport meta)

- [ ] **Step 1: Create the hook**

Write `react-app/src/hooks/useIsMobile.js`:

```js
// Returns true when the viewport is ≤768px wide. Re-renders on resize
// and orientation change. SSR-safe (returns false until hydrated).

import { useEffect, useState } from "react";

const QUERY = "(max-width: 768px)";

export function useIsMobile() {
  const get = () =>
    typeof window !== "undefined" && window.matchMedia(QUERY).matches;
  const [isMobile, setIsMobile] = useState(get);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    // matchMedia.addEventListener exists in all modern browsers; older
    // Safari needs addListener as a fallback.
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return isMobile;
}
```

- [ ] **Step 2: Update viewport meta**

In `react-app/index.html`, replace line 5:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

with:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
```

- [ ] **Step 3: Verify build**

Run: `npm --prefix react-app run build`
Expected: success, dist/ generated.

- [ ] **Step 4: Commit**

```bash
git add react-app/src/hooks/useIsMobile.js react-app/index.html
git commit -m "feat(mobile): add useIsMobile hook + viewport meta for keyboard-aware layout

Foundation for mobile shell. interactive-widget=resizes-content so iOS/Android
keyboards shrink the viewport instead of overlaying it."
```

---

## Task 2: BottomNav component + mobileTab routing

**Files:**
- Create: `react-app/src/components/BottomNav.jsx`
- Modify: `react-app/src/App.jsx` (add mobileTab state, render BottomNav, route content)
- Modify: `react-app/src/styles.css` (append nav rules)

- [ ] **Step 1: Create BottomNav.jsx**

Write `react-app/src/components/BottomNav.jsx`:

```jsx
// Phone-only bottom tab bar: graph / ledger / more.
// Active state shown by a 2px accent bar at the bottom of the active item.
// Hidden on desktop via CSS.

import React from "react";

const ICONS = {
  graph: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </svg>
  ),
  ledger: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6"  x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6"  x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  more: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5"  cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </svg>
  ),
};

export default function BottomNav({ active, onChange }) {
  const items = [
    { id: "graph",  label: "graph"  },
    { id: "ledger", label: "ledger" },
    { id: "more",   label: "more"   },
  ];
  return (
    <nav className="bottom-nav" role="tablist" aria-label="primary">
      {items.map(it => (
        <button key={it.id}
                type="button"
                role="tab"
                aria-selected={active === it.id}
                className={`bn-item${active === it.id ? " active" : ""}`}
                onClick={() => onChange(it.id)}>
          <span className="bn-ic">{ICONS[it.id]}</span>
          <span className="bn-lbl">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Add CSS to styles.css**

Append to the end of `react-app/src/styles.css`:

```css
/* ============================================================
 * MOBILE SHELL (≤768px)
 * Bottom-tab nav + FAB + composer sheet + more-tab drill-ins.
 * Desktop is unaffected — every rule below is gated by media query.
 * ============================================================ */

.bottom-nav { display: none; }

@media (max-width: 768px) {
  .bottom-nav {
    display: flex;
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 30;
    background: var(--bg-2);
    border-top: 1px solid var(--rule);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .bn-item {
    flex: 1; position: relative;
    padding: 7px 0 6px;
    background: transparent; border: none;
    color: var(--ink-3);
    cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 1px;
    font-family: var(--font-mono); font-size: 8px;
  }
  .bn-item .bn-ic {
    width: 18px; height: 18px;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .bn-item.active { color: var(--ink); }
  .bn-item.active::after {
    content: ""; position: absolute;
    left: 38%; right: 38%; bottom: 0;
    height: 2px; border-radius: 2px;
    background: var(--ink);
  }
}
```

- [ ] **Step 3: Wire into App.jsx**

In `react-app/src/App.jsx`:

a) Add import after existing imports (around line 24):

```jsx
import BottomNav from "./components/BottomNav.jsx";
import { useIsMobile } from "./hooks/useIsMobile.js";
```

b) Inside `FinanceApp`, after the `useTweaks` line (~line 160), add:

```jsx
const isMobile = useIsMobile();
const [mobileTab, setMobileTab] = useState(
  (tweaksRaw.viewMode || "graph") === "ledger" ? "ledger" : "graph"
);

// Keep mobileTab in sync with desktop view-toggle when user swaps views
// from desktop and resizes down (or vice versa). Only sync graph/ledger
// — "more" is a phone-only destination with no desktop equivalent.
useEffect(() => {
  if (mobileTab === "more") return;
  const v = tweaks.viewMode || "graph";
  if (v !== mobileTab) setMobileTab(v);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [tweaks.viewMode]);

const onMobileTabChange = (id) => {
  setMobileTab(id);
  if (id === "graph" || id === "ledger") setTweak("viewMode", id);
};
```

c) Render the bottom nav. Inside the returned JSX, after the closing `</div>` of `.main` (around line 493) and before `<Composer …/>`, add:

```jsx
{isMobile && (
  <BottomNav active={mobileTab} onChange={onMobileTabChange} />
)}
```

d) Gate the right-rail panel-default behavior so it doesn't auto-open on mobile. The existing line ~262 reads `useState(initialW < 1024 ? null : "tags")` — leave it alone, but in the JSX wherever `<RightRail>` is rendered, this is handled in Task 4.

- [ ] **Step 4: Verify**

```
npm --prefix react-app run build
npm --prefix react-app run dev
```

Open http://localhost:5173 in a browser, open DevTools, set device toolbar to 360px wide. Expect:
- Bottom nav appears with three items.
- Tapping "ledger" switches the view to ledger.
- Tapping "graph" switches back.
- Tapping "more" sets mobileTab=more (visually no change yet since we haven't built MoreTab — graph/ledger keeps showing). This is fine for now.
- At ≥769px wide, bottom nav is gone.

- [ ] **Step 5: Commit**

```bash
git add react-app/src/components/BottomNav.jsx react-app/src/App.jsx react-app/src/styles.css
git commit -m "feat(mobile): add BottomNav and mobileTab routing

3-item bottom tab bar (graph/ledger/more) renders only on ≤768px.
Graph and ledger sync with tweaks.viewMode so desktop view-toggle
and mobile bottom-nav stay coherent."
```

---

## Task 3: TopBar mobile mode + 4-stat strip

**Files:**
- Modify: `react-app/src/components/TopBar.jsx`
- Modify: `react-app/src/styles.css` (append topbar mobile rules)
- Modify: `react-app/src/App.jsx` (pass new props)

- [ ] **Step 1: Update TopBar.jsx**

Replace the entire body of the default export in `react-app/src/components/TopBar.jsx` with this version. (The `useMemo` totals block stays unchanged — only the JSX after the `return` and the props signature change.)

```jsx
export default function TopBar({
  tweaks, setTweak, entries, range, config, data, now, hamburger,
  isMobile = false, mobileTab = "graph",
  onBack = null, mobileTitle = null,
}) {
  const initialBalance = data.initialBalance;

  const { totals, openingBal, closingBal, balanceAtNow } = useMemo(() => {
    let inc = 0, fixed = 0, extras = 0, loans = 0, sav = 0;
    let bal = initialBalance;
    let opening = null;
    let atNow = null;
    const sorted = entries.slice().sort((a, b) => new Date(a.when) - new Date(b.when));
    for (const e of sorted) {
      const t = new Date(e.when).getTime();
      if (atNow === null && t > now.getTime()) atNow = bal;
      if (opening === null && t >= range.start) opening = bal;
      if (t >= range.start && t <= range.end) {
        if (e.dir === "in") inc += e.amount;
        else if (e.dir !== "merge") {
          if (e.kind === "fixed")   fixed  += e.amount;
          else if (e.kind === "extras" && e.status !== "future") extras += e.amount;
          else if (e.kind === "loans")   loans  += e.amount;
          else if (e.kind === "savings") sav    += e.amount;
        }
      }
      if (t <= range.end) {
        if (e.dir === "in")    bal += e.amount;
        if (e.dir === "out")   bal -= e.amount;
        if (e.dir === "merge") bal -= e.amount;
      }
    }
    if (opening === null) opening = bal;
    if (atNow === null) atNow = bal;
    const committed = fixed + loans + sav;
    return {
      totals: { inc, fixed, extras, loans, sav, committed, spent: committed + extras },
      openingBal: opening, closingBal: bal, balanceAtNow: atNow,
    };
  }, [entries, range.start, range.end, initialBalance, now]);

  const rangeIsAll = range.start === -Infinity;
  const symbol = config.currencySymbol;

  // Mobile drill-in mode: just back-arrow + section title, no stats, no controls.
  if (isMobile && onBack) {
    return (
      <div className="topbar topbar-mobile topbar-drill">
        <button type="button" className="topbar-back" onClick={onBack} aria-label="back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="repo"><b>{mobileTitle || ""}</b></div>
      </div>
    );
  }

  // Mobile (no drill-in): hamburger + title + range chip. Stats only on graph tab.
  if (isMobile) {
    const onMore = mobileTab === "more";
    return (
      <>
        <div className="topbar topbar-mobile">
          {hamburger}
          <div className="repo">
            <span><b>{onMore ? "more" : "trunkline"}</b></span>
          </div>
          {!onMore && (
            <RangeChip tweaks={tweaks} setTweak={setTweak} range={range}
                       presets={config.rangePresets} now={now} />
          )}
        </div>
        {mobileTab === "graph" && (
          <div className="stats-mobile">
            <div className="stat">
              <div className="k">income</div>
              <div className="v ok">+{fmtINR(totals.inc, tweaks.locale, symbol)}</div>
            </div>
            <div className="stat">
              <div className="k">committed</div>
              <div className="v">−{fmtINR(totals.committed, tweaks.locale, symbol)}</div>
            </div>
            <div className="stat">
              <div className="k">extras</div>
              <div className="v warn">−{fmtINR(totals.extras, tweaks.locale, symbol)}</div>
            </div>
            <div className="stat">
              <div className="k">{rangeIsAll ? "today" : "closing"}</div>
              <div className="v" style={{ color: closingBal < 0 ? "var(--warn)" : "var(--ink)" }}>
                {fmtINR(rangeIsAll ? balanceAtNow : closingBal, tweaks.locale, symbol)}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop — unchanged from before.
  return (
    <div className="topbar">
      {hamburger}
      <div className="repo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--b-main)" }}>
          <circle cx="6" cy="3" r="2"></circle>
          <circle cx="6" cy="12" r="2"></circle>
          <circle cx="18" cy="9" r="2"></circle>
          <path d="M6 5v14"></path>
          <path d="M6 7h6a4 4 0 0 1 4 4v0"></path>
        </svg>
        <span><b>trunkline</b></span>
      </div>

      <RangeChip tweaks={tweaks} setTweak={setTweak} range={range}
                 presets={config.rangePresets} now={now} />
      <ViewToggle value={tweaks.viewMode || "graph"}
                  onChange={v => setTweak("viewMode", v)} />
      <FutureToggle showFuture={tweaks.showFuture}
                    collapseFuture={!!tweaks.collapseFuture}
                    onChange={(edits) => setTweak(edits)} />
      <ThemeToggle value={tweaks.theme} themes={config.themes}
                   onChange={v => setTweak("theme", v)} />

      <div className="stats">
        {!rangeIsAll && (
          <div className="stat">
            <div className="k">opening</div>
            <div className="v" style={{ color: "var(--ink-2)" }}>{fmtINR(openingBal, tweaks.locale, symbol)}</div>
          </div>
        )}
        <div className="stat">
          <div className="k">income · in range</div>
          <div className="v ok">+{fmtINR(totals.inc, tweaks.locale, symbol)}</div>
        </div>
        <div className="stat">
          <div className="k">committed</div>
          <div className="v">−{fmtINR(totals.spent, tweaks.locale, symbol)}</div>
        </div>
        <div className="stat">
          <div className="k">extras</div>
          <div className="v warn">−{fmtINR(totals.extras, tweaks.locale, symbol)}</div>
        </div>
        <div className="stat">
          <div className="k">{rangeIsAll ? "balance · today" : "closing balance"}</div>
          <div className="v" style={{ color: closingBal < 0 ? "var(--warn)" : "var(--ink)" }}>
            {fmtINR(rangeIsAll ? balanceAtNow : closingBal, tweaks.locale, symbol)}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append CSS**

At the bottom of `react-app/src/styles.css` (under the mobile shell banner from Task 2), append:

```css
@media (max-width: 768px) {
  .topbar.topbar-mobile {
    flex-wrap: nowrap;
    padding: 6px 10px;
    gap: 10px;
  }
  .topbar.topbar-mobile .repo {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Drop the old wrapped-stats strip on mobile — we render .stats-mobile instead. */
  .topbar.topbar-mobile .stats { display: none; }

  .stats-mobile {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--rule);
    background: var(--bg-2);
  }
  .stats-mobile .stat { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .stats-mobile .stat .k {
    font-family: var(--font-mono); font-size: 8px; text-transform: uppercase;
    letter-spacing: .06em; color: var(--ink-3);
  }
  .stats-mobile .stat .v {
    font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--ink);
  }
  .stats-mobile .stat .v.warn { color: var(--warn); }
  .stats-mobile .stat .v.ok   { color: var(--ok); }

  .topbar.topbar-drill {
    padding: 6px 10px;
    gap: 8px;
  }
  .topbar-back {
    background: var(--surface);
    border: 1px solid var(--rule);
    color: var(--ink-2);
    border-radius: 6px;
    width: 28px; height: 28px;
    display: inline-flex; align-items: center; justify-content: center;
    cursor: pointer;
  }
  .topbar-back:hover { color: var(--ink); border-color: var(--ink-2); }
}

/* On phones (<480px), trim padding/font slightly more. */
@media (max-width: 480px) {
  .stats-mobile { gap: 4px; padding: 5px 8px; }
  .stats-mobile .stat .k { font-size: 7px; }
  .stats-mobile .stat .v { font-size: 10.5px; }
}
```

Also delete the old `.topbar { flex-wrap: wrap … }` and `.topbar .stats { … overflow-x:auto … }` rules from the existing 768px block (lines ~1224–1241) — they conflict with the new layout.

Concretely: in `react-app/src/styles.css` find these blocks inside the existing `@media (max-width: 768px)` (around line 1220–1241) and delete them:

```css
  /* Topbar wraps; the stats become a horizontally-scrollable strip */
  .topbar {
    flex-wrap: wrap;
    gap: 6px 10px;
    padding: 8px 10px;
  }
  .topbar .stats {
    margin-left: 0;
    flex: 1 1 100%;        /* take full row when wrapped */
    min-width: 0;          /* allow shrink so its scroll works */
    gap: 14px;
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 2px;
    -webkit-overflow-scrolling: touch;
  }
  .topbar .stats::-webkit-scrollbar { height: 0; }
  .topbar .stat { flex-shrink: 0; }
  .topbar .stat .v { font-size: 12px; }
```

Leave the rest of that media query intact (the toggle, composer, etc. rules — we'll trim those in later tasks).

- [ ] **Step 3: Wire props from App.jsx**

In `react-app/src/App.jsx`, locate the `<TopBar … />` invocation (around line 418) and update it to:

```jsx
<TopBar tweaks={tweaks} setTweak={setTweak} entries={entries} range={range}
        config={mergedConfig} data={data} now={now}
        isMobile={isMobile}
        mobileTab={mobileTab}
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
```

(`onBack` and `mobileTitle` are passed only by drill-in screens — wired in Task 7.)

- [ ] **Step 4: Verify**

```
npm --prefix react-app run build
npm --prefix react-app run dev
```

At 360px:
- Topbar shows hamburger + "trunkline" + range chip only — no view/future/theme toggles.
- Below topbar, on Graph tab: 4-stat strip (income / committed / extras / closing). No horizontal scroll.
- On Ledger tab: no stats strip.
- On More tab: title is "more", no range chip.

At ≥769px: identical to before — 5-stat strip, all toggles visible.

- [ ] **Step 5: Commit**

```bash
git add react-app/src/components/TopBar.jsx react-app/src/styles.css react-app/src/App.jsx
git commit -m "feat(mobile): mobile-mode topbar + 4-stat strip (income/committed/extras/closing)

Drops view/future/theme toggles on mobile (they move to More).
Replaces horizontal-scroll stats with a fixed 4-stat row on graph tab.
Drill-in mode (back-arrow + title) wired but unused until Task 7."
```

---

## Task 4: Right rail off on mobile + main grid CSS

**Files:**
- Modify: `react-app/src/App.jsx` (skip RightRail when isMobile)
- Modify: `react-app/src/styles.css` (mobile main grid)

- [ ] **Step 1: Skip RightRail on mobile in App.jsx**

In `react-app/src/App.jsx`, find the `<RightRail … />` block (around lines 471–492) and wrap it:

```jsx
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
```

Also adjust the `.main` className expression (around line 433) to not include `right-expanded` on mobile:

```jsx
<div className={`main${activePanel && !isMobile ? " right-expanded" : ""}`}>
```

- [ ] **Step 2: Update mobile CSS for `.main`**

Append to `react-app/src/styles.css` at the bottom:

```css
@media (max-width: 768px) {
  .main {
    grid-template-columns: 1fr !important;  /* drop the rail track */
  }
  .main.right-expanded {
    grid-template-columns: 1fr !important;
  }
  /* Make the body of ledger/more scrollable. The graph is a fixed SVG so
   * it doesn't need scroll. We pad bottom by the nav (34px) + safe-area
   * so content doesn't sit under the bottom nav. */
  .ledger {
    padding-bottom: calc(34px + env(safe-area-inset-bottom));
  }
}
```

- [ ] **Step 3: Verify**

```
npm --prefix react-app run build
npm --prefix react-app run dev
```

At 360px:
- Right rail icon strip is gone.
- Right rail panel (if previously open) is gone.
- Graph fills full width (minus 0px rail).
- Ledger scrolls; bottom rows aren't covered by the bottom nav.

At ≥769px: rail unchanged.

- [ ] **Step 4: Commit**

```bash
git add react-app/src/App.jsx react-app/src/styles.css
git commit -m "feat(mobile): hide RightRail on phones; .main becomes single-column

Frees up 36–280px of horizontal real estate for the graph/ledger.
Rail panels (tags/lanes/insights/log) will move to a More tab in Task 7."
```

---

## Task 5: MoreTab placeholder

**Files:**
- Create: `react-app/src/components/MoreTab.jsx`
- Modify: `react-app/src/App.jsx` (route mobileTab=more to MoreTab)
- Modify: `react-app/src/styles.css` (more-tab styles)

- [ ] **Step 1: Create MoreTab.jsx (placeholder version)**

Write `react-app/src/components/MoreTab.jsx`:

```jsx
// Mobile-only "More" tab — entry point for tags, lanes, insights, log,
// theme, future toggle, hamburger items, and about. This file renders
// the list of rows; tap actions and drill-ins are wired in Tasks 6 and 7.

import React from "react";

export default function MoreTab({
  tweaks, setTweak, themes,
  onOpenTags, onOpenLanes, onOpenInsights, onOpenLog,
  onImport, onAIPrompt, onExport, onLoadDemo, onReset, onAbout,
  counts = {},
}) {
  const themeLabel = (() => {
    const t = (themes || []).find(t => t.value === tweaks.theme);
    return t ? t.label : tweaks.theme;
  })();

  const Row = ({ label, meta, onClick, danger }) => (
    <button type="button"
            className={`mt-row${danger ? " danger" : ""}`}
            onClick={onClick}>
      <span className="mt-label">{label}</span>
      <span className="mt-meta">{meta}</span>
    </button>
  );

  return (
    <div className="more-tab">
      <div className="mt-section">browse</div>
      <Row label="tags"        meta={`${counts.tags ?? "—"} ›`}     onClick={onOpenTags} />
      <Row label="lanes"       meta={`${counts.lanes ?? "—"} ›`}    onClick={onOpenLanes} />
      <Row label="insights"    meta={`${counts.insights ?? "—"} ›`} onClick={onOpenInsights} />
      <Row label="recent log"  meta={`${counts.log ?? 0} ›`}        onClick={onOpenLog} />

      <div className="mt-section">view</div>
      <Row label="future entries"
           meta={tweaks.showFuture ? "show" : "hide"}
           onClick={() => setTweak("showFuture", !tweaks.showFuture)} />
      <Row label="theme" meta={themeLabel}
           onClick={() => {
             // Cycle through the themes list.
             const list = themes || [];
             const i = list.findIndex(t => t.value === tweaks.theme);
             const next = list[(i + 1) % list.length];
             if (next) setTweak("theme", next.value);
           }} />

      <div className="mt-section">data</div>
      <Row label="import JSON"     meta="›" onClick={onImport} />
      <Row label="AI prompt"        meta="›" onClick={onAIPrompt} />
      <Row label="export backup"    meta="›" onClick={onExport} />
      <Row label="load demo"        meta="›" onClick={onLoadDemo} />
      <Row label="reset"            meta="›" onClick={onReset} danger />

      <div className="mt-section">about</div>
      <Row label="about trunkline"  meta="›" onClick={onAbout} />
    </div>
  );
}
```

- [ ] **Step 2: Append CSS**

At the bottom of `react-app/src/styles.css`:

```css
@media (max-width: 768px) {
  .more-tab {
    display: flex; flex-direction: column;
    background: var(--bg);
    overflow-y: auto;
    height: 100%;
    padding-bottom: calc(34px + env(safe-area-inset-bottom) + 12px);
  }
  .more-tab .mt-section {
    font-family: var(--font-mono); font-size: 9px;
    text-transform: uppercase; letter-spacing: .08em;
    color: var(--ink-3);
    padding: 14px 14px 6px;
  }
  .more-tab .mt-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px;
    background: transparent;
    border: none;
    border-bottom: 1px dashed var(--rule);
    width: 100%;
    text-align: left;
    cursor: pointer;
    color: var(--ink);
    font-family: var(--font-sans); font-size: 13px;
  }
  .more-tab .mt-row:hover { background: var(--bg-2); }
  .more-tab .mt-row.danger .mt-meta { color: var(--warn); }
  .more-tab .mt-label { color: var(--ink); }
  .more-tab .mt-meta {
    color: var(--ink-3);
    font-family: var(--font-mono); font-size: 10px;
  }
}
```

- [ ] **Step 3: Wire into App.jsx**

In `react-app/src/App.jsx` add the import (with the other component imports near line 24):

```jsx
import MoreTab from "./components/MoreTab.jsx";
```

In the body region of the returned JSX, replace the existing `isEmpty / ledger / graph` ternary inside `<div className={...main...}>` (around lines 434–470) with a wrapper that handles `mobileTab === "more"`:

```jsx
{isMobile && mobileTab === "more" ? (
  <MoreTab
    tweaks={tweaks}
    setTweak={setTweak}
    themes={config.themes}
    onOpenTags={() => {/* wired in Task 7 */}}
    onOpenLanes={() => {/* wired in Task 7 */}}
    onOpenInsights={() => {/* wired in Task 7 */}}
    onOpenLog={() => {/* wired in Task 7 */}}
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
```

- [ ] **Step 4: Verify**

```
npm --prefix react-app run build
npm --prefix react-app run dev
```

At 360px:
- Tap "more" in bottom nav. The body shows browse/view/data/about sections with rows.
- Tap "future entries" — the meta toggles between "show" and "hide", and pressing back to graph reflects the change.
- Tap "theme" — cycles paper → terminal → midnight.
- Tap "import JSON" / "AI prompt" / "export backup" / "load demo" / "reset" / "about" — the existing overlays/actions fire (this reuses App.jsx's existing handlers).
- Tap "tags" / "lanes" / "insights" / "recent log" — nothing happens yet (Task 7).

- [ ] **Step 5: Commit**

```bash
git add react-app/src/components/MoreTab.jsx react-app/src/App.jsx react-app/src/styles.css
git commit -m "feat(mobile): MoreTab with rows for browse/view/data/about

Wires theme cycle, future toggle, and all hamburger callbacks (import,
AI prompt, export, demo, reset, about). Drill-ins for tags/lanes/insights/log
land in Task 7."
```

---

## Task 6: MoreTab — verify all action wiring + counts

This task is a sanity gate to confirm Task 5's wiring is correct end-to-end before adding drill-ins.

- [ ] **Step 1: Manual verification matrix**

```
npm --prefix react-app run dev
```

At 360px, on More tab, tap each row and confirm the expected behavior. Mark ✅ as you go:

| Row              | Expected                                                      | ✅ |
|------------------|---------------------------------------------------------------|---|
| future entries   | Toggles "show" ↔ "hide"; on returning to graph, future entries appear/disappear |   |
| theme            | Cycles label between paper / terminal / midnight; root data-theme attr changes |   |
| import JSON      | ImportPanel overlay opens                                     |   |
| AI prompt        | AIPromptPanel overlay opens                                   |   |
| export backup    | Triggers download of ledger JSON; hamburger dot clears        |   |
| load demo        | Confirm dialog → demo data loads                              |   |
| reset            | Confirm dialog → wipes ledger                                 |   |
| about            | AboutPanel overlay opens                                      |   |

- [ ] **Step 2: If any row fails, fix the matching App.jsx handler before continuing.**

The handlers (`onExport`, `onLoadDemo`, `onReset`, `setOverlay`) all live in `App.jsx`'s `FinanceApp` function. They were previously called from the hamburger menu — they should work identically here.

- [ ] **Step 3: Verify counts on the right side of each row are accurate**

Confirm:
- "tags" count matches `config.tags.length` (visible on desktop's tag panel as well).
- "lanes" count matches the unarchived kinds.
- "insights" count matches the desktop insights panel.
- "recent log" count = number of entries logged in this session (matches desktop "recent log" panel).

- [ ] **Step 4: Commit (no-op if Task 5 wiring already worked)**

If you fixed anything in Step 2, commit it now:

```bash
git add react-app/src/App.jsx
git commit -m "fix(mobile): correct More-tab action wiring

(Note: skip this commit if no fix was needed.)"
```

If nothing needed fixing, this task adds zero commits — just gates the next task.

---

## Task 7: MoreTab drill-ins (export rail panels, full-screen drill-in)

**Files:**
- Modify: `react-app/src/components/RightRail.jsx` (export the four Panel* internals)
- Modify: `react-app/src/components/MoreTab.jsx` (add drill-in mode)
- Modify: `react-app/src/App.jsx` (add `moreScreen` state + drill-in topbar)
- Modify: `react-app/src/styles.css` (drill-in container)

- [ ] **Step 1: Export panel components from RightRail.jsx**

In `react-app/src/components/RightRail.jsx`, change four internal function declarations from:

```jsx
function PanelLanes(...) { ... }
function PanelTags(...) { ... }
function PanelInsights(...) { ... }
function PanelLog(...) { ... }
```

to:

```jsx
export function PanelLanes(...) { ... }
export function PanelTags(...) { ... }
export function PanelInsights(...) { ... }
export function PanelLog(...) { ... }
```

(Just add `export` before each `function`. Do not move them. The default export `RightRail` keeps using them as before.)

- [ ] **Step 2: Update MoreTab.jsx to support drill-ins**

Replace `react-app/src/components/MoreTab.jsx` with:

```jsx
// Mobile-only "More" tab — list view + drill-in container.
// When `screen` is null we render the row list. Otherwise we render the
// matching panel component filling the area; the parent (App.jsx) is
// responsible for swapping the topbar to drill-in mode (back-arrow + title).

import React from "react";
import { PanelTags, PanelLanes, PanelInsights, PanelLog } from "./RightRail.jsx";

export default function MoreTab({
  tweaks, setTweak, themes,
  screen, onOpenScreen,
  // tags
  config, tagById, hoveredKind, setHoveredKind,
  selectedTag, setSelectedTag, entries, range,
  onAddTag, onEditTag, onRemoveTag,
  // lanes
  kinds, onUpsertKind, onRemoveKind,
  // insights, log
  insights, log, onEditEntry,
  // hamburger callbacks
  onImport, onAIPrompt, onExport, onLoadDemo, onReset, onAbout,
  counts = {},
}) {
  if (screen === "tags") {
    return (
      <div className="more-drill">
        <PanelTags
          tweaks={tweaks}
          hoveredKind={hoveredKind} setHoveredKind={setHoveredKind}
          selectedTag={selectedTag} setSelectedTag={setSelectedTag}
          entries={entries} config={config} tagById={tagById}
          onAddTag={onAddTag} range={range}
          onEditTag={onEditTag} onRemoveTag={onRemoveTag}
        />
      </div>
    );
  }
  if (screen === "lanes") {
    return (
      <div className="more-drill">
        <PanelLanes kinds={kinds || []}
                    onUpsert={onUpsertKind}
                    onRemove={onRemoveKind} />
      </div>
    );
  }
  if (screen === "insights") {
    return (
      <div className="more-drill">
        <PanelInsights insights={insights || []} />
      </div>
    );
  }
  if (screen === "log") {
    return (
      <div className="more-drill">
        <PanelLog log={log} onEditEntry={onEditEntry}
                  tagById={tagById} tweaks={tweaks} config={config} />
      </div>
    );
  }

  const themeLabel = (() => {
    const t = (themes || []).find(t => t.value === tweaks.theme);
    return t ? t.label : tweaks.theme;
  })();

  const Row = ({ label, meta, onClick, danger }) => (
    <button type="button"
            className={`mt-row${danger ? " danger" : ""}`}
            onClick={onClick}>
      <span className="mt-label">{label}</span>
      <span className="mt-meta">{meta}</span>
    </button>
  );

  return (
    <div className="more-tab">
      <div className="mt-section">browse</div>
      <Row label="tags"        meta={`${counts.tags ?? "—"} ›`}     onClick={() => onOpenScreen("tags")} />
      <Row label="lanes"       meta={`${counts.lanes ?? "—"} ›`}    onClick={() => onOpenScreen("lanes")} />
      <Row label="insights"    meta={`${counts.insights ?? "—"} ›`} onClick={() => onOpenScreen("insights")} />
      <Row label="recent log"  meta={`${counts.log ?? 0} ›`}        onClick={() => onOpenScreen("log")} />

      <div className="mt-section">view</div>
      <Row label="future entries"
           meta={tweaks.showFuture ? "show" : "hide"}
           onClick={() => setTweak("showFuture", !tweaks.showFuture)} />
      <Row label="theme" meta={themeLabel}
           onClick={() => {
             const list = themes || [];
             const i = list.findIndex(t => t.value === tweaks.theme);
             const next = list[(i + 1) % list.length];
             if (next) setTweak("theme", next.value);
           }} />

      <div className="mt-section">data</div>
      <Row label="import JSON"     meta="›" onClick={onImport} />
      <Row label="AI prompt"        meta="›" onClick={onAIPrompt} />
      <Row label="export backup"    meta="›" onClick={onExport} />
      <Row label="load demo"        meta="›" onClick={onLoadDemo} />
      <Row label="reset"            meta="›" onClick={onReset} danger />

      <div className="mt-section">about</div>
      <Row label="about trunkline"  meta="›" onClick={onAbout} />
    </div>
  );
}
```

- [ ] **Step 3: Wire moreScreen state in App.jsx**

In `react-app/src/App.jsx`:

a) Add state next to mobileTab (right after `setMobileTab` declaration):

```jsx
const [moreScreen, setMoreScreen] = useState(null); // null | 'tags' | 'lanes' | 'insights' | 'log'
```

b) Reset `moreScreen` whenever `mobileTab` changes away from "more":

```jsx
useEffect(() => {
  if (mobileTab !== "more") setMoreScreen(null);
}, [mobileTab]);
```

c) Update the TopBar invocation to pass drill-in props when `mobileTab==="more" && moreScreen`:

Replace the TopBar block from Task 3 with:

```jsx
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
```

d) Update the MoreTab invocation in JSX to pass the new props:

```jsx
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
  /* …rest of existing ternary unchanged… */
```

- [ ] **Step 4: Add CSS for drill-in container**

Append to `react-app/src/styles.css`:

```css
@media (max-width: 768px) {
  .more-drill {
    height: 100%;
    overflow-y: auto;
    background: var(--bg);
    padding-bottom: calc(34px + env(safe-area-inset-bottom) + 12px);
  }
  .more-drill .rail-panel-body { padding-top: 4px; }
}
```

- [ ] **Step 5: Verify**

```
npm --prefix react-app run build
npm --prefix react-app run dev
```

At 360px:
- Tap More → tap "tags" → topbar swaps to back-arrow + "tags". Body shows the tag list with section dividers, totals, edit-tag, +new-tag form. Back-arrow returns to More list.
- Same for "lanes", "insights", "recent log".
- "lanes" panel still lets you add a new lane and edit existing ones.
- "insights" panel renders all insight cards.
- "recent log" shows nothing if `log` is empty (text "nothing logged yet · try the composer below").

- [ ] **Step 6: Commit**

```bash
git add react-app/src/components/RightRail.jsx react-app/src/components/MoreTab.jsx react-app/src/App.jsx react-app/src/styles.css
git commit -m "feat(mobile): MoreTab drill-ins for tags/lanes/insights/log

Reuses existing PanelTags/PanelLanes/PanelInsights/PanelLog components
from RightRail. Topbar swaps to back-arrow mode when a drill-in is
active. Returning to the More list clears moreScreen."
```

---

## Task 8: Extract ComposerForm from Composer

**Files:**
- Create: `react-app/src/components/ComposerForm.jsx`
- Modify: `react-app/src/components/Composer.jsx` (use ComposerForm internally; behavior unchanged)

This is a pure refactor. After this task, desktop must look and behave exactly as before.

- [ ] **Step 1: Create ComposerForm.jsx**

Write `react-app/src/components/ComposerForm.jsx`:

```jsx
// Shared form internals used by both the desktop anchored Composer and
// the mobile ComposerSheet. Owns: text input, dir toggle, when picker,
// tag select, quick-add chips, parse + submit logic.

import React, { useState, useRef, useEffect, useMemo } from "react";
import { fmtINR, fmtDateTime, isoLocal } from "../lib/format.js";
import TagSelect from "./TagSelect.jsx";

function deriveQuickAdd(entries, fallback) {
  const groups = new Map();
  for (const e of entries) {
    if (e.dir !== "out") continue;
    if (e.status === "future") continue;
    const label = (e.label || "").trim().toLowerCase();
    const tag = e.tags && e.tags[0];
    if (!label || !tag) continue;
    const key = label + "|" + tag;
    if (!groups.has(key)) groups.set(key, { label, tag, amounts: [] });
    groups.get(key).amounts.push(e.amount);
  }
  const ranked = [...groups.values()]
    .filter(g => g.amounts.length >= 2)
    .sort((a, b) => b.amounts.length - a.amounts.length)
    .slice(0, 6)
    .map(g => {
      const sorted = g.amounts.slice().sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      return { label: g.label, amount: Math.round(median), tag: g.tag, count: g.amounts.length };
    });
  if (ranked.length >= 3) return ranked;
  return fallback;
}

export default function ComposerForm({
  tweaks, onLog, config, tagById, now, onAddTag, entries,
  prefill, autoFocus = false, onSubmitted = null,
}) {
  const dynamicQuickAdd = useMemo(
    () => deriveQuickAdd(entries || [], config.quickAdd || []),
    [entries, config.quickAdd]
  );
  const [text, setText] = useState("");
  const [tag, setTag] = useState(config.tags[0]?.id || "chai");
  const [dir, setDir] = useState("out");
  const [whenISO, setWhenISO] = useState(isoLocal(now));
  const [whenOpen, setWhenOpen] = useState(false);
  const inputRef = useRef(null);
  const symbol = config.currencySymbol;

  const [pendingChip, setPendingChip] = useState(null);
  const [pendingAmount, setPendingAmount] = useState("");
  const pendingAmountRef = useRef(null);

  function parse(t) {
    const tokens = t.trim().split(/\s+/);
    const tags = [];
    const rest = [];
    for (const tok of tokens) {
      if (tok.startsWith("#") && tok.length > 1) tags.push(tok.slice(1).toLowerCase());
      else rest.push(tok);
    }
    if (!rest.length) return null;
    let amountIdx = -1;
    for (let i = rest.length - 1; i >= 0; i--) {
      if (/^\d+$/.test(rest[i])) { amountIdx = i; break; }
    }
    if (amountIdx === -1) return null;
    const amount = parseInt(rest[amountIdx], 10);
    const before = rest.slice(0, amountIdx).join(" ");
    const after  = rest.slice(amountIdx + 1).join(" ");
    return { label: before || "untitled", amount, note: after, tags };
  }

  const submit = (e) => {
    e && e.preventDefault();
    const parsed = parse(text);
    if (!parsed) return;
    const validTags = parsed.tags.filter(t => tagById[t]);
    const finalTags = validTags.length ? validTags : [tag];
    const when = new Date(whenISO).toISOString();
    onLog({ label: parsed.label, amount: parsed.amount, note: parsed.note, tags: finalTags, dir, when });
    setText("");
    setWhenISO(isoLocal(new Date()));
    inputRef.current && inputRef.current.focus();
    onSubmitted && onSubmitted();
  };

  const quickAdd = (q) => {
    setPendingChip(q);
    setPendingAmount(String(q.amount));
    setTimeout(() => {
      if (pendingAmountRef.current) {
        pendingAmountRef.current.focus();
        pendingAmountRef.current.select();
      }
    }, 0);
  };
  const cancelPending = () => { setPendingChip(null); setPendingAmount(""); };
  const submitPending = () => {
    if (!pendingChip) return;
    const amt = parseInt(pendingAmount, 10);
    if (!Number.isFinite(amt) || amt <= 0) return;
    onLog({
      label: pendingChip.label, amount: amt, note: "",
      tags: [pendingChip.tag], dir: "out", when: new Date().toISOString(),
    });
    cancelPending();
    onSubmitted && onSubmitted();
  };

  // Web Share Target prefill.
  useEffect(() => {
    if (!prefill || !prefill.text) return;
    setText(prefill.text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [prefill && prefill.at]);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  const whenDate = new Date(whenISO);
  const isFuture = whenDate.getTime() > now.getTime() + 60000;
  const isToday  = whenDate.toDateString() === now.toDateString();
  const whenSummary = isToday
    ? "today · " + String(whenDate.getHours()).padStart(2, "0") + ":" + String(whenDate.getMinutes()).padStart(2, "0")
    : fmtDateTime(whenDate);

  return (
    <>
      {pendingChip && (() => {
        const tobj = tagById[pendingChip.tag];
        return (
          <div className="quick-popup" role="dialog" aria-label="confirm quick add"
               style={{ borderColor: tobj ? `var(--b-${tobj.kind})` : undefined }}>
            <div className="qp-row">
              <span className="qp-label">{pendingChip.label}</span>
              <span className="qp-tag mono"
                    style={{ color: tobj ? `var(--b-${tobj.kind})` : "var(--ink-3)" }}>
                #{pendingChip.tag}
              </span>
            </div>
            <div className="qp-row">
              <span className="qp-prefix mono">{symbol}</span>
              <input
                ref={pendingAmountRef}
                type="number"
                inputMode="numeric"
                className="qp-amount mono"
                value={pendingAmount}
                onChange={e => setPendingAmount(e.target.value.replace(/[^\d]/g, ""))}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); submitPending(); }
                  if (e.key === "Escape") { e.preventDefault(); cancelPending(); }
                }}
              />
              <button type="button" className="qp-cancel" onClick={cancelPending}>cancel</button>
              <button type="button" className="qp-submit" onClick={submitPending}>add</button>
            </div>
          </div>
        );
      })()}

      <div className="chips">
        <span className="mono" style={{ color: "var(--ink-3)", padding: "5px 4px 5px 0" }}>quick:</span>
        {dynamicQuickAdd.map(q => {
          const tobj = tagById[q.tag];
          const isPending = pendingChip && pendingChip.label === q.label && pendingChip.tag === q.tag;
          return (
            <button key={q.label + "|" + q.tag}
                    className={`chip${isPending ? " pending" : ""}`}
                    onClick={() => quickAdd(q)}
                    title={q.count ? `used ${q.count}× · median amount` : undefined}
                    style={{ borderColor: tobj ? `var(--b-${tobj.kind})` : undefined }}>
              {q.emoji && <span>{q.emoji}</span>}
              <span>{q.label}</span>
              <span className="mono" style={{ color: tobj ? `var(--b-${tobj.kind})` : "var(--ink-3)", fontSize: 9 }}>#{q.tag}</span>
              <span className="amt">{fmtINR(q.amount, tweaks.locale, symbol)}</span>
            </button>
          );
        })}
      </div>

      <form className="composer-row" onSubmit={submit}>
        <span className="prompt">$ log</span>

        <div className="dir-toggle" role="group" aria-label="direction">
          <button type="button" className={dir === "out" ? "on" : ""} onClick={() => setDir("out")} aria-label="out">
            −<span className="dir-lbl">out</span>
          </button>
          <button type="button" className={dir === "in" ? "on" : ""} onClick={() => setDir("in")} aria-label="in">
            +<span className="dir-lbl">in</span>
          </button>
        </div>

        <div className="field">
          <span className="mono" style={{ color: "var(--ink-3)" }}>"</span>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder='chai 15 #chai   ·   uber 180 to office #transport   ·   swiggy 420 #food'
            spellCheck={false}
          />
          <span className="mono" style={{ color: "var(--ink-3)" }}>"</span>
        </div>

        <div className="when-wrap">
          <button type="button" className={`when-btn ${isFuture ? "future" : ""}`}
                  onClick={() => setWhenOpen(o => !o)} title="set datetime">
            <span className="mono" style={{ color: "var(--ink-3)", marginRight: 6 }}>at</span>
            {whenSummary}
          </button>
          {whenOpen && (
            <div className="when-pop">
              <input type="datetime-local" value={whenISO}
                     onChange={e => setWhenISO(e.target.value)}
                     style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "4px 6px", background: "var(--surface)", border: "1px solid var(--rule)", color: "var(--ink)", borderRadius: 3 }} />
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                <button type="button" className="when-quick" onClick={() => setWhenISO(isoLocal(new Date()))}>now</button>
                <button type="button" className="when-quick" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setWhenISO(isoLocal(d)); }}>yesterday</button>
                <button type="button" className="when-quick" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); setWhenISO(isoLocal(d)); }}>tomorrow</button>
                <button type="button" className="when-quick" style={{ marginLeft: "auto" }} onClick={() => setWhenOpen(false)}>done</button>
              </div>
            </div>
          )}
        </div>

        <TagSelect
          value={tag}
          onChange={setTag}
          allTags={config.tags}
          onCreate={onAddTag}
        />
        <button className="commit-btn" type="submit">add</button>
      </form>
    </>
  );
}

export { deriveQuickAdd };
```

- [ ] **Step 2: Slim down Composer.jsx to wrap ComposerForm**

Replace the contents of `react-app/src/components/Composer.jsx` with:

```jsx
// Desktop anchored composer. Hosts the legend (zoom controls + tooltips)
// and wraps the shared ComposerForm. The mobile equivalent is
// ComposerSheet, which also wraps ComposerForm but inside a bottom-sheet.

import React, { useEffect, useRef } from "react";
import ComposerForm from "./ComposerForm.jsx";

export default function Composer({
  tweaks, onLog, zoom, setZoom, config, tagById, now, onAddTag, entries,
  prefill,
}) {
  const formInputFocus = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      // Desktop-only ⌘K — gated by viewport so phones don't grab the key.
      if (typeof window !== "undefined" &&
          window.matchMedia("(max-width: 768px)").matches) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Re-focus the topmost text input inside the form.
        const inp = document.querySelector(".composer .field input");
        if (inp) inp.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="composer">
      <div className="legend">
        <span className="item"><span className="swatch solid"></span> already happened</span>
        <span className="item"><span className="swatch dashed"></span> upcoming</span>
        <span className="item">trunk width = balance</span>
        <span className="item">flow width ∝ amount</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "var(--ink-3)" }}>zoom</span>
          <button className="zoom-btn" onClick={() => setZoom(Math.max(0.5, +(zoom - 0.2).toFixed(2)))}>−</button>
          <input type="range" min="0.5" max="4" step="0.1" value={zoom}
                 onChange={e => setZoom(parseFloat(e.target.value))}
                 style={{ width: 100, accentColor: "var(--ink)" }} />
          <button className="zoom-btn" onClick={() => setZoom(Math.min(4, +(zoom + 0.2).toFixed(2)))}>+</button>
          <span className="mono" style={{ color: "var(--ink-2)", minWidth: 36, textAlign: "right" }}>{zoom.toFixed(1)}×</span>
        </span>
      </div>

      <ComposerForm
        tweaks={tweaks} onLog={onLog}
        config={config} tagById={tagById} now={now}
        onAddTag={onAddTag} entries={entries}
        prefill={prefill}
      />

      <div className="hint-row">
        <span className="hint">⌘K focus · ctrl-wheel zoom · scroll up = future · click an entry to edit</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify desktop is unchanged**

```
npm --prefix react-app run build
npm --prefix react-app run dev
```

At ≥1024px:
- Composer at the bottom looks identical to before — legend (4 items + zoom + slider), quick-chip row, form (dir / text / when / tag / add), hint row.
- ⌘K still focuses the input.
- Quick-chip flow still works (click chip → popup → enter amount → add).
- Manual entry still works (`chai 15 #chai`).
- Tag dropdown still works.

- [ ] **Step 4: Commit**

```bash
git add react-app/src/components/ComposerForm.jsx react-app/src/components/Composer.jsx
git commit -m "refactor(composer): extract ComposerForm shared subcomponent

Pure refactor — no behavior change on desktop. ComposerForm holds the
input/dir/when/tag/quick-chip logic so ComposerSheet can reuse it on
mobile. ⌘K listener gated by matchMedia (desktop only)."
```

---

## Task 9: ComposerSheet + FAB + hide anchored composer on mobile

**Files:**
- Create: `react-app/src/components/ComposerSheet.jsx`
- Create: `react-app/src/components/Fab.jsx`
- Modify: `react-app/src/App.jsx`
- Modify: `react-app/src/styles.css`

- [ ] **Step 1: Create ComposerSheet.jsx**

Write `react-app/src/components/ComposerSheet.jsx`:

```jsx
// Mobile-only bottom-sheet wrapping ComposerForm.
// - Slides up from the bottom when `open` flips true.
// - Dim backdrop closes on tap.
// - Drag the grab handle down >80px to dismiss.
// - Keyboard-aware via 100dvh + interactive-widget=resizes-content meta.

import React, { useEffect, useRef, useState } from "react";
import ComposerForm from "./ComposerForm.jsx";

export default function ComposerSheet({
  open, onClose,
  tweaks, onLog, config, tagById, now, onAddTag, entries, prefill,
}) {
  const sheetRef = useRef(null);
  const dragStartY = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (!open) setDragOffset(0);
  }, [open]);

  // Esc to close (works when a hardware keyboard is attached).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Drag handle: track touchstart/touchmove/touchend.
  const onGrabStart = (e) => {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartY.current = y;
  };
  const onGrabMove = (e) => {
    if (dragStartY.current == null) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = Math.max(0, y - dragStartY.current);
    setDragOffset(dy);
  };
  const onGrabEnd = () => {
    if (dragStartY.current == null) return;
    if (dragOffset > 80) onClose();
    else setDragOffset(0);
    dragStartY.current = null;
  };

  if (!open) return null;

  return (
    <div className="cs-root" role="dialog" aria-modal="true" aria-label="add entry">
      <div className="cs-backdrop" onClick={onClose} />
      <div className="cs-sheet" ref={sheetRef}
           style={{ transform: `translateY(${dragOffset}px)` }}>
        <div className="cs-grab"
             onTouchStart={onGrabStart}
             onTouchMove={onGrabMove}
             onTouchEnd={onGrabEnd}
             onMouseDown={onGrabStart}
             onMouseMove={dragStartY.current != null ? onGrabMove : undefined}
             onMouseUp={onGrabEnd}>
          <span className="cs-grab-bar" />
        </div>
        <div className="cs-body">
          <ComposerForm
            tweaks={tweaks} onLog={onLog}
            config={config} tagById={tagById} now={now}
            onAddTag={onAddTag} entries={entries}
            prefill={prefill}
            autoFocus
            onSubmitted={onClose}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Fab.jsx**

Write `react-app/src/components/Fab.jsx`:

```jsx
// Floating action button — phone-only.
// 40px visible, 44px hit area (8px transparent padding around the circle).
// Hidden when the More tab is active or the composer sheet is open.
// Scroll-aware visibility wired in Task 10.

import React from "react";

export default function Fab({ onClick, hidden = false }) {
  return (
    <button type="button"
            className={`fab-wrap${hidden ? " hidden" : ""}`}
            onClick={onClick}
            aria-label="add entry">
      <span className="fab">+</span>
    </button>
  );
}
```

- [ ] **Step 3: Append CSS**

At the bottom of `react-app/src/styles.css`:

```css
@media (max-width: 768px) {
  /* Hide the desktop anchored composer on phones — replaced by ComposerSheet. */
  .composer { display: none; }

  /* FAB */
  .fab-wrap {
    position: fixed;
    right: 8px;
    bottom: calc(38px + env(safe-area-inset-bottom));
    z-index: 35;
    width: 44px; height: 44px;
    padding: 2px;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: transform .18s ease, opacity .18s ease;
  }
  .fab-wrap.hidden {
    transform: translateY(72px);
    opacity: 0;
    pointer-events: none;
  }
  .fab-wrap .fab {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: var(--ink); color: var(--bg);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; line-height: 1;
    box-shadow: 0 4px 12px rgba(0,0,0,.28);
  }

  /* Composer sheet */
  .cs-root {
    position: fixed; inset: 0;
    z-index: 40;
    display: flex; flex-direction: column; justify-content: flex-end;
  }
  .cs-backdrop {
    position: absolute; inset: 0;
    background: rgba(0,0,0,.45);
    animation: cs-fade .18s ease;
  }
  .cs-sheet {
    position: relative;
    background: var(--bg);
    border-top: 1px solid var(--rule);
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -8px 24px rgba(0,0,0,.18);
    padding: 8px 12px calc(12px + env(safe-area-inset-bottom));
    max-height: 100dvh;
    animation: cs-rise .22s ease;
    transition: transform .14s ease;
  }
  .cs-grab {
    padding: 6px 0 8px;
    display: flex; justify-content: center;
    cursor: grab;
    touch-action: none;
  }
  .cs-grab-bar {
    width: 36px; height: 4px;
    border-radius: 2px;
    background: var(--rule);
  }
  .cs-body { display: flex; flex-direction: column; gap: 8px; }
  .cs-body .chips { gap: 4px; }
  .cs-body .composer-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      "dir field add"
      "tag tag tag"
      "when when when";
    gap: 6px;
  }
  .cs-body .composer-row .prompt { display: none; }
  .cs-body .composer-row .dir-toggle { grid-area: dir; }
  .cs-body .composer-row .field { grid-area: field; min-width: 0; }
  .cs-body .composer-row .commit-btn { grid-area: add; padding: 8px 12px; }
  .cs-body .composer-row .tag-select { grid-area: tag; min-width: 0; width: 100%; }
  .cs-body .composer-row .branch-select { grid-area: tag; min-width: 0; width: 100%; }
  .cs-body .composer-row .when-wrap { grid-area: when; }
  .cs-body .composer-row .when-btn { width: 100%; text-align: left; }

  @keyframes cs-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes cs-rise { from { transform: translateY(100%); } to { transform: translateY(0); } }
}
```

- [ ] **Step 4: Wire into App.jsx**

In `react-app/src/App.jsx`:

a) Add imports near the existing component imports:

```jsx
import ComposerSheet from "./components/ComposerSheet.jsx";
import Fab from "./components/Fab.jsx";
```

b) Add state next to mobileTab/moreScreen:

```jsx
const [composerSheetOpen, setComposerSheetOpen] = useState(false);
```

c) After the existing `<Composer …/>` block (around line 495), add:

```jsx
{isMobile && (
  <>
    <Fab
      onClick={() => setComposerSheetOpen(true)}
      hidden={mobileTab === "more" || composerSheetOpen}
    />
    <ComposerSheet
      open={composerSheetOpen}
      onClose={() => setComposerSheetOpen(false)}
      tweaks={tweaks}
      onLog={onLog}
      config={mergedConfig}
      tagById={tagById}
      now={now}
      onAddTag={addUserTag}
      entries={entries}
      prefill={composerPrefill}
    />
  </>
)}
```

(Leave the existing desktop `<Composer …/>` invocation in place. It is now hidden on mobile via `.composer { display: none }` in the CSS we just added.)

- [ ] **Step 5: Verify**

```
npm --prefix react-app run build
npm --prefix react-app run dev
```

At 360px:
- Anchored composer (legend + chips + form) is gone.
- A circular `+` FAB sits at the bottom-right above the bottom nav.
- Tap FAB → bottom sheet slides up. Sheet contains the quick-add chips and the form (dir / text / when / tag / add). Text input is auto-focused; on a real phone the keyboard rises and the sheet stays visible above it (verify on real device — desktop browsers don't show this).
- Tap the dark backdrop → sheet closes.
- Drag the grab handle down >80px → sheet closes.
- Submit a form entry → sheet closes; toast / new entry appears in graph or ledger as before.
- On More tab, FAB is hidden.
- At ≥769px: identical to before — anchored composer, no FAB, no sheet.

- [ ] **Step 6: Commit**

```bash
git add react-app/src/components/ComposerSheet.jsx react-app/src/components/Fab.jsx react-app/src/App.jsx react-app/src/styles.css
git commit -m "feat(mobile): FAB-triggered composer sheet replaces anchored composer

Sheet wraps the shared ComposerForm. Drag-to-dismiss, tap-outside-to-close,
keyboard-aware (100dvh + interactive-widget meta from Task 1). Anchored
composer hidden on phones. FAB hidden on More tab."
```

---

## Task 10: Scroll-aware FAB

**Files:**
- Create: `react-app/src/hooks/useScrollDirection.js`
- Modify: `react-app/src/components/Fab.jsx` (consume the hook)

- [ ] **Step 1: Create useScrollDirection.js**

Write `react-app/src/hooks/useScrollDirection.js`:

```js
// Tracks the direction of the most recent scroll.
// - Returns "up" or "down".
// - Threshold: 8px deltaY before changing direction (avoids flicker).
// - When the user stops scrolling for `idleMs`, direction reverts to "up"
//   so the FAB always reappears when content settles.

import { useEffect, useRef, useState } from "react";

export function useScrollDirection({ threshold = 8, idleMs = 220 } = {}) {
  const [dir, setDir] = useState("up");
  const lastY = useRef(typeof window !== "undefined" ? window.scrollY : 0);
  const lastDir = useRef("up");
  const idleTimer = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) < threshold) return;
      const next = delta > 0 ? "down" : "up";
      lastY.current = y;
      if (next !== lastDir.current) {
        lastDir.current = next;
        setDir(next);
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        lastDir.current = "up";
        setDir("up");
      }, idleMs);
    };

    // Listen on window AND on any element with [data-scroll-host]
    // (we mark .ledger and .more-tab as hosts so scrolling inside them
    // also drives the FAB).
    window.addEventListener("scroll", onScroll, { passive: true });
    const hosts = document.querySelectorAll("[data-scroll-host]");
    hosts.forEach(h => h.addEventListener("scroll", onScroll, { passive: true }));

    // Re-bind hosts when the DOM changes (e.g., switching tabs adds/removes them).
    const obs = new MutationObserver(() => {
      const next = document.querySelectorAll("[data-scroll-host]");
      next.forEach(h => h.addEventListener("scroll", onScroll, { passive: true }));
    });
    obs.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      hosts.forEach(h => h.removeEventListener("scroll", onScroll));
      obs.disconnect();
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [threshold, idleMs]);

  return dir;
}
```

- [ ] **Step 2: Mark scroll hosts in CSS / JSX**

Append to `react-app/src/styles.css`:

```css
@media (max-width: 768px) {
  .ledger { /* existing rule already in this file */ }
}
```

…and **add `data-scroll-host` attributes** in two places. Since these are React components, we modify the JSX:

a) In `react-app/src/components/LedgerView.jsx`, find the root `<div>` with `className="ledger"` (will be near the top of the returned JSX). Add `data-scroll-host` to it:

```jsx
<div className="ledger" data-scroll-host>
```

b) In `react-app/src/components/MoreTab.jsx`, change the list-view root `<div className="more-tab">` to include the attribute:

```jsx
<div className="more-tab" data-scroll-host>
```

Also change the drill-in container `<div className="more-drill">` to include it:

```jsx
<div className="more-drill" data-scroll-host>
```

(Three places in MoreTab.jsx — one for each `more-drill` literal you wrote in Task 7. There are four — tags, lanes, insights, log. Add the attribute to each. Search for `className="more-drill"` and replace with `className="more-drill" data-scroll-host`.)

- [ ] **Step 3: Consume the hook in Fab.jsx**

Replace `react-app/src/components/Fab.jsx` with:

```jsx
// Floating action button — phone-only.
// 40px visible, 44px hit area (transparent padding around the circle).
// Auto-hides when scrolling down; reappears on scroll-up or scroll-stop.

import React from "react";
import { useScrollDirection } from "../hooks/useScrollDirection.js";

export default function Fab({ onClick, hidden = false }) {
  const dir = useScrollDirection();
  const shouldHide = hidden || dir === "down";
  return (
    <button type="button"
            className={`fab-wrap${shouldHide ? " hidden" : ""}`}
            onClick={onClick}
            aria-label="add entry">
      <span className="fab">+</span>
    </button>
  );
}
```

- [ ] **Step 4: Verify**

```
npm --prefix react-app run build
npm --prefix react-app run dev
```

At 360px on the Ledger tab (which scrolls):
- Scroll down — FAB slides off screen.
- Scroll up — FAB reappears.
- Stop scrolling — FAB reappears within ~220ms.

On Graph tab: FAB is always visible (graph doesn't scroll).
On More tab list: scroll the list down — FAB stays hidden (already `hidden=true` because mobileTab==="more"); scroll up — still hidden (correct).
On More drill-in (e.g., tags): FAB stays hidden (mobileTab==="more").

- [ ] **Step 5: Commit**

```bash
git add react-app/src/hooks/useScrollDirection.js react-app/src/components/Fab.jsx react-app/src/components/LedgerView.jsx react-app/src/components/MoreTab.jsx react-app/src/styles.css
git commit -m "feat(mobile): scroll-aware FAB hides on scroll-down, returns on scroll-up

Listens to window + any element with [data-scroll-host]. Threshold 8px
deltaY, idle revert at 220ms. Marks .ledger, .more-tab, and .more-drill
as scroll hosts."
```

---

## Task 11: EditPanel full-screen on mobile

**Files:**
- Modify: `react-app/src/components/EditPanel.jsx`
- Modify: `react-app/src/styles.css`

- [ ] **Step 1: Read the existing EditPanel structure**

Open `react-app/src/components/EditPanel.jsx` and locate the returned JSX (starts around line 74). The structure is:

```jsx
<div className="edit-overlay" onClick={onClose}>
  <div className="edit-panel" onClick={e => e.stopPropagation()} onKeyDown={onKey}>
    <div className="ep-head">
      <div className="ep-id mono">{entry.id}</div>
      <div className="ep-title">edit entry</div>
      ...buttons (delete / cancel / save)...
    </div>
    <div className="ep-grid">
      ...rows of form fields...
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add a back-arrow button to ep-head**

In `react-app/src/components/EditPanel.jsx`, find the `<div className="ep-head">` block (around line 76) and add a back-button as the first child:

```jsx
<div className="ep-head">
  <button type="button"
          className="ep-back"
          onClick={onClose}
          aria-label="back">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  </button>
  <div className="ep-id mono">{entry.id}</div>
  <div className="ep-title">edit entry</div>
  {/* …existing buttons unchanged… */}
</div>
```

- [ ] **Step 3: Append mobile CSS**

At the bottom of `react-app/src/styles.css`:

```css
@media (max-width: 768px) {
  .edit-overlay {
    /* On mobile the overlay = the panel. No centered card; full-screen. */
    align-items: stretch;
    padding: 0;
    background: var(--bg);
  }
  .edit-panel {
    width: 100% !important;
    max-width: none !important;
    max-height: 100dvh !important;
    height: 100dvh;
    border-radius: 0;
    border: none;
    box-shadow: none;
    display: flex; flex-direction: column;
  }
  .ep-head {
    position: sticky; top: 0; z-index: 2;
    background: var(--bg-2);
    padding: 8px 10px;
  }
  .ep-back {
    background: var(--surface);
    border: 1px solid var(--rule);
    color: var(--ink-2);
    border-radius: 6px;
    width: 28px; height: 28px;
    display: inline-flex; align-items: center; justify-content: center;
    cursor: pointer;
  }
  .ep-back:hover { color: var(--ink); border-color: var(--ink-2); }
  .ep-grid {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 14px 14px calc(14px + env(safe-area-inset-bottom));
  }
}
```

The existing `.ep-back` button is desktop-hidden via:

```css
.ep-back { display: none; }
@media (max-width: 768px) { .ep-back { display: inline-flex; } }
```

Add this above the mobile block as a default rule (outside any media query). Place it near `.edit-panel` rules around line 758 in the existing CSS:

```css
.ep-back { display: none; }
```

(The mobile media query above flips it to `inline-flex`.)

- [ ] **Step 4: Verify**

```
npm --prefix react-app run build
npm --prefix react-app run dev
```

At 360px:
- Tap a graph entry or ledger row → EditPanel opens. Fills the whole screen, with a back-arrow at top-left, "edit entry" title, and the existing save/cancel/delete buttons on the right.
- Tap back-arrow → returns to the previous tab.
- Save still saves; delete still deletes (with undo toast); cancel still closes.
- Form fields scroll inside the panel if there are too many for one screen (recurring rules, etc.).

At ≥769px: identical centered overlay as before.

- [ ] **Step 5: Commit**

```bash
git add react-app/src/components/EditPanel.jsx react-app/src/styles.css
git commit -m "feat(mobile): EditPanel becomes full-screen modal on phones

Adds a back-arrow in the header (mobile-only). Form scrolls inside
the panel; existing save/delete/undo unchanged."
```

---

## Task 12: Wire ⌘K, PWA shortcut, Web Share Target on mobile + final polish

**Files:**
- Modify: `react-app/src/App.jsx`
- (Composer.jsx ⌘K already gated in Task 8; nothing to change there.)

- [ ] **Step 1: Open ComposerSheet for `?action=add` on mobile**

In `react-app/src/App.jsx`, locate the PWA shortcut handler effect (around lines 360–414). The relevant block currently dispatches a synthetic ⌘K event for `action === "add"`. Replace that branch:

```jsx
} else if (action === "add") {
  // Composer focuses itself when ⌘K is dispatched.
  setTimeout(() => {
    const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
    window.dispatchEvent(ev);
  }, 80);
  u.searchParams.delete("action");
  consumed = true;
}
```

with:

```jsx
} else if (action === "add") {
  if (typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches) {
    // Mobile — open the composer sheet directly.
    setComposerSheetOpen(true);
  } else {
    // Desktop — focus the anchored composer via the existing ⌘K handler.
    setTimeout(() => {
      const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
      window.dispatchEvent(ev);
    }, 80);
  }
  u.searchParams.delete("action");
  consumed = true;
}
```

- [ ] **Step 2: Open ComposerSheet on Web Share Target prefill on mobile**

In the same effect, find the "if (sharePieces.length)" block and add a mobile-aware sheet open after `setComposerPrefill(...)`:

```jsx
if (sharePieces.length) {
  setComposerPrefill({ text: sharePieces.join(" · "), at: Date.now() });
  if (typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches) {
    setComposerSheetOpen(true);
  }
  ["share_title", "share_text", "share_url"].forEach(k => u.searchParams.delete(k));
  consumed = true;
}
```

- [ ] **Step 3: Verify**

Build is the cheap check; the share/PWA flows need a real device. For now run:

```
npm --prefix react-app run build
npm --prefix react-app run dev
```

Then in the dev browser, manually paste these URLs into a 360px viewport and confirm behavior:

- `http://localhost:5173/?action=add` → composer sheet opens immediately.
- `http://localhost:5173/?share_text=chai+15+%23chai` → composer sheet opens with text "chai 15 #chai" pre-filled.
- `http://localhost:5173/?action=import` → import overlay opens (desktop behavior, unchanged).
- `http://localhost:5173/?view=ledger` → switches to ledger; bottom-nav active item is "ledger".

At ≥1024px:
- `?action=add` — anchored composer focuses (via the synthetic ⌘K, unchanged).

- [ ] **Step 4: Commit**

```bash
git add react-app/src/App.jsx
git commit -m "feat(mobile): PWA action=add and Web Share Target open the sheet on phones

Desktop still uses the ⌘K-synthesized focus path. Mobile detection via
matchMedia(max-width: 768px) — same gate as the rest of the shell."
```

---

## Task 13: Manual verification matrix + optional Playwright pass

This is the final gate before considering the phase complete. No code changes unless something fails.

- [ ] **Step 1: Manual matrix at 360px (DevTools device toolbar)**

Run `npm --prefix react-app run dev`. At 360px wide, walk through:

| # | Action                                              | Expected                                                    | ✅ |
|---|-----------------------------------------------------|-------------------------------------------------------------|---|
| 1 | Page loads on Graph tab                             | Topbar (☰ + trunkline + range chip), 4-stat strip, graph SVG, FAB, bottom nav |   |
| 2 | Tap Ledger in nav                                   | Stats strip disappears; ledger renders with filter chips    |   |
| 3 | Scroll ledger down                                  | FAB hides                                                   |   |
| 4 | Scroll ledger up                                    | FAB reappears                                               |   |
| 5 | Stop scrolling                                      | FAB reappears within ~220ms                                 |   |
| 6 | Tap a ledger row                                    | EditPanel opens full-screen with back-arrow                 |   |
| 7 | Tap back-arrow                                      | Returns to ledger                                           |   |
| 8 | Tap FAB                                             | Composer sheet slides up, input focused                     |   |
| 9 | Type "chai 15 #chai" + tap "add"                    | Sheet closes, entry appears, toast shows                    |   |
| 10| Reopen sheet → tap a quick-add chip                 | Quick-amount popup appears; submit logs entry               |   |
| 11| Reopen sheet → tap backdrop                         | Sheet closes                                                |   |
| 12| Tap More                                            | More tab list renders; FAB hidden; topbar title is "more"   |   |
| 13| Tap "tags" row                                      | Drill-in: topbar shows back-arrow + "tags"; tag list visible |   |
| 14| Edit a tag → save                                   | Tag updates; back-arrow returns to More list                |   |
| 15| Tap each of lanes / insights / recent log           | Drill-ins render; back works                                |   |
| 16| Tap "future entries"                                | Toggles show/hide                                           |   |
| 17| Tap "theme"                                         | Cycles paper → terminal → midnight                          |   |
| 18| Tap "about trunkline"                               | About overlay opens                                         |   |
| 19| Tap import / AI prompt / export / load demo / reset | Each fires the matching overlay or action                   |   |
| 20| Resize browser to 769px                             | Mobile shell collapses; desktop topbar/rail/composer return |   |
| 21| Resize to 768px                                     | Mobile shell returns                                        |   |

If any row fails, fix it before proceeding. Most fixes will land in a small follow-up commit on the relevant component.

- [ ] **Step 2: Optional Playwright verification**

Per the project's CLAUDE.md, before claiming a UI change works, ask Subhayu whether to drive the live UI through `playwright-skill`. If approved:

- Use the playwright-skill to script a 360px viewport visit.
- Wait for `tbody tr` (ledger) or the bottom nav buttons (graph) before asserting.
- Take screenshots of: graph + stats, ledger scrolled, sheet open with input focused, more tab list, more drill-in (tags), edit panel full-screen.
- If trunkline data is empty (fresh state), tap "load demo" first via the More tab.

If declined or skipped, skip this step. The manual matrix is the gate.

- [ ] **Step 3: Final no-op commit if everything passed**

If you found and fixed nothing, no commit is needed — the phase is complete. If you fixed something in Step 1, commit the fix:

```bash
git add <fixed files>
git commit -m "fix(mobile): <short description of what failed and was fixed>"
```

---

## Self-review (run before handoff)

**Spec coverage check** — every section of `docs/superpowers/specs/2026-05-09-mobile-ux-design.md`:

- §1 Goal — entire plan addresses this.
- §2 Non-goals — desktop unchanged: verified by every task's "≥769px: identical" verify step.
- §3 Approach — Tasks 2 (BottomNav), 9 (FAB+Sheet), 7 (More drill-ins), 11 (full-screen edit) cover all four moves.
- §4.1 Graph tab layout — Tasks 2, 3, 9.
- §4.2 Ledger tab — Tasks 2, 3 (rail off, scrollable), 9 (FAB).
- §4.3 More tab — Tasks 5, 6, 7.
- §4.4 Composer sheet — Tasks 8, 9.
- §4.5 Edit panel — Task 11.
- §5.1 App.jsx state — Tasks 2, 5, 7, 9.
- §5.2 TopBar mobile mode — Task 3, with drill-in mode wired in Task 7.
- §5.3 RightRail off + exports — Tasks 4, 7.
- §5.4 Composer split — Task 8.
- §5.5 EditPanel full-screen — Task 11.
- §5.6 BottomNav — Task 2.
- §5.7 MoreTab — Tasks 5, 6, 7.
- §5.8 FAB scroll-aware — Tasks 9, 10.
- §6 CSS / breakpoint — every task that touches styles.css; viewport meta in Task 1.
- §7 Behaviors — covered by relevant tasks; PWA/share specifically in Task 12.
- §8 State summary — Tasks 2, 5, 7, 9 add the three new state fields.
- §9 Testing — Tasks 6 and 13 hold the manual matrices; Task 13 offers Playwright.
- §10 Stats: 4-split — Task 3.
- §11 What's preserved — verified across the plan.
- §12 What's removed — verified across the plan; ⌘K gate in Task 8.

No gaps.

**Placeholder scan** — no "TBD" / "TODO" / "implement later" / "add appropriate error handling" / "similar to Task N" appear in the plan body.

**Type/name consistency check:**
- `mobileTab` used consistently across Tasks 2, 5, 7, 9.
- `composerSheetOpen` consistent across Tasks 9, 12.
- `moreScreen` consistent across Tasks 7, 12.
- `useIsMobile`, `useScrollDirection` named consistently between definition and import.
- `BottomNav`, `Fab`, `ComposerSheet`, `MoreTab`, `ComposerForm` — file names match component names.
- `data-scroll-host` attribute is the same in CSS reference (Task 10 hook scans for it) and JSX placement (Task 10 step 2).
- `.fab-wrap.hidden` class same between Fab.jsx and styles.css.
- `cs-root / cs-backdrop / cs-sheet / cs-grab / cs-grab-bar / cs-body` all paired between ComposerSheet.jsx and styles.css.

No inconsistencies found.
