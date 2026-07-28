---
id: 09-02
title: `parseMvolaStatus()` — Shared Status Reader + Type Corrections
epic: 09
status: todo
size: M
blocked_by: [09-01]
files: [src/lib/mvola/status.ts, src/lib/mvola/types.ts, src/lib/mvola/__tests__/status.test.ts, src/lib/mvola/__tests__/types.test.ts]
issue:
prior_status:
---

# Story 09-02: `parseMvolaStatus()` — Shared Status Reader + Type Corrections

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

Create `src/lib/mvola/status.ts` — one interpretation of MVola's progress reply, so the
polling path and the callback path cannot disagree about what a transaction's state is.

Live verification against the sandbox on 2026-07-28 established that MVola reports progress
in a field named `status` and the settled reference in one named `objectReference`. The
integration reads `transactionStatus` and `transactionReference` (`types.ts:59-63`) and finds
nothing. In sandbox this is invisible because the status path is bypassed before the mismatch
can matter; in production nothing bypasses it, and **every transaction would read as having
no status at all**. This is the latent production defect the sandbox shortcut conceals.

The reader accepts either spelling. See the Technical Notes for why that is a deliberate
choice rather than hedging.

## Acceptance Criteria

- [ ] `src/lib/mvola/status.ts` exports `parseMvolaStatus(payload: unknown): { status: TransactionStatus; reference?: string }`
- [ ] Progress is read as `status ?? transactionStatus`
- [ ] The settled reference is read as `objectReference ?? transactionReference`
- [ ] An empty-string reference is normalised to `undefined`, never persisted as `""`
- [ ] The status string is normalised to the `TransactionStatus` union
- [ ] **An unrecognised, missing, or malformed status yields `"pending"` — never a terminal state.** A record must not settle because a payload was unreadable
- [ ] `payload` being `null`, `undefined`, a string, or an array does not throw — each yields `"pending"`
- [ ] `TransactionStatusResponse` in `types.ts` is corrected to MVola's real shape: `status` and `objectReference` required, `transactionStatus` and `transactionReference` optional
- [ ] `CallbackPayload` keeps `transactionStatus`/`transactionReference` but makes them optional alongside optional `status`/`objectReference`
- [ ] `TransactionDetailsResponse` and `TransactionComparison` (`{ mvola, local }`) are added to `types.ts`
- [ ] Unit tests cover: both field spellings, both spellings present simultaneously, unknown status value, missing status, empty-string reference, and each non-object payload shape
- [ ] `npx jest` still passes fully

## Technical Notes

```typescript
import type { TransactionStatus } from "./types";

const KNOWN: readonly TransactionStatus[] = ["pending", "completed", "failed"];

export function parseMvolaStatus(
  payload: unknown,
): { status: TransactionStatus; reference?: string } {
  const p = (payload ?? {}) as Record<string, unknown>;
  const raw = typeof p.status === "string" ? p.status : p.transactionStatus;
  const status = KNOWN.includes(raw as TransactionStatus)
    ? (raw as TransactionStatus)
    : "pending";

  const ref = (p.objectReference ?? p.transactionReference) as string | undefined;
  return { status, reference: ref ? ref : undefined };
}
```

**Why tolerant reads rather than a straight rename.** The *status* response shape is verified:
`status` and `objectReference`. The *callback* payload shape is **not** — no live MVola webhook
delivery is captured anywhere in this repo, so it is unknown whether MVola sends the callback
under the same names the status endpoint uses or under the ones the current code assumes.
Accepting either spelling on both paths satisfies the single-interpretation requirement
without asserting something unverified. Story 09-14 captures a real delivery; once the actual
shape is recorded in `docs/architecture/_shared.md`, the redundant fallback can be dropped.

Guard the array case explicitly — `typeof [] === "object"`, so an array payload would
otherwise reach the property reads and silently produce `undefined` rather than being
recognised as malformed. The outcome is the same (`"pending"`), but assert it in a test.

Adding optional fields to `TransactionStatusResponse` may surface type errors at
`status/[correlationId]/route.ts:64-66`, which currently reads the response fields directly.
Story 09-03 rewrites that call site; leaving it momentarily broken is acceptable **only** if
`npx tsc --noEmit` still passes here — otherwise adjust the call site minimally in this story
and let 09-03 restructure it.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/mvola/status.ts` | The shared reader |
| CREATE | `src/lib/mvola/__tests__/status.test.ts` | Unit tests for every payload shape |
| MODIFY | `src/lib/mvola/types.ts` | Correct `TransactionStatusResponse`; relax `CallbackPayload`; add details + comparison types |
| MODIFY | `src/lib/mvola/__tests__/types.test.ts` | Cover the corrected and added shapes |

## Dependencies

- **Blocked by:** Story 09-01
- **Blocks:** Stories 09-03, 09-04

## Related

- **Epic:** 09_mvola-api-coverage
- **Spec reference:** pre-spec § 4, § 5.4; feature doc § `src/lib/mvola/status.ts`
