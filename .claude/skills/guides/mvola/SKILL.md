---
name: guide-mvola
description: >
  MVola Merchant Pay API integration reference for mvola-prof. OAuth 2.0
  Client Credentials flow, transaction initiation, status polling, webhook
  callbacks, required headers, sandbox vs. production base URLs, and HTTP
  error code mapping. Reference for any /expert-* skill working with MVola.
user-invocable: false
---

# MVola Merchant Pay API Integration Guide (mvola-prof)

> Sourced from `docs/architecture/api-contracts.md` and `docs/API_MerchantPay.pdf` (the original MVola spec).
> Last reviewed: 2026-04-17
> API version targeted: Merchant Pay 1.0.0

## Project Context

mvola-prof integrates the MVola Merchant Pay API to push withdrawals from a
merchant account to a player's MVola account. All MVola calls happen
**server-side** — credentials are never exposed to the browser.

## Base URLs

| Environment | URL | Selected when |
|-------------|-----|---------------|
| Sandbox | `https://devapi.mvola.mg` | `MVOLA_ENV=sandbox` (default) |
| Production | `https://api.mvola.mg` | `MVOLA_ENV=production` |

Always go through the helper in `src/lib/mvola/client.ts` — never hardcode
the URL elsewhere.

## Authentication: OAuth 2.0 Client Credentials

### Token Request

```
POST /token
Host: devapi.mvola.mg
Authorization: Basic Base64(consumerKey:consumerSecret)
Content-Type: application/x-www-form-urlencoded
Cache-Control: no-cache

grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE
```

### Token Response

```json
{
  "access_token": "<JWT>",
  "scope": "EXT_INT_MVOLA_SCOPE",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Token Cache Strategy

- Cache in memory (module-level variable in `src/lib/mvola/auth.ts`)
- Refresh proactively when within **60 seconds** of expiry
- Token survives the process lifetime; reset on server restart (acceptable PoC behavior)
- **Never log the token value or the consumer key/secret**

## Required Transaction Headers

Every MVola transaction call (initiate, status, etc.) MUST include:

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer {access_token}` |
| `X-CorrelationID` | A fresh UUID per request (use `uuid` package) |
| `UserAccountIdentifier` | `msisdn;{merchant_msisdn}` |
| `partnerName` | `MVOLA_PARTNER_NAME` |
| `Content-Type` | `application/json` |
| `UserLanguage` | `en` or `fr` |
| `Version` | `1.0` |
| `Cache-Control` | `no-cache` |

Optional but recommended:
- `X-Callback-URL` — your `MVOLA_CALLBACK_URL` (so MVola knows where to PUT)

## Initiate Withdrawal (Payout)

```
POST /mvola/mm/transactions/type/merchantpay/1.0.0/
```

**Body:**
```json
{
  "amount": "5000",
  "currency": "Ar",
  "descriptionText": "Game withdrawal",
  "requestingOrganisationTransactionReference": "game-withdrawal-{uuid}",
  "requestDate": "2026-04-17T10:30:00.000Z",
  "debitParty":  [{ "key": "msisdn", "value": "{MERCHANT_MSISDN}" }],
  "creditParty": [{ "key": "msisdn", "value": "{PLAYER_MSISDN}" }],
  "metadata": [
    { "key": "partnerName", "value": "{MVOLA_PARTNER_NAME}" },
    { "key": "fc",          "value": "Ar" },
    { "key": "amountFc",    "value": "5000" }
  ]
}
```

**Withdrawal direction:** `debitParty` = merchant, `creditParty` = player.
For a payment from a player **to** the merchant, swap them.

**Response (200):**
```json
{
  "status": "pending",
  "serverCorrelationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

The `serverCorrelationId` is the handle the client uses to poll status.

## Poll Transaction Status

```
GET /mvola/mm/transactions/type/merchantpay/1.0.0/status/{serverCorrelationId}
```

**Response (200):**
```json
{
  "transactionStatus": "pending | completed | failed",
  "serverCorrelationId": "550e8400-e29b-41d4-a716-446655440000",
  "transactionReference": "MVL-2026-04-17-001"
}
```

Poll at most **every 3 seconds** to avoid rate-limiting.

## Webhook Callback (PUT from MVola)

MVola sends an asynchronous PUT to your `MVOLA_CALLBACK_URL` when a transaction
reaches a terminal state.

```
PUT /api/mvola/callback
Content-Type: application/json

{
  "transactionStatus": "completed",
  "serverCorrelationId": "550e8400-e29b-41d4-a716-446655440000",
  "transactionReference": "MVL-2026-04-17-001",
  "amount": "5000",
  "currency": "Ar",
  "debitParty":  [{ "key": "msisdn", "value": "{MERCHANT_MSISDN}" }],
  "creditParty": [{ "key": "msisdn", "value": "{PLAYER_MSISDN}" }]
}
```

**Your handler MUST:**
- Return HTTP `200 OK` once received and parsed (even if downstream processing fails)
- Be **idempotent** — MVola may retry; the same `serverCorrelationId` may arrive multiple times
- **Never** return 4xx/5xx unless you want MVola to retry (which usually you don't)

## HTTP Status Codes (MVola → You)

| Code | Meaning | Suggested mapping in `/api/mvola/*` response |
|------|---------|-----------------------------------------------|
| 200 | Success | Pass through |
| 400 | Bad Request — invalid params | 400 with details |
| 401 | Unauthorized — token expired/invalid | Refresh token, retry once; if still 401, return 502 |
| 402 | Request Failed — transaction failed | 502 with `{ status: "failed" }` |
| 403 | Forbidden | 502 |
| 404 | Not Found | 404 |
| 409 | Conflict — duplicate `requestingOrganisationTransactionReference` | 409 — generate a fresh UUID |

## Sandbox Test Numbers

| MSISDN | Use as |
|--------|--------|
| `0343500003` | Player (creditParty for withdrawals) |
| `0343500004` | Alternative test account |

**Do not use real customer phone numbers in sandbox.**

## Common Pitfalls

### Wrong direction (debit/credit swap)
- **What:** Setting `debitParty=player`, `creditParty=merchant` for a withdrawal
- **Why bad:** That's a *payment*, not a *payout* — money flows the wrong way
- **Instead:** For player withdrawals, `debitParty=merchant_msisdn`, `creditParty=player_msisdn`

### Reusing the same `requestingOrganisationTransactionReference`
- **What:** Hardcoded reference value
- **Why bad:** MVola returns 409 Conflict
- **Instead:** Generate a fresh UUID per call (`game-withdrawal-${uuid()}`)

### Sending `amount` as a number
- **What:** `{ "amount": 5000 }` (number)
- **Why bad:** MVola spec requires it as a string
- **Instead:** `{ "amount": "5000" }` (string)

### Forgetting `Cache-Control: no-cache`
- **What:** Omitting the header on token or transaction calls
- **Why bad:** Some MVola gateway hops cache responses unexpectedly
- **Instead:** Always set `Cache-Control: no-cache`

### Logging the bearer token
- **What:** `console.log("Got token", token)` or `console.log(headers)`
- **Why bad:** Tokens grant full merchant API access until they expire
- **Instead:** Log `"Token refreshed, expires in Xs"` only — never the value

### Webhook returning 500 on parse error
- **What:** Throwing in `PUT /api/mvola/callback` on an unexpected body shape
- **Why bad:** MVola treats non-2xx as "failed delivery" and retries — possibly forever
- **Instead:** Wrap in try/catch, log the error, return 200

## Production Hardening Gaps (out of PoC scope)

These are intentionally NOT addressed in the PoC. Flag them when transitioning to production:

- **No webhook signature verification** — MVola spec doesn't define one; consider IP allowlist or shared secret
- **No persistent transaction log** — restarts lose in-flight state
- **No idempotency store** — duplicate withdrawals could be initiated if the client retries
- **No rate limiting** on `/api/mvola/withdraw`
- **No alerting** on token refresh failures or repeated MVola 5xx
- **In-memory token cache** — fine for single-instance; multi-instance deployments would re-fetch per instance

## References

- Project spec: `docs/API_MerchantPay.pdf` (authoritative)
- Architecture: `docs/architecture/api-contracts.md`, `docs/architecture/data-flow.md`
- MVola Developer Portal: https://developer.mvola.mg/devportal/

This guide is used by **/expert-backend** (implementing the MVola client and routes), **/expert-qa** (testing against the sandbox), and **/expert-analyst** (verifying compliance with the spec).
