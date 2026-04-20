# Epic 05: State Store Layer

## Description

Introduce the in-memory state store layer that underpins the wallet, deposit, cash-out-with-reserve, coin-flip game, and history features. Three module-level `Map` stores live in `src/lib/store/`: `wallets.ts`, `transactions.ts`, and `games.ts`. None of the stores leak their underlying `Map` — only typed accessor functions are exported. Every mutation is synchronous (no awaits between read and write) so that Node's single-threaded event loop guarantees atomicity.

This epic is purely infrastructural — no route or UI change happens here. Everything that follows in Epics 06–08 depends on this layer being in place, so land 05-01 → 05-04 before starting any other new work.

## Goals

- Extend `src/lib/mvola/types.ts` with all new domain types (WalletState, TransactionRecord, GameSession, their unions, and an `InsufficientFundsError` class)
- Provide a wallet store with safe credit/debit accessors that enforce non-negative balances
- Provide a transaction store that indexes by both `localTxId` and `correlationId` for fast webhook/status reconciliation
- Provide an append-only game session store
- Ship unit tests for each store

## Scope

### In Scope
- New types in `src/lib/mvola/types.ts`
- Three new files under `src/lib/store/` with typed accessors
- Unit test files under `src/lib/store/__tests__/`

### Out of Scope
- Any route or UI integration (comes in Epics 06–08)
- Persistence, serialization, or migration tooling — PoC is in-memory only
- Multi-process concurrency handling

## Dependencies

- **Depends on:** None (uses existing patterns from `src/lib/mvola/auth.ts` token cache)
- **Blocks:** Epic 06 (all wallet-aware MVola flows), Epic 07 (game + wallet query routes)

## Stories

| # | Story | Size | Status |
|---|-------|------|--------|
| 01 | Domain type extensions — `types.ts` | S | TODO |
| 02 | Wallet store — `src/lib/store/wallets.ts` | M | TODO |
| 03 | Transaction store — `src/lib/store/transactions.ts` | M | TODO |
| 04 | Game session store — `src/lib/store/games.ts` | S | TODO |

## Acceptance Criteria

- [ ] `WalletState`, `TransactionRecord`, `GameSession`, and related unions are exported from `src/lib/mvola/types.ts`
- [ ] `InsufficientFundsError` is exported and extends `Error` with a stable `name` property
- [ ] Three store modules exist under `src/lib/store/` with only typed accessors exported (no direct `Map` exports)
- [ ] `wallets.debitWallet` throws `InsufficientFundsError` when `balance < amount`
- [ ] `transactions.createTransaction` rejects duplicate `correlationId`
- [ ] Each store exposes a `resetAll()` for tests
- [ ] Unit tests pass for each store (credit, debit, overdraft rejection, create/lookup, list order, multi-MSISDN isolation)
- [ ] No store module imports from `src/app/` or from any route (one-way dependency: routes → stores)

## Technical Notes

The existing OAuth token cache in `src/lib/mvola/auth.ts` is the template — a module-level variable, synchronous accessors, reset on server restart. Apply the same pattern here.

Key invariants (also documented in `docs/architecture/state-management.md`):
- `WalletState.balance >= 0` always
- All amounts are integer Ariary (`number`, not string)
- `TransactionRecord.direction` is immutable after creation
- `TransactionRecord.correlationId` is unique; secondary index must enforce this
- `GameSession` is append-only — no update or delete API

Every mutation function must perform its work in a single synchronous pass (no `await` between a read and a dependent write). This is how the PoC gets atomicity without locking.
