---
id: 09-12
title: `TransactionHistory` — Expandable Settled Row
epic: 09
status: done
size: L
blocked_by: [09-08, 09-10]
files: [src/components/TransactionHistory.tsx, src/__tests__/components/TransactionHistory.test.tsx]
issue:
prior_status:
---

# Story 09-12: `TransactionHistory` — Expandable Settled Row

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

The history row shows `mvolaReference` as a truncated grey string (`TransactionHistory.tsx:104-108`)
and nothing more. Story 09-08 made that reference retrieve MVola's authoritative record of the
transaction; this story surfaces it.

A settled row carrying a reference expands to show MVola's record beside the local one. The two
are rendered as **separate columns, not merged** — the point is that two independently-kept
ledgers agree, and a single reconciled view would make agreement unfalsifiable. This is step 5
of the demonstration walkthrough and the moment the local bookkeeping is corroborated by an
outside source.

A pending row gets `PendingApprovalBanner` instead. A settled row with no reference says why it
cannot be opened rather than offering an inert control.

No new tab and no modal — `TabbedLayout` is untouched.

## Acceptance Criteria

- [x] A settled row (`completed` / `failed`) with an `mvolaReference` exposes an expand control
- [x] Expanding fetches `GET /api/mvola/transaction/{mvolaReference}` **once**, lazily; collapsing and re-expanding does not refetch
- [x] The expanded panel renders MVola's record and the local record as two labelled columns, clearly attributed to their source
- [x] The MVola column renders whatever keys the response contains, without assuming a fixed field set
- [x] A `404` renders "No local transaction carries that reference"; a `502` renders the MVola error — **neither is filled in with a synthesised record**
- [x] A loading state is shown while the fetch is in flight; an error state is dismissible or retryable
- [x] A `pending` row renders `PendingApprovalBanner` instead of an expand control
- [x] A settled row **without** an `mvolaReference` shows why it cannot be opened (no reference was recorded at settlement) rather than a disabled or dead control
- [x] Game rows are unaffected
- [x] The expand control is keyboard-operable with `aria-expanded` reflecting state
- [x] `TabbedLayout` and the tab set are unchanged; no modal is introduced
- [x] The component still imports nothing from `src/lib/store/*` — everything goes through the API
- [x] Tests cover: expand fetches once, both columns render, collapse/re-expand does not refetch, 404 and 502 states, pending row shows the banner, settled-without-reference explanation, game rows untouched
- [x] `npx jest` passes fully

## Technical Notes

Expansion state belongs per-row and keyed by `localTxId`, so several rows can be open at once
without sharing a fetch:

```tsx
function TransactionRow({ tx }: { tx: TransactionEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState<TransactionComparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  // fetch only on first expand, only when tx.mvolaReference is set
}
```

**Render the MVola column generically.** Story 09-07 explains why the details response shape is
indicative rather than verified: the details call was rejected during the 2026-07-28
verification because no settled reference existed to call it with. Iterating the returned
object's entries — rather than reading named fields — means the panel is correct whatever MVola
actually sends, and means story 09-14 discovers the real shape without this component needing a
change. Format nested `debitParty` / `creditParty` arrays readably if present, but do not
require them.

**Do not merge the columns and do not compute a match indicator.** The route deliberately
returns no verdict (story 09-08), and adding one here would move the judgement from the viewer
to the application — undoing the reason the view exists.

`TransactionHistory` refetches whenever the context balance changes (`TransactionHistory.tsx:162-177`).
Make sure a refetch does not silently discard open expansion state, or a row will collapse
under the viewer mid-demo when an unrelated transaction settles.

This is the largest story in the epic. If it needs splitting during implementation, the natural
seam is: expand control + fetch + comparison panel first, then the pending-row banner and the
missing-reference explanation.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/components/TransactionHistory.tsx` | Expandable settled row, comparison panel, pending banner, missing-reference explanation |
| MODIFY | `src/__tests__/components/TransactionHistory.test.tsx` | Expansion, fetch-once, both columns, 404/502, pending, missing reference |

## Dependencies

- **Blocked by:** Stories 09-08 (details route), 09-10 (banner)
- **Blocks:** Story 09-14

## Related

- **Epic:** 09_mvola-api-coverage
- **Spec reference:** pre-spec § 5.1, § 8 step 5; feature doc § `TransactionHistory`, § Flow C

## Implementation Summary

A settled row (`completed`/`failed`) carrying an `mvolaReference` now renders a
`SettledRowComparison` affordance: a keyboard-operable `<button aria-expanded>` that, on
first expand, lazily fetches `GET /api/mvola/transaction/{reference}` exactly once — a
`useRef` fetch-guard (not component unmount) means collapsing and re-expanding, and even
a parent-driven history refetch (the row survives because `TransactionRow` is keyed by
`localTxId`), never re-fetch. The panel renders MVola's record and the local record as
two separately labelled, source-attributed columns via a generic `RecordColumn` renderer
that iterates `Object.entries()` — no fixed field set is assumed, and `debitParty`/
`creditParty`-shaped arrays are formatted readably without special-casing the rest of the
shape. A `404` renders the route's own message verbatim; a `502` renders `error` +
`details` verbatim; neither path fabricates a record. A loading state and a retryable
error state are both scoped to the row. A `pending` row renders `PendingApprovalBanner`
(fed `pollTimeoutMs` from a new `/api/config/polling` fetch in `TransactionHistory`,
falling back to a hardcoded default on failure) instead of the expand control. A settled
row with no reference renders an explanatory sentence rather than a disabled/dead
control. Game rows are untouched. No import from `src/lib/store/*`, `TabbedLayout`, or
any API route was added or touched.

**Files Touched:**
- MODIFIED `src/components/TransactionHistory.tsx` — +199/-3 lines: added
  `SettledRowComparison`, `RecordColumn`, `formatFieldValue`/`isPartyLike`, the
  `/api/config/polling` fetch and `pollTimeoutMs` state in `TransactionHistory`, and
  wired `PendingApprovalBanner` + the missing-reference explanation into `TransactionRow`
- MODIFIED `src/__tests__/components/TransactionHistory.test.tsx` — +462/-4 lines: new
  fixtures (`SETTLED_NO_REF_ENTRY`, `FAILED_TX_WITH_REF`, `MVOLA_COMPARISON_BODY`), a
  `buildFetchMock` helper, and a new `describe("expandable settled row")` block covering
  every acceptance criterion plus a regression test for expansion state surviving a
  balance-triggered history refetch

**QA:** delegated to `ck-code:qa-validator` — PASS on all 14 acceptance criteria; 567/567
tests passing (29 suites); `npx tsc --noEmit` shows only the pre-existing, out-of-scope
`scripts/__tests__/preflight.test.ts` NODE_ENV overload error (confirmed present before
this story's changes via `git stash`).
