<div align="center">
  <img src="react-app/docs/wordmark.svg" alt="trunkline" width="420" />
  <br/>
  <br/>
  <em>A trunk-and-branches finance tracker. Local-first, no server, no account.</em>
</div>

---

trunkline is a single-page finance tracker that visualizes cash flow as a vertical "trunk" of running balance over time, with horizontal "branches" representing income, fixed costs, day-to-day spending, credit cards, loans, and savings. It's a personal git-graph for your money.

- 📈 **Two views** — git-styled trunk-and-branches graph + a plain ledger.
- 🏷 **Tags + lanes** you can edit, recolor, and re-side.
- 🔁 **Recurring entries** materialise as projected future flows.
- 🤖 **AI prompt → JSON** — paste a bank statement into ChatGPT/Claude/Gemini, get back a ledger.
- 📥 **Import / export** as JSON. Web Share Target to drop SMS/email payment alerts straight into the composer.
- 💾 **Local-first** — all data lives in your browser's localStorage. No server, no account.
- 📲 **PWA** — install on phone, with home-screen quick actions for "Add entry", "Ledger view", "This month", "Export backup".

## Getting started

```bash
cd react-app
npm install
npm run dev          # http://localhost:5173
npm run build        # production bundle in dist/
```

## Deploy

A GitHub Actions workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) auto-builds and publishes to GitHub Pages on every push to `main`. Enable it in repo **Settings → Pages → Source = GitHub Actions**.

## Docs

- [`react-app/README.md`](react-app/README.md) — full app docs, file layout, config keys, schema.
- [`react-app/docs/MULTI-ACCOUNT-PLAN.md`](react-app/docs/MULTI-ACCOUNT-PLAN.md) — design plan for multi-account support.

## License

MIT.
