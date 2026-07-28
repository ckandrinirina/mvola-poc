---
id: 09-15
title: Deposit Route — Real Payment, No Auto-Complete Timer
epic: 09
status: todo
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

- [ ] The `setTimeout` auto-complete timer is removed from `src/app/api/mvola/deposit/route.ts`
- [ ] The string `MVL-SANDBOX-` appears nowhere in `src/` (project-wide, closing rule R1)
- [ ] `MVOLA_ENV` is not referenced anywhere in this file — the MVola call path is unconditional
- [ ] `correlationId` on the created record is MVola's `serverCorrelationId` in **every** environment
- [ ] Imports narrowed to what remains reachable once the timer is gone (`reconcileTransaction` /
      `getTransactionByCorrelationId` were the timer's only consumers in the withdraw route —
      verify the same holds here rather than assuming it)
- [ ] Wallet accounting is unchanged and correct: a deposit credits only on confirmed settlement,
      never optimistically at request time
- [ ] The failure path (token fetch throws, or `initiateDeposit` throws) leaves **no** phantom
      credit and no orphan transaction record
- [ ] Failure-path assertions read the real wallet-store balance, not a `creditWallet` call count —
      a call-count assertion passes through a double-credit, a missing credit, and a wrong-amount
      credit alike
- [ ] The behavioural contract is exercised with `MVOLA_ENV` unset, `sandbox`, and `production`
      (09-05 found the old suite pinned `production` in `beforeAll`, which is exactly how the
      sandbox shim survived unexamined)
- [ ] `jest.getTimerCount()` is asserted zero on both the success and failure paths
- [ ] A source-guard test fails if `MVOLA_ENV`, `MVL-SANDBOX-`, or `setTimeout` reappear in this file
- [ ] Full suite green and `npx tsc --noEmit` clean for this story's files

## Notes

- Depends on 09-05 only for its reference implementation and to avoid both stories editing
  overlapping test helpers; there is no runtime dependency between the two routes.
- Does **not** overlap any other epic-09 story's `files:` scope, so it is safe to run in parallel
  with the remaining stories once 09-05 has merged.
