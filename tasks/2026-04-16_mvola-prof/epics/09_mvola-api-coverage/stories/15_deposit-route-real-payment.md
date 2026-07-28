---
id: 09-15
title: Deposit Route — Real Payment, No Auto-Complete Timer
epic: 09
status: done
size: M
blocked_by: [09-05]
files: [src/app/api/mvola/deposit/route.ts, src/app/api/mvola/deposit/__tests__/route.test.ts]
issue:
prior_status:
---

# Story 09-15: Deposit Route — Real Payment, No Auto-Complete Timer

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Why this story exists

This story was **not in the original epic plan**. It was discovered during story 09-05, which
removed the sandbox auto-complete short-circuit from the *withdraw* route and then found the
identical short-circuit still living in the *deposit* route:

```
src/app/api/mvola/deposit/route.ts:87
  reconcileTransaction(latest, "completed", `MVL-SANDBOX-${record.localTxId.slice(0, 8)}`);
```

The epic's feature doc schedules the withdraw, status, and callback routes for de-sandboxing but
never the deposit route, and no other story in epic 09 declares that file in its `files:` scope.
Story 09-11 owns the `DepositForm` **component**, not the route. So without this story the epic
would close with rule R1 — *no fabricated settlements; every demonstrated payment is a real MVola
transaction* — satisfied for cash-out but silently violated for deposit, which is the more common
demo path.

## Scope

Mirror what 09-05 did for withdraw, applied to deposit. 09-05's rewritten
`src/app/api/mvola/withdraw/route.ts` and its test suite are the reference implementation —
follow their structure rather than inventing a new shape.

## Acceptance criteria

- [x] The `setTimeout` auto-complete timer is removed from `src/app/api/mvola/deposit/route.ts`
- [x] The string `MVL-SANDBOX-` appears nowhere in `src/` (project-wide, closing rule R1)
- [x] `MVOLA_ENV` is not referenced anywhere in this file — the MVola call path is unconditional
- [x] `correlationId` on the created record is MVola's `serverCorrelationId` in **every** environment
- [x] Imports narrowed to what remains reachable once the timer is gone (`reconcileTransaction` /
      `getTransactionByCorrelationId` were the timer's only consumers in the withdraw route —
      verify the same holds here rather than assuming it)
- [x] Wallet accounting is unchanged and correct: a deposit credits only on confirmed settlement,
      never optimistically at request time
- [x] The failure path (token fetch throws, or `initiateDeposit` throws) leaves **no** phantom
      credit and no orphan transaction record
- [x] Failure-path assertions read the real wallet-store balance, not a `creditWallet` call count —
      a call-count assertion passes through a double-credit, a missing credit, and a wrong-amount
      credit alike
- [x] The behavioural contract is exercised with `MVOLA_ENV` unset, `sandbox`, and `production`
      (09-05 found the old suite pinned `production` in `beforeAll`, which is exactly how the
      sandbox shim survived unexamined)
- [x] `jest.getTimerCount()` is asserted zero on both the success and failure paths
- [x] A source-guard test fails if `MVOLA_ENV`, `MVL-SANDBOX-`, or `setTimeout` reappear in this file
- [x] Full suite green and `npx tsc --noEmit` clean for this story's files

## Notes

- Depends on 09-05 only for its reference implementation and to avoid both stories editing
  overlapping test helpers; there is no runtime dependency between the two routes.
- Does **not** overlap any other epic-09 story's `files:` scope, so it is safe to run in parallel
  with the remaining stories once 09-05 has merged.

## Implementation Summary

**Approach.** Mirrored 09-05's rewritten withdraw route and suite rather than inventing a new
shape. The production change is a deletion: the `MVOLA_ENV` branch, the `setTimeout`
auto-complete timer, the synthesised `MVL-SANDBOX-` reference and the now-unreachable
`SANDBOX_AUTO_COMPLETE_MS` constant are gone. The route now submits a real deposit to MVola in
every environment and records MVola's `serverCorrelationId` unconditionally.

**Imports — verified, not assumed.** The criterion asked to confirm rather than copy 09-05's
finding. `getTransactionByCorrelationId` (old line 85) and `reconcileTransaction` (old line 87)
each had exactly one consumer in this file, both inside the timer body, so both imports were
removed; `createTransaction` is the only store import that survives. A source-guard test pins
this.

**Wallet accounting is unchanged, and that is the point.** The deposit route never touched the
wallet and still does not. A deposit credits only on confirmed settlement, applied by
`reconcile.ts` when the callback or a status poll reports it (rule R3). The record is created
with `walletSettled: false` and stays `pending`. The timer was the one thing that violated this,
by driving a completed settlement locally.

**Test-design decision (the substantive one).** The suite mocks **only** the HTTP edge
(`auth.ts`, `client.ts`). The transaction store, the wallet store and `reconcile.ts` are left
**real**. This is what makes the money assertions load-bearing: with the timer still present,
the real `reconcileTransaction` really calls `creditWallet`, so the phantom credit shows up as an
actual balance change. Had `reconcile` been mocked, that credit would have been absorbed
invisibly, and a `creditWallet` call-count assertion would have passed a double-credit, a missing
credit and a wrong-amount credit alike.

**The environment matrix earned its keep.** `describe.each` runs the contract with `MVOLA_ENV`
unset, `sandbox` and `production`. In the RED run the four timer/settlement tests failed under
*unset* and *sandbox* but **passed** under *production* — a direct reproduction of how the shim
survived unexamined behind a `production`-pinned `beforeAll`.

**Verification.** RED: 12 failing (4 source guards + 4 timer/settlement tests × unset & sandbox).
GREEN: 26 suites / 523 tests passing — the same total as the RED run, so the 12 flipped rather
than disappearing. `npx tsc --noEmit` clean. `grep -rn 'MVL-SANDBOX-' src/` now matches only
assertion strings in the deposit and withdraw test files; no production source. Rule R1 is closed
for both money directions.

> Note: a full-suite run issued immediately after writing the test file reported a false green
> (25 suites / 433 tests, 0 failures) because the new file had not yet entered Jest's module map.
> The re-run picked it up as 26 suites / 523 tests with 12 failures. Suite **and** test counts are
> worth checking against the expected baseline before trusting a green run here.

### Files Touched

- MODIFIED `src/app/api/mvola/deposit/route.ts:1-101` — removed the `MVOLA_ENV` branch, the
  auto-complete timer, the `MVL-SANDBOX-` reference and `SANDBOX_AUTO_COMPLETE_MS`; narrowed the
  store import to `createTransaction`; rewrote the module header, which had documented the removed
  shim as intended behaviour.
- MODIFIED `src/app/api/mvola/deposit/__tests__/route.test.ts:1-548` — rewrote the suite around a
  three-value `MVOLA_ENV` matrix, real store/reconcile modules, real-balance and real-record
  assertions, `jest.getTimerCount()` checks on the success and failure paths, and six source
  guards.

### Follow-up (outside this story's file scope — not changed)

`.claude/skills/guides/conventions/SKILL.md` § *Known Deviations* still records this deposit-route
deviation as live, describing it as "scheduled for removal by the `mvola-api-coverage` feature
(epic 09)". It is now removed, so that entry is stale and should be deleted when epic 09 closes.
Left untouched here because the file is outside this story's declared `files:` scope.
