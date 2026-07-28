---
slug: game-and-queries
design: planned
---

# Coin-Flip Game and Wallet Queries

> Self-contained — a story reads this (+ folder-structure.md, + \_shared.md when noted), not other feature docs.

## Summary

The in-game simulation layer and the read-only wallet query API. The coin-flip game is
pure logic behind a thin route that debits, plays, credits, and records — no MVola
involvement, everything synchronous against the in-memory stores. The wallet query routes
(`balance`, `history`) are read-only views into the same stores. Its boundary: this
feature never calls MVola and never mutates transaction records; the stores it reads are
owned by [state-store](../state-store/index.md).

## Components

### `src/lib/game/coinflip.ts` — Coin-Flip Game Logic

- **Type:** Server-only TypeScript module (pure)
- **Purpose:** Compute the outcome of a single coin-flip round
- **Responsibilities:**
  - `playCoinFlip(bet, choice, rng?): CoinFlipOutcome` → `{ outcome, result, delta }`
  - Default `rng`: `crypto.getRandomValues(new Uint8Array(1))[0] < 128 ? "heads" : "tails"`
  - Accepts an injected `rng` for deterministic unit tests
  - Pure function — no I/O, no state mutation
- **Depends on:** `types.ts` (`GameChoice`, `CoinFlipOutcome`)

### `src/app/api/game/coinflip/route.ts` — Coin-Flip Game Route

- **Type:** Next.js API Route (server-only)
- **Purpose:** Play one round of coin-flip against the in-memory wallet
- **Responsibilities:**
  - Validate body: `{ msisdn, bet, choice: "heads" | "tails" }` with `bet > 0`
  - Check `getWallet(msisdn).balance >= bet` — return `409 Conflict` if insufficient
  - **Debit** `bet` from the wallet
  - Call `playCoinFlip(bet, choice)`
  - If `result === "win"`: **credit** `2 * bet` (net `+bet`); else balance stays debited (net `-bet`)
  - Record the round via `recordGameSession(...)`
  - Return `{ sessionId, outcome, result, delta, balanceAfter }`
- **Depends on:** `lib/game/coinflip.ts`, `lib/store/{wallets,games}.ts`

### `src/app/api/wallet/[msisdn]/balance/route.ts` — Wallet Balance Route

- **Type:** Next.js API Route (server-only, read-only)
- **Purpose:** Return the current in-memory wallet balance for an MSISDN
- **Responsibilities:**
  - Read `msisdn` from the path parameter
  - Call `wallets.ts → getWallet(msisdn)`; return `{ msisdn, balance: 0 }` if unknown
  - Return `{ msisdn, balance, updatedAt }`
- **Depends on:** `lib/store/wallets.ts`

### `src/app/api/wallet/[msisdn]/history/route.ts` — History Route

- **Type:** Next.js API Route (server-only, read-only)
- **Purpose:** Return a merged, sorted history of all transactions and game rounds for an MSISDN
- **Responsibilities:**
  - Call `transactions.ts → listTransactionsByMsisdn(msisdn)` and `games.ts → listGameSessionsByMsisdn(msisdn)`
  - Return a single chronologically-sorted array tagged by `kind: "transaction" | "game"`
- **Depends on:** `lib/store/{transactions,games}.ts`

## API

These routes read and mutate the in-memory wallet / transaction / game state. They do
**not** call MVola directly. They exist only on this server.

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

> Returns `{ balance: 0 }` for an MSISDN that has never been seen — a wallet is created
> lazily on first credit/debit.

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

### POST `/api/game/coinflip`

Play one round of coin-flip. Atomically validates balance, debits the bet, computes the
outcome, and credits winnings on a win.

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

## Data

None owned. Reads `wallets.ts` / `transactions.ts` and reads+writes `games.ts` from
[state-store](../state-store/index.md).

## Flows

### 5. Coin-flip round (pure, no MVola call)

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

## Shared dependencies

- [Conventions](../../_shared.md#conventions) — integer Ariary throughout
- [state-management.md](../../state-management.md) — store schemas and concurrency model
