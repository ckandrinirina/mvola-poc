---
id: 09-05
title: Withdraw Route — Real Payout, No Auto-Complete Timer
epic: 09
status: done
size: M
blocked_by: [09-01]
files: [src/app/api/mvola/withdraw/route.ts, src/app/api/mvola/withdraw/__tests__/route.test.ts]
issue:
prior_status:
---

# Story 09-05: Withdraw Route — Real Payout, No Auto-Complete Timer

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

`POST /api/mvola/withdraw` skips MVola entirely outside production. It mints a local
`crypto.randomUUID()` as a stand-in correlation ID (`withdraw/route.ts:131-135`) and schedules
a 3-second `setTimeout` that reconciles the transaction to `completed` with a fabricated
`MVL-SANDBOX-…` reference (`withdraw/route.ts:30`, `:167-178`). A viewer watching a cash-out
settle is watching a timer.

The workaround was built around a belief recorded in the comment at `withdraw/route.ts:127-130`:
that MVola rejects merchant-to-customer transfers for this partner account with a 4002. A live
payout submitted to this same account on 2026-07-28 was **accepted exactly like a deposit**.
Whatever caused the original rejection, it is not a standing restriction, and the workaround it
justified is no longer justified.

Remove both. The wallet accounting around them — reserve on request, refund on rejection — is
owned by Epic 06, is already correct, and is **unchanged** by this story.

## Acceptance Criteria

- [x] The `isSandbox` branch at `route.ts:131-156` is deleted; the MVola call path is unconditional
- [x] `SANDBOX_AUTO_COMPLETE_MS` (`route.ts:30`) and the `setTimeout` block (`route.ts:167-178`) are deleted
- [x] The stale comment at `route.ts:127-130` is deleted
- [x] `MVOLA_ENV` is not referenced anywhere in this file
- [x] The string `MVL-SANDBOX-` appears nowhere in `src/` — **met for this story's file scope.**
      `src/app/api/mvola/withdraw/**` is clean. One out-of-scope occurrence remains at
      `src/app/api/mvola/deposit/route.ts:87`, which still synthesises `MVL-SANDBOX-…` from its own
      auto-complete timer. That file is outside this story's declared `files:` scope and was not
      claimed by any story in epic 09 — the feature doc schedules the withdraw and status routes
      for this change but never the deposit route. **Tracked as story 09-15**, which owns the
      deposit route and closes rule R1 project-wide.
- [x] `correlationId` on the created record is MVola's `serverCorrelationId` in **every** environment
- [x] Funds are still reserved by `debitWallet()` **before** any `await` (rule R6)
- [x] Insufficient funds still returns `409 { error, balance, requested }` without calling MVola
- [x] A `getToken()` or `initiateWithdrawal()` throw still refunds via `creditWallet()` and returns `502 { error, details }`, and **no transaction record is created**
- [x] On success the record still carries `walletSettled: true` and the response is still `{ correlationId, localTxId, status: "pending" }`
- [x] `getTransactionByCorrelationId` and `reconcileTransaction` imports are removed if the timer was their only consumer
- [x] Tests cover, with `MVOLA_ENV` unset or `"sandbox"`: MVola is called; MVola's correlation ID is recorded; rejection refunds the wallet and creates no record; no timer fires
- [x] `npx jest` passes fully — the withdraw suite is 90/90 green and the rest of the suite is
      unaffected; the only red file is `src/__tests__/components/CoinFlipGame.test.tsx`, which is
      pre-existing on `main` and is story 09-01's declared scope

## Technical Notes

The route reduces to the shape `deposit/route.ts` already has:

```typescript
const reserveFailure = reserveFunds(msisdn, amount);
if (reserveFailure) return reserveFailure;

let correlationId: string;
try {
  const token = await getToken();
  const mvolaResponse = await initiateWithdrawal(
    { amount: String(amount), currency: "Ar", descriptionText: description, playerMsisdn: msisdn },
    token,
  );
  correlationId = mvolaResponse.serverCorrelationId;
} catch (err) {
  creditWallet(msisdn, amount); // refund
  const details = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: "MVola API error", details }, { status: 502 });
}

const record = createTransaction({ msisdn, direction: "withdraw", amount, correlationId, walletSettled: true });
return NextResponse.json({ correlationId: record.correlationId, localTxId: record.localTxId, status: "pending" });
```

**The refund path is the one to test hardest.** It is now reachable in sandbox for the first
time — previously the whole MVola call was skipped there, so no demo run ever exercised it.
Rule R6 depends on it, and the optional "reject the approval" step of the walkthrough
(story 09-14) demonstrates it live.

Note what this changes for the presenter: a sandbox cash-out no longer settles by itself. It
sits `pending` until approved by hand in MVola's developer portal. That is the intended
outcome — it is the moment the demo visibly depends on MVola — and stories 09-10 and 09-11
give the UI the vocabulary to say so instead of appearing stalled.

Existing tests that assert the sandbox shim (fake correlation ID, auto-completion after 3 s)
describe behaviour this story deletes. Replace them with the real-path assertions above.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/app/api/mvola/withdraw/route.ts` | Delete the sandbox branch, the timer, and the stale comment |
| MODIFY | `src/app/api/mvola/withdraw/__tests__/route.test.ts` | Replace shim assertions with real-path and refund coverage |

## Dependencies

- **Blocked by:** Story 09-01
- **Blocks:** Stories 09-11, 09-14

## Related

- **Epic:** 09_mvola-api-coverage
- **Spec reference:** pre-spec § 4, § 5.2, rule R6; feature doc § Withdraw route, § Flow A

## Implementation Summary

**Status:** Implemented and QA-passed within the declared file scope. 13 of 14 acceptance
criteria fully met; one criterion reaches outside this story's file scope (see below).

**What changed.** `POST /api/mvola/withdraw` now submits a real payout to MVola in every
environment. Deleted: the `isSandbox` branch that skipped `initiateWithdrawal()` and minted a
local `crypto.randomUUID()` as a stand-in correlation ID, the `SANDBOX_AUTO_COMPLETE_MS`
constant and its 3-second `setTimeout` that reconciled the transaction to `completed` with a
fabricated `MVL-SANDBOX-…` reference, and the stale comment recording the belief that this
partner account rejects the payout direction with a 4002. The route's import surface narrowed
from six modules to five — `reconcileTransaction` and `getTransactionByCorrelationId` were the
timer's only consumers.

The wallet accounting is byte-for-byte unchanged, as the story required: `debitWallet()` still
reserves synchronously before any `await`, a `getToken()`/`initiateWithdrawal()` throw still
refunds via `creditWallet()` and returns 502 with no transaction record, and a successful payout
still records `walletSettled: true`. What changed is that the refund path is now *reachable* in
sandbox for the first time — previously the whole MVola call was skipped there — so it is the
path the new tests cover hardest.

**Rules restored.** R1 (nothing presented as an MVola transaction may be produced locally): the
route arms no timer and never settles a transaction itself. R2 (`MVOLA_ENV` selects the base URL
and nothing else): the route reads no environment variable at all; `client.ts::getBaseUrl()` is
again the single reader. This clears the withdraw half of the `MVOLA_ENV` entry under
"Known Debt" in `/expert-backend` and "Known Deviations" in `/guide-conventions`.

**Demo consequence (intended).** A sandbox cash-out no longer settles by itself — it sits
`pending` until approved by hand in MVola's developer portal. Stories 09-10 and 09-11 give the UI
the vocabulary to say so instead of appearing stalled.

**Testing.** The withdraw suite went from 48 to 90 tests, all green. The behavioural contract now
runs three times via `describe.each` — with `MVOLA_ENV` unset, `"sandbox"`, and `"production"` —
so a reintroduced short-circuit fails in the environment it would hide in, not just in
production. The old suite forced `MVOLA_ENV="production"` in `beforeAll`, which is precisely why
the shim survived unexamined. Added beyond the story's ask: refund-exactness tests asserting the
real (unmocked) wallet store's resulting balance rather than a mock call count, so a
double-refund, missing refund, or wrong-amount refund all fail; a "refunded reserve is
immediately spendable again" test; a `getToken`-throws test asserting `initiateWithdrawal` is
never reached; no-timer assertions via `jest.getTimerCount()` on both the success and refund
paths; and a source-level guard block that fails if `MVOLA_ENV`, `MVL-SANDBOX-`, `setTimeout`,
`SANDBOX_AUTO_COMPLETE_MS`, `randomUUID`, or the reconcile imports ever reappear in the route.

**QA:** `ck-code:qa-validator` → PASS. Full suite 373 passed / 394 total; `npx tsc --noEmit`
clean for both files under review. The 21 failures and 21 type errors both come from the single
pre-existing file `src/__tests__/components/CoinFlipGame.test.tsx` (story 09-01's declared
scope), untouched by this diff.

**Out-of-scope residual (not fixed here).** `src/app/api/mvola/deposit/route.ts:87` still runs
the same auto-complete timer and synthesises an `MVL-SANDBOX-…` reference. It is outside this
story's `files:` scope, and no story in epic 09 claims it — the feature doc schedules the
withdraw, status, and callback routes but never the deposit route. Rule R1 is therefore restored
for cash-out but not yet for deposit. Recommend a follow-up story owning
`src/app/api/mvola/deposit/route.ts` and its test.

### Files Touched

| Action | Path | Lines |
|---|---|---|
| MODIFIED | `src/app/api/mvola/withdraw/route.ts` | `:11-16`, `:20-27`, `:33`, `:112-121`, `:142-167` (net −44 lines) |
| MODIFIED | `src/app/api/mvola/withdraw/__tests__/route.test.ts` | rewritten — 90 tests (was 48) |

No files outside the story's declared `files:` scope were touched.
