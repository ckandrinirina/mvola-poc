# Epic 06: Wallet-Aware MVola Flows

## Description

Bring the MVola integration up to the feature's real requirements: add the **deposit** direction, retrofit the existing **cash-out** route to reserve wallet funds at request time, and make the **status** and **callback** routes reconcile wallet balances idempotently. The centrepiece is a shared `reconcileTransaction()` helper so the status route and the webhook route apply the same logic — the `walletSettled` flag on each `TransactionRecord` prevents double-credits when both paths fire for the same transaction.

After this epic lands, a developer can exercise the entire money-movement lifecycle end-to-end with `curl` against the MVola sandbox, without touching the UI.

## Goals

- Add `initiateDeposit()` to `src/lib/mvola/client.ts` — same endpoint as withdraw, swapped parties
- Add `POST /api/mvola/deposit` — records a pending transaction; does **not** credit the wallet
- Refactor `POST /api/mvola/withdraw` to validate and reserve wallet funds (409 on insufficient funds, refund on sync MVola error)
- Refactor `GET /api/mvola/status/[correlationId]` to reconcile wallet state on the first terminal transition
- Refactor `PUT /api/mvola/callback` to apply the same reconciliation, guaranteeing idempotency across both paths
- Extract the reconciliation logic into a shared helper (`src/lib/mvola/reconcile.ts`) with its own unit tests

## Scope

### In Scope
- One new route: `src/app/api/mvola/deposit/route.ts`
- Refactors of three existing routes: `withdraw/route.ts`, `status/[correlationId]/route.ts`, `callback/route.ts`
- New helper: `src/lib/mvola/reconcile.ts`
- Extension to `src/lib/mvola/client.ts` (`initiateDeposit` + `DepositParams`)
- Route and unit tests for all of the above

### Out of Scope
- Game and wallet query routes (Epic 07)
- UI components (Epic 08)
- MVola webhook signature verification (deferred — see feature spec § Open questions)

## Dependencies

- **Depends on:** Epic 05 (wallet, transaction stores + domain types)
- **Blocks:** Epic 08 (`DepositForm`, `CashOutForm` call into these routes)

## Stories

| # | Story | Size | Status |
|---|-------|------|--------|
| 01 | Deposit HTTP client method — `client.ts::initiateDeposit` | M | TODO |
| 02 | Deposit route — `POST /api/mvola/deposit` | M | TODO |
| 03 | Wallet-aware cash-out refactor — `POST /api/mvola/withdraw` | L | TODO |
| 04 | Reconciliation in status route — `GET /api/mvola/status/:id` | L | TODO |
| 05 | Reconciliation in callback route — `PUT /api/mvola/callback` | M | TODO |

## Acceptance Criteria

- [ ] `initiateDeposit` sends the same MVola endpoint and headers as `initiateWithdrawal` but with swapped `debitParty` / `creditParty`
- [ ] `POST /api/mvola/deposit` creates a `TransactionRecord` with `direction="deposit"`, `walletSettled=false` and returns `{ correlationId, localTxId, status: "pending" }`
- [ ] Deposit never credits the wallet at request time
- [ ] `POST /api/mvola/withdraw` returns `409` with `{ balance, requested }` when wallet < amount
- [ ] Withdraw reserves funds at request time (wallet balance drops immediately on 200)
- [ ] Synchronous MVola failure during withdraw refunds the wallet and returns 502
- [ ] `GET /api/mvola/status/:id` and `PUT /api/mvola/callback` share a single `reconcileTransaction()` helper
- [ ] Reconciliation is idempotent: two calls for the same terminal outcome result in exactly one wallet mutation
- [ ] All existing tests still pass (or are migrated to the new schema); new tests cover the new paths
- [ ] End-to-end: deposit → poll → wallet credited; withdraw → poll → MVola failed → wallet refunded

## Technical Notes

- The reconciliation helper `reconcileTransaction(record, newStatus)` is the decision point. It reads the current record, computes the side-effect (credit / refund / no-op), and applies it through the store accessors in a single synchronous pass.
- The `walletSettled` flag is the idempotency gate. Both the status route and the callback route pass through the helper; whichever arrives first wins, and the second call sees a record whose `walletSettled` state already reflects the resolution.
- Keep `deposit/route.ts` and the refactored `withdraw/route.ts` structurally similar so the pattern reads consistently. Both validate → acquire token → call client → update store.
- For withdraw, do the debit **before** `await getToken()`. If `getToken()` throws, refund the wallet before returning 502.
