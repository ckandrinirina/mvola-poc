# Story 07-02: Coin-Flip Route — `POST /api/game/coinflip`

> **Epic:** 07 — Game & Wallet Queries
> **Size:** M
> **Status:** DONE

## Description

Create `src/app/api/game/coinflip/route.ts` — the route the browser calls to play one coin-flip round. It validates the body, checks the wallet balance, **synchronously** debits the bet, calls the pure `playCoinFlip`, credits `2 * bet` on a win, records a `GameSession`, and returns `{ sessionId, outcome, result, delta, balanceAfter }`. The balance-check / debit pair runs in the same event-loop tick to preserve atomicity.

## Acceptance Criteria

- [x] Accepts `{ msisdn: string, bet: number, choice: "heads" | "tails" }` JSON body
- [x] Returns 400 `{ error: "Invalid request", details: <string> }` when:
  - [x] `msisdn` is missing or empty
  - [x] `bet` is not a positive integer
  - [x] `choice` is not `"heads"` or `"tails"`
- [x] Returns 409 `{ error: "Insufficient funds", balance, requested }` when wallet < bet
- [x] Debits the bet via `debitWallet(msisdn, bet)` **before** calling `playCoinFlip` (synchronous block — no `await`)
- [x] On win (`result === "win"`): calls `creditWallet(msisdn, 2 * bet)` — net wallet delta is `+bet`
- [x] On loss: wallet stays at `balance − bet`
- [x] Calls `recordGameSession({ msisdn, bet, choice, outcome, result, delta, balanceAfter })` where `balanceAfter = getWallet(msisdn).balance`
- [x] Returns 200 `{ sessionId, outcome, result, delta, balanceAfter }` on success
- [x] Route tests cover: 400 each validation path, 409 insufficient funds, 200 win path (mocked RNG), 200 loss path (mocked RNG), wallet balance is correct after each
- [x] No MVola API is called

## Technical Notes

The route is the one place in the system where both the wallet store and the game session store mutate together in the same request. Keep the whole pipeline synchronous:

```typescript
// Synchronous block — no awaits
debitWallet(msisdn, bet);
const outcome = playCoinFlip(bet, choice);
if (outcome.result === "win") {
  creditWallet(msisdn, bet * 2);
}
const balanceAfter = getWallet(msisdn)!.balance;
const session = recordGameSession({
  msisdn,
  bet,
  choice,
  outcome: outcome.outcome,
  result: outcome.result,
  delta: outcome.delta,
  balanceAfter,
});
return NextResponse.json({
  sessionId: session.sessionId,
  outcome: session.outcome,
  result: session.result,
  delta: session.delta,
  balanceAfter,
}, { status: 200 });
```

Wrap the whole thing in `try/catch` to map `InsufficientFundsError` to a 409.

For tests, mock `playCoinFlip` (via `jest.mock("@/lib/game/coinflip")`) to force deterministic outcomes.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/app/api/game/coinflip/route.ts` | Coin-flip round handler |
| CREATE | `src/app/api/game/coinflip/__tests__/route.test.ts` | Route tests |

## Dependencies

- **Blocked by:** Stories 05-02, 05-04, 07-01
- **Blocks:** Story 08-04 (CoinFlipGame component)

## Related

- **Epic:** 07_game-and-queries
- **Spec reference:** `docs/architecture/api-contracts.md` § `POST /api/game/coinflip`, `docs/architecture/data-flow.md` § Flow 5 (Coin-Flip Round)
