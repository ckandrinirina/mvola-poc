---
id: 09-11
title: Wire Polling Knobs and Banner into `DepositForm` / `CashOutForm`
epic: 09
status: todo
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

- [ ] Both forms poll at `pollIntervalMs` from `GET /api/config/polling`, falling back to `3000` if the config fetch fails
- [ ] Both stop polling at `pollTimeoutMs` and enter a distinct **still-pending** state
- [ ] The still-pending state is visually and textually distinct from `failed`; the word "failed" is not used for it
- [ ] The still-pending state does **not** call `refreshBalance()` and does not alter any displayed balance (rule R3)
- [ ] `PendingApprovalBanner` renders in both forms while status is `pending`, receiving the submission time and `pollTimeoutMs`
- [ ] A terminal status still stops the interval, sets the status, and calls `refreshBalance()` on `completed` exactly as before
- [ ] Both forms keep reading `body.transactionStatus`, which story 09-03 guarantees is still present
- [ ] Intervals are cleared on unmount and before any new submit — no leaks, no duplicate loops
- [ ] The `CashOutForm` insufficient-funds (409) and refund-on-failure messages are unchanged
- [ ] Tests cover for both forms: interval uses the configured value, ceiling produces the still-pending state, banner renders while pending, `refreshBalance` is not called on timeout, cleanup on unmount, terminal status still settles normally
- [ ] `npx jest` passes fully

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
