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

## Detailed Flows (continued) — Wallet, Deposit, Game, Cash-Out

### 4. Deposit (User → Merchant, wallet credit on confirmation)

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

---

### 5. Coin-Flip Round (pure, no MVola call)

```
Step 1: Player chooses bet amount and heads/tails in CoinFlipGame
Step 2: Browser → POST /api/game/coinflip { msisdn, bet, choice }
Step 3: coinflip/route.ts validates body: bet > 0, choice in { heads, tails }, msisdn non-empty
Step 4: coinflip/route.ts → wallets.ts.getWallet(msisdn)
        IF balance < bet → return 409 Conflict { error: "Insufficient funds" }
Step 5: wallets.ts.debitWallet(msisdn, bet)
Step 6: coinflip.ts.playCoinFlip(bet, choice)
        → outcome = rng() → "heads" | "tails"
        → result  = (outcome === choice) ? "win" : "loss"
        → delta   = (result === "win") ? +bet : -bet
Step 7: IF result === "win" → wallets.ts.creditWallet(msisdn, 2 * bet)
         ELSE (loss) → wallet stays at (balance − bet), no further action
Step 8: games.ts.recordGameSession({ msisdn, bet, choice, outcome, result, delta, balanceAfter })
Step 9: Return { sessionId, outcome, result, delta, balanceAfter }
Step 10: UI shows flip animation, then reveals outcome and new balance
```

**Net wallet delta: `+bet` on win, `−bet` on loss.**
No MVola, no external calls, no polling. Fully synchronous.

---

### 6. Cash-Out (Merchant → User, wallet reserved upfront, refunded on failure)

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

## State Management

No persistent state. The PoC uses:

- **In-memory OAuth token cache** (`src/lib/mvola/auth.ts` module-level variable): survives the process lifetime, reset on server restart
- **In-memory domain stores** (`src/lib/store/{wallets,transactions,games}.ts`): module-level `Map`s that hold wallet balances, transaction reconciliation records, and game session logs. Wiped on server restart.
- **Client-side React state**:
  - `WalletHeader` tracks the active MSISDN (mirrored in `localStorage`) and polls the balance
  - `DepositForm` / `CashOutForm` track `correlationId`, polling interval, and transaction status
  - `CoinFlipGame` tracks the last outcome and flip animation state

### Key invariants
- **Wallet balance ≥ 0** always — every debit path checks first and throws if insufficient
- **Wallet credit is confirmation-driven** for deposits — never optimistic
- **Wallet debit is reservation-driven** for cash-outs — reserved at request time, refunded if MVola rejects or returns failed
- **Idempotency:** every `TransactionRecord` carries a `walletSettled` flag; the status route and the webhook route both consult it before applying a wallet side-effect, so the wallet never double-credits or double-refunds when both events fire for the same transaction
- **Monetary unit:** integer Ariary throughout the store and game layers; conversion to/from the MVola API's string representation happens only at the `client.ts` boundary

See [state-management.md](state-management.md) for full schemas, accessor contracts, and reset behaviour.
