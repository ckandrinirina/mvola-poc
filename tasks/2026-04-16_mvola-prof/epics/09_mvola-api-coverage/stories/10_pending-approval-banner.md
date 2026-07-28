---
id: 09-10
title: `PendingApprovalBanner` Component
epic: 09
status: done
size: M
blocked_by: [09-09]
files: [src/components/PendingApprovalBanner.tsx, src/__tests__/components/PendingApprovalBanner.test.tsx]
issue:
prior_status:
---

# Story 09-10: `PendingApprovalBanner` Component

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

Sandbox transactions do not settle on their own. They stay `pending` until approved by hand in
MVola's developer portal, on its transaction-approvals page. The 3-second timer removed in
story 09-05 hid this, and in hiding it also hid the fact that MVola was involved at all.

Without the timer, a pending transaction now sits visibly waiting. The current UI has one word
for that state — "Pending…" with a spinner (`DepositForm.tsx:129-134`) — which reads as a hung
application rather than a system waiting on a person.

`PendingApprovalBanner` gives the wait a voice: what is being waited on, how long it has been
waiting, how much budget remains, and a link to the page where the approval is performed. A
viewer watching a balance change *after* an approval elsewhere sees something a local timer
cannot imitate — but only if the interface says that is what is happening.

## Acceptance Criteria

- [x] `src/components/PendingApprovalBanner.tsx` is a React client component (`"use client"`)
- [x] It states plainly what is being waited on: MVola settlement, pending a manual approval in the developer portal
- [x] It shows elapsed time, updating at least once per second
- [x] It shows the remaining budget, derived from `pollTimeoutMs`
- [x] It links to MVola's developer-portal transaction-approvals page, opening in a new tab with `rel="noopener noreferrer"`
- [x] On reaching the ceiling it switches to **"still pending — MVola has not settled this yet"**, never "failed" and never an error style
- [x] The timed-out state explains that settlement may still arrive by callback, so the wait is not presented as a dead end
- [x] Timing values arrive as props or from `GET /api/config/polling` — the component does not hardcode `3000` or `120000`
- [x] Its interval is cleared on unmount; no timer survives the component
- [x] It renders nothing (or is not mounted) when there is no pending transaction
- [x] Styling is consistent with the existing components: Tailwind utilities only, rounded card, amber for waiting rather than red
- [x] Tests cover: renders while pending, elapsed time advances under fake timers, ceiling switches to the still-pending wording, the word "failed" never appears, cleanup on unmount, approvals link present
- [x] `npx jest` passes fully

## Technical Notes

Suggested surface — keep the component presentational and let callers own the transaction state:

```tsx
interface PendingApprovalBannerProps {
  startedAt: number;        // ms epoch, when the transaction was submitted
  pollTimeoutMs: number;
  timedOut?: boolean;       // caller-controlled; the banner may also derive it
}
```

Story 09-11 mounts it in the two forms and story 09-12 mounts it in pending history rows, so
it must not assume a single caller or reach into `MsisdnContext`.

**The wording is the deliverable.** "Waiting for MVola" is not enough — it must say that a human
approval in MVola's portal is what unblocks it, because in sandbox that is literally true and
the presenter is the human. The distinction between "still pending" and "failed" is not
cosmetic either: reporting failure on a client-side timeout would contradict rule R3, since the
transaction may settle by callback moments later and the wallet must not have moved on the
client's guess.

The approvals-page URL belongs to MVola's developer portal. Confirm the exact path from the
portal or `docs/mvola-reference/01-developer-guide.pdf` rather than guessing; a link that 404s
in front of an audience is worse than no link. If it cannot be confirmed, link the portal root
and name the page in the text.

Use `jest.useFakeTimers()` for the elapsed-time and ceiling tests, and wrap advances in `act()`.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/components/PendingApprovalBanner.tsx` | The approval affordance |
| CREATE | `src/__tests__/components/PendingApprovalBanner.test.tsx` | Wording, timing, cleanup, link |

## Dependencies

- **Blocked by:** Story 09-09
- **Blocks:** Stories 09-11, 09-12

## Related

- **Epic:** 09_mvola-api-coverage
- **Spec reference:** pre-spec § 5.5; feature doc § `PendingApprovalBanner`

## Implementation Summary

`PendingApprovalBanner` is a purely presentational client component: it takes `startedAt`
(ms epoch or `null`/`undefined`), `pollTimeoutMs`, and an optional caller-controlled
`timedOut` override as props, and owns no transaction state, no fetch, and no context
dependency — matching the requirement that stories 09-11/09-12 mount it without it
reaching into form state.

While `startedAt` is set, it ticks a 1-second clock (`setInterval`, cleared on unmount)
showing elapsed time and the remaining budget derived from `pollTimeoutMs`, states plainly
that settlement is waiting on a manual approval in MVola's developer portal, and links to
it (`target="_blank"`, `rel="noopener noreferrer"`). The developer-portal transaction-
approvals sub-path is not documented anywhere in the repo (confirmed against
`docs/mvola-reference/01-developer-guide.pdf` and `docs/mvola-reference/README.md`), so the
link points at the confirmed portal root `https://developer.mvola.mg/devportal/` and names
"Transaction Approvals" in the link text instead, per the story's guidance to avoid a link
that 404s. On reaching `pollTimeoutMs` (or when `timedOut` is passed), the banner switches
to "Still pending — MVola has not settled this yet" and explains settlement may still
arrive by callback — the word "failed" never appears and the styling stays amber
throughout, never red. `startedAt == null` renders `null`.

One refactor beyond the initial pass: the elapsed clock is seeded from `startedAt` itself
(elapsed = 0) rather than `Date.now()`, and reconciled to the real clock in the mount
effect — avoiding a server/client render mismatch on first paint, consistent with this
project's established caution around environment-dependent initial render state.

**Files Touched:**
- CREATED: `src/components/PendingApprovalBanner.tsx`
- CREATED: `src/__tests__/components/PendingApprovalBanner.test.tsx`

**Tests:** 10 new tests (461/461 project-wide passing). `npx tsc --noEmit` clean.
**QA:** PASS — all acceptance criteria verified against source with file:line citations;
no code-quality issues found.
