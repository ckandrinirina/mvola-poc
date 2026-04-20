# Story 06-03: Wallet-Aware Cash-Out Refactor — `POST /api/mvola/withdraw`

> **Epic:** 06 — Wallet-Aware MVola Flows
> **Size:** L
> **Status:** TODO

## Description

Refactor the existing `src/app/api/mvola/withdraw/route.ts` so it participates in the wallet lifecycle. Before calling MVola it validates that `wallet.balance >= amount` (returning `409` if not) and **reserves** the funds by debiting the wallet immediately. On a successful MVola initiation it records a `TransactionRecord` with `walletSettled=true`. On a synchronous MVola error it refunds the wallet and returns `502`. Later `failed` status handling is delegated to the reconciliation helper in story 06-04.

## Acceptance Criteria

- [ ] Accepts `{ msisdn: string, amount: string | number, description?: string }`
  - [ ] Accepts `playerMsisdn` as a legacy alias for `msisdn` (backwards-compatible during rollout)
- [ ] Returns 400 when `msisdn` or `amount` is missing / amount not a positive integer
- [ ] Reads the wallet via `getWallet(msisdn)`; returns 409 `{ error: "Insufficient funds", balance, requested }` if balance < amount
- [ ] Calls `debitWallet(msisdn, amount)` **before** awaiting the token or the MVola call
- [ ] Acquires OAuth token via `getToken()`
- [ ] Calls `initiateWithdrawal({ msisdn, amount, description }, token)`
- [ ] If the MVola call throws **synchronously** (before returning a `serverCorrelationId`):
  - [ ] Calls `creditWallet(msisdn, amount)` to refund
  - [ ] Returns 502 `{ error, details }`
  - [ ] No transaction record is created
- [ ] On success:
  - [ ] Calls `createTransaction({ msisdn, direction: "withdraw", amount, correlationId, walletSettled: true })`
  - [ ] Returns 200 `{ correlationId, localTxId, status: "pending" }`
- [ ] Existing withdraw tests are updated or rewritten to match the new schema and assertions
- [ ] New tests cover: 409 insufficient funds (wallet unchanged), successful reserve (wallet debited), MVola sync error (wallet refunded to starting balance)

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
