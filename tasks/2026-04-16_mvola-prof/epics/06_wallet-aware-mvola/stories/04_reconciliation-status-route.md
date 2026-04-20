# Story 06-04: Reconciliation in Status Route — `GET /api/mvola/status/[correlationId]`

> **Epic:** 06 — Wallet-Aware MVola Flows
> **Size:** L
> **Status:** DONE

## Description

Refactor `src/app/api/mvola/status/[correlationId]/route.ts` so that, in addition to proxying the MVola status call, it reconciles local wallet state on the first terminal transition. Extract the decision logic into a shared helper `src/lib/mvola/reconcile.ts::reconcileTransaction(record, newStatus)` that will be reused by the callback route in story 06-05. The `walletSettled` flag on each transaction prevents double-credits.

## Acceptance Criteria

- [ ] `reconcileTransaction(record, newStatus)` helper exported from `src/lib/mvola/reconcile.ts`
- [ ] Helper applies the following state transitions (see truth table in Technical Notes):
  - Deposit + `completed` + `walletSettled=false` → credit wallet, set `walletSettled=true`, update status
  - Deposit + `failed` + `walletSettled=false` → no wallet change, set `walletSettled=true`, update status
  - Withdraw + `completed` + `walletSettled=true` → no wallet change, update status
  - Withdraw + `failed` + `walletSettled=true` → refund wallet, set `walletSettled=false`, update status
  - Any subsequent call where the transition is a no-op → no-op (idempotent)
- [ ] Route hands the local record + incoming MVola `transactionStatus` to the helper, then returns the MVola status to the caller unchanged
- [ ] Route returns 200 unchanged for success; 502 on MVola error (unchanged)
- [ ] If the local record can't be found (unknown correlationId), the route still returns MVola's status but does not crash
- [ ] `src/lib/mvola/__tests__/reconcile.test.ts` covers every row of the truth table plus idempotency (same input twice → single mutation)
- [ ] Route tests cover: first `completed` deposit credits wallet; second status poll is a no-op; first `failed` withdraw refunds wallet; happy withdraw stays settled

## Technical Notes

### Truth table for `reconcileTransaction(record, newStatus)`

| direction | current `walletSettled` | current `status` | new `status` | wallet action | new `walletSettled` | new `status` |
|-----------|--------------------------|-------------------|---------------|---------------|----------------------|---------------|
| deposit   | false | pending | completed | credit +amount | true  | completed |
| deposit   | false | pending | failed    | no-op          | true  | failed    |
| deposit   | true  | any     | any       | no-op          | true  | unchanged |
| withdraw  | true  | pending | completed | no-op          | true  | completed |
| withdraw  | true  | pending | failed    | refund +amount | false | failed    |
| withdraw  | false | failed  | any       | no-op          | false | unchanged |

Helper skeleton:

```typescript
import { TransactionRecord, TransactionStatus } from "@/lib/mvola/types";
import { creditWallet } from "@/lib/store/wallets";
import { updateTransactionStatus } from "@/lib/store/transactions";

export function reconcileTransaction(
  record: TransactionRecord,
  newStatus: TransactionStatus,
  mvolaReference?: string,
): void {
  if (newStatus !== "completed" && newStatus !== "failed") return;
  if (record.status !== "pending") return;  // already reconciled

  if (record.direction === "deposit" && newStatus === "completed" && !record.walletSettled) {
    creditWallet(record.msisdn, record.amount);
    updateTransactionStatus(record.localTxId, "completed", { walletSettled: true, mvolaReference });
    return;
  }
  if (record.direction === "deposit" && newStatus === "failed" && !record.walletSettled) {
    updateTransactionStatus(record.localTxId, "failed", { walletSettled: true, mvolaReference });
    return;
  }
  if (record.direction === "withdraw" && newStatus === "completed") {
    updateTransactionStatus(record.localTxId, "completed", { mvolaReference });
    return;
  }
  if (record.direction === "withdraw" && newStatus === "failed" && record.walletSettled) {
    creditWallet(record.msisdn, record.amount);
    updateTransactionStatus(record.localTxId, "failed", { walletSettled: false, mvolaReference });
    return;
  }
}
```

The route calls `getTransactionByCorrelationId(correlationId)`, then passes through the helper — the helper contains the entire decision tree so the callback route (story 06-05) can reuse it verbatim.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/mvola/reconcile.ts` | Shared reconciliation helper |
| CREATE | `src/lib/mvola/__tests__/reconcile.test.ts` | Unit tests for the truth table |
| MODIFY | `src/app/api/mvola/status/[correlationId]/route.ts` | Invoke helper after MVola status call |
| MODIFY | `src/app/api/mvola/status/[correlationId]/__tests__/route.test.ts` | Assert wallet / store side-effects |

## Dependencies

- **Blocked by:** Stories 05-02, 05-03
- **Blocks:** Story 06-05 (reuses the helper), Story 08-03 (DepositForm relies on status→wallet-credit), Story 08-05 (CashOutForm relies on failed→refund)

## Related

- **Epic:** 06_wallet-aware-mvola
- **Spec reference:** `docs/architecture/state-management.md` § Idempotency, `docs/architecture/data-flow.md` § State mutation summaries
