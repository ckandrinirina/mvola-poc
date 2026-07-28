---
epic: 09
slug: mvola-api-coverage
title: MVola API Coverage & Demo Credibility
description: Close the gap between what the MVola integration can do and what it demonstrably does — remove the sandbox short-circuits so every demonstrated payment is a real MVola transaction, add the fourth published operation, and correct the field-name mismatch that makes MVola's status reply unreadable outside the sandbox.
---

# Epic 09: MVola API Coverage & Demo Credibility

## Description

Epics 01–08 built a proof of concept that moves money through MVola: a player deposits from
their MVola account into an in-game wallet, plays a coin-flip round, and cashes out. The
wallet accounting behind that is sound. What the demo does not yet do is **prove** it.

Two of the three payment interactions a viewer would watch — the cash-out and the status
check — short-circuit to local code whenever `MVOLA_ENV !== "production"`, which is the only
way the demo is ever run. The cash-out mints a local UUID instead of calling MVola
(`withdraw/route.ts:131-156`) and a 3-second timer fabricates an `MVL-SANDBOX-…` reference
(`withdraw/route.ts:167-178`); the status route returns local state without asking MVola
(`status/[correlationId]/route.ts:46`). A fourth published operation, Transaction Details,
is not implemented at all. And `types.ts:60` reads MVola's progress under `transactionStatus`
when MVola actually sends `status` — a latent production defect that the sandbox shortcut is
actively concealing.

This epic removes both short-circuits, adds the fourth operation, corrects the field
interpretation on both settlement routes, and adds the demo affordances that make MVola's
involvement visible: a pending-approval banner, an expandable history row showing MVola's
record beside the local one, and a preflight check that answers "is this demo runnable right
now?" before an audience is watching.

Its boundary: this epic owns the **correctness and completeness of the MVola call surface**.
The wallet accounting it rides on — reserve-on-request, refund-on-failure, the
`walletSettled` idempotency guard — is owned by Epic 06 and is **unchanged**. This epic only
changes what causes those rules to fire. The tab shell and history list belong to Epic 08;
this epic extends the history row rather than restructuring it.

## Goals

- Exercise all four operations MVola publishes, with Transaction Details added and shown
- Route every demonstrated payment through MVola for real — no local timer produces anything a viewer sees
- Read MVola's status reply under its actual field names, identically on the polling and callback paths
- Make the sandbox approval step visible rather than hidden
- Restore a fully passing test suite and make the demo reproducible on demand

## Scope

### In Scope

- Removing the sandbox branches in `withdraw/route.ts` and `status/[correlationId]/route.ts`
- A shared `parseMvolaStatus()` reader used by both the polling and callback paths
- `getTransactionDetails()` client method + `GET /api/mvola/transaction/[transactionReference]`
- Retaining the settled MVola reference and indexing transactions by it
- Poll interval / poll ceiling knobs, surfaced to the browser without exposing `process.env`
- `PendingApprovalBanner` and an expandable settled row in `TransactionHistory`
- `scripts/preflight.mjs` (`npm run preflight`)
- Repairing the 21 failing `CoinFlipGame` checks

### Out of Scope

- Persistent storage — state remains in memory and is lost on restart
- Multiple concurrent players or multiple merchants; player authentication
- Any change to reserve/refund semantics or the `walletSettled` guard (Epic 06 owns these)
- Restructuring `TabbedLayout` — no new tab, no modal
- The production go-live submission, MVola's branding requirements, and its web security checklist

## Dependencies

- **Depends on:** Epic 06 (wallet-aware MVola routes, `reconcileTransaction`), Epic 07 (history route), Epic 08 (`TransactionHistory`, `MsisdnContext`, the forms)
- **Blocks:** None — this is the epic that makes the demo presentable

## Stories

| # | Story | Size | Status |
|---|-------|------|--------|
| 01 | Repair the `CoinFlipGame` Test Suite | S | TODO |
| 02 | `parseMvolaStatus()` — Shared Status Reader + Type Corrections | M | TODO |
| 03 | Status Route — Remove the Sandbox Short-Circuit | M | TODO |
| 04 | Callback Route — Unified Interpretation | S | TODO |
| 05 | Withdraw Route — Real Payout, No Auto-Complete Timer | M | TODO |
| 06 | Settled-Reference Retention + Lookup by `mvolaReference` | S | TODO |
| 07 | `getTransactionDetails()` — The Fourth MVola Operation | S | TODO |
| 08 | Details Route — `GET /api/mvola/transaction/[transactionReference]` | M | TODO |
| 09 | Polling Policy Module + Client Config Exposure | M | TODO |
| 10 | `PendingApprovalBanner` Component | M | TODO |
| 11 | Wire Polling Knobs and Banner into `DepositForm` / `CashOutForm` | M | TODO |
| 12 | `TransactionHistory` — Expandable Settled Row | L | TODO |
| 13 | `scripts/preflight.mjs` — Demo Preflight Check | M | TODO |
| 14 | End-to-End Sandbox Walkthrough & Payload Capture | M | TODO |

## Acceptance Criteria

- [ ] `npx jest` passes fully — 332/332 checks, 23/23 suites
- [ ] No code branches on `MVOLA_ENV` anywhere except `client.ts::getBaseUrl()`
- [ ] A cash-out in sandbox returns MVola's own `serverCorrelationId`; no `crypto.randomUUID()` stands in for it
- [ ] No `setTimeout` reconciles a transaction; `MVL-SANDBOX-` appears nowhere in `src/`
- [ ] A status poll in sandbox reaches MVola; the terminal-state skip remains and is reached only because MVola said so
- [ ] A payload using `status`/`objectReference` and one using `transactionStatus`/`transactionReference` reconcile identically on both routes
- [ ] `GET /api/mvola/transaction/{reference}` returns `{ mvola, local }`, 404 without a local record, 502 on MVola error, and never fabricates a record
- [ ] A pending transaction shows what it is waiting for and how long remains; reaching the ceiling reports "still pending", never "failed"
- [ ] A settled history row with a reference expands to show MVola's record beside the local one; one without a reference explains why it cannot be opened
- [ ] `npm run preflight` exits non-zero with a one-line diagnosis per failure
- [ ] The full walkthrough runs end to end against the sandbox with two manual approvals

## Technical Notes

**Rules this epic must not break** (restated from the spec because this work touches the
paths that enforce them; R3–R6 already hold and must still hold afterwards):

| # | Rule |
|---|---|
| R1 | Nothing presented as an MVola transaction may be produced locally |
| R2 | Sandbox and production follow the same path; only credentials and addresses differ |
| R3 | A wallet balance changes only when MVola confirms settlement |
| R4 | Settlement is applied once per transaction, whichever of callback or poll arrives first |
| R5 | Credentials remain server-side and are never exposed to the browser |
| R6 | A cash-out reserves funds when requested and refunds them if MVola rejects it |
| R7 | The transaction reference is retained at settlement so the MVola record stays retrievable |

R2 is the structural consequence of this epic. After it, `getBaseUrl()` holds the single
remaining `MVOLA_ENV` branch, and that is the check that R2 still holds.

**Ordering.** Story 09-01 comes first and alone. A failing suite masks any genuine regression
introduced by the rest of this epic, so the baseline is made green before anything else moves.

**Why tolerant reads rather than a straight rename.** MVola's *status* response was verified
live on 2026-07-28: the progress field is `status`, the settled reference is `objectReference`.
The *callback* payload's field names were **not** verified — no live webhook delivery is
captured anywhere in this repo. Accepting either spelling on both paths satisfies the
requirement without asserting something unverified. Story 09-14 captures a real delivery so
the redundant fallback can later be dropped.

**Test file locations.** Component tests live in `src/__tests__/components/`; route and lib
tests live beside their subject in `__tests__/` folders. Note that the callback route has
tests in *both* conventions (`src/__tests__/app/api/mvola/callback/route.test.ts` and
`src/app/api/mvola/callback/__tests__/route.test.ts`) — both must be kept passing.

**Environment.** This repo uses `.env`, not `.env.local`. Preflight must check the variables
Next.js actually loads rather than a fixed filename.
