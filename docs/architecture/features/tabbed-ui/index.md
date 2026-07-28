---
slug: tabbed-ui
design: planned
---

# Tabbed Single-Page UI

> Self-contained — a story reads this (+ folder-structure.md, + \_shared.md when noted), not other feature docs.

## Summary

Replaces the single-form demo UI with a richer single-page app that makes the full
deposit → play → cash-out → history round-trip tangible in the browser. A persistent
header holds the active player's MSISDN (stored in `localStorage`) and shows the live
wallet balance; a tab switcher hosts the four task-specific components. Its boundary:
this feature owns everything under `src/components/` and the composed `src/app/page.tsx`;
it calls the routes owned by [wallet-aware-mvola](../wallet-aware-mvola/index.md) and
[game-and-queries](../game-and-queries/index.md) but implements no server logic. It
supersedes [demo-ui](../demo-ui/index.md).

## Components

### `src/app/page.tsx` — Demo Page

- **Type:** React Server Component (renders the tabbed single-page layout)
- **Purpose:** Entry point for the demo UI
- **Responsibilities:** Render `WalletHeader` + `TabbedLayout` (which hosts `DepositForm`, `CoinFlipGame`, `CashOutForm`, `TransactionHistory`)
- **Depends on:** every component below

### `src/components/WalletHeader.tsx` — Wallet Header

- **Type:** React Client Component (`"use client"`)
- **Purpose:** Capture the active player MSISDN and display live wallet balance
- **Responsibilities:**
  - Input field for MSISDN, persisted to `localStorage` under `mvola-prof.msisdn`
  - Poll `GET /api/wallet/:msisdn/balance` every 2 seconds while an MSISDN is set
  - Broadcast the active MSISDN to sibling tab components (via React context or prop drilling)
- **Depends on:** [game-and-queries](../game-and-queries/index.md) balance route

### `src/components/TabbedLayout.tsx` — Tab Switcher

- **Type:** React Client Component (`"use client"`)
- **Purpose:** Host the four tabbed sections on a single page
- **Responsibilities:**
  - Render tab triggers: `Deposit`, `Play`, `Cash-out`, `History`
  - Mount the active tab's component and pass the current MSISDN down
  - Expose a "refresh balance" callback that child components call after successful actions
- **Depends on:** `WalletHeader` context

### `src/components/DepositForm.tsx` — Deposit Form

- **Type:** React Client Component (`"use client"`)
- **Purpose:** Initiate a deposit from the player's MVola account into the in-game wallet
- **Responsibilities:**
  - Capture form input (amount)
  - `POST /api/mvola/deposit` with `{ msisdn, amount }`
  - Poll `GET /api/mvola/status/{correlationId}` every 3 seconds until `completed` or `failed`
  - On `completed`, trigger a balance refresh on the header
- **Depends on:** [wallet-aware-mvola](../wallet-aware-mvola/index.md) deposit + status routes

### `src/components/CoinFlipGame.tsx` — Coin-Flip Game UI

- **Type:** React Client Component (`"use client"`)
- **Purpose:** Let the player bet from their wallet on a coin-flip outcome
- **Responsibilities:**
  - Capture bet amount and heads/tails choice
  - `POST /api/game/coinflip` with `{ msisdn, bet, choice }`
  - Display outcome with a short flip animation, win/loss banner, and new balance
  - Trigger a balance refresh on the header after each round
- **Depends on:** [game-and-queries](../game-and-queries/index.md) coinflip route

### `src/components/CashOutForm.tsx` — Cash-Out Form (refactor of `WithdrawForm`)

- **Type:** React Client Component (`"use client"`)
- **Purpose:** Cash the current in-game wallet balance back to the player's MVola account
- **Responsibilities:**
  - Capture amount (defaulting to full wallet balance, capped at balance)
  - `POST /api/mvola/withdraw` with `{ msisdn, amount }` — server validates wallet balance ≥ amount
  - Poll `GET /api/mvola/status/{correlationId}` every 3 seconds
  - On `failed`, display "wallet refunded" message
  - On `completed`, trigger balance refresh
- **Depends on:** [wallet-aware-mvola](../wallet-aware-mvola/index.md) withdraw + status routes

### `src/components/TransactionHistory.tsx` — History List

- **Type:** React Client Component (`"use client"`)
- **Purpose:** Show a chronological list of all transactions and game rounds for the current MSISDN
- **Responsibilities:**
  - `GET /api/wallet/:msisdn/history` on mount and on `refresh` callback
  - Render each entry with direction (deposit / withdraw / game), amount, status, timestamp
  - Distinguish `pending` / `completed` / `failed` visually
- **Depends on:** [game-and-queries](../game-and-queries/index.md) history route

## API

None owned. This feature consumes:

| Route | Owner |
|---|---|
| `POST /api/mvola/deposit` | [wallet-aware-mvola](../wallet-aware-mvola/index.md) |
| `POST /api/mvola/withdraw` | [wallet-aware-mvola](../wallet-aware-mvola/index.md) |
| `GET /api/mvola/status/[correlationId]` | [api-routes](../api-routes/index.md) |
| `POST /api/game/coinflip` | [game-and-queries](../game-and-queries/index.md) |
| `GET /api/wallet/[msisdn]/balance` | [game-and-queries](../game-and-queries/index.md) |
| `GET /api/wallet/[msisdn]/history` | [game-and-queries](../game-and-queries/index.md) |

## Data

Client-side React state only:

- `WalletHeader` tracks the active MSISDN (mirrored in `localStorage` under
  `mvola-prof.msisdn`) and polls the balance
- `DepositForm` / `CashOutForm` track `correlationId`, polling interval, and transaction status
- `CoinFlipGame` tracks the last outcome and flip animation state

Nothing persists server-side — see [state-store](../state-store/index.md).

## Flows

Polling cadence owned by this feature:

```
WalletHeader   → GET /api/wallet/:msisdn/balance          every 2s while MSISDN set
DepositForm    → GET /api/mvola/status/{correlationId}    every 3s until completed|failed
CashOutForm    → GET /api/mvola/status/{correlationId}    every 3s until completed|failed
CoinFlipGame   → no polling (synchronous round-trip)
TransactionHistory → GET /api/wallet/:msisdn/history      on mount + on refresh callback
```

The server-side round-trips these drive are documented as
[deposit (flow 4)](../wallet-aware-mvola/index.md#4-deposit-player--merchant-wallet-credited-on-confirmation),
[coin-flip (flow 5)](../game-and-queries/index.md#5-coin-flip-round-pure-no-mvola-call), and
[cash-out (flow 6)](../wallet-aware-mvola/index.md#6-cash-out-merchant--player-wallet-reserved-upfront-refunded-on-failure).

## Shared dependencies

- [Architecture diagram](../../_shared.md#architecture-diagram) — the browser layer
- [High-level request flow](../../_shared.md#high-level-request-flow)
- [Sandbox test numbers](../../_shared.md#sandbox-test-numbers)
- [dev-guide.md](../../dev-guide.md) — the full round-trip walkthrough
