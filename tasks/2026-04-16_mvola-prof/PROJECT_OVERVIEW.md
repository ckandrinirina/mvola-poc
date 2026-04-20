# Project Overview: mvola-prof

> **2026-04-20 update:** The project scope was extended beyond a single-direction withdrawal PoC. It now demonstrates a realistic round-trip: deposit via MVola → play a simulated coin-flip game against an in-game wallet → cash out remaining funds back to MVola. See `docs/architecture/features/2026-04-20_wallet-deposit-game.md` for the feature spec.

## Vision

`mvola-prof` is a proof-of-concept Next.js application demonstrating a realistic, end-to-end MVola Merchant Pay integration. A single player enters their MVola number, deposits Ariary into an in-game wallet, plays a simulated coin-flip betting game, and cashes out the remaining balance back to their MVola account. It serves as a working, well-structured reference implementation that developers can adapt into a real game backend — covering both payment directions (user → merchant and merchant → user) and the wallet semantics that bind them together.

## Architecture

> The diagram below reflects the extended v2 scope. For the full diagram with all new internal routes and the store layer, see `docs/architecture/components.md`.

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│  WalletHeader (MSISDN + live balance)                        │
│  TabbedLayout:  Deposit | Play | Cash-out | History          │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP (localhost)
┌──────────────────────────────▼───────────────────────────────┐
│                Next.js Server (API Routes)                   │
│                                                              │
│  MVola proxy routes:                                         │
│    POST /api/mvola/token                                     │
│    POST /api/mvola/deposit   (NEW, user → merchant)          │
│    POST /api/mvola/withdraw  (wallet-aware cash-out)         │
│    GET  /api/mvola/status/:id  (reconciles wallet state)     │
│    PUT  /api/mvola/callback    (reconciles wallet state)     │
│                                                              │
│  Internal routes (no MVola call):                            │
│    GET  /api/wallet/:msisdn/balance                          │
│    GET  /api/wallet/:msisdn/history                          │
│    POST /api/game/coinflip                                   │
│                                                              │
│  src/lib/mvola/                                              │
│    auth.ts       — token cache + refresh                     │
│    client.ts     — typed MVola HTTP calls (both dirs)        │
│    reconcile.ts  — shared reconciliation helper (NEW)        │
│    types.ts      — MVola + domain TypeScript interfaces      │
│                                                              │
│  src/lib/store/       (NEW — in-memory Maps)                 │
│    wallets.ts         — Map<msisdn, WalletState>             │
│    transactions.ts    — Map<localTxId, TransactionRecord>    │
│    games.ts           — Map<sessionId, GameSession>          │
│                                                              │
│  src/lib/game/        (NEW — pure)                           │
│    coinflip.ts        — playCoinFlip(bet, choice, rng?)      │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼───────────────────────────────┐
│               MVola API (devapi.mvola.mg)                    │
│  POST /token                                                 │
│  POST /mvola/mm/transactions/type/merchantpay/1.0.0/         │
│       (same endpoint for both deposit and withdraw)          │
│  GET  /mvola/mm/transactions/.../status/:id                  │
└──────────────────────────────────────────────────────────────┘
          │ PUT webhook callback
          ▼
  PUT /api/mvola/callback  (this server)
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14+ |
| Language | TypeScript | 5+ |
| Runtime | Node.js | 18+ |
| HTTP client | Native `fetch` | — |
| Styling | Tailwind CSS | 3+ |
| Package manager | npm | 10+ |
| UUID generation | `uuid` | latest |

## Components

### `src/lib/mvola/types.ts`
- **Purpose:** Single source of truth for all MVola payload shapes
- **Key types:** `MVolaToken`, `WithdrawalRequest`, `TransactionResponse`, `CallbackPayload`

### `src/lib/mvola/auth.ts`
- **Purpose:** Manage OAuth 2.0 token lifecycle (Client Credentials flow)
- **Key responsibilities:** Fetch token, cache in memory with expiry, auto-refresh 60s before expiry

### `src/lib/mvola/client.ts`
- **Purpose:** Typed wrappers around MVola API endpoints
- **Key responsibilities:** `initiateWithdrawal()`, `getTransactionStatus()`, attach required headers

### `src/app/api/mvola/token/route.ts`
- **Purpose:** Debug/test endpoint to acquire a fresh OAuth token

### `src/app/api/mvola/withdraw/route.ts`
- **Purpose:** Initiate a payout from merchant to player; validates input and returns `correlationId`

### `src/app/api/mvola/status/[correlationId]/route.ts`
- **Purpose:** Poll transaction status by `serverCorrelationId`

### `src/app/api/mvola/callback/route.ts`
- **Purpose:** Receive MVola asynchronous webhook PUT; log and return 200

### `src/components/WithdrawForm.tsx`
- **Purpose:** Demo React form — captures amount + MSISDN, submits, polls, displays status (v1; refactored to `CashOutForm` in Epic 08)

### `src/lib/mvola/reconcile.ts` (NEW)
- **Purpose:** Shared reconciliation helper used by both `status/route.ts` and `callback/route.ts`
- **Key responsibilities:** Apply the wallet side-effect (credit on confirmed deposit, refund on failed withdraw) exactly once per transaction via the `walletSettled` flag

### `src/lib/store/wallets.ts` (NEW)
- **Purpose:** In-memory wallet balances per MSISDN
- **Key responsibilities:** `getWallet`, `ensureWallet`, `creditWallet`, `debitWallet` (throws `InsufficientFundsError` on overdraft)

### `src/lib/store/transactions.ts` (NEW)
- **Purpose:** In-memory log of deposits + cash-outs with reconciliation metadata
- **Key responsibilities:** `createTransaction`, `getTransactionByCorrelationId`, `updateTransactionStatus`, `listTransactionsByMsisdn`

### `src/lib/store/games.ts` (NEW)
- **Purpose:** Append-only log of coin-flip rounds
- **Key responsibilities:** `recordGameSession`, `listGameSessionsByMsisdn`

### `src/lib/game/coinflip.ts` (NEW)
- **Purpose:** Pure, deterministic-by-injection coin-flip game logic
- **Key responsibilities:** `playCoinFlip(bet, choice, rng?)` returns `{ outcome, result, delta }`

### `src/app/api/mvola/deposit/route.ts` (NEW)
- **Purpose:** Initiate a deposit (user → merchant); records a pending transaction and does NOT credit the wallet

### `src/app/api/wallet/[msisdn]/balance/route.ts` (NEW)
- **Purpose:** Read-only current wallet balance for a player

### `src/app/api/wallet/[msisdn]/history/route.ts` (NEW)
- **Purpose:** Merged chronological list of transactions + game sessions for a player

### `src/app/api/game/coinflip/route.ts` (NEW)
- **Purpose:** Play one coin-flip round against the wallet

### `src/components/WalletHeader.tsx` (NEW)
- **Purpose:** MSISDN input persisted in `localStorage` + live balance poll + `MsisdnContext`

### `src/components/TabbedLayout.tsx` (NEW)
- **Purpose:** Presentational tab switcher for Deposit / Play / Cash-out / History

### `src/components/DepositForm.tsx` (NEW)
- **Purpose:** Deposit tab body — amount input, POST + polling, refresh balance on success

### `src/components/CoinFlipGame.tsx` (NEW)
- **Purpose:** Play tab body — bet + heads/tails + flip animation + result

### `src/components/CashOutForm.tsx` (NEW — refactor of WithdrawForm)
- **Purpose:** Cash-out tab body — wallet-aware defaults, 409 handling, refund messaging

### `src/components/TransactionHistory.tsx` (NEW)
- **Purpose:** History tab body — merged list of transactions + game rounds

## Key Design Decisions

- **Server-side credentials only:** All MVola API calls go through Next.js API routes; credentials never reach the browser.
- **In-memory token cache:** Simple module-level variable in `auth.ts`; refreshed automatically. Resets on server restart (acceptable for PoC).
- **No database:** PoC only — no persistent storage. All state (wallet, transactions, game history, token) lives in module-level `Map` objects and is wiped on server restart.
- **Native `fetch`:** Node.js 18+ ships with `fetch`; no extra HTTP library needed.
- **Wallet credit is confirmation-driven:** Deposits never credit the wallet at request time; only the status route or the webhook credit it once MVola reports `completed`.
- **Wallet debit is reservation-driven:** Cash-outs reserve funds at request time and refund them automatically if MVola fails synchronously or reports `failed`.
- **Idempotent reconciliation:** A single `reconcileTransaction()` helper is shared between the status route and the webhook callback; the `walletSettled` flag on each `TransactionRecord` ensures no double-credit/double-refund when both paths fire.
- **Single active player:** The UI assumes one MSISDN at a time (persisted in `localStorage`); multi-player concurrency is explicitly out of scope.
- **No new runtime dependencies for v2:** The feature adds three store modules, one pure game module, and several components — all built from the existing stack (Next.js + TypeScript + Tailwind + `crypto` built-ins).

## Non-Functional Requirements

- **Security:** Credentials server-side only; never logged or bundled into client JS.
- **Reliability:** Token auto-refresh prevents 401 mid-flow.
- **Compatibility:** Sandbox (`devapi.mvola.mg`) only; configurable for production via `MVOLA_ENV`.

## References

- Architecture docs: `docs/architecture/`
- Feature spec (v2): `docs/architecture/features/2026-04-20_wallet-deposit-game.md`
- State management: `docs/architecture/state-management.md`
- Generated: 2026-04-16
- Last updated: 2026-04-20 (wallet + deposit + coin-flip + cash-out feature; Epics 05–08 added)
