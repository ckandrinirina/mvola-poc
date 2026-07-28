---
slug: state-store
design: planned
---

# In-Memory State Store

> Self-contained — a story reads this (+ folder-structure.md, + \_shared.md when noted), not other feature docs.

## Summary

The in-memory state layer under `src/lib/store/` that underpins the wallet, deposit,
cash-out-with-reserve, coin-flip game, and history features, plus the domain half of
`src/lib/mvola/types.ts`. Three module-level `Map` stores — `wallets.ts`,
`transactions.ts`, `games.ts` — none of which leak their underlying `Map`; only typed
accessor functions are exported. Its boundary: this feature owns the data and the
accessors, never the routes that call them. The MVola payload types in the same
`types.ts` file belong to [mvola-core-library](../mvola-core-library/index.md).

## Components

### `src/lib/store/wallets.ts` — Wallet Store

- **Type:** Server-only TypeScript module (module-level `Map<msisdn, WalletState>`)
- **Purpose:** In-memory wallet balance per player MSISDN
- **Responsibilities:**
  - `getWallet(msisdn): WalletState | undefined` — read-only lookup
  - `ensureWallet(msisdn): WalletState` — create a zero-balance wallet if absent
  - `creditWallet(msisdn, amount): WalletState` — add to balance, bump `updatedAt`
  - `debitWallet(msisdn, amount): WalletState` — subtract from balance (throws `InsufficientFundsError`)
  - `resetAll()` — test-only helper
- **Depends on:** `types.ts` (`WalletState`, `InsufficientFundsError`)

### `src/lib/store/transactions.ts` — Transaction Store

- **Type:** Server-only TypeScript module
- **Purpose:** In-memory log of every deposit and withdrawal with reconciliation state
- **Responsibilities:**
  - `createTransaction({ msisdn, direction, amount, correlationId, walletSettled }): TransactionRecord`
  - `getTransactionByCorrelationId(correlationId): TransactionRecord | undefined`
  - `updateTransactionStatus(localTxId, status, { mvolaReference?, walletSettled? })`
  - `listTransactionsByMsisdn(msisdn): TransactionRecord[]` — sorted by `createdAt` desc
  - Maintains a secondary index `correlationId → localTxId` for webhook/status lookups
- **Depends on:** `types.ts` (`TransactionRecord`, `TransactionDirection`)

### `src/lib/store/games.ts` — Game Session Store

- **Type:** Server-only TypeScript module
- **Purpose:** In-memory log of every coin-flip round
- **Responsibilities:**
  - `recordGameSession({ msisdn, bet, choice, outcome, result, delta, balanceAfter }): GameSession`
  - `listGameSessionsByMsisdn(msisdn): GameSession[]` — sorted by `playedAt` desc
- **Depends on:** `types.ts` (`GameSession`, `GameChoice`, `GameResult`)

### `src/lib/mvola/types.ts` — Domain type extensions

- **Type:** Shared type definitions (the domain half of the file)
- **Purpose:** Single source of truth for the internal domain shapes
- **Responsibilities:** Define `WalletState`, `TransactionRecord`, `TransactionDirection`,
  `GameSession`, `GameChoice`, `GameResult`, `CoinFlipOutcome`
- **Depends on:** nothing

## API

None. This feature exposes no HTTP routes — it is consumed in-process by
[wallet-aware-mvola](../wallet-aware-mvola/index.md) and
[game-and-queries](../game-and-queries/index.md).

## Data

No persistent state. Three module-level `Map`s, wiped on server restart. The full
schemas (`WalletState`, `TransactionRecord`, `GameSession`), accessor contracts,
idempotency rules, concurrency model, reset behaviour, and debug tips live in
[state-management.md](../../state-management.md) — the authoritative reference for this
feature.

### Key invariants

- **Wallet balance ≥ 0** always — every debit path checks first and throws if insufficient
- **Wallet credit is confirmation-driven** for deposits — never optimistic
- **Wallet debit is reservation-driven** for cash-outs — reserved at request time,
  refunded if MVola rejects or returns failed
- **Idempotency:** every `TransactionRecord` carries a `walletSettled` flag; the status
  route and the webhook route both consult it before applying a wallet side-effect, so
  the wallet never double-credits or double-refunds when both events fire for the same
  transaction
- **Monetary unit:** integer Ariary throughout the store and game layers; conversion
  to/from the MVola API's string representation happens only at the `client.ts` boundary
- **Atomicity:** every mutation is synchronous (no awaits between read and write), so
  Node's single-threaded event loop guarantees it

## Flows

None owned — the stores are passive. See the deposit and cash-out flows in
[wallet-aware-mvola](../wallet-aware-mvola/index.md#flows) and the coin-flip round in
[game-and-queries](../game-and-queries/index.md#flows).

## Shared dependencies

- [Conventions](../../_shared.md#conventions)
- [state-management.md](../../state-management.md) — full schemas and accessor contracts
