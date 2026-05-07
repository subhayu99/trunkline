# trunkline · finance tracker

A direct React + Vite conversion of the original `app.jsx` / `graph.jsx` / `data.jsx` / `tweaks-panel.jsx` prototype. The visual design and behavior are preserved — only the build/architecture changed.

## What changed vs. the original

- **Build:** Babel-standalone CDN → Vite + ESM imports.
- **Data:** the random data generator inside `data.jsx` was run once with a deterministic seed and frozen into [`public/data.json`](public/data.json). That file is the single source of truth for the ledger.
- **Config:** all user-tunable knobs (tags, theme list, default tweaks, quick-add chips, insights, "now" anchor, currency, branch labels, graph constants) moved to [`public/config.json`](public/config.json).
- **Persistence:** tweak state survives reloads via `localStorage` (`trunkline.tweaks`); legacy `finance-tracker.tweaks` is auto-migrated on first load.
- **Tweaks panel:** the host-iframe protocol was dropped; toggle the panel with the gear button (bottom-right) or `⌘.` / `Ctrl+.`.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
```

## Editing data and config

Both `public/data.json` and `public/config.json` are loaded at runtime via `fetch`, so you can edit them and just refresh the page — no rebuild required.

### `public/data.json`

```jsonc
{
  "initialBalance": 7835,
  "entries": [
    {
      "id": "e1001",
      "when": "2026-01-01T04:30:00.000Z",
      "dir": "in",            // "in" | "out" | "merge"
      "amount": 178846,
      "tags": ["salary"],     // first tag is the primary kind
      "label": "salary credited",
      "note": "Acme Corp",
      "status": "past",       // recomputed at runtime against `config.now`
      "kind": "income",       // derived from primary tag
      "recur": {              // optional
        "freq": "month",      // "day" | "week" | "month" | "year"
        "every": 1,
        "count": 12           // OR "until": "<ISO datetime>"
      }
    }
  ]
}
```

To regenerate a fresh demo dataset from the original generator logic:

```bash
npm run regen-data
```

### `public/config.json`

| Key                     | Purpose                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `now`                   | ISO datetime used as "today". `null` = real `Date.now()`.                                    |
| `currencySymbol`        | Symbol used by `fmtINR` / `fmtCompact` (default `₹`).                                        |
| `defaults`              | Initial values for every tweak (theme, locale, zoom, range preset, etc.).                    |
| `themes`                | Allowed theme names — must match `[data-theme="…"]` selectors in `styles.css`.               |
| `vocabIntensities`      | `heavy` / `medium` / `light` labels for graph headers.                                       |
| `thicknessScales`       | `sqrt` / `linear` / `log`.                                                                   |
| `locales`               | Number-format choices shown in the tweaks panel.                                             |
| `rangePresets`          | Date-range chips in the top bar.                                                             |
| `branchKinds`           | Order of lanes in the graph.                                                                 |
| `branchLabels`          | Per-kind labels for `heavy` / `medium` / `light` vocab modes.                                |
| `tagGroups`             | Section headers in the left rail and the edit-panel tag picker.                              |
| `tags`                  | Master list of tags. Each `{ id, label, kind }`. The `kind` must appear in `branchKinds`.    |
| `quickAdd`              | Chips above the composer.                                                                    |
| `insights`              | Auto-cards in the right rail.                                                                |
| `graph.trunkMinWidth`   | Main (cash) trunk thickness floor (px).                                                      |
| `graph.trunkMaxWidth`   | Main (cash) trunk thickness ceiling (px).                                                    |
| `graph.laneTrunkMinWidth` | Per-lane accumulating-trunk floor (px). The visible "skeleton" before any entry lands.     |
| `graph.laneTrunkMaxWidth` | Per-lane accumulating-trunk ceiling (px). The largest cumulative-lane total maps here.     |
| `graph.flowMinWidth`    | Flow stroke floor (px). The smallest amount maps here.                                       |
| `graph.flowMaxWidth`    | Flow stroke ceiling (px). The largest amount in the dataset maps here.                       |
| `graph.initialDaysInViewport` | Days that fit the viewport at zoom = 1.                                                |
| `graph.horizonYears`    | Cap for unbounded recurring entries.                                                         |

## Project layout

```
react-app/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   ├── config.json
│   └── data.json
├── scripts/
│   └── generate-data.mjs
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles.css
    ├── hooks/
    │   └── useConfigAndData.js
    ├── lib/
    │   ├── data.js     · running balance, materialize recurring, status
    │   ├── format.js   · fmtINR, fmtCompact, fmtDateShort, …
    │   └── range.js    · rangeFromPreset
    └── components/
        ├── Composer.jsx
        ├── EditPanel.jsx
        ├── MoneyGraph.jsx
        ├── RangeChip.jsx
        ├── RightRail.jsx
        ├── TagRail.jsx
        ├── ThemeToggle.jsx
        ├── TopBar.jsx
        └── tweaks/
            └── TweaksPanel.jsx
```

## Keyboard shortcuts

| Shortcut          | Action                                |
| ----------------- | ------------------------------------- |
| `⌘K` / `Ctrl+K`   | Focus the composer                    |
| `⌘.` / `Ctrl+.`   | Toggle the tweaks panel               |
| `Ctrl + wheel`    | Zoom the graph vertically             |
| `⌘↵` (in editor)  | Save the entry being edited           |
| `Esc` (in editor) | Cancel the edit                       |
