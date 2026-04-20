# Epic 07: Game & Wallet Queries

## Description

Add the in-game simulation layer and the read-only wallet query API. The coin-flip game is pure logic behind a thin route that debits, plays, credits, and records — no MVola involvement, everything synchronous against the in-memory stores. The wallet query routes (`balance`, `history`) are read-only views into the same stores.

Together these routes make the feature fully exercisable from `curl`: after Epic 06 a developer can move money into and out of MVola; after this epic they can also play the game, see their balance, and list their history.

## Goals

- Pure `playCoinFlip(bet, choice, rng?)` function in `src/lib/game/coinflip.ts` with deterministic tests via RNG injection
- `POST /api/game/coinflip` — synchronous balance-check + debit + play + credit-on-win + record
- `GET /api/wallet/[msisdn]/balance` — read the wallet, return `{ msisdn, balance, updatedAt }`
- `GET /api/wallet/[msisdn]/history` — merged, time-sorted list of transactions + game sessions

## Scope

### In Scope
- One new lib file: `src/lib/game/coinflip.ts`
- Three new routes under `src/app/api/game/coinflip/` and `src/app/api/wallet/[msisdn]/{balance,history}/`
- Unit tests for the game logic and route tests for all three routes

### Out of Scope
- Richer game mechanics (dice, slots, house edge) — not for PoC
- Pagination or filtering on history — small in-memory data set, no need
- Admin / debug endpoints — deferred

## Dependencies

- **Depends on:** Epic 05 (wallet, transaction, game stores + domain types)
- **Blocks:** Epic 08 (UI components call these routes)

## Stories

| # | Story | Size | Status |
|---|-------|------|--------|
| 01 | Coin-flip pure logic — `src/lib/game/coinflip.ts` | S | TODO |
| 02 | Coin-flip route — `POST /api/game/coinflip` | M | TODO |
| 03 | Balance query route — `GET /api/wallet/[msisdn]/balance` | S | TODO |
| 04 | History query route — `GET /api/wallet/[msisdn]/history` | M | TODO |

## Acceptance Criteria

- [ ] `playCoinFlip` accepts an injected RNG for deterministic tests
- [ ] `POST /api/game/coinflip` validates input (400), checks balance (409), atomically debits the bet, plays, credits winnings on win, records the session, returns the outcome + new balance
- [ ] Coin-flip route's balance-check and debit happen in the same synchronous block (no `await` between them)
- [ ] Balance route returns `balance: 0` for unknown MSISDN with 200 status
- [ ] History route returns a single chronologically-sorted array tagging each entry with `kind: "transaction" | "game"`
- [ ] Each route has its own tests; `playCoinFlip` has deterministic unit tests via RNG injection
- [ ] No route in this epic calls the MVola API

## Technical Notes

- The coin-flip route is the one place where both the wallet store and the game session store are mutated in the same request. Keep the `debitWallet → playCoinFlip → creditWallet → recordGameSession` pipeline fully synchronous so a concurrent game round cannot observe a partial state.
- The balance route is deliberately permissive (no MSISDN validation beyond path presence) — the client uses it for polling and we want it cheap.
- The history route does a simple `concat + sort` in memory; the data set is tiny (single player, in-memory, single session), so no pagination is needed.
