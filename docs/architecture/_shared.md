# Shared / Cross-Cutting

> Infra used by multiple features. Feature docs link here instead of duplicating.
> A story reads this only when its feature doc's "Shared dependencies" points to a
> section here.

## Architecture diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                page.tsx (Demo UI)                    │    │
│  │                                                      │    │
│  │  ┌────────────── WalletHeader ─────────────────┐     │    │
│  │  │  MSISDN input (localStorage) + balance      │     │    │
│  │  └──────────────────┬──────────────────────────┘     │    │
│  │                     │                                │    │
│  │  ┌──────────────── TabbedLayout ──────────────┐      │    │
│  │  │  [Deposit] [Play] [Cash-out] [History]     │      │    │
│  │  ├────────────────────────────────────────────┤      │    │
│  │  │  DepositForm     → POST /mvola/deposit     │      │    │
│  │  │  CoinFlipGame    → POST /game/coinflip     │      │    │
│  │  │  CashOutForm     → POST /mvola/withdraw    │      │    │
│  │  │  TransactionHistory → GET /wallet/:m/hist  │      │    │
│  │  └────────────────────────────────────────────┘      │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP (localhost)
┌──────────────────────────────▼───────────────────────────────┐
│                Next.js Server (API Routes)                   │
│                                                              │
│  MVola proxy routes:                                         │
│    POST /api/mvola/token       token/route.ts                │
│    POST /api/mvola/deposit     deposit/route.ts              │
│    POST /api/mvola/withdraw    withdraw/route.ts             │
│    GET  /api/mvola/status/:id  status/route.ts               │
│    GET  /api/mvola/transaction/:ref                          │
│                                transaction/route.ts          │
│    PUT  /api/mvola/callback    callback/route.ts             │
│                                                              │
│  Internal routes (no MVola call):                            │
│    GET  /api/wallet/:msisdn/balance                          │
│    GET  /api/wallet/:msisdn/history                          │
│    POST /api/game/coinflip                                   │
│                                                              │
│  ┌──────────────── src/lib/mvola/ ────────────────────┐      │
│  │  auth.ts    — token cache + refresh logic          │      │
│  │  client.ts  — typed MVola HTTP calls (both dirs)   │      │
│  │  types.ts   — shared TypeScript interfaces         │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
│  ┌──────────────── src/lib/store/ ────────────────────┐      │
│  │  wallets.ts       — Map<msisdn, WalletState>       │      │
│  │  transactions.ts  — Map<localTxId, TxRecord>       │      │
│  │  games.ts         — Map<sessionId, GameSession>    │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
│  ┌──────────────── src/lib/game/ ─────────────────────┐      │
│  │  coinflip.ts — pure game logic (RNG injected)      │      │
│  └────────────────────────────────────────────────────┘      │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼───────────────────────────────┐
│               MVola API (devapi.mvola.mg)                    │
│                                                              │
│  POST /token                                                 │
│  POST /mvola/mm/transactions/type/merchantpay/1.0.0/         │
│       (same endpoint for both deposit and withdraw —         │
│        direction is determined by debitParty/creditParty)    │
│  GET  /mvola/mm/transactions/type/merchantpay/1.0.0/         │
│       status/{serverCorrelationId}                           │
│  GET  /mvola/mm/transactions/type/merchantpay/1.0.0/         │
│       {transactionReference}    (details of a settled tx)    │
└──────────────────────────────────────────────────────────────┘
          │ PUT callback (webhook)
          ▼
  PUT /api/mvola/callback  (on this server)
```

## Component interaction matrix

| From \ To | UI components | /api/mvola/* | /api/wallet/* | /api/game/* | lib/mvola/* | lib/store/* | lib/game/* | MVola API |
|-----------|---------------|--------------|---------------|-------------|-------------|-------------|------------|-----------|
| UI components | — | HTTP POST/GET | HTTP GET | HTTP POST | — | — | — | — |
| /api/mvola/* | — | — | — | — | calls | calls | — | — |
| /api/wallet/* | — | — | — | — | — | reads | — | — |
| /api/game/* | — | — | — | — | — | reads + writes | calls | — |
| lib/mvola/auth.ts | — | — | — | — | — | — | — | POST /token |
| lib/mvola/client.ts | — | — | — | — | — | — | — | POST/GET tx |
| lib/store/* | — | — | — | — | — | — | — | — |
| lib/game/coinflip.ts | — | — | — | — | — | — | — | — |

## High-level request flow

```
Browser                Next.js Server           MVola API
   │                        │                       │
   │  POST /withdraw         │                       │
   │────────────────────────▶│                       │
   │                        │  (token expired?)      │
   │                        │  POST /token           │
   │                        │───────────────────────▶│
   │                        │  { access_token }      │
   │                        │◀───────────────────────│
   │                        │                       │
   │                        │  POST /merchantpay    │
   │                        │───────────────────────▶│
   │                        │  { serverCorrelationId}│
   │                        │◀───────────────────────│
   │  { correlationId }     │                       │
   │◀────────────────────────│                       │
   │                        │                       │
   │  GET /status/:id        │                       │
   │────────────────────────▶│                       │
   │                        │  GET status/:id        │
   │                        │───────────────────────▶│
   │                        │  { status,             │
   │                        │    objectReference }   │
   │                        │◀───────────────────────│
   │  { status: pending }   │                       │
   │◀────────────────────────│                       │
   │                        │                       │
   │  (poll every 3s)       │                       │
   │────────────────────────▶│──────────────────────▶│
   │◀────────────────────────│◀──────────────────────│
   │                        │                       │
   │                        │◀──────────────────────│
   │                        │  PUT /callback         │
   │                        │  { status: completed } │
   │                        │  → log + return 200   │
   │  { status: completed } │                       │
   │◀────────────────────────│(next poll returns final│
   │                         status)                │
```

## MVola external API reference

All calls go to:
- **Sandbox:** `https://devapi.mvola.mg`
- **Production:** `https://api.mvola.mg`

### Published surface

MVola publishes two APIs and four operations. This is the complete surface — full coverage
is an achievable goal for this project, not an aspiration.

| API | Operation | Purpose |
|---|---|---|
| Authentication | `POST /token` | Bearer token, one-hour lifetime |
| Merchant Pay | `POST /…/merchantpay/1.0.0/` | Moves money in either direction |
| Merchant Pay | `GET /…/status/{serverCorrelationId}` | Progress of a submitted transaction |
| Merchant Pay | `GET /…/{transactionReference}` | Full record of a settled transaction |

### Common request headers

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

### POST `/token` — OAuth token

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

### POST `/mvola/mm/transactions/type/merchantpay/1.0.0/` — Initiate transaction

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

> **Direction:** the same endpoint serves both directions. For a payout to a player
> (cash-out), `debitParty` = merchant MSISDN and `creditParty` = player MSISDN. For a
> deposit, the pair is reversed.

### GET `/mvola/mm/transactions/type/merchantpay/1.0.0/status/{serverCorrelationId}` — Check status

**Response (200):**
```json
{
  "status": "pending | completed | failed",
  "serverCorrelationId": "550e8400-e29b-41d4-a716-446655440000",
  "objectReference": "MVL-2026-04-16-001"
}
```

> **Corrected 2026-07-28.** This response was previously documented — and is still read in
> code — as `transactionStatus` / `transactionReference`. Live verification against the
> sandbox established the real field names are `status` and `objectReference`. Reading the
> old names finds nothing, which in production would leave every transaction with no status
> at all. Both spellings are accepted via `parseMvolaStatus()`; see
> [mvola-api-coverage](features/mvola-api-coverage/index.md#srclibmvolastatusts--shared-status-reader-new).

### GET `/mvola/mm/transactions/type/merchantpay/1.0.0/{transactionReference}` — Transaction details

Returns MVola's authoritative record of a **settled** transaction: amounts, both parties,
timestamps, and final state, as MVola holds them. Requires a reference issued at
settlement — it cannot be called for a transaction that is still pending.

> **Header note:** per `docs/mvola-reference/merchant-pay-openapi.json`, this operation does
> not require the `partnerName` header that the initiate and status operations do.

### HTTP status codes (MVola)

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request — invalid parameters |
| 401 | Unauthorized — invalid or expired token |
| 402 | Request Failed — transaction failed |
| 403 | Forbidden — access denied |
| 404 | Not Found — resource not found |
| 409 | Conflict — duplicate transaction reference |

### Sandbox test numbers

| MSISDN | Role |
|--------|------|
| `0343500003` | Test account A (use as player in sandbox) |
| `0343500004` | Test account B |

## Shared message formats

### Token request
```
POST /token HTTP/1.1
Host: devapi.mvola.mg
Authorization: Basic <Base64(consumerKey:consumerSecret)>
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE
```

### Token response
```json
{
  "access_token": "<JWT>",
  "scope": "EXT_INT_MVOLA_SCOPE",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Transaction status response
```json
{
  "status": "pending | completed | failed",
  "serverCorrelationId": "550e8400-e29b-41d4-a716-446655440000",
  "objectReference": "MVL-2026-04-16-001"
}
```

### MVola webhook callback (PUT)

> **Unverified.** No live webhook delivery has been captured, so it is not known whether the
> callback uses the same `status` / `objectReference` names as the status response or the
> `transactionStatus` / `transactionReference` names shown below. `parseMvolaStatus()`
> accepts either. Record the observed shape here after the first real delivery.

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

## Conventions

- **Monetary unit:** integer Ariary throughout the store and game layers; conversion
  to/from the MVola API's string representation happens only at the `client.ts` boundary.
- **No persistent state.** Every store is a module-level `Map`, wiped on server restart.
  See [state-management.md](state-management.md).
- **Server-only MVola access.** The browser never calls MVola directly — it calls the
  Next.js API routes, which proxy.
- **Sandbox/production base URL** is configured via environment variables — see
  [configuration.md](configuration.md).
