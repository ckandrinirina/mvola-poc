---
id: 09-04
title: Callback Route — Unified Interpretation
epic: 09
status: done
size: S
blocked_by: [09-02]
files: [src/app/api/mvola/callback/route.ts, src/app/api/mvola/callback/__tests__/route.test.ts, src/__tests__/app/api/mvola/callback/route.test.ts]
issue:
prior_status:
---

# Story 09-04: Callback Route — Unified Interpretation

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

`PUT /api/mvola/callback` destructures `transactionStatus` and `transactionReference` straight
off the body (`callback/route.ts:35-36`). Replace that with `parseMvolaStatus(body)` so a
callback and a status poll reaching the same conclusion cannot disagree about what MVola said
(rule R4).

Everything else about this route is unchanged and must stay that way: unknown correlation IDs,
parse errors and reconciliation errors all still return `200 { received: true }`, because any
other status causes MVola to retry the notification indefinitely.

## Acceptance Criteria

- [x] The destructure at `route.ts:35-36` is replaced by `parseMvolaStatus(body)`
- [x] `serverCorrelationId` is still read directly from the body — it is not part of the status reader's contract
- [x] `reconcileTransaction()` receives the parsed status and parsed reference
- [x] A body using `status`/`objectReference` reconciles **identically** to one using `transactionStatus`/`transactionReference`
- [x] A body carrying an unreadable status reconciles as `pending`, i.e. is a no-op — a malformed delivery must not settle a wallet (rule R3)
- [x] Every existing guarantee holds: missing `serverCorrelationId` → `200`, unknown correlationId → `200`, malformed JSON → `200`, reconciliation throw → `200`
- [x] Personal data is still not logged — log lines carry `serverCorrelationId` and status only
- [x] Both callback test files are updated and passing (see note below)
- [x] `npx jest` passes fully

## Technical Notes

```typescript
import { parseMvolaStatus } from "@/lib/mvola/status";

const body = await req.json();
const { serverCorrelationId } = body ?? {};
// ... existing guards unchanged ...
const { status, reference } = parseMvolaStatus(body);
reconcileTransaction(record, status, reference);
```

**Two test files cover this route** and both must be kept green:

- `src/app/api/mvola/callback/__tests__/route.test.ts`
- `src/__tests__/app/api/mvola/callback/route.test.ts`

They are near-duplicates left over from two competing test-location conventions. Consolidating
them is out of scope here — do not delete either as part of this story. If they have drifted,
note the difference rather than silently reconciling it.

The always-`200` contract is the one thing in this file that must not be "improved". It looks
like swallowed errors and is deliberate: MVola treats any non-200 as a delivery failure and
retries.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/app/api/mvola/callback/route.ts` | Read the payload through `parseMvolaStatus()` |
| MODIFY | `src/app/api/mvola/callback/__tests__/route.test.ts` | Add both-spelling and unreadable-status coverage |
| MODIFY | `src/__tests__/app/api/mvola/callback/route.test.ts` | Same, for the duplicate suite |

## Dependencies

- **Blocked by:** Story 09-02
- **Blocks:** Story 09-14

## Related

- **Epic:** 09_mvola-api-coverage
- **Related stories:** 09-03 (same interpretation, polling path)
- **Spec reference:** pre-spec § 5.4, rules R3/R4; feature doc § Callback route

## Implementation Summary

Replaced the callback route's raw `{ transactionStatus, transactionReference }` destructure
with `parseMvolaStatus(body)`, matching story 09-03's status-route pattern exactly.
`serverCorrelationId` continues to be read directly from the body (unchanged — it is not part
of the status reader's contract). The parsed `{ status, reference }` now feeds
`reconcileTransaction()` in place of the raw fields. Because `parseMvolaStatus()` always
defaults an unrecognised/missing status to `"pending"`, and `reconcileTransaction()` already
treats `"pending"` as a no-op (Guard 1), rule R3 (a malformed delivery must never settle a
wallet) holds without any new branching in the route. The always-200 contract, the
unknown-correlationId/missing-correlationId/malformed-JSON/reconciliation-throw guarantees,
and the existing logging (serverCorrelationId + status only, on the paths this story touches)
are all unchanged.

**Route:** LEAN (size S). **SOLID:** SRP unchanged — the route still only validates,
delegates, and translates (per house convention); interpretation stays entirely inside
`parseMvolaStatus()`. DIP: the route now depends on the shared status-reader abstraction
instead of reading wire fields directly — the intended inversion this story required.

**Tests added** (both callback suites, kept in parity):
- A body using `status`/`objectReference` reconciles identically to one using
  `transactionStatus`/`transactionReference` (same `reconcileTransaction()` call).
- A body with an unreadable/unknown status reconciles as `"pending"` — verified as a no-op
  at the route boundary (asserted via the mocked `reconcileTransaction` call arguments; the
  no-op behavior itself is `reconcileTransaction`'s own contract, covered in `reconcile.test.ts`).

**QA:** Delegated to `ck-code:qa-validator` — PASS. Full suite: 455/455 passing, 26 suites.
`npx tsc --noEmit`: clean. File scope confirmed limited to the callback route and its two
test files; `src/lib/mvola/status.ts` and `types.ts` untouched.

**Files Touched:**
- MODIFIED `src/app/api/mvola/callback/route.ts:1-30,38-70` (module header, import, guard
  destructure, and the parseMvolaStatus() call feeding reconcileTransaction())
- MODIFIED `src/app/api/mvola/callback/__tests__/route.test.ts` (added both-spelling parity
  test and unreadable-status no-op test)
- MODIFIED `src/__tests__/app/api/mvola/callback/route.test.ts` (same two tests, for the
  duplicate suite)
