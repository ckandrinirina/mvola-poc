---
id: 09-05
title: Withdraw Route — Real Payout, No Auto-Complete Timer
epic: 09
status: todo
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

- [ ] The `isSandbox` branch at `route.ts:131-156` is deleted; the MVola call path is unconditional
- [ ] `SANDBOX_AUTO_COMPLETE_MS` (`route.ts:30`) and the `setTimeout` block (`route.ts:167-178`) are deleted
- [ ] The stale comment at `route.ts:127-130` is deleted
- [ ] `MVOLA_ENV` is not referenced anywhere in this file
- [ ] The string `MVL-SANDBOX-` appears nowhere in `src/`
- [ ] `correlationId` on the created record is MVola's `serverCorrelationId` in **every** environment
- [ ] Funds are still reserved by `debitWallet()` **before** any `await` (rule R6)
- [ ] Insufficient funds still returns `409 { error, balance, requested }` without calling MVola
- [ ] A `getToken()` or `initiateWithdrawal()` throw still refunds via `creditWallet()` and returns `502 { error, details }`, and **no transaction record is created**
- [ ] On success the record still carries `walletSettled: true` and the response is still `{ correlationId, localTxId, status: "pending" }`
- [ ] `getTransactionByCorrelationId` and `reconcileTransaction` imports are removed if the timer was their only consumer
- [ ] Tests cover, with `MVOLA_ENV` unset or `"sandbox"`: MVola is called; MVola's correlation ID is recorded; rejection refunds the wallet and creates no record; no timer fires
- [ ] `npx jest` passes fully

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
