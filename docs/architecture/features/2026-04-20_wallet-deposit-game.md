# Feature: Wallet + Deposit + Coin-Flip Game + Cash-Out

> Added on **2026-04-20**. Cross-references: [overview.md](../overview.md) · [folder-structure.md](../folder-structure.md) · [components.md](../components.md) · [data-flow.md](../data-flow.md) · [api-contracts.md](../api-contracts.md) · [state-management.md](../state-management.md) · [dev-guide.md](../dev-guide.md)

## Goal

Turn the existing single-direction MVola withdraw PoC into a realistic round-trip demo. A single player can:

1. Enter their MVola number
2. **Deposit** Ariary from their MVola account into an in-game wallet
3. **Check** their in-game balance at any time
4. **Play** a simulated coin-flip game, wagering from the wallet
5. **Cash out** the remaining wallet balance back to their MVola account
6. **Review** every deposit, game round, and cash-out in a history list

The deliverable is a single-page tabbed UI and a set of server-side routes, all backed by in-memory stores.

## User journey

```
[1] Player opens http://localhost:3000
     └─ WalletHeader: MSISDN input (saved to localStorage), balance = 0 Ar

[2] Deposit tab
     └─ Enter 10000 Ar → Deposit → poll MVola → balance becomes 10000 Ar

[3] Play tab
     └─ Bet 1000 on heads → flip → result: tails → balance = 9000 Ar
     └─ Bet 2000 on tails → flip → result: tails → balance = 11000 Ar
     └─ Bet 500 on heads → flip → result: heads → balance = 11500 Ar
        (5 rounds, balance drifts as a random walk around the starting point)

[4] Cash-out tab
     └─ Amount defaults to full balance (11500) → Cash out
     └─ Wallet debited immediately (reserve)
     └─ Poll MVola → on completed, UI shows "Cash-out successful"
     └─ Balance = 0 Ar

[5] History tab
     └─ Chronological list of all entries:
          ✓ Deposit  +10000 Ar  (completed)
          × Game     −1000  Ar  (tails / heads — loss)
          ✓ Game     +2000  Ar  (tails / tails — win)
          × Game     +500   Ar  (heads / heads — win)
          ...
          ✓ Withdraw −11500 Ar  (completed)
```

## What gets added

### Server-side

| Path | New? | Purpose |
|------|------|---------|
| `src/lib/store/wallets.ts` | NEW | `Map<msisdn, WalletState>` + credit/debit accessors |
| `src/lib/store/transactions.ts` | NEW | `Map<localTxId, TransactionRecord>` + correlationId index |
| `src/lib/store/games.ts` | NEW | `Map<sessionId, GameSession>` + list accessor |
| `src/lib/game/coinflip.ts` | NEW | Pure `playCoinFlip(bet, choice, rng?)` |
| `src/lib/mvola/client.ts` | EXTEND | Add `initiateDeposit()` — same endpoint as withdraw, swapped parties |
| `src/lib/mvola/types.ts` | EXTEND | Add `WalletState`, `TransactionRecord`, `GameSession`, etc. |
| `src/app/api/mvola/deposit/route.ts` | NEW | `POST` — initiate deposit, record pending transaction |
| `src/app/api/mvola/withdraw/route.ts` | REFACTOR | Validate wallet, reserve funds, refund on failure |
| `src/app/api/mvola/status/[correlationId]/route.ts` | REFACTOR | Reconcile wallet on status transition |
| `src/app/api/mvola/callback/route.ts` | REFACTOR | Reconcile wallet on webhook arrival |
| `src/app/api/wallet/[msisdn]/balance/route.ts` | NEW | `GET` — current wallet balance |
| `src/app/api/wallet/[msisdn]/history/route.ts` | NEW | `GET` — merged transaction + game history |
| `src/app/api/game/coinflip/route.ts` | NEW | `POST` — play one round against the wallet |

### Client-side

| Path | New? | Purpose |
|------|------|---------|
| `src/app/page.tsx` | REFACTOR | Compose `WalletHeader` + `TabbedLayout` |
| `src/components/WalletHeader.tsx` | NEW | MSISDN input + live balance |
| `src/components/TabbedLayout.tsx` | NEW | Tab switcher + shared msisdn context |
| `src/components/DepositForm.tsx` | NEW | Deposit flow + polling |
| `src/components/CoinFlipGame.tsx` | NEW | Bet form + flip animation + result |
| `src/components/CashOutForm.tsx` | REFACTOR | The existing `WithdrawForm.tsx`, wallet-aware |
| `src/components/TransactionHistory.tsx` | NEW | History list for the current MSISDN |

### Unchanged

- `src/lib/mvola/auth.ts` — token cache stays as-is
- `src/app/api/mvola/token/route.ts` — debug-only endpoint unchanged
- All env vars in `.env.example` / `.env.local`
- `next.config.ts`, `tsconfig.json`, `package.json`

## New flows (detailed in [data-flow.md](../data-flow.md))

1. **Deposit** — confirmation-driven wallet credit (credit only when MVola says `completed`)
2. **Coin-flip round** — synchronous debit → play → credit-on-win, fully internal
3. **Cash-out** — reserve at request time, refund on failure

## Wallet semantics

| Event | Wallet delta | Transaction `walletSettled` |
|-------|--------------|------------------------------|
| Deposit request accepted | 0 | `false` |
| Deposit `completed` (first seen) | `+amount` | flip to `true` |
| Deposit `failed` | 0 | flip to `true` (frozen) |
| Coin-flip round accepted | `−bet` | n/a (no transaction record) |
| Coin-flip win | `+2·bet` net effect `+bet` | n/a |
| Coin-flip loss | 0 (stays at `−bet`) | n/a |
| Cash-out request accepted | `−amount` | `true` (reserved) |
| Cash-out `completed` (first seen) | 0 | stays `true` |
| Cash-out `failed` | `+amount` (refund) | flip to `false` |
| Cash-out MVola call throws (sync) | `+amount` (immediate refund) | record never created |

Duplicate deliveries (status poll + webhook for the same event) are absorbed by the `walletSettled` guard. See [state-management.md § Idempotency](../state-management.md#idempotency).

## Edge cases

| Case | Behaviour |
|------|-----------|
| Player tries to bet more than wallet | `409 Conflict` from `/api/game/coinflip` with `{ balance, requested }` |
| Player tries to cash out more than wallet | `409 Conflict` from `/api/mvola/withdraw` |
| Deposit never resolves (MVola hang) | Record stays `pending`; UI keeps polling. No wallet credit until resolved. A manual `curl /api/mvola/status/:id` can be used to force a re-check. |
| Webhook arrives before the first status poll | Callback route does the full reconciliation; subsequent polls are no-ops |
| Webhook arrives after status poll already reconciled | Callback route is a no-op (`walletSettled` guard) |
| Server restart mid-flow | All state is lost: wallet resets to 0, pending transactions vanish. Real MVola-side funds are unaffected. See [state-management.md § Reset behaviour](../state-management.md#reset-behaviour) |
| Cash-out MVola call fails synchronously (network error before `serverCorrelationId`) | Wallet refunded immediately inside the route handler; no record persisted |
| Simultaneous deposit + game play | Safe: each route handler's balance check + mutation is synchronous (no `await` in between), so operations serialise on the single Node event loop |

## Test matrix

### Unit tests

- `wallets.ts` — ensure/credit/debit, insufficient-funds throw
- `transactions.ts` — create, correlationId index lookup, status update + `walletSettled` flag, list-by-msisdn sort order
- `games.ts` — record + list
- `coinflip.ts` — deterministic via injected RNG: forced win, forced loss, forced tail/head, bet=0 rejection
- `client.ts` — `initiateDeposit` sends correct `debitParty`/`creditParty` (inverse of `initiateWithdrawal`)

### Route tests

- `POST /api/mvola/deposit` — validation, happy path creates record + returns correlationId, wallet NOT credited at request time
- `POST /api/mvola/withdraw` — insufficient funds 409, reserve debits wallet, MVola error refunds wallet, record has `walletSettled: true`
- `GET /api/mvola/status/:id` — first `completed` on deposit credits wallet exactly once; second call is a no-op; `failed` on withdraw refunds wallet
- `PUT /api/mvola/callback` — same reconciliation behaviour as status; idempotent with status route
- `GET /api/wallet/:msisdn/balance` — returns 0 for unknown MSISDN, live value otherwise
- `GET /api/wallet/:msisdn/history` — merged sort order, correct entry shape per `kind`
- `POST /api/game/coinflip` — insufficient funds 409, bet validation, deterministic win/loss with mocked RNG, balance delta

### Component tests

- `WalletHeader` — localStorage round-trip, balance polling stops when MSISDN is cleared
- `DepositForm` — happy path: request → pending → polling → completed, triggers balance refresh
- `CoinFlipGame` — loading state, flip animation, win/loss rendering, balance refresh trigger
- `CashOutForm` — 409 shows "insufficient funds", failed status shows "wallet refunded"
- `TransactionHistory` — renders transaction + game entries in order with correct icons/colours

### Manual end-to-end

Walk through the user journey above with `MVOLA_ENV=sandbox` and `0343500003` as the MSISDN. Verify:

- Balance visible in header changes after each deposit/game/cash-out
- ngrok console shows the incoming PUT callback for each MVola transaction
- After server restart, balance is back to 0 and history is empty

## Open questions

None blocking. The following are deferred and tracked as future work (not part of this feature):

- Should we persist state to a file / SQLite so dev restarts don't wipe the wallet?
- Should the coin-flip game have a house edge (e.g. 47/53) to feel more realistic?
- Should the callback route verify an MVola HMAC signature before mutating state?
- Should multi-player concurrent sessions be supported without collisions on the merchant account?
