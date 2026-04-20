# Story 06-03: Wallet-Aware Cash-Out Refactor — `POST /api/mvola/withdraw`

> **Epic:** 06 — Wallet-Aware MVola Flows
> **Size:** L
> **Status:** DONE

## Description

Refactor the existing `src/app/api/mvola/withdraw/route.ts` so it participates in the wallet lifecycle. Before calling MVola it validates that `wallet.balance >= amount` (returning `409` if not) and **reserves** the funds by debiting the wallet immediately. On a successful MVola initiation it records a `TransactionRecord` with `walletSettled=true`. On a synchronous MVola error it refunds the wallet and returns `502`. Later `failed` status handling is delegated to the reconciliation helper in story 06-04.

## Acceptance Criteria

- [x] Accepts `{ msisdn: string, amount: string | number, description?: string }`
  - [x] Accepts `playerMsisdn` as a legacy alias for `msisdn` (backwards-compatible during rollout)
- [x] Returns 400 when `msisdn` or `amount` is missing / amount not a positive integer
- [x] Reads the wallet via `getWallet(msisdn)`; returns 409 `{ error: "Insufficient funds", balance, requested }` if balance < amount
- [x] Calls `debitWallet(msisdn, amount)` **before** awaiting the token or the MVola call
- [x] Acquires OAuth token via `getToken()`
- [x] Calls `initiateWithdrawal({ msisdn, amount, description }, token)`
- [x] If the MVola call throws **synchronously** (before returning a `serverCorrelationId`):
  - [x] Calls `creditWallet(msisdn, amount)` to refund
  - [x] Returns 502 `{ error, details }`
  - [x] No transaction record is created
- [x] On success:
  - [x] Calls `createTransaction({ msisdn, direction: "withdraw", amount, correlationId, walletSettled: true })`
  - [x] Returns 200 `{ correlationId, localTxId, status: "pending" }`
- [x] Existing withdraw tests are updated or rewritten to match the new schema and assertions
- [x] New tests cover: 409 insufficient funds (wallet unchanged), successful reserve (wallet debited), MVola sync error (wallet refunded to starting balance)

## Technical Notes

The balance check (`getWallet`) and the debit (`debitWallet`) must happen in the same synchronous block — no `await` between them. `debitWallet` itself throws `InsufficientFundsError`, so the simplest pattern is:

```typescript
try {
  debitWallet(msisdn, amount);
} catch (e) {
  if (e instanceof InsufficientFundsError) {
    return NextResponse.json(
      { error: "Insufficient funds", balance: e.balance, requested: e.requested },
      { status: 409 },
    );
  }
  throw e;
}
```

After that, the route proceeds with `getToken()` + `initiateWithdrawal()`. Wrap the latter in its own try/catch that refunds the wallet:

```typescript
let mvolaResponse;
try {
  const token = await getToken();
  mvolaResponse = await initiateWithdrawal({ msisdn, amount, description }, token);
} catch (err) {
  creditWallet(msisdn, amount);  // refund
  return NextResponse.json(
    { error: "MVola API error", details: err instanceof Error ? err.message : String(err) },
    { status: 502 },
  );
}
```

Accept `playerMsisdn` as alias before validation:

```typescript
const msisdn = body.msisdn ?? body.playerMsisdn;
```

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/app/api/mvola/withdraw/route.ts` | Add wallet validation, reserve, refund-on-sync-error |
| MODIFY | `src/app/api/mvola/withdraw/__tests__/route.test.ts` | Update existing tests + add 409, reserve, refund cases |

## Dependencies

- **Blocked by:** Stories 05-01, 05-02, 05-03
- **Blocks:** Story 08-05 (CashOutForm consumes this contract)

## Related

- **Epic:** 06_wallet-aware-mvola
- **Spec reference:** `docs/architecture/api-contracts.md` § `POST /api/mvola/withdraw`, `docs/architecture/data-flow.md` § Flow 6 (Cash-Out)

---

## Implementation Plan

**Planned:** 2026-04-20
**Skills loaded:** experts/backend, experts/qa, experts/qa-project, guides/typescript, guides/nextjs, guides/mvola
**SOLID approach:** Route stays a thin orchestrator delegating to focused store accessors (`debitWallet` / `creditWallet` / `createTransaction`) — each module has one responsibility. Wallet side-effects (reserve and refund) are bracketed in small try/catch blocks. The route depends on abstractions (exported store functions + MVola client + auth), not concrete instances.

### Subtasks
1. [x] Move withdraw tests from `src/__tests__/app/api/mvola/withdraw/route.test.ts` to co-located `src/app/api/mvola/withdraw/__tests__/route.test.ts` and rewrite against the new contract (msisdn + playerMsisdn alias, 409 insufficient funds, wallet reserve, refund, createTransaction assertions, amount validation)
2. [x] Confirm RED phase — new tests fail on old route
3. [x] Refactor `src/app/api/mvola/withdraw/route.ts` to: accept `msisdn` (with `playerMsisdn` alias), validate amount is a positive integer, reserve funds via `debitWallet` (catch `InsufficientFundsError` → 409), acquire token + call `initiateWithdrawal` in a try/catch that refunds on sync error, persist `TransactionRecord` with `walletSettled: true`, return `{ correlationId, localTxId, status }`
4. [x] Confirm GREEN phase — all withdraw tests pass
5. [x] SOLID refactor pass
6. [x] QA validation — full `npm test` + `tsc --noEmit` + `eslint`
7. [x] Update docs, story status DONE, epic table

### Design Notes
- `debitWallet` / `creditWallet` are synchronous — run the balance check/reserve **before** `await getToken()` so an insufficient-funds caller never triggers a token fetch.
- `debitWallet` already throws `InsufficientFundsError` with `balance`/`requested` — catch and return 409 directly (no separate `getWallet` probe needed).
- The sync-error catch refunds **only** when the debit succeeded (structurally ensured: the inner try runs only after `debitWallet` returned normally).
- Response adds `localTxId` alongside existing `correlationId` / `status` fields.
- Tests move into the co-located `__tests__` directory, matching the deposit-route pattern and the story's Files table.

---

## Implementation Summary

**Completed:** 2026-04-20
**TDD Iterations:** 1 (red → green → refactor)
**QA Iterations:** 1 (passed on first run)
**Tests written:** 25 new tests (40 total in the suite)
**Files created:** 1
**Files modified:** 1 (plus 1 deleted and 1 story file updated)

### What Was Implemented
- Rewrote `POST /api/mvola/withdraw` as a wallet-aware reserve-then-initiate flow: validates body (accepts `msisdn` or legacy `playerMsisdn`, coerces `amount` to a positive integer), reserves funds via `debitWallet` synchronously (409 on `InsufficientFundsError`), then calls `getToken()` + `initiateWithdrawal()` inside a try/catch that refunds via `creditWallet()` and returns 502 on any sync error, and finally persists a `TransactionRecord` with `walletSettled: true`.
- Extracted `parseBody()` and `reserveFunds()` helpers to keep the `POST` handler readable and each function focused on one responsibility.
- Replaced the old `src/__tests__/app/api/mvola/withdraw/route.test.ts` with a co-located suite at `src/app/api/mvola/withdraw/__tests__/route.test.ts`, mirroring the deposit-route pattern. Coverage: request validation (8 tests), legacy `playerMsisdn` alias (2), 409 insufficient funds with wallet-unchanged (4), happy path with reserve + response shape + ordering (10), and sync-error refund (4) — 28 `it` blocks total in the new file, 40 passing tests across the 2 withdraw suites.

### Files Touched

```
CREATED  src/app/api/mvola/withdraw/__tests__/route.test.ts
MODIFIED src/app/api/mvola/withdraw/route.ts:1-159
DELETED  src/__tests__/app/api/mvola/withdraw/route.test.ts
MODIFIED tasks/2026-04-16_mvola-prof/epics/06_wallet-aware-mvola/stories/03_wallet-aware-withdraw.md
MODIFIED tasks/2026-04-16_mvola-prof/epics/06_wallet-aware-mvola/EPIC.md  (story 03 → DONE)
```

### SOLID Compliance
- **S:** `parseBody` only validates; `reserveFunds` only reserves; `POST` only orchestrates. Store/client/auth each stay in their own module.
- **O:** Route extends behaviour by composing existing store accessors (`debitWallet`, `creditWallet`, `createTransaction`) without modifying them.
- **L:** N/A — no inheritance.
- **I:** `WithdrawInput` carries only the three fields the handler uses.
- **D:** Route depends on the module-exported functions (`getToken`, `initiateWithdrawal`, store accessors), all of which are replaced by Jest mocks in tests — no concrete coupling.

### Notes
- The wallet reserve runs **before** `await getToken()`, so an insufficient-funds caller never triggers an OAuth fetch or an outbound MVola call.
- `playerMsisdn` is still accepted for backwards compatibility during the rollout — `msisdn` takes priority when both are sent.
- The response adds `localTxId` (new in this contract) alongside the existing `correlationId` and `status` fields.
- The route depends on `InsufficientFundsError` from `@/lib/mvola/types` (defined in story 05-01) as the control-flow signal from `debitWallet`.
