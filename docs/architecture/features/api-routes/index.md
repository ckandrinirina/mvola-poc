---
slug: api-routes
design: planned
---

# MVola Proxy API Routes

> Self-contained — a story reads this (+ folder-structure.md, + \_shared.md when noted), not other feature docs.

## Summary

The four Next.js App Router routes that proxy all MVola communication server-side: token,
withdraw, status, and callback. The browser never calls MVola directly — it calls these
routes, which validate the request, delegate to
[mvola-core-library](../mvola-core-library/index.md), and return clean JSON. Its boundary:
this feature owns the **base** (wallet-unaware) contracts. Wallet reservation, the
`409 Insufficient funds` response, and the reconciliation logic that the status and
callback routes later gain are owned by
[wallet-aware-mvola](../wallet-aware-mvola/index.md).

## Components

### `src/app/api/mvola/token/route.ts` — Token Route

- **Type:** Next.js API Route (server-only)
- **Purpose:** Acquire and return an OAuth access token from MVola
- **Responsibilities:**
  - Call `src/lib/mvola/auth.ts` to get a valid token
  - Return the token (for debugging); in production this endpoint would be internal only
- **Depends on:** `lib/mvola/auth.ts`

### `src/app/api/mvola/withdraw/route.ts` — Withdraw Route

- **Type:** Next.js API Route (server-only)
- **Purpose:** Initiate a payout from the merchant account to a player's MVola number
- **Responsibilities:**
  - Validate request body (`msisdn`, `amount`)
  - Ensure a valid OAuth token (via `auth.ts`)
  - Call `client.ts → initiateWithdrawal()` (debitParty = merchant, creditParty = player)
  - Return `{ correlationId }` to the client for polling
- **Depends on:** `lib/mvola/auth.ts`, `lib/mvola/client.ts`
- **Extended by:** [wallet-aware-mvola](../wallet-aware-mvola/index.md) — adds balance check, reserve, refund

### `src/app/api/mvola/status/[correlationId]/route.ts` — Status Route

- **Type:** Next.js API Route (server-only)
- **Purpose:** Check the status of a previously initiated transaction
- **Responsibilities:**
  - Ensure a valid OAuth token
  - Call `client.ts` to GET transaction status from MVola
  - Return `{ transactionStatus, transactionReference }` to the client
- **Depends on:** `lib/mvola/auth.ts`, `lib/mvola/client.ts`
- **Extended by:** [wallet-aware-mvola](../wallet-aware-mvola/index.md) — adds wallet reconciliation

### `src/app/api/mvola/callback/route.ts` — Webhook Route

- **Type:** Next.js API Route (server-only)
- **Purpose:** Receive MVola's asynchronous callback when a transaction completes
- **Responsibilities:**
  - Accept `PUT` requests from MVola
  - Log the callback payload
  - Always return `200 OK` (MVola retries on non-200)
- **Depends on:** `lib/mvola/types.ts` (`CallbackPayload`)
- **Extended by:** [wallet-aware-mvola](../wallet-aware-mvola/index.md) — adds wallet reconciliation

## API

These routes are called by the browser. They proxy to MVola server-side.

### POST `/api/mvola/token`

Acquire a fresh OAuth token (for debugging/testing only).

**Request:** No body required.

**Response (200):**
```json
{
  "access_token": "<JWT>",
  "expires_in": 3600
}
```

### POST `/api/mvola/withdraw`

Initiate a payout from the merchant account to a player's MVola number.

**Request:**
```json
{
  "msisdn": "0343500003",
  "amount": "5000",
  "description": "Game cash-out"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| msisdn | string | Yes | Player's MVola phone number (credited by MVola) |
| amount | string | Yes | Amount in Ariary (e.g. `"5000"`) |
| description | string | No | Transaction description text |

> `playerMsisdn` is accepted as a legacy alias for `msisdn`; prefer `msisdn`.

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

> The wallet-balance check and the `409 Insufficient funds` response are documented in
> [wallet-aware-mvola](../wallet-aware-mvola/index.md#post-apimvolawithdraw-wallet-aware).

### GET `/api/mvola/status/[correlationId]`

Poll the status of a pending transaction.

**Path parameter:** `correlationId` — the `serverCorrelationId` returned by MVola.

**Response (200):**
```json
{
  "transactionStatus": "pending | completed | failed",
  "serverCorrelationId": "550e8400-e29b-41d4-a716-446655440000",
  "transactionReference": "MVL-2026-04-16-001"
}
```

### PUT `/api/mvola/callback`

Receive asynchronous notification from MVola when a transaction completes.
This URL must be publicly accessible and configured as `MVOLA_CALLBACK_URL`.

**Request (sent by MVola):**
```json
{
  "transactionStatus": "completed",
  "serverCorrelationId": "550e8400-e29b-41d4-a716-446655440000",
  "transactionReference": "MVL-2026-04-16-001",
  "amount": "5000",
  "currency": "Ar",
  "debitParty": [{ "key": "msisdn", "value": "034XXXXXXX" }],
  "creditParty": [{ "key": "msisdn", "value": "0343500003" }]
}
```

**Response:** `200 OK` (must be returned; MVola retries on other status codes)

## Data

None owned. These routes hold no state of their own; the token cache belongs to
[mvola-core-library](../mvola-core-library/index.md) and the wallet/transaction stores to
[state-store](../state-store/index.md).

## Flows

### 1. Player initiates withdrawal (happy path)

```
Step 1: Player fills in WithdrawForm (amount, phone number) and clicks Submit
Step 2: Browser → POST /api/mvola/withdraw { amount, playerMsisdn }
Step 3: withdraw/route.ts calls auth.ts.getToken()
Step 4: auth.ts checks in-memory cache
        IF token valid → return cached token
        IF token missing/expired → POST https://devapi.mvola.mg/token
Step 5: client.ts POST https://devapi.mvola.mg/mvola/mm/transactions/type/merchantpay/1.0.0/
        Headers: Authorization: Bearer {token}, X-CorrelationID: {uuid}, ...
        Body: { amount, debitParty: [merchant MSISDN], creditParty: [player MSISDN], ... }
Step 6: MVola returns { serverCorrelationId: "abc-123" }
Step 7: API route returns { correlationId: "abc-123" } to browser
Step 8: Browser starts polling GET /api/mvola/status/abc-123 every 3 seconds
Step 9: Each poll: status/route.ts → client.ts → GET https://devapi.mvola.mg/.../status/abc-123
Step 10: MVola processes transaction; eventually sends PUT to MVOLA_CALLBACK_URL
Step 11: callback/route.ts logs payload, returns 200 OK
Step 12: Next poll from browser gets transactionStatus: "completed"
Step 13: UI updates to show success
```

**Payload at Step 5 (body):**
```json
{
  "amount": "5000",
  "currency": "Ar",
  "descriptionText": "Game withdrawal",
  "requestingOrganisationTransactionReference": "game-withdrawal-{uuid}",
  "requestDate": "2026-04-16T10:30:00.000Z",
  "debitParty": [{ "key": "msisdn", "value": "034XXXXXXX" }],
  "creditParty": [{ "key": "msisdn", "value": "0343500003" }],
  "metadata": [
    { "key": "partnerName", "value": "MyGame" },
    { "key": "fc", "value": "Ar" },
    { "key": "amountFc", "value": "5000" }
  ]
}
```

### 3. Webhook callback reception

```
Step 1: MVola sends PUT https://{MVOLA_CALLBACK_URL}/api/mvola/callback
        Body: { transactionStatus, serverCorrelationId, transactionReference, amount, ... }
Step 2: callback/route.ts reads and validates the PUT body
Step 3: Log the payload (console.log in PoC)
Step 4: Return HTTP 200 OK
        (If not 200, MVola may retry)
```

## Shared dependencies

- [High-level request flow](../../_shared.md#high-level-request-flow)
- [MVola external API reference](../../_shared.md#mvola-external-api-reference) — including HTTP status codes and sandbox test numbers
- [Shared message formats](../../_shared.md#shared-message-formats)
- [configuration.md](../../configuration.md) — `MVOLA_CALLBACK_URL` and credentials
