# Mobile UX redesign

**Date:** 2026-05-09
**Status:** approved
**Scope:** trunkline at viewports ≤768px

---

## 1. Goal

Make trunkline feel native on phones. The phone is co-equal with desktop and used for all three modes equally — quick logging, glancing at health, drilling into the ledger. The current mobile experience is a desktop layout squeezed into a phone: a 6-control topbar that wraps onto two lines, a horizontally-scrolling stats strip that hides half the KPIs off-screen, a persistent right rail that eats up to 50% of screen width when expanded, an always-pinned 3-row composer that gets covered by the iOS keyboard. We rebuild the mobile shell around the way phones actually work.

## 2. Non-goals

- Desktop layout stays untouched. Same components, just gated by `@media (min-width: 769px)`.
- No changes to data model, ledger storage, recurring entry materialization, AI prompt, import/export logic.
- No changes to the graph rendering itself (`MoneyGraph.jsx`'s SVG output) — only the surrounding chrome.
- No new dependencies. This is a CSS + JSX restructure on existing React/Vite.

## 3. Approach in one sentence

A bottom-tab shell (Graph / Ledger / More) replaces the desktop topbar+rail+anchored-composer combo on phones. The composer becomes a FAB-triggered bottom sheet. The right rail's four panels (tags, lanes, insights, log) become drill-in destinations from the More tab. Edit panel becomes full-screen.

## 4. Layout (≤768px)

### 4.1 Graph tab (default)

```
┌────────────────────────────┐
│ ☰  trunkline   last 30d ▾ │  ~36px topbar
├────────────────────────────┤
│ income committed extras balance │  ~32px stats strip (4 KPIs, no scroll)
│ +₹62k  −₹54k  −₹9k  ₹37k        │
├────────────────────────────┤
│                            │
│                            │
│         GRAPH (SVG)        │  remainder of viewport
│         full width         │
│                            │            (+) ← FAB 40px
│                            │
├────────────────────────────┤
│  📈    📋    ⋯              │  ~34px bottom nav
│ graph ledger more          │
└────────────────────────────┘
```

### 4.2 Ledger tab

```
┌────────────────────────────┐
│ ☰  trunkline   last 30d ▾ │
├────────────────────────────┤
│ [all] [in] [out] [future]  │  filter chips toolbar (existing)
├────────────────────────────┤
│ Mon · 6 May                │
│ chai   #chai     −₹15      │
│ swiggy #food    −₹420      │
│ uber   #transp  −₹180      │
│ Sun · 5 May                │
│ ...                        │            (+)
│                            │
├────────────────────────────┤
│  📈    📋    ⋯              │
└────────────────────────────┘
```

### 4.3 More tab

```
┌────────────────────────────┐
│ ☰  more                    │  no range chip on More
├────────────────────────────┤
│ BROWSE                     │
│ tags                12  ›  │
│ lanes                7  ›  │
│ insights             3  ›  │
│ recent log          12  ›  │
│ VIEW                       │
│ future entries     [show]  │
│ theme           [paper ☀]  │
│ DATA                       │
│ import JSON           ›    │
│ AI prompt             ›    │
│ export backup         ›    │
│ load demo             ›    │
│ reset                 ›    │
│ ABOUT                      │
│ about trunkline       ›    │
├────────────────────────────┤
│  📈    📋    ⋯              │
└────────────────────────────┘
```

### 4.4 Composer sheet (FAB tapped, on Graph or Ledger)

```
┌────────────────────────────┐
│ ☰  trunkline   last 30d ▾ │  topbar still visible
├────────────────────────────┤
│ ░░░░░░░░░░░░░░░░░░░░░░░░░ │  dim backdrop over body
│ ░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ┌────────────────────────┐ │  bottom sheet (rounded top)
│ │       ──── grab        │ │
│ │ "chai 15 #chai_______" │ │  text input (focused, keyboard up)
│ │ quick: [chai 15] [u..] │ │  quick chips
│ │ [-][+]  today 14:30  add│ │  dir / when / submit
│ └────────────────────────┘ │
└────────────────────────────┘
   (bottom nav hidden behind sheet)
```

### 4.5 Edit panel (entry tapped)

Full-screen modal that slides up from bottom. Same form structure as desktop EditPanel, fills the viewport. Topbar of the modal: back-arrow on the left, "edit entry" title, save action on the right. Dismissed by the back-arrow or hardware back gesture.

## 5. Component changes

### 5.1 `App.jsx`

- New local state: `mobileTab: 'graph' | 'ledger' | 'more'`. On viewport ≤768px, this drives which screen renders. Mirrors `tweaks.viewMode` for the `'graph' | 'ledger'` cases (so the desktop view-toggle still works and a desktop user resizing down lands on the same view).
- New local state: `composerSheetOpen: boolean`. FAB tap → `setComposerSheetOpen(true)`.
- New local state: `moreScreen: null | 'tags' | 'lanes' | 'insights' | 'log'`. When non-null on More tab, renders the corresponding rail panel as a full-screen drill-in.
- Web Share Target / `?action=add` PWA shortcut: if mobile, opens the sheet directly instead of focusing the anchored composer.
- ⌘K listener gated by `window.matchMedia('(min-width: 769px)').matches`.

### 5.2 `TopBar.jsx`

- Mobile, normal mode: `{hamburger, title="trunkline", RangeChip}`. Drop `ViewToggle`, `FutureToggle`, `ThemeToggle` (those move to More).
- Mobile, More tab: `{hamburger, title="more"}`. RangeChip hidden (range scoping doesn't apply on More).
- Mobile, More drill-in (tags / lanes / insights / log): `{back-arrow, title=<section name>}`. Back-arrow clears `moreScreen` state.
- Mobile, EditPanel open: that panel renders its own topbar (see §5.5); base topbar unaffected (it's behind the modal).
- Stats strip: 4 stats on mobile (income / committed / extras / balance). No horizontal scroll — fits at 360px via tighter gap (10–12px) and slightly smaller value font (11–12px). Renders only when `mobileTab === 'graph'` and no drill-in is active. Drops `opening` from the desktop 5-stat strip; the rest are preserved.
- Stats hidden when `mobileTab === 'ledger'` (ledger has its own toolbar) and `mobileTab === 'more'`.
- Desktop renders the existing 5-stat strip + all toggles unchanged.

### 5.3 `RightRail.jsx`

- Mobile: not rendered at all. App.jsx skips `<RightRail>` when ≤768px.
- The four panel implementations (`PanelTags`, `PanelLanes`, `PanelInsights`, `PanelLog`) are exported and reused inside More tab drill-in screens.
- Desktop: unchanged.

### 5.4 `Composer.jsx` → split

- Existing `Composer` becomes the desktop anchored variant (unchanged).
- New `ComposerSheet.jsx` reuses the same form internals (extract a `<ComposerForm>` shared subcomponent containing the input + dir toggle + when picker + tag select + quick chips + parse/submit logic).
- `ComposerSheet` adds: backdrop, grab handle, slide-up animation, dismiss-on-tap-outside, dismiss-on-swipe-down, keyboard-aware positioning (using `100dvh` and `interactive-widget=resizes-content` viewport meta).
- Desktop renders `<Composer>`. Mobile renders `<ComposerSheet open={composerSheetOpen} onClose={...}>`.

### 5.5 `EditPanel.jsx`

- Mobile: full-screen modal (`position: fixed; inset: 0`), slides up from bottom. Internal topbar: back-arrow (left) + "edit entry" title + save action (right). Existing delete-with-undo affordance stays inside the form. Dismissed via back-arrow or browser back gesture (`history.back()` integration optional, can be a follow-up).
- Desktop: unchanged (centered overlay).
- Single component, CSS-gated.

### 5.6 New: `BottomNav.jsx`

- 3 items: Graph (📈), Ledger (📋), More (⋯). Each ~`flex: 1` so they're evenly spaced.
- Height ~34px. Padding `7px 0 6px`. Icon 18px, label 8px. Active state: small accent bar (2px, ~24% width) at the very bottom of the active item; label and icon shift to `--ink`.
- `position: fixed; bottom: 0; left: 0; right: 0;` with `padding-bottom: env(safe-area-inset-bottom)` for notched phones.
- Hidden ≥769px.
- Hidden when `composerSheetOpen` (sheet covers it visually anyway, but explicit display:none avoids stacking glitches).

### 5.7 New: `MoreTab.jsx`

Extracted into its own file to keep `App.jsx` from growing.

Renders the More tab content per §4.3. Each row tap either:
- Sets `moreScreen` (for tags/lanes/insights/log → drill-in).
- Toggles a `tweaks` value (for future, theme).
- Opens an existing overlay (`setOverlay('import' | 'aiprompt' | 'about')`).
- Triggers an action (`onExport`, `onLoadDemo`, `onReset`).

Drill-in screens render the corresponding rail panel filling the viewport, with a back button in the topbar that clears `moreScreen`.

### 5.8 New: `Fab.jsx`

- 40×40px visible, 44×44px hit area (transparent padding).
- `position: fixed; right: 12px; bottom: 46px;` (sits 12px above the bottom nav).
- `padding-bottom: env(safe-area-inset-bottom)` on the wrapper.
- Hidden when `mobileTab === 'more'`.
- **Scroll-aware visibility**: hides when the active tab's content is being scrolled down, reappears when scrolling up or when scroll stops. Implementation: `useScrollDirection()` hook listens to scroll on the active tab's scrollable container (`window` for graph if it scrolls, `.lg` element for ledger). Threshold: 8px deltaY before changing direction (avoids flicker). On scroll-end (`scrollend` event with rAF debounce), revert to visible.
- Icon: `+`.
- Tap: `setComposerSheetOpen(true)`.

## 6. CSS / breakpoint strategy

- Single breakpoint: `@media (max-width: 768px)`.
- Existing media queries at 768px and 480px stay; we add new mobile-specific rules in the same blocks.
- The `body { overflow: hidden }` rule needs revisiting on mobile so the ledger/more can scroll. Solution: `.app` keeps full-viewport grid, but `.app[data-mobile-tab="ledger"] .main` and `.app[data-mobile-tab="more"] .main` set `overflow-y: auto`.
- `.main` grid stops being `1fr 36px` on mobile — becomes a single column without the rail track.
- `.composer` (desktop bottom-anchored) gets `display: none` on mobile.
- `.bottom-nav` and `.fab-wrap` get `display: none` on desktop.
- `react-app/index.html` viewport meta becomes `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">` so iOS/Android keyboards resize the layout instead of overlaying it (lets the sheet stay above the keyboard).

## 7. Behaviors

- **Tap entry in graph or ledger** → opens full-screen `EditPanel` (mobile) or centered overlay (desktop).
- **Tap row in ledger** → opens `EditPanel`.
- **FAB scroll-aware rule**: hide on scroll-down (>8px deltaY), show on scroll-up or scroll-stop. Always shown when the scrollable content is at the top.
- **iOS keyboard with sheet open**: sheet uses `100dvh` so it shrinks correctly when the keyboard appears. `<meta name="viewport" content="..., interactive-widget=resizes-content">` ensures the layout adapts.
- **Web Share Target** (`share_title`/`share_text`/`share_url` query params): on mobile, opens `ComposerSheet` with prefill. On desktop, focuses anchored composer (existing behavior).
- **PWA shortcut `?action=add`**: opens `ComposerSheet` on mobile, focuses anchored composer on desktop.
- **PWA shortcut `?view=ledger`**: switches `mobileTab` (and `tweaks.viewMode`) to ledger.
- **Hamburger menu**: still available on mobile from the topbar. Items it triggers (import/AI/export/demo/reset/about) overlap with More tab items — keep both entry points, redundancy is fine.
- **Swipe-down on sheet** (drag the grab handle below ~80px) closes the sheet.
- **Tap-outside on sheet backdrop** closes the sheet.
- **Desktop resize down to mobile**: state migrates cleanly. `tweaks.viewMode === 'graph'` → `mobileTab = 'graph'`. Open right rail panel just disappears (no migration needed; data is in More now).

## 8. State summary

Existing state (unchanged):
- `tweaks.viewMode: 'graph' | 'ledger'` — synced to mobile bottom-nav.
- `tweaks.theme`, `tweaks.showFuture`, etc.
- `overlay`, `editing`, `toast`.

New mobile-only state in `App.jsx`:
- `mobileTab: 'graph' | 'ledger' | 'more'` — local React state, not persisted.
- `composerSheetOpen: boolean`.
- `moreScreen: null | 'tags' | 'lanes' | 'insights' | 'log'`.

Why local-only: these are ephemeral phone-shell state that resets on reload. Persisting "I was in More" across reloads adds noise.

## 9. Testing

- Manual: 360px (small phone), 414px (large phone), 768px (boundary), 769px (desktop side of boundary).
- iOS Safari real device: keyboard + sheet interaction, safe-area-inset on notched models, swipe-down to dismiss.
- Android Chrome: same.
- Verify Web Share Target still works (paste `?share_text=...` URL).
- Verify PWA shortcuts (manifest's `shortcuts` array).
- Verify all four More tab drill-ins render correctly and back-out clears state.
- Verify FAB scroll-aware doesn't flicker.

## 10. Resolved decisions

- **Stats**: 4 stats — income / committed / extras / balance. Drops `opening` (still visible in desktop's 5-stat strip). Keeps committed and extras separate so the user can read "am I overspending on chai vs. just hitting fixed bills?" at a glance.

## 11. What's preserved

Things that exist today and stay reachable on mobile:
- All existing entry editing (full-screen on phone).
- Tag and lane management (in More → drill-in).
- Insights (in More → drill-in).
- Recent log (in More → drill-in).
- Theme switching (in More).
- Future entries toggle (in More).
- Range chip / range presets / custom range (topbar).
- Hamburger items: export, import, AI prompt, demo, reset, about (in both hamburger menu and More — redundant but no harm).
- Web Share Target.
- PWA shortcuts.
- Quick-add chips (inside the composer sheet).
- Click-to-edit on graph entries (desktop) and ledger rows (mobile).

## 12. What's removed on mobile

- View toggle (replaced by bottom-nav Graph/Ledger items).
- Future toggle in topbar (moved to More).
- Theme toggle in topbar (moved to More).
- Persistent right-rail icon strip (replaced by More tab).
- Persistent right-rail panel when expanded.
- Always-anchored composer footer (replaced by FAB-triggered sheet).
- Composer legend ("trunk width = balance, etc.") — informational, fits better on desktop or in About.
- ⌘K keyboard handler.
- Composer hint row.

---

## Implementation note (out of scope for this spec)

Implementation order, file-by-file diff, test plan with concrete commands — handled by the writing-plans phase that follows spec approval.
