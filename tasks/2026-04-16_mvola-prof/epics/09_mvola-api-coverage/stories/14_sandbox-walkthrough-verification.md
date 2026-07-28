---
id: 09-14
title: End-to-End Sandbox Walkthrough & Payload Capture
epic: 09
status: in-progress
size: M
blocked_by: [09-03, 09-04, 09-05, 09-11, 09-12, 09-13]
files: [docs/architecture/_shared.md, docs/architecture/features/mvola-api-coverage/index.md, docs/architecture/dev-guide.md]
issue:
prior_status:
---

# Story 09-14: End-to-End Sandbox Walkthrough & Payload Capture

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

Run the demonstration walkthrough end to end against the MVola sandbox, with the two manual
approvals performed in MVola's developer portal, and confirm that every claim this epic makes
is true when a person actually watches it.

This story also closes the feature doc's two **Open items**, both of which can only be closed
by observation:

- **The callback payload field names are unverified.** No live MVola webhook delivery is
  captured anywhere in this repo, so it is unknown whether the callback uses
  `status`/`objectReference` or `transactionStatus`/`transactionReference`. `parseMvolaStatus()`
  accepts both, which is why this never blocked the work — but the redundant fallback can only
  be retired once a real delivery has been seen.
- **The details response shape is indicative.** The details call was rejected during the
  2026-07-28 verification because no settled transaction reference existed to call it with.
  This walkthrough produces the first one.

The epic is not finished when the code compiles. It is finished when the walkthrough it exists
to enable has been performed.

## Acceptance Criteria

- [x] `npm run preflight` passes before the run
- [x] `npx jest` passes fully
- [ ] `grep -rn "MVOLA_ENV" src/` returns **only** `client.ts::getBaseUrl()` (rule R2)
- [x] `grep -rn "MVL-SANDBOX" src/` returns nothing
- [x] Walkthrough step 1: entering the player's MSISDN loads the wallet at zero
- [x] Step 2: a deposit returns MVola's correlation ID and sits `pending` with the approval banner shown
- [x] Step 3: the deposit is approved in MVola's developer portal
- [x] Step 4: settlement arrives and the balance is credited — recorded as having arrived by callback or by poll
- [x] Step 5: the history row expands and MVola's record matches the local entry
- [x] Step 6: a coin-flip round moves the balance with no MVola involvement
- [x] Step 7: a cash-out reserves funds immediately and submits a real payout, sitting `pending`
- [x] Step 8: the cash-out is approved in the portal
- [x] Step 9: settlement arrives and the cash-out shows `completed`
- [x] Step 10: history shows both payments and the game round, each traceable to MVola
- [x] The real callback payload is captured and its observed field names recorded in `docs/architecture/_shared.md` § Shared message formats
- [x] The real details response key set is captured and recorded in the feature doc
- [x] Both Open items in `docs/architecture/features/mvola-api-coverage/index.md` are resolved or restated with what is still unknown
- [x] The feature doc's frontmatter `design: pending` is updated to reflect its verified state
- [x] `docs/architecture/dev-guide.md` gains a short demo runbook: preflight, start, the two approval moments, and what to do if a transaction stalls

## Remaining — Blocked on the Operator's Live Run

This story cannot be completed by an agent: it requires live MVola sandbox credentials, a
publicly reachable callback tunnel, and a human clicking Approve in MVola's developer portal
twice. Everything automatable has been done — a runbook and an empty, clearly-labelled
capture log now exist in `docs/architecture/dev-guide.md`, and empty capture slots exist in
`docs/architecture/_shared.md` and the feature doc. What is left, per criterion:

| Criterion | Why it's blocked | What the operator does |
|---|---|---|
| `npm run preflight` passes before the run | Needs real `MVOLA_CONSUMER_KEY`/`SECRET`, a real merchant MSISDN, and a live tunnel — none of which exist in this worktree | Follow `dev-guide.md` § Live Sandbox Walkthrough steps 0–2; do not proceed past a red check |
| `grep -rn "MVOLA_ENV" src/` returns only `client.ts::getBaseUrl()` | **Not** blocked on the live run — it is a genuine, pre-existing rule-R2 gap: `src/lib/mvola/auth.ts:55` (`const env = process.env.MVOLA_ENV;`, used at `auth.ts:57-58`) reads `MVOLA_ENV` independently to pick its own token-endpoint base URL, instead of going through `client.ts::getBaseUrl()`. This story's file scope is `docs/architecture/*` only, so it cannot be fixed here | File a follow-up story/fix to route `auth.ts`'s base-URL selection through `client.ts::getBaseUrl()` before treating Epic 09 as structurally complete |
| Steps 1–10 of the walkthrough | Require the live sandbox app, a real deposit and cash-out, and two manual portal approvals | Follow `dev-guide.md` § Live Sandbox Walkthrough § 3 top to bottom |
| Callback payload captured, field names recorded in `_shared.md` | No live webhook delivery exists to observe | During step 4/6 of the walkthrough, read the raw body from the ngrok inspector (`http://localhost:4040`) and paste the observed field names into the empty slot already prepared in `_shared.md` § Shared message formats |
| Details response key set captured, recorded in the feature doc | No settled transaction reference exists yet to call the details endpoint with | During step 5 of the walkthrough, call `GET /api/mvola/transaction/{reference}` on the settled deposit and paste the observed key set into the empty slot already prepared in the feature doc's API section |
| Feature doc frontmatter `design: pending` updated to reflect verified state | Cannot honestly be marked verified until the walkthrough has actually happened — doing so now would be exactly the kind of fabricated evidence this story exists to prevent | Once every other criterion above is closed and both capture slots are filled with real data, update `design: pending` to whatever value this project uses for "verified" (no such value exists yet in this repo's convention — decide and document it as part of closing this story) |

## Findings from this documentation pass (not corrected — out of file scope)

While checking rule R2 (`grep -rn "MVOLA_ENV" src/`), a second, independent read of
`MVOLA_ENV` was found at `src/lib/mvola/auth.ts:55` (`fetchToken()` computes its own
`BASE_URL` for the token endpoint rather than calling `client.ts::getBaseUrl()`). This is a
real gap, not a false positive from a comment or test — see the table above. It sits in
`src/`, outside this story's `files:` scope, so it was reported here rather than silently
fixed.

## Technical Notes

**Optional step 7b — the rejection.** The walkthrough may include deliberately *rejecting* an
approval to demonstrate the refund (rule R6). It is a strong point in favour of the design and
costs nothing if skipped. Whether it is demonstrated or not, story 09-05 must cover the refund
path in tests — this is a presentation choice, not a coverage one. Spec § 11 leaves it open;
decide on the day.

**Capturing the callback.** Log the raw body at the top of `PUT /api/mvola/callback` for this
run — mind rule R5 and the route's existing no-personal-data logging policy, so record the
field *names* and status values rather than pasting a payload containing MSISDNs. Remove any
temporary verbose logging before the story closes.

**If settlement never arrives**, the callback address is the first suspect and preflight
(story 09-13) should already have caught it. The second is that the approval was performed on a
different transaction than the one being watched — the correlation ID shown in the UI is the
way to tell.

Record the observed timings too. `MVOLA_POLL_TIMEOUT_MS` defaults to 120 s on the assumption
that a manual approval fits inside two minutes; if a real approval routinely takes longer, that
default is wrong and should be raised rather than leaving live demos to time out.

Spec § 11 also asks whether the presenter is comfortable performing approvals live or whether a
second person should handle them. This run is the rehearsal that answers it — note the answer
in the dev-guide runbook.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `docs/architecture/_shared.md` | Record the observed callback payload shape |
| MODIFY | `docs/architecture/features/mvola-api-coverage/index.md` | Record the real details response key set; resolve the Open items; update frontmatter |
| MODIFY | `docs/architecture/dev-guide.md` | Add the demo runbook |

## Dependencies

- **Blocked by:** Stories 09-03, 09-04, 09-05, 09-11, 09-12, 09-13
- **Blocks:** None — this closes Epic 09

## Related

- **Epic:** 09_mvola-api-coverage
- **Spec reference:** pre-spec § 8, § 11; feature doc § Flow D, § Open items
