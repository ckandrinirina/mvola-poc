---
id: 09-04
title: Callback Route — Unified Interpretation
epic: 09
status: in-progress
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

- [ ] The destructure at `route.ts:35-36` is replaced by `parseMvolaStatus(body)`
- [ ] `serverCorrelationId` is still read directly from the body — it is not part of the status reader's contract
- [ ] `reconcileTransaction()` receives the parsed status and parsed reference
- [ ] A body using `status`/`objectReference` reconciles **identically** to one using `transactionStatus`/`transactionReference`
- [ ] A body carrying an unreadable status reconciles as `pending`, i.e. is a no-op — a malformed delivery must not settle a wallet (rule R3)
- [ ] Every existing guarantee holds: missing `serverCorrelationId` → `200`, unknown correlationId → `200`, malformed JSON → `200`, reconciliation throw → `200`
- [ ] Personal data is still not logged — log lines carry `serverCorrelationId` and status only
- [ ] Both callback test files are updated and passing (see note below)
- [ ] `npx jest` passes fully

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
