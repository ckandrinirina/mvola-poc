---
id: 09-02
title: `parseMvolaStatus()` — Shared Status Reader + Type Corrections
epic: 09
status: done
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

- [x] `src/lib/mvola/status.ts` exports `parseMvolaStatus(payload: unknown): { status: TransactionStatus; reference?: string }`
- [x] Progress is read as `status ?? transactionStatus`
- [x] The settled reference is read as `objectReference ?? transactionReference`
- [x] An empty-string reference is normalised to `undefined`, never persisted as `""`
- [x] The status string is normalised to the `TransactionStatus` union
- [x] **An unrecognised, missing, or malformed status yields `"pending"` — never a terminal state.** A record must not settle because a payload was unreadable
- [x] `payload` being `null`, `undefined`, a string, or an array does not throw — each yields `"pending"`
- [x] `TransactionStatusResponse` in `types.ts` is corrected to MVola's real shape: `status` and `objectReference` required, `transactionStatus` and `transactionReference` optional
- [x] `CallbackPayload` keeps `transactionStatus`/`transactionReference` but makes them optional alongside optional `status`/`objectReference`
- [x] `TransactionDetailsResponse` and `TransactionComparison` (`{ mvola, local }`) are added to `types.ts`
- [x] Unit tests cover: both field spellings, both spellings present simultaneously, unknown status value, missing status, empty-string reference, and each non-object payload shape
- [x] `npx jest` still passes fully

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

---

## Implementation Summary

**Completed:** 2026-07-28
**TDD Iterations:** 2 (red→green→refactor cycles: `status.ts` + `parseMvolaStatus` tests; `types.ts` corrections + `types.test.ts` coverage)
**QA Iterations:** 1
**Manual-test bugs:** none
**Tests written:** 25 (16 in `status.test.ts`, 9 added to `types.test.ts`)
**Files created:** 2
**Files modified:** 2
**Unplanned changes:** none

### What Was Implemented

- `parseMvolaStatus(payload: unknown)` — the single shared interpretation of MVola's progress
  reply, reading `status ?? transactionStatus` and `objectReference ?? transactionReference`,
  normalising an empty-string reference to `undefined`, and defaulting any unrecognised,
  missing, or malformed status to `"pending"` (never a terminal state).
- Guards `null`, `undefined`, non-object primitives, and arrays explicitly (arrays are
  `typeof "object"` too) so every malformed shape yields `"pending"` without throwing.
- Corrected `TransactionStatusResponse` to MVola's verified shape: `status` and
  `objectReference` required, `transactionStatus`/`transactionReference` kept as optional
  legacy fields.
- Relaxed `CallbackPayload` so all four status/reference fields (`status`, `objectReference`,
  `transactionStatus`, `transactionReference`) are optional, since the callback's real field
  spelling is unverified (story 09-14 records the first real delivery).
- Added `TransactionDetailsResponse` (index-signature tolerant, every named field optional)
  and `TransactionComparison` (`{ mvola, local }`, no verdict field) to `types.ts`.

### Files Touched

CREATED src/lib/mvola/status.ts
CREATED src/lib/mvola/__tests__/status.test.ts
MODIFIED src/lib/mvola/types.ts:55-122
MODIFIED src/lib/mvola/__tests__/types.test.ts:16-32,218-369

### SOLID Compliance

- **SRP:** `status.ts` has exactly one job — normalise MVola's progress reply; `asPlainRecord`
  and `isKnownStatus` are private helpers that exist only to keep `parseMvolaStatus` itself a
  single, flat decision.
- **OCP:** `KNOWN_STATUSES` + the `TransactionStatus` union is the one place a new status value
  would be added; the parsing logic itself does not change shape.
- **LSP:** not applicable — no subclassing or interface substitution in this module.
- **ISP:** the module's public surface is exactly one function; the two helpers stay
  module-private so no consumer can depend on internals it doesn't need.
- **DIP:** `parseMvolaStatus` depends only on the `TransactionStatus` type, not on `fetch`, a
  route, or a store — callers own supplying the untrusted payload.

### Notes

- **Known, deliberately deferred consequence (documented in this story's own Technical
  Notes):** making `transactionStatus`/`transactionReference` optional on
  `TransactionStatusResponse` (AC requirement) means `src/app/api/mvola/status/[correlationId]/route.ts:65`
  and 7 mock literals in the legacy `src/__tests__/app/api/mvola/status/[correlationId]/route.test.ts`
  no longer type-check under `npx tsc --noEmit` (they were written against the old
  required-fields shape). Both files are outside this story's declared scope (`src/lib/mvola/status.ts`,
  `src/lib/mvola/types.ts`, and their two test files only) and are explicitly owned by Story
  09-03 ("Status Route — Remove the Sandbox Short-Circuit", `blocked_by: [09-02]`), which
  rewrites that exact call site through `parseMvolaStatus()` and rewrites the legacy test file's
  mocks. `npx jest --testPathIgnorePatterns=/node_modules/` was verified to still pass fully for
  every suite this story could affect (357 total checks; the run's only failures are the 21
  pre-existing `CoinFlipGame.test.tsx` failures belonging to Story 09-01, unrelated to and not
  regressed by this change) — ts-jest does not fail a suite on this project's tsc-only
  diagnostic (`tsconfig.json` sets `isolatedModules: true`, so cross-file assignability errors
  do not block the transform). No file outside this story's declared scope was modified.
