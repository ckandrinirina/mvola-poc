---
id: 09-06
title: Settled-Reference Retention + Lookup by `mvolaReference`
epic: 09
status: in-progress
size: S
blocked_by: [09-01]
files: [src/lib/store/transactions.ts, src/lib/mvola/reconcile.ts, src/lib/store/__tests__/transactions.test.ts, src/lib/mvola/__tests__/reconcile.test.ts]
issue:
prior_status:
---

# Story 09-06: Settled-Reference Retention + Lookup by `mvolaReference`

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

`mvolaReference` is decorative today — set opportunistically at settlement, displayed as text
in the history row (`TransactionHistory.tsx:104-108`), and never read back. Story 09-08 makes
it load-bearing: it becomes the key the transaction-details route looks up. A settled
transaction without one cannot be opened.

Two changes make that possible. The store gains a lookup by `mvolaReference`, which it has no
index for today. And `reconcileTransaction()` is verified — and tested — to persist the
reference on the first terminal transition of every path it handles (rule R7).

## Acceptance Criteria

- [x] `src/lib/store/transactions.ts` exports `getTransactionByMvolaReference(reference: string): TransactionRecord | undefined`
- [x] The lookup is O(1) via a third index (`byMvolaReference: Map<reference, localTxId>`), maintained in `updateTransactionStatus()` alongside the existing indexes
- [x] `resetAll()` clears the new index
- [x] An unknown reference returns `undefined`; an empty-string reference returns `undefined` and is never indexed
- [x] `reconcileTransaction()` persists `mvolaReference` on the first terminal transition for **all four** rows of its truth table (deposit→completed, deposit→failed, withdraw→completed, withdraw→failed)
- [x] Passing `mvolaReference: undefined` leaves any previously stored reference intact — it must not blank it out
- [x] The wallet side-effects and the `walletSettled` idempotency guard are **unchanged**; the truth table in the `reconcile.ts` docstring still holds verbatim
- [x] A second reconcile call on an already-terminal record remains a no-op and does not re-index
- [x] Tests cover: lookup hit, lookup miss, index maintained on each terminal transition, `undefined` reference does not clear a stored one, idempotent re-reconcile
- [x] `npx jest` passes fully

## Technical Notes

`updateTransactionStatus()` (`transactions.ts:101-126`) is the single write path for
`mvolaReference`, so it is the only place the new index needs maintaining:

```typescript
const byMvolaReference = new Map<string, string>(); // mvolaReference → localTxId

// inside updateTransactionStatus, after the patch is applied:
if (patch?.mvolaReference) {
  updated.mvolaReference = patch.mvolaReference;
  byMvolaReference.set(patch.mvolaReference, localTxId);
}
```

Keep the existing `patch?.mvolaReference !== undefined` guard semantics: `undefined` means
"no new information", not "clear it". Story 09-02 already normalises an empty-string reference
to `undefined` upstream, but guard here too — the store is used directly by tests and should
not depend on a caller having sanitised its input.

Reference collisions are not expected (MVola references are unique per settled transaction).
Last-write-wins is acceptable; do not add rejection logic for a case that should not occur.

Inspect `reconcile.ts:46-82` before changing anything — the deposit-completed, deposit-failed
and withdraw-completed branches already forward `mvolaReference` into the patch, and the
withdraw-failed branch does too. This story may therefore be **test-only** on the reconcile
side. If so, say that in the commit rather than manufacturing a change: the value here is the
guarantee, proven by tests, not new code.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/lib/store/transactions.ts` | Add the `mvolaReference` index and its lookup |
| MODIFY | `src/lib/mvola/reconcile.ts` | Verify/ensure reference persistence on every terminal branch |
| MODIFY | `src/lib/store/__tests__/transactions.test.ts` | Lookup hit/miss, index maintenance, reset |
| MODIFY | `src/lib/mvola/__tests__/reconcile.test.ts` | Reference retained on all four terminal rows; `undefined` does not clear |

## Dependencies

- **Blocked by:** Story 09-01
- **Blocks:** Story 09-08

## Related

- **Epic:** 09_mvola-api-coverage
- **Spec reference:** pre-spec § 5.1, rule R7; feature doc § `reconcile.ts`, § Data

## Implementation Summary

Added a third module-private index to the transaction store — `byMvolaReference: Map<reference,
localTxId>` — and its public O(1) accessor `getTransactionByMvolaReference()`. The index is
maintained in the single write path, `updateTransactionStatus()`: the existing `patch?.mvolaReference
!== undefined` guard was tightened to a truthy check (`if (patch?.mvolaReference)`), so both
`undefined` and `""` are treated as "no new information" — a previously stored reference is never
blanked, and an empty string is never written to the record or the index. `resetAll()` now clears
the new map alongside the other two.

`reconcile.ts` required **no code change** — inspection confirmed all four truth-table branches
(deposit→completed, deposit→failed, withdraw→completed, withdraw→failed) already forwarded
`mvolaReference` into the `updateTransactionStatus()` patch before this story. The acceptance
criteria on that side are satisfied by tests alone, proving the existing guarantee rather than
introducing new branching logic.

**Tests added:**
- `transactions.test.ts`: index-maintained-on-patch, previously-stored-reference-survives-undefined-patch,
  empty-string-never-indexed-or-stored, lookup hit/miss/empty-string (new `describe` block),
  `resetAll()` clears the new index.
- `reconcile.test.ts`: deposit→failed row now asserts reference persistence (previously only checked
  status/wallet), idempotent-completed test asserts the index is not re-set/overwritten by a second
  poll's differing reference, and a new test confirms a reference recorded on a still-pending record
  survives a terminal transition whose `mvolaReference` argument is omitted.

**Files Touched:**
- MODIFIED: `src/lib/store/transactions.ts:4-6,21,97-117,136,138,159,165`
- MODIFIED: `src/lib/store/__tests__/transactions.test.ts:5,216-267,275-300,370-384`
- MODIFIED: `src/lib/mvola/__tests__/reconcile.test.ts:21-22,90,95-100,107,110-111,115-121,258-279`

**QA:** Delegated to `ck-code:qa-validator` — PASS on every acceptance criterion. Scoped suite
(`transactions.test.ts` + `reconcile.test.ts`): 39/39 green. Full suite: 319 passed, 21 pre-existing
failures in `src/__tests__/components/CoinFlipGame.test.tsx` ("useMsisdnContext must be used inside
`<WalletHeader>`") — confirmed present via `git stash` before this story's changes, out of this
story's file scope (`src/components/**`), and not a regression introduced here.
