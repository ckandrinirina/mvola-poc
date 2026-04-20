# Story 06-05: Reconciliation in Callback Route — `PUT /api/mvola/callback`

> **Epic:** 06 — Wallet-Aware MVola Flows
> **Size:** M
> **Status:** DONE

## Description

Refactor `src/app/api/mvola/callback/route.ts` so that, when MVola delivers an asynchronous webhook, the route looks up the local `TransactionRecord` by `serverCorrelationId` and runs the **same** `reconcileTransaction()` helper created in story 06-04. Because the helper reads/writes the `walletSettled` flag, duplicate deliveries (callback + status poll) result in exactly one wallet mutation. The route must always return 200 to MVola — even for unknown correlation IDs — to prevent MVola from retrying indefinitely.

## Acceptance Criteria

- [x] Handler reads the PUT body and extracts `serverCorrelationId`, `transactionStatus`, `transactionReference`
- [x] Calls `getTransactionByCorrelationId(serverCorrelationId)`
- [x] If the record is found, invokes `reconcileTransaction(record, transactionStatus, transactionReference)` from `reconcile.ts`
- [x] If the record is NOT found, logs a warning (`"unknown correlationId"` + the payload) but still returns 200
- [x] Always returns `{ received: true }` with 200 — even on malformed payloads, parsing errors, or reconciliation throws (logged)
- [x] Route tests cover:
  - known record + deposit + `completed` → wallet credited once, `walletSettled` flipped to `true`
  - duplicate callback (same correlationId twice) → no double-credit
  - known record + withdraw + `failed` → wallet refunded once
  - unknown correlationId → 200 + warning log
  - malformed JSON body → 200 + warning log
- [x] Existing callback tests updated to match the new contract (logging is now conditional; no secrets logged)

## Technical Notes

Skeleton:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTransactionByCorrelationId } from "@/lib/store/transactions";
import { reconcileTransaction } from "@/lib/mvola/reconcile";

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { serverCorrelationId, transactionStatus, transactionReference } = body;
    if (!serverCorrelationId) {
      console.warn("[mvola/callback] Missing serverCorrelationId in payload", body);
      return NextResponse.json({ received: true }, { status: 200 });
    }
    const record = getTransactionByCorrelationId(serverCorrelationId);
    if (!record) {
      console.warn("[mvola/callback] Unknown correlationId", serverCorrelationId);
      return NextResponse.json({ received: true }, { status: 200 });
    }
    reconcileTransaction(record, transactionStatus, transactionReference);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[mvola/callback] Unhandled error", err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
```

The route is intentionally permissive: every path returns 200. If we return 5xx, MVola retries and can double-trigger reconciliation — but even that is safe thanks to the `walletSettled` guard; the 200 is about reducing retry traffic.

Do not log the full body if it contains personal data; only log the `serverCorrelationId` and `transactionStatus`.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/app/api/mvola/callback/route.ts` | Call helper from 06-04, preserve 200-always behaviour |
| MODIFY | `src/app/api/mvola/callback/__tests__/route.test.ts` | Add reconciliation assertions |

## Dependencies

- **Blocked by:** Story 06-04 (helper must exist)
- **Blocks:** Story 08-03 (DepositForm relies on end-to-end reconciliation working), Story 08-05 (CashOutForm relies on refund path)

## Related

- **Epic:** 06_wallet-aware-mvola
- **Spec reference:** `docs/architecture/data-flow.md` § Flow 3 (Webhook Reception), `docs/architecture/state-management.md` § Idempotency
