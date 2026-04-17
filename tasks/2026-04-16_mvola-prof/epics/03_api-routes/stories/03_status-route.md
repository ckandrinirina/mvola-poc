# Story 03-03: Status Route — `GET /api/mvola/status/[correlationId]`

> **Epic:** 03 — API Routes
> **Size:** S
> **Status:** DONE

## Description

Create `src/app/api/mvola/status/[correlationId]/route.ts` — a dynamic route handler that proxies the transaction status check. The client polls this endpoint every 3 seconds after initiating a withdrawal, passing the `correlationId` returned by the withdraw route.

## Acceptance Criteria

- [x] `GET /api/mvola/status/[correlationId]` responds with `{ transactionStatus, serverCorrelationId, transactionReference }`
- [x] Uses the `correlationId` from the URL path parameter
- [x] Calls `getToken()` then `getTransactionStatus(correlationId, token)`
- [x] Returns 200 with the status response from MVola
- [x] Returns 502 with `{ error: string }` on MVola failure
- [x] `transactionStatus` values: `"pending"`, `"completed"`, or `"failed"`

## Technical Notes

Next.js dynamic route handler receives params as second argument:
```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: { correlationId: string } }
) {
  const { correlationId } = params;
  // ...
}
```

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/app/api/mvola/status/[correlationId]/route.ts` | Transaction status polling proxy |

## Dependencies

- **Blocked by:** Story 02-02 (`getToken`), Story 02-03 (`getTransactionStatus`)
- **Blocks:** Story 04-02 (UI polls this route)

## Related

- **Epic:** 03_api-routes
- **Spec reference:** `docs/architecture/api-contracts.md` — `GET /api/mvola/status/[correlationId]`
