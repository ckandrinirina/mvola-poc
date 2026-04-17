# Data Flow

## High-Level Flow

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
   │                        │  { transactionStatus } │
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

## Detailed Flows

### 1. Player Initiates Withdrawal (Happy Path)

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

### 2. Token Refresh Flow

```
Step 1: auth.ts receives getToken() call
Step 2: Check cachedToken — is it present and not expiring in <60s?
        YES → return cachedToken.access_token
        NO  → proceed
Step 3: POST https://devapi.mvola.mg/token
        Headers: Authorization: Basic Base64(consumerKey:consumerSecret)
                 Content-Type: application/x-www-form-urlencoded
        Body:    grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE
Step 4: Response: { access_token, expires_in: 3600 }
Step 5: Store in cache with expiresAt = now + 3600s
Step 6: Return access_token
```

### 3. Webhook Callback Reception

```
Step 1: MVola sends PUT https://{MVOLA_CALLBACK_URL}/api/mvola/callback
        Body: { transactionStatus, serverCorrelationId, transactionReference, amount, ... }
Step 2: callback/route.ts reads and validates the PUT body
Step 3: Log the payload (console.log in PoC)
Step 4: Return HTTP 200 OK
        (If not 200, MVola may retry)
```

## Message Formats

### Token Request
```
POST /token HTTP/1.1
Host: devapi.mvola.mg
Authorization: Basic <Base64(consumerKey:consumerSecret)>
Content-Type: application/x-www-form-urlencoded

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

### Transaction Status Response
```json
{
  "transactionStatus": "pending | completed | failed",
  "serverCorrelationId": "550e8400-e29b-41d4-a716-446655440000",
  "transactionReference": "MVL-2026-04-16-001"
}
```

### MVola Webhook Callback (PUT)
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

## State Management

No persistent state. The PoC uses:
- **In-memory token cache** (`auth.ts` module-level variable): survives the process lifetime, reset on server restart
- **Client-side React state** (`useState` in `WithdrawForm`): tracks `correlationId` and `transactionStatus` for the current session
