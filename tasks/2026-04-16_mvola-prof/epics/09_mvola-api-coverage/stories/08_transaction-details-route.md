---
id: 09-08
title: Details Route — `GET /api/mvola/transaction/[transactionReference]`
epic: 09
status: in-progress
size: M
blocked_by: [09-06, 09-07]
files: [src/app/api/mvola/transaction/[transactionReference]/route.ts, src/app/api/mvola/transaction/[transactionReference]/__tests__/route.test.ts]
issue:
prior_status:
---

# Story 09-08: Details Route — `GET /api/mvola/transaction/[transactionReference]`

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

Serve MVola's record of a settled transaction beside this application's own record of it, so a
reviewer can see that local bookkeeping and MVola's ledger agree.

The route returns `{ mvola, local }` and **no verdict field**. The comparison is presented, not
asserted — the UI renders both and lets the viewer draw the conclusion. A route that returned
`{ matches: true }` would be asking to be trusted about exactly the thing the view exists to
demonstrate.

## Acceptance Criteria

- [x] `GET /api/mvola/transaction/[transactionReference]` returns `200 { mvola, local }`
- [x] `mvola` is the body from `getTransactionDetails()` **forwarded unaltered** — not reshaped, renamed, or filtered to resemble the local record
- [x] `local` is the `TransactionRecord` found via `getTransactionByMvolaReference()`
- [x] The response contains no verdict, match flag, or diff field
- [x] No local record carrying that reference → `404 { error: "No local transaction carries that reference" }`, and MVola is not called
- [x] A MVola error or token failure → `502 { error: "MVola API error", details }`
- [x] **Nothing is fabricated.** A MVola rejection is surfaced as a 502; no synthesised or placeholder record is ever returned
- [x] The route is server-only; no credential reaches the response body (rule R5)
- [x] The `params` promise is awaited, matching the Next.js 15 signature used by `status/[correlationId]/route.ts:34`
- [x] Tests cover: 200 with both objects present, unknown reference → 404 without a MVola call, MVola throw → 502, `mvola` forwarded byte-for-byte, no verdict key in any response
- [x] `npx jest` passes fully

## Technical Notes

```typescript
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ transactionReference: string }> },
): Promise<NextResponse> {
  const { transactionReference } = await params;

  const local = getTransactionByMvolaReference(transactionReference);
  if (!local) {
    return NextResponse.json(
      { error: "No local transaction carries that reference" },
      { status: 404 },
    );
  }

  try {
    const token = await getToken();
    const mvola = await getTransactionDetails(transactionReference, token);
    return NextResponse.json({ mvola, local });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "MVola API error", details }, { status: 502 });
  }
}
```

**Check the local record first.** It costs nothing, avoids an unnecessary token acquisition and
MVola round-trip for a reference this application has never seen, and makes the 404 path
trivially testable. Assert in a test that `getToken` is not called on that path.

**Forward `mvola` verbatim.** The temptation is to normalise it into the local record's shape so
the UI can render one component for both columns. Doing so would defeat the comparison: the
point is that two independently-kept records agree, and reshaping one to match the other makes
agreement unfalsifiable. Story 09-12 renders them as two separate columns for the same reason.

The exact key set inside `mvola` is not yet known — see story 09-07 and the feature doc's Open
items. Do not write assertions that depend on specific MVola field names; assert that the
object is forwarded unchanged instead.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/app/api/mvola/transaction/[transactionReference]/route.ts` | The details route |
| CREATE | `src/app/api/mvola/transaction/[transactionReference]/__tests__/route.test.ts` | 200 / 404 / 502 coverage |

## Dependencies

- **Blocked by:** Stories 09-06 (lookup by reference), 09-07 (client method)
- **Blocks:** Story 09-12

## Related

- **Epic:** 09_mvola-api-coverage
- **Spec reference:** pre-spec § 5.1, § 6; feature doc § Details route, § Flow C

## Implementation Summary

Implemented `GET /api/mvola/transaction/[transactionReference]` exactly per the Technical
Notes: check the local record first (via `getTransactionByMvolaReference()`), return `404`
without touching MVola when it's missing, otherwise acquire a token and call
`getTransactionDetails()`, returning `{ mvola, local }` with `mvola` forwarded verbatim and
no verdict/match/diff field anywhere in the response. A token or MVola failure is caught and
translated to `502 { error: "MVola API error", details }` — nothing is fabricated. Added
`export const runtime = "nodejs"` per `guide-nextjs`/`expert-backend`'s standard for routes
under `src/app/api/mvola/**` that read secrets via `getToken()`.

**SOLID:** SRP — the handler only orchestrates (lookup → token → MVola call → shape
response); DIP — depends on the narrow `getToken`/`getTransactionDetails`/
`getTransactionByMvolaReference` function abstractions, fully mockable via `jest.mock`; OCP —
response shaping never inspects `mvola`'s internal shape, so a wider MVola reply requires no
route change.

**Tests (9, all green):** 200 with both objects; local lookup called with the path
reference; 404 with no local record and no `getToken`/`getTransactionDetails` call; 502 on
`getTransactionDetails` throw; 502 on `getToken` throw (with `getTransactionDetails` never
called); `mvola` forwarded byte-for-byte including unknown/extra keys; no verdict/match/diff
key in the 200, 404, and 502 responses.

**QA:** PASS (`ck-code:qa-validator`) — all acceptance criteria verified against
`route.ts`/`route.test.ts` with file:line citations; full suite 460/460 green;
`tsc --noEmit` clean; no credential leakage; dependency files untouched.

### Files Touched

- CREATED `src/app/api/mvola/transaction/[transactionReference]/route.ts`
- CREATED `src/app/api/mvola/transaction/[transactionReference]/__tests__/route.test.ts`
