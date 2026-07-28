---
slug: mvola-api-coverage
design: pending
---

# MVola API Coverage & Demo Credibility

> Self-contained — a story reads this (+ folder-structure.md, + \_shared.md when noted), not other feature docs.

## Summary

Closes the gap between what the MVola integration *can* do and what it *demonstrably
does*. Three of MVola's four published operations are currently either bypassed in
sandbox or absent: the cash-out and status paths short-circuit to a local timer whenever
`MVOLA_ENV !== "production"` — which is the only way the demo is ever run — and
Transaction Details is not implemented at all. This feature removes both short-circuits so
every demonstrated payment is a real MVola transaction, adds the fourth operation, and
corrects a field-name mismatch that makes MVola's status reply unreadable outside the
sandbox.

Its boundary: this feature owns the **correctness and completeness of the MVola call
surface** and the demo affordances that make settlement visible. The wallet accounting it
rides on — reserve-on-request, refund-on-failure, `walletSettled` idempotency — is owned by
[wallet-aware-mvola](../wallet-aware-mvola/index.md) and is **unchanged**; this feature only
changes what causes those rules to fire. The tab shell and history list belong to
[tabbed-ui](../tabbed-ui/index.md); this feature extends the history row rather than
restructuring it.

### Operation coverage

| MVola operation | Before | After |
|---|---|---|
| Authentication — request access token | Used | Used |
| Merchant Pay — initiate transaction | Used (deposit real, cash-out faked in sandbox) | Used, both directions real |
| Merchant Pay — transaction status | Built but bypassed in sandbox | Used |
| Merchant Pay — transaction details | **Not implemented** | Used |

## Components

### `src/lib/mvola/status.ts` — Shared status reader (new)

- **Type:** Server-only TypeScript module
- **Purpose:** Read MVola's progress field and settled-transaction reference under one
  interpretation, so the polling path and the callback path cannot disagree (spec §5.4)
- **Responsibilities:**
  - `parseMvolaStatus(payload: unknown): { status: TransactionStatus; reference?: string }`
  - Reads the progress field as `status ?? transactionStatus`
  - Reads the settled reference as `objectReference ?? transactionReference`
  - Normalises the status string to the `TransactionStatus` union; an unrecognised value
    is treated as `pending`, never as a terminal state
- **Depends on:** `types.ts`

> **Why tolerant reads rather than a straight rename.** MVola's *status* response was
> verified live on 2026-07-28: the progress field is `status`, not `transactionStatus`, and
> the settled reference is `objectReference`. The *callback* payload's field names were
> **not** verified — no live webhook delivery is captured anywhere in this repo. Accepting
> either spelling on both paths satisfies §5.4 without asserting something unverified about
> the callback. Once a real callback has been observed, the fallback for that path may be
> dropped. See [Open items](#open-items).

### `src/lib/mvola/client.ts::getTransactionDetails` — Details client method (new)

- **Type:** Server-only TypeScript module method
- **Purpose:** Retrieve MVola's authoritative record of a settled transaction
- **Responsibilities:**
  - `getTransactionDetails(transactionReference, token)` →
    `GET {base}/mvola/mm/transactions/type/merchantpay/1.0.0/{transactionReference}`
  - Reuses `buildHeaders()` and `throwOnError()` unchanged
  - **Header note:** per `docs/mvola-reference/merchant-pay-openapi.json`, this operation
    does *not* require the `partnerName` header the other two do. Sending it is harmless and
    keeps `buildHeaders()` single-purpose — do not fork the helper for this.
- **Depends on:** [mvola-core-library](../mvola-core-library/index.md) (`buildHeaders`, `types.ts`)

### `src/lib/mvola/types.ts` — Corrected and extended types

- **Type:** Shared type definitions (file owned by [mvola-core-library](../mvola-core-library/index.md))
- **Responsibilities:**
  - **Correct** `TransactionStatusResponse` to MVola's real shape — see [API](#get-apimvolastatuscorrelationid-changed)
  - **Add** `TransactionDetailsResponse` for the fourth operation
  - **Add** `TransactionComparison` — the `{ mvola, local }` envelope the details route returns
  - `CallbackPayload` keeps `transactionStatus`/`transactionReference` but makes them
    optional alongside `status`/`objectReference`, since the callback shape is unverified

### `src/app/api/mvola/transaction/[transactionReference]/route.ts` — Details route (new)

- **Type:** Next.js API Route (server-only)
- **Purpose:** Serve MVola's record of a settled transaction beside this application's own
  record of it, so a reviewer can see the two ledgers agree
- **Responsibilities:**
  - Acquire a token, call `getTransactionDetails()`
  - Look up the local `TransactionRecord` by `mvolaReference`
  - Return `{ mvola, local }` — **no verdict field.** The comparison is presented, not
    asserted; the UI renders both columns and lets the viewer draw the conclusion
  - `404` when no local record carries that reference; `502` on MVola error
  - **Never fabricates a record.** If MVola rejects the reference, that rejection is
    surfaced — a synthesised record would destroy the only point this view exists to make
- **Depends on:** `lib/mvola/auth.ts`, `lib/mvola/client.ts`, `lib/store/transactions.ts`

### `src/app/api/mvola/withdraw/route.ts` — Short-circuit removed

- **Type:** Next.js API Route (server-only) — modification of the
  [wallet-aware-mvola](../wallet-aware-mvola/index.md) route
- **Purpose:** Submit a real payout to MVola in every environment
- **Responsibilities:**
  - **Delete** the `isSandbox` branch that skips `initiateWithdrawal()` and mints a local
    `crypto.randomUUID()` as a stand-in correlation ID (`withdraw/route.ts:131-156`)
  - **Delete** `SANDBOX_AUTO_COMPLETE_MS` and the 3-second `setTimeout` that reconciles the
    transaction to `completed` with a fabricated `MVL-SANDBOX-…` reference
    (`withdraw/route.ts:30`, `:167-178`)
  - Always: get token → `initiateWithdrawal()` → record MVola's own `serverCorrelationId`
  - The reserve-on-request and refund-on-sync-error behaviour around it is **unchanged**
- **Justification:** a live payout submitted to this partner account on 2026-07-28 was
  accepted exactly like a deposit. The belief that the payout direction is disabled — which
  the comment at `withdraw/route.ts:127-130` records — does not hold.

### `src/app/api/mvola/status/[correlationId]/route.ts` — Short-circuit removed, settled-skip narrowed

- **Type:** Next.js API Route (server-only) — modification
- **Purpose:** Ask MVola for progress, and let MVola's answer drive the wallet
- **Responsibilities:**
  - **Delete** the `|| isSandbox` clause at `status/[correlationId]/route.ts:46` that returns
    local state without calling MVola whenever the environment is not production
  - **Keep** the narrower skip: when the local record is already in a terminal state
    (`status !== "pending"`), return local truth without re-asking. A settled transaction
    will not change, so this is an optimisation — and after this change that terminal state
    is only ever reached *because MVola said so*
  - Reconcile via `reconcileTransaction()` using `parseMvolaStatus()`
- **Depends on:** `lib/mvola/status.ts`, `lib/mvola/reconcile.ts`, `lib/mvola/client.ts`

### `src/app/api/mvola/callback/route.ts` — Unified interpretation

- **Type:** Next.js API Route (server-only) — modification
- **Responsibilities:**
  - Replace the direct destructure of `transactionStatus`/`transactionReference`
    (`callback/route.ts:35-36`) with `parseMvolaStatus(body)`
  - Everything else is unchanged: unknown correlation IDs, parse errors, and reconciliation
    errors all still return `200 { received: true }` so MVola does not retry

### `src/lib/mvola/reconcile.ts` — Reference retention

- **Type:** Server-only TypeScript module — modification
- **Responsibilities:**
  - Persist the settled reference onto `TransactionRecord.mvolaReference` on the first
    terminal transition, so the MVola record stays retrievable afterwards (rule R7)
  - Wallet side-effects and the `walletSettled` idempotency guard are **unchanged**

### `src/lib/mvola/polling.ts` — Polling policy (new)

- **Type:** Shared module (values read server-side, exposed to the client via the balance
  or a small config route — the browser must never read `process.env` directly)
- **Purpose:** Single source for the two timing knobs of spec §9
- **Responsibilities:**
  - `POLL_INTERVAL_MS` from `MVOLA_POLL_INTERVAL_MS`, default `3000`
  - `POLL_TIMEOUT_MS` from `MVOLA_POLL_TIMEOUT_MS`, default `120000`
  - Reaching the ceiling is reported as **"still pending"**, never as failure — the
    transaction may yet settle by callback, and the wallet must not move on a client-side
    timeout (rule R3)

### `src/components/PendingApprovalBanner.tsx` — Approval affordance (new)

- **Type:** React client component
- **Purpose:** Make the wait legible. A pending sandbox transaction is waiting on a human
  approval in MVola's portal; without saying so, the UI reads as hung
- **Responsibilities:**
  - Render while a transaction is `pending`: what is being waited on, elapsed time, and the
    remaining budget from `POLL_TIMEOUT_MS`
  - Link to MVola's developer-portal transaction-approvals page
  - On timeout, switch to "still pending — MVola has not settled this yet", not "failed"
- **Depends on:** `lib/mvola/polling.ts` values

### `src/components/TransactionHistory.tsx` — Expandable settled row

- **Type:** React client component — modification of the
  [tabbed-ui](../tabbed-ui/index.md) component
- **Responsibilities:**
  - A settled row carrying an `mvolaReference` expands to fetch
    `GET /api/mvola/transaction/{reference}` and render MVola's record beside the local one
  - A pending row renders `PendingApprovalBanner` instead
  - A settled row with **no** reference shows why it cannot be opened rather than an
    inert control
  - No new tab, no modal — `TabbedLayout` is untouched

### `scripts/preflight.mjs` — Demo preflight check (new)

- **Type:** Node script, `npm run preflight`
- **Purpose:** Answer "is this demo runnable right now?" before an audience is watching
- **Responsibilities:**
  - Assert every required variable in `.env.local` is set
  - Request an MVola access token — proves credentials are live
  - Issue a `GET` to `MVOLA_CALLBACK_URL` from outside the process and assert it is
    reachable; a dead tunnel is the single most likely cause of a demo that stalls
  - Exit non-zero with a one-line diagnosis per failure

## API

### GET `/api/mvola/transaction/[transactionReference]` (new)

Retrieve MVola's authoritative record of a settled transaction alongside the local one.

| Param | In | Description |
|---|---|---|
| `transactionReference` | path | The reference MVola issued at settlement, stored as `TransactionRecord.mvolaReference` |

**Response (200):**
```json
{
  "mvola": {
    "amount": "5000",
    "currency": "Ar",
    "transactionReference": "...",
    "transactionStatus": "completed",
    "createDate": "2026-07-28T10:32:11.000Z",
    "debitParty": [{ "key": "msisdn", "value": "0343500003" }],
    "creditParty": [{ "key": "msisdn", "value": "034XXXXXXX" }]
  },
  "local": {
    "localTxId": "tx_01HW...",
    "correlationId": "550e8400-e29b-41d4-a716-446655440000",
    "msisdn": "0343500003",
    "direction": "deposit",
    "amount": 5000,
    "status": "completed",
    "walletSettled": true,
    "mvolaReference": "...",
    "createdAt": 1785000000000,
    "updatedAt": 1785000042000
  }
}
```

> The exact key set inside `mvola` is whatever MVola returns and is forwarded unaltered —
> the fields above are indicative **shape only, not a capture**. The response is **not**
> reshaped to match the local record; making the two look alike would defeat the comparison.

**Response (404):** `{ "error": "No local transaction carries that reference" }`
**Response (502):** `{ "error": "MVola API error", "details": "..." }`

**Observed key set — first successful call (live capture):**

```
PASTE THE OBSERVED KEY SET HERE — DO NOT FILL IN BY HAND.
Captured during the docs/architecture/dev-guide.md "Live Sandbox Walkthrough" runbook
(story 09-14), step 5, from a real GET /api/mvola/transaction/{reference} response after
a settled deposit. Record the key names present in the real `mvola` object (redact MSISDN
values in debitParty/creditParty — keep only the last 3 digits).
```

This block remains empty until story 09-14's live run produces a settled transaction
reference and successfully calls this route with it.

### GET `/api/mvola/status/[correlationId]` (changed)

Behaviour changes, contract mostly preserved. MVola's real reply shape is:

```json
{
  "status": "pending | completed | failed",
  "serverCorrelationId": "550e8400-e29b-41d4-a716-446655440000",
  "objectReference": "..."
}
```

The route continues to return `transactionStatus` and `transactionReference` to the browser
so existing UI polling keeps working, and additionally returns `status` and
`objectReference`. What changes is that in sandbox this is now the answer MVola gave, not
the answer local state held.

### PUT `/api/mvola/callback` (changed)

Same contract and same always-`200` guarantee. The payload is now read through
`parseMvolaStatus()`, so a body using `status`/`objectReference` reconciles identically to
one using `transactionStatus`/`transactionReference`.

### POST `/api/mvola/withdraw` (behaviour changed, contract unchanged)

Request and response shapes are exactly as documented in
[wallet-aware-mvola](../wallet-aware-mvola/index.md#post-apimvolawithdraw-wallet-aware). The
`correlationId` returned is now MVola's `serverCorrelationId` in every environment, and no
timer completes the transaction.

## Data

No new stores and no schema change. Two changes in how the existing
[state-store](../state-store/index.md) is populated:

| Field | Before | After |
|---|---|---|
| `TransactionRecord.correlationId` (withdraw, sandbox) | Locally minted UUID | MVola's `serverCorrelationId` |
| `TransactionRecord.mvolaReference` | Set from `transactionReference`; `MVL-SANDBOX-…` when auto-completed | Set from MVola's `objectReference` at settlement; never synthesised |

`mvolaReference` becomes load-bearing rather than decorative — it is the key the details
route looks up (rule R7). A settled transaction without one cannot be opened, and the UI
says so rather than hiding the row.

## Flows

### A. Cash-out through MVola (replaces the sandbox timer)

```
Step 1:  Player requests cash-out in CashOutForm
Step 2:  Browser → POST /api/mvola/withdraw { msisdn, amount }
Step 3:  Validate body; wallets.debitWallet(msisdn, amount)   // RESERVE — unchanged
Step 4:  auth.getToken()
Step 5:  client.initiateWithdrawal()  → debitParty = merchant, creditParty = player
         (previously skipped whenever MVOLA_ENV !== "production")
Step 6a: MVola call throws → wallets.creditWallet(msisdn, amount)  // REFUND — unchanged
         → 502
Step 6b: MVola returns { status: "pending", serverCorrelationId }
         → transactions.createTransaction({ correlationId: <MVola's>, walletSettled: true })
Step 7:  UI shows `pending` + PendingApprovalBanner
Step 8:  Presenter approves in MVola's developer portal        // human step, off-app
Step 9:  Settlement arrives by callback or next poll → reconcileTransaction()
         → mvolaReference := objectReference
```

No local timer participates at any step (rule R1).

### B. Status polling through MVola

```
Step 1:  UI polls GET /api/mvola/status/{correlationId} every POLL_INTERVAL_MS
Step 2:  Local record already terminal? → return local truth, stop polling
         (optimisation only — that state was reached because MVola said so)
Step 3:  Otherwise auth.getToken() → client.getTransactionStatus()
Step 4:  parseMvolaStatus(reply) → { status, reference }
Step 5:  reconcileTransaction(record, status, reference)   // walletSettled guard unchanged
Step 6:  Return the reply to the browser
Step 7:  POLL_TIMEOUT_MS reached with no settlement → UI reports STILL PENDING,
         not failure; wallet untouched (rule R3)
```

### C. Transaction details

```
Step 1:  Player expands a settled row in TransactionHistory
Step 2:  Browser → GET /api/mvola/transaction/{mvolaReference}
Step 3:  Route: auth.getToken() → client.getTransactionDetails(reference, token)
Step 4:  Route: transactions.getByMvolaReference(reference)
Step 5:  Return { mvola, local }
Step 6:  Row renders both records side by side; the viewer compares them
```

If step 3 fails, the failure is shown. Nothing is simulated to fill the gap (spec §6).

### D. Demonstration walkthrough

The sequence a reviewer watches. Steps 3 and 8 are performed by the presenter in MVola's
portal — they are the moments the demo visibly depends on MVola rather than on itself.

| # | Step | Operation exercised |
|---|---|---|
| 1 | Enter the player's number; wallet loads at zero | — |
| 2 | Request a deposit → `pending` + correlation ID | Auth + Initiate |
| 3 | **Approve in MVola's portal** | *(off-app)* |
| 4 | Settlement arrives; balance credited | Status / callback |
| 5 | Open transaction details; MVola's record matches the local entry | Details |
| 6 | Play a coin-flip round | — (no MVola) |
| 7 | Request cash-out; funds reserved, payout submitted → `pending` | Initiate |
| 7b | *(optional)* **Reject** the approval; wallet is refunded | Status / callback |
| 8 | **Approve in MVola's portal** | *(off-app)* |
| 9 | Settlement arrives; cash-out `completed` | Status / callback |
| 10 | Review history; every payment traceable to MVola | — |

Step 7b is optional and decided on the day. It costs nothing if skipped, and the refund path
it exercises (rule R6) must be covered by tests whether or not it is demonstrated.

## Non-functional

### Rules this feature must not break

Restated from the spec because this work touches the paths that enforce them. R3–R6 already
hold and must still hold afterwards.

| # | Rule |
|---|---|
| R1 | Nothing presented as an MVola transaction may be produced locally |
| R2 | Sandbox and production follow the same path; only credentials and addresses differ |
| R3 | A wallet balance changes only when MVola confirms settlement |
| R4 | Settlement is applied once per transaction, whichever of callback or poll arrives first |
| R5 | Credentials remain server-side and are never exposed to the browser |
| R6 | A cash-out reserves funds when requested and refunds them if MVola rejects it |
| R7 | The transaction reference is retained at settlement so the MVola record stays retrievable |

R2 is the structural consequence of this feature: after it, no code branches on
`MVOLA_ENV` except base-URL selection in `client.ts::getBaseUrl()`. That single remaining
branch is the intended one and is the check that R2 still holds.

### Test remediation

`src/__tests__/components/CoinFlipGame.test.tsx` fails (21 checks) because it renders
`CoinFlipGame` without the `MsisdnContext` provider that
`src/components/WalletHeader.tsx:24` defines and the component now requires. The other four
component test files already wrap in the provider; this one was not updated when the
component was refactored. These are stale tests, not broken behaviour — but a failing suite
masks any genuine regression from the work above, so it is repaired **first**, before the
short-circuits are removed.

Tests must also be added for: `parseMvolaStatus()` under both field spellings, the details
route's 404 and 502 paths, the cash-out path reaching MVola in a non-production
environment, and the refund-on-rejection path behind step 7b.

### Timing

| Knob | Env var | Default | Note |
|---|---|---|---|
| Poll interval | `MVOLA_POLL_INTERVAL_MS` | `3000` | |
| Poll ceiling | `MVOLA_POLL_TIMEOUT_MS` | `120000` | Sized for a manual approval. Too short and a live demo reports a timeout while the presenter is still clicking |

## Open items

Restated as of story 09-14's documentation pass — **both remain open**. Neither can be
closed by writing; both require the operator to actually drive the sandbox walkthrough in
`docs/architecture/dev-guide.md` § Live Sandbox Walkthrough — Operator Runbook and paste the
result into the slots that pass has prepared:

- **Callback payload field names — still unverified.** No live MVola webhook delivery has
  been captured in this repo. It is still unknown whether the callback uses
  `status`/`objectReference` (as the status response does) or
  `transactionStatus`/`transactionReference` (as the current code and `_shared.md` assume).
  `parseMvolaStatus()` accepts both, so this does not block correctness — only the removal
  of the redundant fallback is blocked on it. An empty, clearly-labelled capture slot now
  exists at [\_shared.md § Shared message formats](../../_shared.md#shared-message-formats);
  it must be filled from a real `PUT /api/mvola/callback` delivery, observed via the ngrok
  inspector, before this item can close.
- **Details response shape — still indicative.** The `mvola` object in the details response
  above is forwarded verbatim; its fields are drawn from the operation's purpose, not from a
  captured 200. The details call was rejected during an earlier verification attempt because
  no settled transaction reference existed to call it with (that attempt is undated in this
  repo — do not infer a date for it). An empty capture slot now exists
  directly below the [details API response](#get-apimvolatransactiontransactionreference-new)
  above; it must be filled from a real successful call before this item can close.

**Additional finding from this pass (not part of either Open item above, flagged for
whoever picks this up next):** `grep -rn "MVOLA_ENV" src/` does **not** currently return only
`client.ts::getBaseUrl()` as rule R2 requires — `src/lib/mvola/auth.ts:55`
(`const env = process.env.MVOLA_ENV;`, used at `auth.ts:57-58` to compute its own token-endpoint
base URL) reads `MVOLA_ENV` independently of `client.ts::getBaseUrl()`. This is a real R2 gap
in `src/`, out of this story's file scope to fix (this story touches only
`docs/architecture/*`), and should be raised as a follow-up fix before the epic is
considered structurally complete.

## Shared dependencies

- [MVola external API reference](../../_shared.md#mvola-external-api-reference) — all four operations, headers, status codes
- [Shared message formats](../../_shared.md#shared-message-formats)
- [Conventions](../../_shared.md#conventions) — server-only MVola access, integer-Ariary boundary
- [configuration.md](../../configuration.md) — polling knobs, callback URL, credentials
- [dev-guide.md](../../dev-guide.md) — preflight and the demo runbook
- [wallet-aware-mvola](../wallet-aware-mvola/index.md) — reserve/refund semantics and the `walletSettled` guard this feature relies on and does not change
