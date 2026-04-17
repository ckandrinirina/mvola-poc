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

### POST `/api/mvola/withdraw`

Initiate a withdrawal payout from the merchant account to a player.

**Request:**
```json
{
  "amount": "5000",
  "playerMsisdn": "0343500003",
  "description": "Game withdrawal"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | string | Yes | Amount in Ariary (e.g. `"5000"`) |
| playerMsisdn | string | Yes | Player's MVola phone number |
| description | string | No | Transaction description text |

**Response (200):**
```json
{
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

**Response (400):**
```json
{ "error": "amount and playerMsisdn are required" }
```

**Response (502):**
```json
{ "error": "MVola API error", "details": "..." }
```

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
