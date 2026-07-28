# MVola API Coverage & Demo Credibility

**Status:** draft · **Language:** English · **Audience:** technical reviewers
**Created:** 2026-07-28

---

## 1. Context

The proof of concept already moves money through MVola. A player deposits from
their MVola account into an in-game wallet, plays a coin-flip round, and cashes
out. That story is built and the wallet accounting behind it is sound.

What the demo does **not** yet do is prove it. Two of the three payment
interactions a viewer would watch — the cash-out and the status check — are
short-circuited whenever the application runs against the sandbox, which is the
only way it is ever demonstrated. They complete on a local timer instead of
through MVola. The transaction they appear to describe never leaves the
building.

Live verification against the MVola sandbox on 2026-07-28 established that this
shortcut is no longer necessary. Every operation MVola publishes responds
correctly to this partner account, including the payout direction the code was
written to avoid. The gap between what the integration *can* do and what it
*demonstrably does* is the subject of this specification.

A secondary finding: MVola's published surface is far smaller than it appears
from the portal. It consists of two APIs and four operations in total. Complete
coverage is therefore an achievable goal for this proof of concept, not an
aspiration — and "we exercise the entire MVola API" is a far stronger claim to
present than "we exercise most of it".

---

## 2. Objectives

1. **Exercise every operation MVola publishes** — all four, with the one
   currently unused operation (Transaction Details) added and shown.
2. **Route every demonstrated payment through MVola for real**, so that nothing
   a viewer watches is produced by a local timer.
3. **Interpret MVola's responses correctly**, closing a field-naming mismatch
   that currently makes the transaction status unreadable outside the sandbox.
4. **Make the sandbox approval step visible rather than hidden**, so the
   pending-to-completed transition is understood as MVola's decision.
5. **Ensure the demo is reproducible on demand** — a stable callback address
   and a fully passing test suite.

---

## 3. Current coverage

MVola publishes two APIs. This is the complete surface.

| API | Operation | Purpose | Status today |
|---|---|---|---|
| Authentication | Request access token | Bearer token, one-hour lifetime | Fully used |
| Merchant Pay | Initiate transaction | Moves money in either direction | Fully used |
| Merchant Pay | Transaction status | Progress of a submitted transaction | Built, but bypassed in sandbox |
| Merchant Pay | Transaction details | Full record of a settled transaction | **Not implemented** |

Coverage is therefore two operations of four demonstrably exercised, and a
third that exists only as unreachable code during any demonstration.

---

## 4. Verification results

All calls were made against the MVola sandbox with the project's own
credentials on 2026-07-28.

| Interaction | Result | Interpretation |
|---|---|---|
| Access token request | Accepted | Credentials valid; one-hour token issued |
| Deposit — player to merchant | Accepted, pending | Works as designed |
| Payout — merchant to player | Accepted, pending | **Works.** Contradicts the assumption it was disabled |
| Status enquiry | Accepted | Works, but the reply is read incorrectly |
| Transaction details | Rejected | Requires a settled transaction's reference, which the demo never captures |

Two findings deserve emphasis.

**The payout direction is not blocked.** The cash-out path was written around a
belief that MVola rejects merchant-to-customer transfers for this partner
account. A live payout submitted during verification was accepted exactly like
a deposit. Whatever caused the original rejection, it is not a standing
restriction, and the workaround built in response is no longer justified.

**The status reply is read under the wrong field name.** MVola reports progress
in a field named `status`; the integration reads one named `transactionStatus`
and finds nothing. In the sandbox this is invisible, because the status path is
bypassed before the mismatch can matter. In production nothing bypasses it, and
every transaction would read as having no status at all. This is a latent
production defect that the sandbox shortcut is actively concealing.

---

## 5. Behaviors

### 5.1 Complete the API surface

The demo gains a transaction-details view. Once a transaction settles, MVola
issues a transaction reference; that reference retrieves the authoritative
record of what happened — amounts, both parties, timestamps and final state, as
MVola holds them rather than as the application remembers them.

This requires capturing and retaining the transaction reference at settlement,
which the application currently discards. Presented alongside the local wallet
entry, it demonstrates that local bookkeeping and MVola's ledger agree — a
point worth making explicitly to a reviewer.

The history view gains a way to open this record for any settled transaction.

### 5.2 Cash-out goes through MVola

The sandbox shortcut on the cash-out path is removed. A cash-out submits a real
payout to MVola and returns MVola's own correlation identifier, exactly as a
deposit does.

The wallet accounting around it is unchanged and already correct: funds are
reserved when the request is made and refunded if MVola rejects it, so a
player's balance can never be spent twice while a payout is in flight.

### 5.3 Status polling goes through MVola

The sandbox shortcut on the status path is removed. Polling asks MVola, and the
answer drives the wallet.

One piece of the existing shortcut is worth keeping in narrower form: once a
transaction has reached a settled state locally, there is no value in asking
again, and the application should stop. The distinction is that settlement is
now reached *because MVola said so*, not because a timer expired.

### 5.4 Status is read correctly

The application reads MVola's progress field under its actual name, and the
settled-transaction reference under its actual name. Both the polling path and
the callback path apply the same interpretation, so the two routes to
settlement cannot disagree.

### 5.5 Sandbox approval becomes part of the story

Sandbox transactions do not settle on their own. They remain pending until
approved by hand in MVola's developer portal, on its transaction-approvals
page. The current three-second auto-completion timer hides this, and in doing so
hides the fact that MVola is involved at all.

The demo should instead show the transaction sitting in `pending`, wait for the
approval, and then show it settle — driven by MVola's callback or by the next
poll. A viewer watching a balance change *after* an approval elsewhere sees
something a local timer cannot imitate.

This makes the demo dependent on a live approval step. The presenter should
expect to perform it, and the interface should say plainly what it is waiting
for rather than appearing stalled.

### 5.6 The demo is reproducible

Two practical obstacles stand between the current state and a demonstration
that can be run on request.

The callback address is a temporary tunnel that expires. MVola cannot deliver
settlement notifications to a dead address, and the notification is what makes
settlement feel real. The demo needs an address that is still valid when it is
run, and the presenter needs a way to confirm this before starting.

The test suite does not pass. Twenty-one checks covering the coin-flip game
fail because they exercise the component without the surrounding context it
was recently changed to require. The failures are stale tests rather than
broken behaviour, but a failing suite is not something to present, and it masks
any genuine regression introduced by the work described here.

---

## 6. Decisions

| Question | Decision | Reason |
|---|---|---|
| Keep the sandbox cash-out shortcut? | No — remove it | Live verification shows the payout direction is accepted |
| Keep the sandbox status shortcut? | No — remove it | It conceals a production defect and removes MVola from the demo |
| Stop polling once settled? | Yes | Settled state will not change; retained as an optimisation, not a substitute |
| Keep the three-second auto-completion? | No — replace with the real approval step | The approval is the most convincing part of the demonstration |
| Add Transaction Details? | Yes | Completes the API surface and corroborates local bookkeeping |
| Simulate a settled transaction to demo details? | No | A fabricated record would undermine the point the view exists to make |
| Fix the failing tests? | Yes | Required to trust that these changes break nothing |

---

## 7. Rules

| # | Rule |
|---|---|
| R1 | Nothing presented as an MVola transaction may be produced locally. |
| R2 | Sandbox and production follow the same path; only credentials and addresses differ. |
| R3 | A wallet balance changes only when MVola confirms settlement. |
| R4 | Settlement is applied once per transaction, whether the callback or a poll arrives first, or both. |
| R5 | Credentials remain server-side and are never exposed to the browser. |
| R6 | A cash-out reserves funds when requested and refunds them if MVola rejects it. |
| R7 | The transaction reference is retained at settlement so the MVola record stays retrievable. |

Rules R3 through R6 describe behaviour that already holds. They are recorded
here because the changes above touch the paths that enforce them, and they must
still hold afterwards.

---

## 8. Demonstration walkthrough

The sequence a reviewer would watch, at human pace.

| | Step | What is visible |
|---|---|---|
| 1 | Presenter enters the player's number | Wallet loads, zero balance |
| 2 | Deposit requested | Submitted to MVola; correlation identifier returned; state `pending` |
| 3 | Approval given in MVola's portal | *(performed by the presenter, on MVola's own site)* |
| 4 | Settlement arrives | Balance credited; state `completed` |
| 5 | Transaction details opened | MVola's own record, matching the local entry |
| 6 | Coin-flip round played | Balance moves on the game outcome; no MVola involvement |
| 7 | Cash-out requested | Funds reserved immediately; payout submitted to MVola; state `pending` |
| 8 | Approval given in MVola's portal | *(performed by the presenter)* |
| 9 | Settlement arrives | Cash-out shown `completed` |
| 10 | History reviewed | Both payments and the game round, each traceable to MVola |

Steps 2, 4, 5, 7 and 9 each exercise a distinct MVola operation. Between them
the walkthrough covers all four, in both payment directions, through both
settlement routes.

The two approval steps are the ones worth drawing attention to: they are the
moments where the demonstration visibly depends on MVola rather than on itself.

---

## 9. Operational knobs

| Knob | Purpose | Suggested default |
|---|---|---|
| Environment | Selects sandbox or production | Sandbox |
| Callback address | Where MVola sends settlement notices | A stable address, confirmed before each demo |
| Poll interval | How often a pending transaction is re-checked | A few seconds |
| Poll ceiling | When to stop waiting and report a timeout | Around two minutes, to accommodate a manual approval |
| Merchant identity | The merchant's MVola number and partner name | The sandbox test number already configured |

The poll ceiling matters more than it would otherwise, because the approval is
manual. Too short and a live demonstration reports failure while the presenter
is still clicking.

---

## 10. Out of scope

- Persistent storage; state remains in memory and is lost on restart
- Multiple concurrent players or multiple merchants
- Player authentication
- Production hardening beyond what is described above
- The production go-live submission itself, including MVola's branding
  requirements and its web security checklist — both are prerequisites for
  going live, and neither is needed to demonstrate the integration
- Any workaround for MVola's own broken documentation download, which returns a
  server error on their side

---

## 11. Open questions

1. **Callback address.** Is a stable public address available for the demo, or
   should the presenter refresh a temporary tunnel beforehand and verify it as
   part of the setup routine?
2. **Approval timing.** Is the presenter comfortable performing the approval
   live in MVola's portal, or should the walkthrough be rehearsed with a second
   person handling approvals?
3. **Failure demonstration.** Should the walkthrough include a deliberately
   rejected transaction to show the refund behaviour? It is a strong point in
   favour of the design, but it lengthens the demonstration and depends on
   being able to reject an approval on request.

---

## Next step

Comments are welcome from anyone — on the coverage claims, on the walkthrough,
or on whether the demonstration tells the right story for its audience. Once
this reads correctly, it moves on to architecture.
