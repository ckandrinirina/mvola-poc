---
id: 09-07
title: `getTransactionDetails()` — The Fourth MVola Operation
epic: 09
status: todo
size: S
blocked_by: [09-01]
files: [src/lib/mvola/client.ts, src/lib/mvola/types.ts, src/lib/mvola/__tests__/client.test.ts]
issue:
prior_status:
---

# Story 09-07: `getTransactionDetails()` — The Fourth MVola Operation

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

MVola publishes two APIs and four operations in total — this is the complete surface, not a
subset. Three are used: Authentication, Initiate Transaction, and Transaction Status. The
fourth, **Transaction Details**, is not implemented at all.

Add it to `src/lib/mvola/client.ts`. Given a settled transaction's reference, it retrieves
MVola's authoritative record: amounts, both parties, timestamps and final state, as MVola
holds them rather than as the application remembers them. Story 09-08 serves it beside the
local record so a reviewer can see the two ledgers agree.

Completing the surface is the point. "We exercise the entire MVola API" is a materially
stronger claim than "we exercise most of it", and with four operations it is achievable.

## Acceptance Criteria

- [ ] `client.ts` exports `getTransactionDetails(transactionReference: string, token: string): Promise<TransactionDetailsResponse>`
- [ ] It issues `GET {base}/mvola/mm/transactions/type/merchantpay/1.0.0/{transactionReference}`
- [ ] The reference is URL-encoded into the path
- [ ] It reuses `getBaseUrl()`, `buildHeaders()` and `throwOnError()` **unchanged** — no forked helper
- [ ] A non-200 response throws via `throwOnError()` with a context label identifying this call
- [ ] `TransactionDetailsResponse` is defined in `types.ts` with an index signature, so keys MVola returns but the type does not name are preserved rather than dropped
- [ ] Tests cover: correct URL and method, headers present, reference encoding, 200 returns the parsed body verbatim, non-200 throws with the status and body in the message
- [ ] `npx jest` passes fully

## Technical Notes

```typescript
export async function getTransactionDetails(
  transactionReference: string,
  token: string,
): Promise<TransactionDetailsResponse> {
  const url = `${getBaseUrl()}/mvola/mm/transactions/type/merchantpay/1.0.0/${encodeURIComponent(transactionReference)}`;

  const response = await fetch(url, { method: "GET", headers: buildHeaders(token) });
  await throwOnError(response, "transaction details endpoint");

  return response.json() as Promise<TransactionDetailsResponse>;
}
```

**Header note.** Per `docs/mvola-reference/merchant-pay-openapi.json`, this operation does not
require the `partnerName` header the other two do. Sending it anyway is harmless and keeps
`buildHeaders()` single-purpose — **do not fork the helper for this.**

**The response shape is indicative, not verified.** The details call was attempted during the
2026-07-28 verification and rejected, because no settled transaction reference existed to call
it with. The fields the feature doc lists (`amount`, `currency`, `transactionReference`,
`transactionStatus`, `createDate`, `debitParty`, `creditParty`) are drawn from the operation's
purpose, not from a captured 200. Type it permissively:

```typescript
export interface TransactionDetailsResponse {
  amount?: string;
  currency?: string;
  transactionReference?: string;
  transactionStatus?: string;
  createDate?: string;
  debitParty?: MVolaParty[];
  creditParty?: MVolaParty[];
  [key: string]: unknown;
}
```

Story 09-14 makes the first successful call and records the real key set. Until then, nothing
downstream may assume a field is present — story 09-08 forwards the object verbatim precisely
so this uncertainty stays contained in one place.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/lib/mvola/client.ts` | Add `getTransactionDetails()` |
| MODIFY | `src/lib/mvola/types.ts` | Add `TransactionDetailsResponse` (index-signature tolerant) |
| MODIFY | `src/lib/mvola/__tests__/client.test.ts` | URL, headers, encoding, 200 and non-200 paths |

## Dependencies

- **Blocked by:** Story 09-01
- **Blocks:** Story 09-08

## Related

- **Epic:** 09_mvola-api-coverage
- **Spec reference:** pre-spec § 3, § 5.1; feature doc § `getTransactionDetails`, § Open items
