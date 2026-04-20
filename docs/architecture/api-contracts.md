# API Contracts

## Internal API (Next.js API Routes)

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

---

### POST `/api/mvola/deposit`

Initiate a **deposit** from a player's MVola account into the in-game wallet. Internally calls the same MVola Merchant Pay endpoint as withdraw, but with `debitParty` = player MSISDN and `creditParty` = merchant MSISDN. The in-game wallet is credited **only when MVola confirms** the transaction (via status poll or webhook), never at request time.

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

> The wallet is NOT credited by this endpoint. Poll `GET /api/mvola/status/{correlationId}` until `completed`; the status route (or the webhook) will apply the wallet credit.

---

### POST `/api/mvola/withdraw`

Initiate a **cash-out** (withdrawal payout) from the merchant account to a player's MVola number. The in-game wallet is debited (reserved) **at request time** and refunded if MVola rejects the request or reports `failed`.

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
| amount | string | Yes | Amount in Ariary (e.g. `"5000"`) — must be ≤ wallet balance |
| description | string | No | Transaction description text |

> `playerMsisdn` is accepted as a legacy alias for `msisdn` when the wallet integration is first rolled out; prefer `msisdn`.

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

**Response (409):**
```json
{ "error": "Insufficient funds", "balance": 1000, "requested": 5000 }
```

**Response (502):**
```json
{ "error": "MVola API error", "details": "..." }
```

> On success, the wallet is **immediately debited by `amount`** (reserve). If the MVola call itself fails synchronously, or the transaction later resolves to `failed`, the wallet is refunded automatically.

---

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

---

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

---

## MVola External API Reference

All calls go to:
- **Sandbox:** `https://devapi.mvola.mg`
- **Production:** `https://api.mvola.mg`

### Common Request Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer {access_token}` |
| `X-CorrelationID` | A unique UUID per request |
| `UserAccountIdentifier` | `msisdn;{merchant_msisdn}` |
| `partnerName` | Your partner/organization name |
| `Content-Type` | `application/json` |
| `UserLanguage` | `en` or `fr` |
| `Version` | `1.0` |
| `Cache-Control` | `no-cache` |

---

### POST `/token` — OAuth Token

**Headers:**
```
Authorization: Basic Base64(consumerKey:consumerSecret)
Content-Type: application/x-www-form-urlencoded
Cache-Control: no-cache
```

**Body:**
```
grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE
```

**Response (200):**
```json
{
  "access_token": "<JWT>",
  "scope": "EXT_INT_MVOLA_SCOPE",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

### POST `/mvola/mm/transactions/type/merchantpay/1.0.0/` — Initiate Transaction

**Request Body:**
```json
{
  "amount": "5000",
  "currency": "Ar",
  "descriptionText": "Game withdrawal",
  "requestingOrganisationTransactionReference": "game-withdrawal-{uuid}",
  "requestDate": "2026-04-16T10:30:00.000Z",
  "debitParty": [
    { "key": "msisdn", "value": "{merchant_msisdn}" }
  ],
  "creditParty": [
    { "key": "msisdn", "value": "{player_msisdn}" }
  ],
  "metadata": [
    { "key": "partnerName", "value": "{MVOLA_PARTNER_NAME}" },
    { "key": "fc", "value": "Ar" },
    { "key": "amountFc", "value": "5000" }
  ]
}
```

**Response (200):**
```json
{
  "status": "pending",
  "serverCorrelationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

> **Withdrawal vs. Payment:** For a payout to a player, `debitParty` = merchant MSISDN and `creditParty` = player MSISDN.

---

### GET `/mvola/mm/transactions/type/merchantpay/1.0.0/status/{serverCorrelationId}` — Check Status

**Response (200):**
```json
{
  "transactionStatus": "pending | completed | failed",
  "serverCorrelationId": "550e8400-e29b-41d4-a716-446655440000",
  "transactionReference": "MVL-2026-04-16-001"
}
```

---

## HTTP Status Codes (MVola)

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request — invalid parameters |
| 401 | Unauthorized — invalid or expired token |
| 402 | Request Failed — transaction failed |
| 403 | Forbidden — access denied |
| 404 | Not Found — resource not found |
| 409 | Conflict — duplicate transaction reference |

---

## Sandbox Test Numbers

| MSISDN | Role |
|--------|------|
| `0343500003` | Test account A (use as player in sandbox) |
| `0343500004` | Test account B |

---

## Internal Wallet & Game API

These routes read and mutate the in-memory wallet / transaction / game state. They do **not** call MVola directly. They exist only on this server.

### GET `/api/wallet/[msisdn]/balance`

Return the current in-game wallet balance for a player.

**Path parameter:** `msisdn` — the player's MVola phone number (the wallet key).

**Response (200):**
```json
{
  "msisdn": "0343500003",
  "balance": 5000,
  "updatedAt": 1745150400000
}
```

> Returns `{ balance: 0 }` for an MSISDN that has never been seen — a wallet is created lazily on first credit/debit.

---

### GET `/api/wallet/[msisdn]/history`

Return a chronologically-sorted merged history of all transactions and game rounds for a player.

**Path parameter:** `msisdn` — the player's MVola phone number.

**Response (200):**
```json
{
  "msisdn": "0343500003",
  "entries": [
    {
      "kind": "transaction",
      "localTxId": "tx_01HW...",
      "correlationId": "550e8400-e29b-41d4-a716-446655440000",
      "direction": "deposit",
      "amount": 5000,
      "status": "completed",
      "mvolaReference": "MVL-2026-04-20-001",
      "createdAt": 1745150200000,
      "updatedAt": 1745150260000
    },
    {
      "kind": "game",
      "sessionId": "gm_01HW...",
      "bet": 1000,
      "choice": "heads",
      "outcome": "tails",
      "result": "loss",
      "delta": -1000,
      "balanceAfter": 4000,
      "playedAt": 1745150300000
    }
  ]
}
```

Entries are sorted most-recent-first.

---

### POST `/api/game/coinflip`

Play one round of coin-flip. Atomically validates balance, debits the bet, computes the outcome, and credits winnings on a win.

**Request:**
```json
{
  "msisdn": "0343500003",
  "bet": 1000,
  "choice": "heads"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| msisdn | string | Yes | Player MSISDN |
| bet | integer | Yes | Bet amount in Ariary, must be > 0 and ≤ current wallet balance |
| choice | `"heads"` \| `"tails"` | Yes | Player's coin-flip pick |

**Response (200):**
```json
{
  "sessionId": "gm_01HW...",
  "outcome": "tails",
  "result": "loss",
  "delta": -1000,
  "balanceAfter": 4000
}
```

**Response (400):**
```json
{ "error": "Invalid request", "details": "bet must be a positive integer" }
```

**Response (409):**
```json
{ "error": "Insufficient funds", "balance": 500, "requested": 1000 }
```

### Payout table

| Scenario | Delta | Balance change |
|----------|-------|----------------|
| `outcome === choice` (win) | `+bet` | `−bet + 2·bet = +bet` net |
| `outcome !== choice` (loss) | `−bet` | `−bet` net |

No house edge in the PoC; odds are exactly 50/50.
