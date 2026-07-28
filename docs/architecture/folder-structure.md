# Project Folder Structure

## Overview

A standard Next.js 14+ App Router project. All MVola API calls are proxied through server-side API routes in `src/app/api/mvola/` to keep credentials out of the browser. The MVola HTTP client and token logic live in `src/lib/mvola/`. The in-memory wallet / transaction / game state lives in `src/lib/store/`, and pure game logic lives in `src/lib/game/`. Internal (non-MVola) API routes for wallet queries and game rounds live under `src/app/api/wallet/` and `src/app/api/game/`.

## Directory Tree

```
mvola-prof/
├── src/
│   ├── app/                            # Next.js App Router root
│   │   ├── layout.tsx                  # Root HTML layout
│   │   ├── page.tsx                    # Demo UI: tabbed single page
│   │   └── api/
│   │       ├── mvola/                  # Server-side MVola proxy routes
│   │       │   ├── token/
│   │       │   │   └── route.ts        # POST — fetch/refresh OAuth token
│   │       │   ├── deposit/
│   │       │   │   └── route.ts        # POST — initiate deposit (user → merchant)
│   │       │   ├── withdraw/
│   │       │   │   └── route.ts        # POST — initiate cash-out (merchant → user)
│   │       │   ├── status/
│   │       │   │   └── [correlationId]/
│   │       │   │       └── route.ts    # GET — poll transaction status
│   │       │   ├── transaction/
│   │       │   │   └── [transactionReference]/
│   │       │   │       └── route.ts    # GET — MVola's record of a settled tx + the local one
│   │       │   └── callback/
│   │       │       └── route.ts        # PUT — receive MVola webhook
│   │       ├── wallet/                 # Internal wallet queries (no MVola call)
│   │       │   └── [msisdn]/
│   │       │       ├── balance/
│   │       │       │   └── route.ts    # GET — current wallet balance
│   │       │       └── history/
│   │       │           └── route.ts    # GET — transactions + game rounds
│   │       └── game/                   # Internal game simulation
│   │           └── coinflip/
│   │               └── route.ts        # POST — play one coin-flip round
│   ├── lib/
│   │   ├── mvola/                      # MVola API client (server-only)
│   │   │   ├── client.ts               # HTTP calls (initiateWithdrawal, initiateDeposit,
│   │   │   │                           #   getTransactionStatus, getTransactionDetails)
│   │   │   ├── auth.ts                 # Token fetch + in-memory cache
│   │   │   ├── reconcile.ts            # Idempotent wallet reconciliation
│   │   │   ├── status.ts               # parseMvolaStatus() — one reading for poll + callback
│   │   │   ├── polling.ts              # Poll interval / ceiling from env
│   │   │   └── types.ts                # TypeScript types for MVola payloads + domain types
│   │   ├── store/                      # In-memory state (server-only)
│   │   │   ├── wallets.ts              # Map<msisdn, WalletState>
│   │   │   ├── transactions.ts         # Map<localTxId, TransactionRecord> + correlationId index
│   │   │   └── games.ts                # Map<sessionId, GameSession>
│   │   └── game/                       # Pure game logic (server-only)
│   │       └── coinflip.ts             # Coin-flip round: bet, outcome, delta
│   └── components/
│       ├── WalletHeader.tsx            # MSISDN input + live balance (persisted in localStorage)
│       ├── TabbedLayout.tsx            # Tab switcher: Deposit / Play / Cash-out / History
│       ├── DepositForm.tsx             # Amount form → POST /api/mvola/deposit + polling
│       ├── CoinFlipGame.tsx            # Bet + heads/tails, result display
│       ├── CashOutForm.tsx             # Wallet-aware cash-out (refactor of WithdrawForm)
│       ├── PendingApprovalBanner.tsx   # Names the manual approval a pending tx waits on
│       └── TransactionHistory.tsx      # Chronological list; settled rows expand to MVola's record
├── scripts/
│   └── preflight.mjs                   # npm run preflight — env, token, callback reachability
├── docs/
│   ├── API_MerchantPay.pdf             # Original MVola API spec (read-only)
│   ├── mvola-reference/                # MVola's own guides + merchant-pay-openapi.json
│   ├── specs/                          # Stakeholder feature specs (read-only input)
│   └── architecture/                   # This documentation set
├── .env.local                          # Secrets — NOT committed
├── .env.example                        # Template — committed
├── next.config.ts
├── tsconfig.json
├── package.json
└── CLAUDE.md
```

## Key Directories Explained

### `src/app/api/mvola/`
Next.js route handlers that proxy calls to the MVola API. Running entirely on the server, they have access to environment variables (credentials) and are never bundled into the client. Includes both payment directions: `deposit/` (user → merchant) and `withdraw/` (merchant → user).

### `src/app/api/wallet/`
Internal read-only routes for querying the in-memory wallet state — current balance and transaction/game history for a given MSISDN. No MVola API is called; these read from `src/lib/store/`.

### `src/app/api/game/`
Internal routes that simulate game activity. `coinflip/route.ts` validates the player's balance, debits the bet, runs the pure game logic from `src/lib/game/coinflip.ts`, credits winnings, records the round, and returns the new balance.

### `src/lib/mvola/`
Reusable MVola client logic. `auth.ts` manages token lifecycle (fetch on first use, return cached token while valid). `client.ts` provides typed functions for all four MVola operations. `status.ts` holds the single interpretation of MVola's reply that both the polling route and the webhook route apply, so the two paths to settlement cannot disagree. `reconcile.ts` applies the wallet side-effect exactly once. `polling.ts` reads the two timing knobs from the environment. `types.ts` holds shared TypeScript interfaces for both MVola payloads and internal domain types (`WalletState`, `TransactionRecord`, `GameSession`).

### `scripts/`
Operational scripts run outside the Next.js server. `preflight.mjs` answers "is this demo runnable right now?" — environment completeness, live credentials, and callback reachability — before an audience is watching.

### `src/lib/store/`
Module-level `Map` stores that hold wallet balances, transaction records, and game sessions. Mirrors the existing in-memory pattern used by the OAuth token cache in `auth.ts` — survives the process lifetime, resets on server restart. See [state-management.md](state-management.md) for full schemas and invariants.

### `src/lib/game/`
Pure, deterministic-by-injection game logic. `coinflip.ts` exposes a single function that accepts a bet + choice and returns an outcome + delta; randomness is sourced via `crypto.getRandomValues`. No network, no state — fully unit-testable in isolation.

### `src/components/`
Stateless React UI components. The demo page composes them into a tabbed single-page layout (`TabbedLayout`) with a persistent header (`WalletHeader`) that stores the active MSISDN in `localStorage`.

## Conventions

- File names: `camelCase` for TypeScript files, `PascalCase` for React components
- API route files are always named `route.ts` (Next.js App Router convention)
- Server-only code lives in `src/lib/` — never imported from client components
- All MVola types are defined once in `src/lib/mvola/types.ts`; domain types (`WalletState`, `TransactionRecord`, `GameSession`) live alongside them in the same file
- Store modules export typed accessors only (`getWallet`, `creditWallet`, `debitWallet`, etc.) — the underlying `Map` is never exposed directly
- Monetary amounts are **integer Ariary** everywhere in the wallet/game layer; the MVola HTTP layer serialises them as strings at the edge per the MVola API contract
- `MVOLA_ENV` is read in exactly one place — `client.ts::getBaseUrl()`. No other code branches on the environment; sandbox and production follow the same path
