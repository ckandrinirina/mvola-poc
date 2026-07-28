---
slug: wallet-aware-mvola
design: planned
---

# Wallet-Aware MVola Flows

> Self-contained — a story reads this (+ folder-structure.md, + \_shared.md when noted), not other feature docs.

## Summary

Brings the MVola integration up to the product's real requirements: adds the **deposit**
direction, retrofits the **cash-out** route to reserve wallet funds at request time, and
makes the **status** and **callback** routes reconcile wallet balances idempotently. The
centrepiece is a shared `reconcileTransaction()` helper so the status route and the
webhook route apply the same logic — the `walletSettled` flag on each `TransactionRecord`
prevents double-credits when both paths fire for the same transaction. Its boundary: this
feature owns the wallet side-effects on MVola routes; the base route contracts belong to
[api-routes](../api-routes/index.md) and the stores themselves to
[state-store](../state-store/index.md).

## Components

### `src/lib/mvola/client.ts::initiateDeposit` — Deposit client method

- **Type:** Server-only TypeScript module method
- **Purpose:** POST to MVola Merchant Pay with the deposit party pair
- **Responsibilities:**
  - `initiateDeposit(params, token)` → debitParty = player MSISDN, creditParty = merchant MSISDN
  - Shares URL, headers, and error handling with `initiateWithdrawal`; only the party pair differs
- **Depends on:** [mvola-core-library](../mvola-core-library/index.md) (`buildHeaders`, `types.ts`)

### `src/app/api/mvola/deposit/route.ts` — Deposit Route

- **Type:** Next.js API Route (server-only)
- **Purpose:** Initiate a deposit from a player's MVola account into the in-game wallet
- **Responsibilities:**
  - Validate request body (`msisdn`, `amount`)
  - Ensure a valid OAuth token (via `auth.ts`)
  - Call `client.ts → initiateDeposit()`
  - Create a `TransactionRecord` with `direction: "deposit"`, `status: "pending"`, `walletSettled: false`
  - Return `{ correlationId, localTxId, status: "pending" }` to the client for polling
  - **Does NOT credit the wallet yet** — the wallet is only credited when MVola confirms
- **Depends on:** `lib/mvola/auth.ts`, `lib/mvola/client.ts`, `lib/store/transactions.ts`

### `src/app/api/mvola/withdraw/route.ts` — Withdraw (Cash-Out) Route, wallet-aware

- **Type:** Next.js API Route (server-only) — refactor of the [api-routes](../api-routes/index.md) base route
- **Purpose:** Cash out wallet funds to a player's MVola number, reserving the amount upfront
- **Responsibilities:**
  - Validate request body (`msisdn`, `amount`)
  - Check `wallets.ts → getWallet(msisdn).balance >= amount` — return `409 Conflict` if insufficient
  - **Reserve (debit) the amount from the wallet immediately** so concurrent rounds cannot overdraft
  - Call `client.ts → initiateWithdrawal()`
  - Create a `TransactionRecord` with `direction: "withdraw"`, `status: "pending"`, `walletSettled: true`
  - On MVola call error or `failed` status later, **refund the wallet** and flip `walletSettled` back to `false`
- **Depends on:** `lib/mvola/auth.ts`, `lib/mvola/client.ts`, `lib/store/{wallets,transactions}.ts`

### `src/lib/mvola/reconcile.ts` — Reconciliation helper

- **Type:** Server-only TypeScript module
- **Purpose:** Apply the wallet side-effect of a transaction status transition exactly once
- **Responsibilities:**
  - On first transition to `completed`:
    - **Deposit:** credit the wallet for the amount, set `walletSettled: true`
    - **Withdraw:** no-op (already settled at request time)
  - On first transition to `failed`:
    - **Deposit:** no-op (never credited), set `walletSettled: true` (frozen)
    - **Withdraw:** refund the wallet, set `walletSettled: false`
  - Update the local record's `status`, `mvolaReference`, `updatedAt`
  - All mutations guarded by the `walletSettled` flag to ensure idempotency
- **Depends on:** `lib/store/{wallets,transactions}.ts`

### `src/app/api/mvola/status/[correlationId]/route.ts` — Status Route, reconciling

- **Type:** Next.js API Route (server-only) — extends the [api-routes](../api-routes/index.md) base route
- **Purpose:** Check transaction status **and** reconcile wallet state
- **Responsibilities:**
  - Look up the local `TransactionRecord` by `correlationId`
  - Call `reconcileTransaction()` with the MVola status
  - Return `{ transactionStatus, transactionReference }` to the client
- **Depends on:** `lib/mvola/reconcile.ts`, `lib/mvola/client.ts`

### `src/app/api/mvola/callback/route.ts` — Webhook Route, reconciling

- **Type:** Next.js API Route (server-only) — extends the [api-routes](../api-routes/index.md) base route
- **Purpose:** Receive MVola's asynchronous callback and reconcile wallet state
- **Responsibilities:**
  - Look up the `TransactionRecord` by `serverCorrelationId`
  - Apply the same `reconcileTransaction()` logic as the status route
  - Log the callback payload
  - Always return `200 OK` (MVola retries on non-200)
- **Depends on:** `lib/mvola/reconcile.ts`

## API

### POST `/api/mvola/deposit`

Initiate a **deposit** from a player's MVola account into the in-game wallet. Internally
calls the same MVola Merchant Pay endpoint as withdraw, but with `debitParty` = player
MSISDN and `creditParty` = merchant MSISDN. The in-game wallet is credited **only when
MVola confirms** the transaction (via status poll or webhook), never at request time.

**Request:**
```json
{
  "msisdn": "0343500003",
  "amount": "5000"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| msisdn | string | Yes | Player MVola phone number (debited by MVola) |
| amount | string | Yes | Amount in Ariary (e.g. `"5000"`) |

**Response (200):**
```json
{
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "localTxId": "tx_01HW...",
  "status": "pending"
}
```

**Response (400):**
```json
{ "error": "msisdn and amount are required" }
```

**Response (502):**
```json
{ "error": "MVola API error", "details": "..." }
```

> The wallet is NOT credited by this endpoint. Poll `GET /api/mvola/status/{correlationId}`
> until `completed`; the status route (or the webhook) will apply the wallet credit.

### POST `/api/mvola/withdraw` (wallet-aware)

Initiate a **cash-out** from the merchant account to a player's MVola number. The in-game
wallet is debited (reserved) **at request time** and refunded if MVola rejects the request
or reports `failed`. The base request/response shape is documented in
[api-routes](../api-routes/index.md#post-apimvolawithdraw); this feature adds:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | string | Yes | Amount in Ariary — must be ≤ wallet balance |

**Response (409):**
```json
{ "error": "Insufficient funds", "balance": 1000, "requested": 5000 }
```

> On success, the wallet is **immediately debited by `amount`** (reserve). If the MVola
> call itself fails synchronously, or the transaction later resolves to `failed`, the
> wallet is refunded automatically.

### GET `/api/mvola/status/[correlationId]` and PUT `/api/mvola/callback`

Response shapes are unchanged from [api-routes](../api-routes/index.md#api); this feature
adds the wallet reconciliation side-effect described under `reconcile.ts` above.

## Data

None owned directly. Reads and mutates `wallets.ts` and `transactions.ts` from
[state-store](../state-store/index.md). The `walletSettled` flag on `TransactionRecord`
is this feature's idempotency key.

## Flows

### 4. Deposit (player → merchant, wallet credited on confirmation)

```
Step 1: Player enters amount in DepositForm; active MSISDN comes from WalletHeader
Step 2: Browser → POST /api/mvola/deposit { msisdn, amount }
Step 3: deposit/route.ts validates body (amount > 0, msisdn non-empty)
Step 4: deposit/route.ts → auth.ts.getToken()
Step 5: client.ts → initiateDeposit({ msisdn, amount, token })
        → POST https://devapi.mvola.mg/mvola/mm/transactions/type/merchantpay/1.0.0/
        → debitParty  = [{ key: "msisdn", value: PLAYER MSISDN   }]
        → creditParty = [{ key: "msisdn", value: MERCHANT MSISDN }]
Step 6: MVola returns { serverCorrelationId: "abc-123", status: "pending" }
Step 7: deposit/route.ts → transactions.ts.createTransaction({
          msisdn, direction: "deposit", amount,
          correlationId: "abc-123", walletSettled: false, status: "pending"
        })
        Wallet is NOT credited yet.
Step 8: API returns { correlationId: "abc-123", localTxId, status: "pending" } to browser
Step 9: DepositForm polls GET /api/mvola/status/abc-123 every 3 s
Step 10: Each status poll looks up the local TransactionRecord by correlationId
Step 11: First time MVola returns "completed" for a pending deposit:
         → wallets.ts.creditWallet(msisdn, amount)
         → transactions.ts.updateTransactionStatus(localTxId, "completed", { walletSettled: true })
Step 12: Alternatively, MVola may deliver the outcome via PUT /api/mvola/callback first;
         the callback route runs the exact same reconciliation.
         Whichever arrives first wins — subsequent calls are no-ops (walletSettled guard).
Step 13: Browser balance poll (WalletHeader) sees the new balance, UI updates
```

**Request body for step 2:**
```json
{ "msisdn": "0343500003", "amount": "5000" }
```

**State mutation summary:**

| Event | Wallet | Transaction status |
|-------|--------|--------------------|
| Request accepted (step 7) | unchanged | `pending`, `walletSettled=false` |
| MVola → `completed` | +amount | `completed`, `walletSettled=true` |
| MVola → `failed` | unchanged | `failed`, `walletSettled=true` |

### 6. Cash-out (merchant → player, wallet reserved upfront, refunded on failure)

```
Step 1: Player enters cash-out amount in CashOutForm (default = full wallet balance)
Step 2: Browser → POST /api/mvola/withdraw { msisdn, amount }
Step 3: withdraw/route.ts validates body
Step 4: withdraw/route.ts → wallets.ts.getWallet(msisdn)
        IF balance < amount → return 409 Conflict { error: "Insufficient funds" }
Step 5: wallets.ts.debitWallet(msisdn, amount)   // RESERVE funds immediately
Step 6: withdraw/route.ts → auth.ts.getToken()
Step 7: client.ts → initiateWithdrawal({ msisdn, amount, token })
        → debitParty  = [{ key: "msisdn", value: MERCHANT MSISDN }]
        → creditParty = [{ key: "msisdn", value: PLAYER MSISDN   }]

Step 8a: IF MVola call throws (network/4xx/5xx before serverCorrelationId):
         → wallets.ts.creditWallet(msisdn, amount)   // REFUND immediately
         → return 502 to browser
Step 8b: IF MVola returns { serverCorrelationId, status: "pending" }:
         → transactions.ts.createTransaction({
             msisdn, direction: "withdraw", amount,
             correlationId, walletSettled: true, status: "pending"
           })  // wallet already reserved, so walletSettled=true
         → return { correlationId, localTxId, status: "pending" }

Step 9: Browser polls status route / MVola also sends PUT callback
Step 10: First time MVola returns "completed" for this withdraw:
         → transactions.ts.updateTransactionStatus(localTxId, "completed")
         → wallet is NOT changed (already debited at step 5)
Step 11: First time MVola returns "failed" for this withdraw:
         → wallets.ts.creditWallet(msisdn, amount)   // REFUND
         → transactions.ts.updateTransactionStatus(localTxId, "failed", { walletSettled: false })
Step 12: UI shows final outcome; if failed, a "wallet refunded" banner is shown
```

**State mutation summary:**

| Event | Wallet | Transaction status |
|-------|--------|--------------------|
| Request accepted (step 5) | −amount (reserved) | `pending`, `walletSettled=true` |
| MVola call fails before serverCorrelationId | +amount (refund) | not created |
| MVola → `completed` | unchanged | `completed`, `walletSettled=true` |
| MVola → `failed` | +amount (refund) | `failed`, `walletSettled=false` |

## Shared dependencies

- [MVola external API reference](../../_shared.md#mvola-external-api-reference)
- [High-level request flow](../../_shared.md#high-level-request-flow)
- [Shared message formats](../../_shared.md#shared-message-formats)
- [Conventions](../../_shared.md#conventions)
- [state-management.md](../../state-management.md) — `walletSettled` idempotency and store contracts
