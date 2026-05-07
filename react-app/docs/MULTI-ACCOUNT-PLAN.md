# Multi-account support — design plan

> Living doc. Nothing here is implemented yet; this captures the agreed-on
> shape so a future session can pick it up without re-deriving the design.

## Concept

An **account** is a logical container for money. It has its own identity
(name, color/icon), its own opening balance, and its own running balance
that's the sum of all entries that point at it.

There are two **shapes** of account, distinguished by what "balance going up"
means:

| Shape          | Balance behavior                                     | Examples                              |
| -------------- | ---------------------------------------------------- | ------------------------------------- |
| **Deposit**    | Starts at the opening balance, **`in` adds**, **`out` subtracts**. Balance is the money you actually own there. | Cash on hand · Savings/Checking accounts · Wallets · Investment accounts (when treated as one number) |
| **Liability**  | Starts at the opening *debt* (often 0), **`out` adds to what you owe**, **`in`/`merge` reduces the debt**. Balance represents what you *owe*, not what you *have*. | Credit cards · Personal loans · BNPL · Any rolling-debt instrument |

Internally both shapes use the same fields — they just interpret the running
sum with opposite sign. The shape is just metadata so the UI can label things
correctly ("balance" vs "owed", "available credit", etc.).

## Data model

Extends the existing ledger snapshot. Backwards-compatible: any entry without
an `account` field is assumed to belong to a default `cash` account that's
auto-created on migration.

```jsonc
{
  "version": 2,
  "initialBalance": 7835,           // legacy — kept for migration only
  "accounts": [
    {
      "id": "cash",
      "label": "Cash on hand",
      "shape": "deposit",
      "openingBalance": 7835,
      "currency": "INR",            // optional, defaults to config.currencySymbol
      "color": "oklch(0.85 0.04 130)",
      "icon": "💵",                 // optional
      "creditLimit": null,          // only meaningful for liability shape
      "archived": false
    },
    {
      "id": "hdfc-sav",
      "label": "HDFC Savings",
      "shape": "deposit",
      "openingBalance": 200000
    },
    {
      "id": "hdfc-cc",
      "label": "HDFC Credit Card",
      "shape": "liability",
      "openingBalance": 0,
      "creditLimit": 250000          // optional, used to show "available credit"
    },
    {
      "id": "icici-pl",
      "label": "ICICI Personal Loan",
      "shape": "liability",
      "openingBalance": 480000       // outstanding principal at start of tracking
    }
  ],
  "entries": [
    {
      "id": "e1",
      "when": "2026-05-08T10:00:00Z",
      "dir": "out",
      "amount": 2100,
      "tags": ["cc-hdfc", "shopping"],
      "label": "amazon · headphones",
      "account": "hdfc-cc",          // ← NEW
      "transferId": null              // ← NEW, see transfers below
    }
  ]
}
```

### Migration v1 → v2

On first load with v1 data:

1. Create a single `cash` account: `{ id: "cash", label: "Cash on hand", shape: "deposit", openingBalance: <v1.initialBalance> }`.
2. Tag every entry with `account: "cash"`.
3. Drop the top-level `initialBalance` field (or keep for safety; ignored by v2 readers).
4. Bump `version` to `2`.

Old export files still import cleanly under the same path.

## Transfers

A transfer is two paired entries — they always move together:

```jsonc
{ "id": "e_t1a", "when": "...", "dir": "out", "amount": 50000,
  "account": "hdfc-sav",  "transferId": "t_2026-05-08-1",
  "label": "transfer to cash", "tags": ["transfer"] },

{ "id": "e_t1b", "when": "...", "dir": "in",  "amount": 50000,
  "account": "cash",      "transferId": "t_2026-05-08-1",
  "label": "transfer from HDFC Savings", "tags": ["transfer"] }
```

- The composer gets a third dir-mode (alongside `−out` / `+in`): **`⇄ transfer`**, which expands to two account pickers (from / to) and one amount.
- Editing or deleting one half of a transfer prompts whether to update both halves; the default behavior is "keep them in sync" (edit/delete propagates to the linked entry).
- Transfers never count as income or expense in the stats — they net to zero. The graph should not draw a flow path for transfers (or should draw a quiet, neutral grey one between the two account-trunks).

### Liability "merge" entries — natural pairing

A credit-card auto-pay (currently a single `merge` entry) is really a transfer:
the same amount leaves the linked savings account and reduces the card's
outstanding. After this proposal lands, those entries should migrate to the
transfer model:

- old: `{ dir: "merge", amount: 2100, tags: ["cc-hdfc"] }`
- new: a transfer pair from `hdfc-sav` (`out`) to `hdfc-cc` (`in`, which on a
  liability account reduces what's owed).

The `merge` dir can be kept as a UX shortcut that creates a transfer pair under the hood.

## UI surface

### Right-rail panels

Add a 4th icon in the VS-Code-style strip: **Accounts**. Clicking opens an
accounts panel with one row per account showing:

- account name + shape badge ("DEPOSIT" / "LIABILITY")
- current balance (or "owed" for liabilities) — color-coded (green positive, red overdrawn)
- secondary line: "available credit ₹X" for liabilities with a `creditLimit`
- click row → filter the rest of the app to just this account (chip in topbar reflects it)
- right-side actions: edit, archive, delete

A **+ new account** button at the bottom opens a small inline form: label,
shape (deposit/liability), opening balance, optional credit limit and color.

### Topbar — account filter

A new **account chip** between the range chip and the view toggle:

> `[ Cash · ₹86k ]` (with the active account's color as the chip's accent)

Clicking opens a dropdown of accounts plus an "All accounts" option. Behavior:

- **Single account selected:** chart trunk is *that account's* balance over time. Stats reflect that account only.
- **All accounts:** the trunk is the sum of all deposit-account balances. Liability accounts are drawn as their own (separate) trunks/lanes — see below.

### Graph view

Two questions: where does each account go, and how is the trunk drawn?

- **Deposit accounts** all share the central "main" lane. With one selected, the trunk is that account's balance. With all selected, the trunk is the sum (current behavior, just generalised).
- **Liability accounts** become their own lanes alongside the existing kind-lanes. The trunk for a liability account *grows downward* (or just visually flips its colour) as you owe more — different shape from a deposit trunk.
- An optional toggle "show one trunk per deposit account" lets the user split the central trunk into one trunk per deposit account, side-by-side. Useful for visualising the rebalancing flows between accounts.

### Composer — account picker

A small chip next to the dir-toggle showing the active account. Click → dropdown
of accounts. Defaults to the last-used account for that direction.

For the **transfer mode** specifically, the chip splits into two: `from →
to` so the user can pick both accounts inline.

### Edit panel

Add an **account** row alongside `direction` / `when` / `tags`. For a transfer
half, also show a "linked entry" link that opens the other half.

## Stats / insights / lane totals

All existing stats are now scoped by the account filter:

- "income · in range" → income credited to the selected account(s)
- "committed", "extras", etc. → flows out of the selected account(s)
- "closing balance" → that account's balance at range end
- the right-rail tag totals respect the filter too

When **all accounts** are selected, the existing aggregation works unchanged.

The `extras burn rate` insight gains nuance: it can compare **per-account**
spend rates and call out the noisier account. Skip for now, layer in later.

## Edge cases / open questions

- **Multi-currency.** Out of scope for v2. Each account keeps its `currency`
  field; the app pretends everything is one currency (the config's
  `currencySymbol`). When/if multi-currency is needed, a per-account locale
  formatter swaps in.
- **Account archive vs delete.** Deleting an account with entries is destructive;
  archive (hide from pickers, keep entries intact) is the safer default.
- **Initial-balance edits.** Changing `openingBalance` retroactively affects
  every running-balance calculation. Treat it as an explicit user action, not
  something we silently re-anchor.
- **Liability "available credit" breach.** If `currentDebt > creditLimit`, just
  show a red chip; don't prevent the entry. Banks themselves enforce that.
- **Backward-compat exports.** v2 exports include the `accounts` array. v1
  importers (older forks of this app) will fail. Add a top-level
  `"version": 2` so old code can detect the mismatch and warn.

## Effort estimate

| Phase                                      | ~Effort |
| ------------------------------------------ | ------- |
| Schema migration + persistence updates     | small   |
| Account picker in composer + dir=transfer  | medium  |
| Right-rail Accounts panel + add/edit form  | medium  |
| Topbar account filter chip                 | small   |
| Graph: per-account trunk, liability lanes  | medium  |
| Edit panel changes (account row + linked)  | small   |
| Insights revisit (per-account aware)       | small   |

Total: ~half-day to a day of focused work, plus the data-model migration which is the part most worth getting right on the first pass.

## Order to implement

1. Schema migration + accounts in ledger envelope (no UI yet)
2. Composer account picker (single mode)
3. Right-rail Accounts panel
4. Topbar account filter
5. Transfer mode (composer + edit panel + entry rendering)
6. Liability accounts in graph
7. Insights tweaks
