# System Components

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                page.tsx (Demo UI)                    │    │
│  │                                                      │    │
│  │  ┌────────────── WalletHeader ─────────────────┐     │    │
│  │  │  MSISDN input (localStorage) + balance      │     │    │
│  │  └──────────────────┬──────────────────────────┘     │    │
│  │                     │                                │    │
│  │  ┌──────────────── TabbedLayout ──────────────┐      │    │
│  │  │  [Deposit] [Play] [Cash-out] [History]     │      │    │
│  │  ├────────────────────────────────────────────┤      │    │
│  │  │  DepositForm     → POST /mvola/deposit     │      │    │
│  │  │  CoinFlipGame    → POST /game/coinflip     │      │    │
│  │  │  CashOutForm     → POST /mvola/withdraw    │      │    │
│  │  │  TransactionHistory → GET /wallet/:m/hist  │      │    │
│  │  └────────────────────────────────────────────┘      │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP (localhost)
┌──────────────────────────────▼───────────────────────────────┐
│                Next.js Server (API Routes)                   │
│                                                              │
│  MVola proxy routes:                                         │
│    POST /api/mvola/token       token/route.ts                │
│    POST /api/mvola/deposit     deposit/route.ts              │
│    POST /api/mvola/withdraw    withdraw/route.ts             │
│    GET  /api/mvola/status/:id  status/route.ts               │
│    PUT  /api/mvola/callback    callback/route.ts             │
│                                                              │
│  Internal routes (no MVola call):                            │
│    GET  /api/wallet/:msisdn/balance                          │
│    GET  /api/wallet/:msisdn/history                          │
│    POST /api/game/coinflip                                   │
│                                                              │
│  ┌──────────────── src/lib/mvola/ ────────────────────┐      │
│  │  auth.ts    — token cache + refresh logic          │      │
│  │  client.ts  — typed MVola HTTP calls (both dirs)   │      │
│  │  types.ts   — shared TypeScript interfaces         │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
│  ┌──────────────── src/lib/store/ ────────────────────┐      │
│  │  wallets.ts       — Map<msisdn, WalletState>       │      │
│  │  transactions.ts  — Map<localTxId, TxRecord>       │      │
│  │  games.ts         — Map<sessionId, GameSession>    │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
│  ┌──────────────── src/lib/game/ ─────────────────────┐      │
│  │  coinflip.ts — pure game logic (RNG injected)      │      │
│  └────────────────────────────────────────────────────┘      │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼───────────────────────────────┐
│               MVola API (devapi.mvola.mg)                    │
│                                                              │
│  POST /token                                                 │
│  POST /mvola/mm/transactions/type/merchantpay/1.0.0/         │
│       (same endpoint for both deposit and withdraw —         │
│        direction is determined by debitParty/creditParty)    │
│  GET  /mvola/mm/transactions/type/merchantpay/1.0.0/         │
│       status/{serverCorrelationId}                           │
└──────────────────────────────────────────────────────────────┘
          │ PUT callback (webhook)
          ▼
  PUT /api/mvola/callback  (on this server)
```

## Components

### `src/app/page.tsx` — Demo Page
- **Type:** React Server Component (renders the tabbed single-page layout)
- **Purpose:** Entry point for the demo UI
- **Responsibilities:** Render `WalletHeader` + `TabbedLayout` (which hosts `DepositForm`, `CoinFlipGame`, `CashOutForm`, `TransactionHistory`)

### `src/components/WalletHeader.tsx` — Wallet Header (NEW)
- **Type:** React Client Component (`"use client"`)
- **Purpose:** Capture the active player MSISDN and display live wallet balance
- **Responsibilities:**
  - Input field for MSISDN, persisted to `localStorage` under `mvola-prof.msisdn`
  - Poll `GET /api/wallet/:msisdn/balance` every 2 seconds while an MSISDN is set
  - Broadcast the active MSISDN to sibling tab components (via React context or prop drilling)

### `src/components/TabbedLayout.tsx` — Tab Switcher (NEW)
- **Type:** React Client Component (`"use client"`)
- **Purpose:** Host the four tabbed sections on a single page
- **Responsibilities:**
  - Render tab triggers: `Deposit`, `Play`, `Cash-out`, `History`
  - Mount the active tab's component and pass the current MSISDN down
  - Expose a "refresh balance" callback that child components call after successful actions

### `src/components/DepositForm.tsx` — Deposit Form (NEW)
- **Type:** React Client Component (`"use client"`)
- **Purpose:** Initiate a deposit from the player's MVola account into the in-game wallet
- **Responsibilities:**
  - Capture form input (amount)
  - `POST /api/mvola/deposit` with `{ msisdn, amount }`
  - Poll `GET /api/mvola/status/{correlationId}` every 3 seconds until `completed` or `failed`
  - On `completed`, trigger a balance refresh on the header

### `src/components/CoinFlipGame.tsx` — Coin-Flip Game UI (NEW)
- **Type:** React Client Component (`"use client"`)
- **Purpose:** Let the player bet from their wallet on a coin-flip outcome
- **Responsibilities:**
  - Capture bet amount and heads/tails choice
  - `POST /api/game/coinflip` with `{ msisdn, bet, choice }`
  - Display outcome with a short flip animation, win/loss banner, and new balance
  - Trigger a balance refresh on the header after each round

### `src/components/CashOutForm.tsx` — Cash-Out Form (refactor of `WithdrawForm`)
- **Type:** React Client Component (`"use client"`)
- **Purpose:** Cash the current in-game wallet balance back to the player's MVola account
- **Responsibilities:**
  - Capture amount (defaulting to full wallet balance, capped at balance)
  - `POST /api/mvola/withdraw` with `{ msisdn, amount }` — server validates wallet balance ≥ amount
  - Poll `GET /api/mvola/status/{correlationId}` every 3 seconds
  - On `failed`, display "wallet refunded" message
  - On `completed`, trigger balance refresh

### `src/components/TransactionHistory.tsx` — History List (NEW)
- **Type:** React Client Component (`"use client"`)
- **Purpose:** Show a chronological list of all transactions and game rounds for the current MSISDN
- **Responsibilities:**
  - `GET /api/wallet/:msisdn/history` on mount and on `refresh` callback
  - Render each entry with direction (deposit / withdraw / game), amount, status, timestamp
  - Distinguish `pending` / `completed` / `failed` visually

### `src/app/api/mvola/token/route.ts` — Token Route
- **Type:** Next.js API Route (server-only)
- **Purpose:** Acquire and return an OAuth access token from MVola
- **Responsibilities:**
  - Call `src/lib/mvola/auth.ts` to get a valid token
  - Return the token (for debugging); in production this endpoint would be internal only

### `src/app/api/mvola/deposit/route.ts` — Deposit Route (NEW)
- **Type:** Next.js API Route (server-only)
- **Purpose:** Initiate a deposit from a player's MVola account into the in-game wallet
- **Responsibilities:**
  - Validate request body (`msisdn`, `amount`)
  - Ensure a valid OAuth token (via `auth.ts`)
  - Call `client.ts → initiateDeposit()` (debitParty = player, creditParty = merchant)
  - Create a `TransactionRecord` with `direction: "deposit"`, `status: "pending"`, `walletSettled: false`
  - Return `{ correlationId, localTxId, status: "pending" }` to the client for polling
  - **Does NOT credit the wallet yet** — the wallet is only credited when MVola confirms the transaction (see `status/route.ts` and `callback/route.ts`)

### `src/app/api/mvola/withdraw/route.ts` — Withdraw (Cash-Out) Route
- **Type:** Next.js API Route (server-only)
- **Purpose:** Cash out wallet funds — initiate a payout from the merchant account to a player's MVola number
- **Responsibilities:**
  - Validate request body (`msisdn`, `amount`)
  - Check `wallets.ts → getWallet(msisdn).balance >= amount` — return `409 Conflict` if insufficient
  - **Reserve (debit) the amount from the wallet immediately** so concurrent rounds cannot overdraft
  - Ensure a valid OAuth token (via `auth.ts`)
  - Call `client.ts → initiateWithdrawal()` (debitParty = merchant, creditParty = player)
  - Create a `TransactionRecord` with `direction: "withdraw"`, `status: "pending"`, `walletSettled: true` (funds already reserved)
  - On MVola call error or `failed` status later, **refund the wallet** and flip `walletSettled` back to `false`
  - Return `{ correlationId, localTxId, status: "pending" }` to the client for polling

### `src/app/api/mvola/status/[correlationId]/route.ts` — Status Route
- **Type:** Next.js API Route (server-only)
- **Purpose:** Check the status of a previously initiated transaction and reconcile wallet state
- **Responsibilities:**
  - Ensure a valid OAuth token
  - Call `client.ts` to GET transaction status from MVola
  - Look up the local `TransactionRecord` by `correlationId`
  - On first transition to `completed`:
    - **Deposit:** credit the wallet for the amount, set `walletSettled: true`
    - **Withdraw:** no-op (already settled at request time)
  - On first transition to `failed`:
    - **Deposit:** no-op (never credited), set `walletSettled: true` (frozen)
    - **Withdraw:** refund the wallet, set `walletSettled: false`
  - Update the local record's `status`, `mvolaReference`, `updatedAt`
  - Return `{ transactionStatus, transactionReference }` to the client
  - All mutations guarded by the `walletSettled` flag to ensure idempotency (see [state-management.md](state-management.md))

### `src/app/api/mvola/callback/route.ts` — Webhook Route
- **Type:** Next.js API Route (server-only)
- **Purpose:** Receive MVola's asynchronous callback when a transaction completes and reconcile wallet state
- **Responsibilities:**
  - Accept `PUT` requests from MVola
  - Look up the `TransactionRecord` by `serverCorrelationId`
  - Apply the same reconciliation logic as the status route (credit on completed deposit, refund on failed withdraw)
  - Log the callback payload
  - Always return `200 OK` (MVola retries on non-200)

### `src/lib/mvola/auth.ts` — Token Manager
- **Type:** Server-only TypeScript module
- **Purpose:** Manage OAuth token lifecycle
- **Responsibilities:**
  - Fetch a new token using Consumer Key + Secret (Basic Auth)
  - Cache the token in memory with its expiry time
  - Automatically refresh when token is within 60 seconds of expiry

### `src/lib/mvola/client.ts` — MVola HTTP Client
- **Type:** Server-only TypeScript module
- **Purpose:** Typed wrappers around MVola API endpoints (both payment directions)
- **Responsibilities:**
  - `initiateWithdrawal(params, token)` → POST to MVola Merchant Pay (debitParty = merchant, creditParty = player)
  - `initiateDeposit(params, token)` → POST to MVola Merchant Pay (debitParty = player, creditParty = merchant)
  - `getTransactionStatus(correlationId, token)` → GET status from MVola
  - Attach required headers (`X-CorrelationID`, `UserAccountIdentifier`, etc.) via the existing `buildHeaders()` helper
  - Both `initiateDeposit` and `initiateWithdrawal` share the same URL, headers, and error handling; they only differ in the `debitParty`/`creditParty` pair

### `src/lib/mvola/types.ts` — TypeScript Types
- **Type:** Shared type definitions
- **Purpose:** Single source of truth for all MVola payload shapes **and** internal domain types
- **Responsibilities:** Define interfaces for:
  - MVola shapes: `MVolaToken`, `WithdrawalRequest`, `TransactionResponse`, `CallbackPayload`, `TransactionStatus`, `MVolaParty`
  - Domain shapes: `WalletState`, `TransactionRecord`, `TransactionDirection`, `GameSession`, `GameChoice`, `GameResult`, `CoinFlipOutcome`

### `src/lib/store/wallets.ts` — Wallet Store (NEW)
- **Type:** Server-only TypeScript module (module-level `Map`)
- **Purpose:** In-memory wallet balance per player MSISDN
- **Responsibilities:**
  - `getWallet(msisdn): WalletState | undefined` — read-only lookup
  - `ensureWallet(msisdn): WalletState` — create a zero-balance wallet if absent
  - `creditWallet(msisdn, amount): WalletState` — add to balance, bump `updatedAt`
  - `debitWallet(msisdn, amount): WalletState` — subtract from balance (throws on insufficient funds)
  - `resetAll()` — test-only helper

### `src/lib/store/transactions.ts` — Transaction Store (NEW)
- **Type:** Server-only TypeScript module
- **Purpose:** In-memory log of every deposit and withdrawal with reconciliation state
- **Responsibilities:**
  - `createTransaction({ msisdn, direction, amount, correlationId, walletSettled }): TransactionRecord`
  - `getTransactionByCorrelationId(correlationId): TransactionRecord | undefined`
  - `updateTransactionStatus(localTxId, status, { mvolaReference?, walletSettled? })`
  - `listTransactionsByMsisdn(msisdn): TransactionRecord[]` — sorted by `createdAt` desc
  - Maintains a secondary index `correlationId → localTxId` for webhook/status lookups

### `src/lib/store/games.ts` — Game Session Store (NEW)
- **Type:** Server-only TypeScript module
- **Purpose:** In-memory log of every coin-flip round
- **Responsibilities:**
  - `recordGameSession({ msisdn, bet, choice, outcome, result, delta, balanceAfter }): GameSession`
  - `listGameSessionsByMsisdn(msisdn): GameSession[]` — sorted by `playedAt` desc

### `src/lib/game/coinflip.ts` — Coin-Flip Game Logic (NEW)
- **Type:** Server-only TypeScript module (pure)
- **Purpose:** Compute the outcome of a single coin-flip round
- **Responsibilities:**
  - `playCoinFlip(bet, choice, rng?): CoinFlipOutcome` → `{ outcome, result, delta }`
  - Default `rng`: `crypto.getRandomValues(new Uint8Array(1))[0] < 128 ? "heads" : "tails"`
  - Accepts an injected `rng` for deterministic unit tests
  - Pure function — no I/O, no state mutation

### `src/app/api/wallet/[msisdn]/balance/route.ts` — Wallet Balance Route (NEW)
- **Type:** Next.js API Route (server-only, read-only)
- **Purpose:** Return the current in-memory wallet balance for an MSISDN
- **Responsibilities:**
  - Read `msisdn` from the path parameter
  - Call `wallets.ts → getWallet(msisdn)`; return `{ msisdn, balance: 0 }` if unknown
  - Return `{ msisdn, balance, updatedAt }`

### `src/app/api/wallet/[msisdn]/history/route.ts` — History Route (NEW)
- **Type:** Next.js API Route (server-only, read-only)
- **Purpose:** Return a merged, sorted history of all transactions and game rounds for an MSISDN
- **Responsibilities:**
  - Call `transactions.ts → listTransactionsByMsisdn(msisdn)` and `games.ts → listGameSessionsByMsisdn(msisdn)`
  - Return a single chronologically-sorted array tagged by `kind: "transaction" | "game"`

### `src/app/api/game/coinflip/route.ts` — Coin-Flip Game Route (NEW)
- **Type:** Next.js API Route (server-only)
- **Purpose:** Play one round of coin-flip against the in-memory wallet
- **Responsibilities:**
  - Validate body: `{ msisdn, bet, choice: "heads" | "tails" }` with `bet > 0`
  - Check `getWallet(msisdn).balance >= bet` — return `409 Conflict` if insufficient
  - **Debit** `bet` from the wallet
  - Call `playCoinFlip(bet, choice)`
  - If `result === "win"`: **credit** `2 * bet` (net `+bet`); else balance stays debited (net `-bet`)
  - Record the round via `recordGameSession(...)`
  - Return `{ sessionId, outcome, result, delta, balanceAfter }`

## Component Interaction Matrix

| From \ To | UI components | /api/mvola/* | /api/wallet/* | /api/game/* | lib/mvola/* | lib/store/* | lib/game/* | MVola API |
|-----------|---------------|--------------|---------------|-------------|-------------|-------------|------------|-----------|
| UI components | — | HTTP POST/GET | HTTP GET | HTTP POST | — | — | — | — |
| /api/mvola/* | — | — | — | — | calls | calls | — | — |
| /api/wallet/* | — | — | — | — | — | reads | — | — |
| /api/game/* | — | — | — | — | — | reads + writes | calls | — |
| lib/mvola/auth.ts | — | — | — | — | — | — | — | POST /token |
| lib/mvola/client.ts | — | — | — | — | — | — | — | POST/GET tx |
| lib/store/* | — | — | — | — | — | — | — | — |
| lib/game/coinflip.ts | — | — | — | — | — | — | — | — |
