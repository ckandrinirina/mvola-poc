# Story 05-03: Transaction Store — `src/lib/store/transactions.ts`

> **Epic:** 05 — State Store Layer
> **Size:** M
> **Status:** DONE

## Description

Create the transaction store — an in-memory log of every deposit and cash-out with reconciliation metadata (`status`, `walletSettled`). A secondary index keyed by `correlationId` lets the status route and the webhook callback look up records in O(1) when MVola delivers an outcome.

## Acceptance Criteria

- [x] `createTransaction(input): TransactionRecord` where `input = { msisdn, direction, amount, correlationId, walletSettled }`:
  - [x] Generates `localTxId` via `crypto.randomUUID()`
  - [x] Sets `status = "pending"`, `createdAt = updatedAt = Date.now()`
  - [x] Inserts into both the primary map (by `localTxId`) and the secondary `correlationId` index
  - [x] Throws `Error` if the `correlationId` already exists in the secondary index
  - [x] Throws `Error` if `amount` is not a positive integer
- [x] `getTransactionByCorrelationId(correlationId: string): TransactionRecord | undefined` uses the secondary index
- [x] `getTransactionById(localTxId: string): TransactionRecord | undefined` uses the primary map
- [x] `updateTransactionStatus(localTxId, status, patch?: { mvolaReference?, walletSettled? }): TransactionRecord`:
  - [x] Throws if the record doesn't exist
  - [x] Updates `status`, bumps `updatedAt`
  - [x] Optionally sets `mvolaReference` and/or `walletSettled` from `patch`
- [x] `listTransactionsByMsisdn(msisdn: string): TransactionRecord[]` returns records sorted by `createdAt` descending
- [x] `resetAll(): void` clears both primary and secondary maps
- [x] The underlying maps are module-private
- [x] Unit tests cover: create + lookup by both keys, duplicate correlationId rejection, status update + mvolaReference / walletSettled patches, list order, multi-msisdn isolation, non-integer amount rejection

## Technical Notes

```typescript
import { TransactionRecord, TransactionDirection, TransactionStatus } from "@/lib/mvola/types";

const byId = new Map<string, TransactionRecord>();
const byCorrelationId = new Map<string, string>();

interface CreateInput {
  msisdn: string;
  direction: TransactionDirection;
  amount: number;
  correlationId: string;
  walletSettled: boolean;
}

export function createTransaction(input: CreateInput): TransactionRecord {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error(`amount must be a positive integer, got ${input.amount}`);
  }
  if (byCorrelationId.has(input.correlationId)) {
    throw new Error(`Duplicate correlationId: ${input.correlationId}`);
  }
  const now = Date.now();
  const record: TransactionRecord = {
    localTxId: crypto.randomUUID(),
    correlationId: input.correlationId,
    msisdn: input.msisdn,
    direction: input.direction,
    amount: input.amount,
    status: "pending",
    walletSettled: input.walletSettled,
    createdAt: now,
    updatedAt: now,
  };
  byId.set(record.localTxId, record);
  byCorrelationId.set(record.correlationId, record.localTxId);
  return record;
}
```

Secondary index is `Map<correlationId, localTxId>` — not the full record — so there's only one source of truth.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/store/transactions.ts` | Transaction log + correlationId index |
| CREATE | `src/lib/store/__tests__/transactions.test.ts` | Unit tests for accessors |

## Dependencies

- **Blocked by:** Story 05-01 (`TransactionRecord`, `TransactionDirection`)
- **Blocks:** Stories 06-02, 06-03, 06-04, 06-05, 07-04

## Related

- **Epic:** 05_state-store
- **Spec reference:** `docs/architecture/state-management.md` § `transactions.ts`
