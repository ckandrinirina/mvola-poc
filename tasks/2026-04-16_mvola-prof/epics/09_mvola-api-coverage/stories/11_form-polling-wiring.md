---
id: 09-11
title: Wire Polling Knobs and Banner into `DepositForm` / `CashOutForm`
epic: 09
status: done
size: M
blocked_by: [09-05, 09-10]
files: [src/components/DepositForm.tsx, src/components/CashOutForm.tsx, src/__tests__/components/DepositForm.test.tsx, src/__tests__/components/CashOutForm.test.tsx]
issue:
prior_status:
---

# Story 09-11: Wire Polling Knobs and Banner into `DepositForm` / `CashOutForm`

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

Both forms run their own copy of the same polling loop: a hardcoded 3000 ms `setInterval`
against `/api/mvola/status/{correlationId}`, stopping only when the status turns terminal
(`DepositForm.tsx:31-47` and the equivalent in `CashOutForm.tsx:45-...`). Neither has a ceiling,
so a transaction that is never approved is polled until the tab closes.

Replace the hardcoded interval with the configured one, add the ceiling, and render
`PendingApprovalBanner` while a transaction is pending — so the wait explains itself instead of
spinning.

## Acceptance Criteria

- [x] Both forms poll at `pollIntervalMs` from `GET /api/config/polling`, falling back to `3000` if the config fetch fails
- [x] Both stop polling at `pollTimeoutMs` and enter a distinct **still-pending** state
- [x] The still-pending state is visually and textually distinct from `failed`; the word "failed" is not used for it
- [x] The still-pending state does **not** call `refreshBalance()` and does not alter any displayed balance (rule R3)
- [x] `PendingApprovalBanner` renders in both forms while status is `pending`, receiving the submission time and `pollTimeoutMs`
- [x] A terminal status still stops the interval, sets the status, and calls `refreshBalance()` on `completed` exactly as before
- [x] Both forms keep reading `body.transactionStatus`, which story 09-03 guarantees is still present
- [x] Intervals are cleared on unmount and before any new submit — no leaks, no duplicate loops
- [x] The `CashOutForm` insufficient-funds (409) and refund-on-failure messages are unchanged
- [x] Tests cover for both forms: interval uses the configured value, ceiling produces the still-pending state, banner renders while pending, `refreshBalance` is not called on timeout, cleanup on unmount, terminal status still settles normally
- [x] `npx jest` passes fully

## Technical Notes

The two forms now share four concerns — fetch config, poll, apply the ceiling, render the
banner. Extracting a `useTransactionPolling(correlationId)` hook is the cleaner shape and is
encouraged; duplicating the logic a second time is acceptable but note the duplication.

```typescript
function useTransactionPolling(correlationId: string | null) {
  // fetch /api/config/polling once; interval at pollIntervalMs;
  // stop on terminal status OR at pollTimeoutMs → { status: "still-pending" };
  // clear on unmount and on correlationId change
}
```

**The timeout is not a failure and must not behave like one.** Reaching the ceiling means the
client stopped asking, nothing more. The transaction may settle by callback seconds later, and
the wallet must not move on a client-side guess. Concretely: do not set `status` to `"failed"`,
do not call `refreshBalance()`, do not show an error style. Assert this in tests — it is the
easiest requirement in this story to get wrong and the most consequential.

Story 09-05 makes cash-out genuinely pending in sandbox, so `CashOutForm` reaches these states
for the first time in a demo. It is the form most likely to sit in the banner state during a
walkthrough, since the presenter must approve the payout in MVola's portal before it settles.

The config fetch should happen once per form (or once per hook instance), not once per poll
tick. A failed config fetch must not prevent polling — fall back and carry on.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/components/DepositForm.tsx` | Configured interval, ceiling, still-pending state, banner |
| MODIFY | `src/components/CashOutForm.tsx` | Same |
| MODIFY | `src/__tests__/components/DepositForm.test.tsx` | Interval, ceiling, banner, no-balance-move-on-timeout |
| MODIFY | `src/__tests__/components/CashOutForm.test.tsx` | Same, plus unchanged 409 / refund messages |

## Dependencies

- **Blocked by:** Stories 09-05 (cash-out genuinely pending), 09-10 (the banner)
- **Blocks:** Story 09-14

## Related

- **Epic:** 09_mvola-api-coverage
- **Spec reference:** pre-spec § 5.5, § 9, rule R3; feature doc § Timing

---

## Implementation Summary

**Completed:** 2026-07-28
**TDD Iterations:** 2 (red→green→refactor cycles: DepositForm, then CashOutForm)
**QA Iterations:** 1
**Manual-test bugs:** none (manual-test gate deferred to the orchestrator per parallel-build convention)
**Tests written:** 8 new (4 per form: configured interval, ceiling → still-pending without `refreshBalance`, banner rendering, unmount/ceiling-timeout cleanup) + 1 pre-existing assertion disambiguated
**Files created:** 0
**Files modified:** 4
**Unplanned changes:** none

### What Was Implemented

- Replaced the hardcoded 3000 ms `setInterval` in both `DepositForm` and `CashOutForm`
  with a `usePollingConfig()` hook that reads `pollIntervalMs`/`pollTimeoutMs` once from
  `GET /api/config/polling`, falling back to 3000/120000 ms on any fetch failure or
  malformed response — polling is never blocked on this fetch.
- Added a ceiling `setTimeout` (`pollTimeoutMs`) alongside the polling interval in both
  forms. Reaching it stops polling and sets a new `"still-pending"` status — distinct
  from `"failed"`, never calls `refreshBalance()`, never mutates displayed balance
  (rule R3).
- Rendered `PendingApprovalBanner` (unmodified, from story 09-10) in both forms while
  `status`/`transactionStatus` is `"pending"` or `"still-pending"`, passing the
  submission timestamp (`submittedAt`) and `pollTimeoutMs`, with an explicit `timedOut`
  override so the ceiling transition is deterministic rather than derived from the
  banner's own clock.
- `usePollingConfig()` is intentionally duplicated verbatim in both files per the
  story's Technical Notes (shared hook extraction was optional; duplication documented
  rather than silently repeated).
- `CashOutForm.startPolling` now clears any prior interval/timeout before starting new
  ones (matching `DepositForm`'s existing guard) — closes a latent duplicate-polling
  gap the story's AC called out explicitly.
- Fixed one pre-existing test assertion in `DepositForm.test.tsx` that became
  ambiguous once the banner's own copy also contains the word "pending".

### Files Touched

MODIFIED src/components/DepositForm.tsx:2-61,63-84,87-103,110-124,126-132,150-156,209-230
MODIFIED src/components/CashOutForm.tsx:2-67,73-88,95-141,150-159,175-181,248-269
MODIFIED src/__tests__/components/DepositForm.test.tsx:210-216,504-716
MODIFIED src/__tests__/components/CashOutForm.test.tsx:57-83,466-772

### SOLID Compliance

- **SRP:** `usePollingConfig()` owns only reading/validating the polling policy;
  `startPolling`/`stopPolling` own only interval/timeout lifecycle; rendering stays in
  JSX. `PendingApprovalBanner` (untouched) keeps sole ownership of pending-wait
  presentation — the forms supply data via props only, never fetching or deriving
  timeout state inside it.
- **OCP:** The `DepositStatus`/`TransactionStatus` unions extend with `"still-pending"`
  without altering the terminal-status branch (`completed`/`failed` handling is
  untouched).
- **LSP:** N/A — no inheritance/polymorphism introduced.
- **ISP:** `PendingApprovalBanner`'s existing narrow prop interface (`startedAt`,
  `pollTimeoutMs`, optional `timedOut`) was reused as-is; no new props needed.
- **DIP:** Both forms depend on the `GET /api/config/polling` HTTP boundary (an
  abstraction over the server-only `src/lib/mvola/polling.ts`), never importing the
  server module directly.

### Notes

- QA delegated to `ck-code:qa-validator`: PASS on all acceptance criteria, 29 test
  suites / 562 tests / 0 failures, `tsc --noEmit` clean aside from one pre-existing,
  unrelated error in `scripts/__tests__/preflight.test.ts` (out of scope).
- Per parallel-build convention, this run stops before the manual-test gate (build
  Phase 8.5) and does not run `ck-index.sh` — the orchestrator regenerates the shared
  indexes and performs manual testing after merge.
