# Architecture Documentation

> Generated from `docs/API_MerchantPay.pdf` (original spec) on 2026-04-16.
> Extended with the Wallet + Deposit + Coin-Flip Game + Cash-Out feature on 2026-04-20.
> The original specification PDF was not modified.

## Documents

| Document | Description |
|----------|-------------|
| [overview.md](overview.md) | Project vision, goals, and target users |
| [folder-structure.md](folder-structure.md) | Complete project directory tree with annotations |
| [tech-stack.md](tech-stack.md) | Languages, frameworks, and library versions |
| [components.md](components.md) | Component descriptions and responsibilities |
| [data-flow.md](data-flow.md) | How data moves through the system |
| [api-contracts.md](api-contracts.md) | Internal API routes and MVola API reference |
| [configuration.md](configuration.md) | Environment variables and configuration |
| [dev-guide.md](dev-guide.md) | Prerequisites, setup, and run instructions |
| [state-management.md](state-management.md) | In-memory store layer: wallet, transactions, game sessions |
| [features/2026-04-20_wallet-deposit-game.md](features/2026-04-20_wallet-deposit-game.md) | Self-contained spec for the deposit / game / cash-out feature |
| database-schema.md | Not applicable — PoC has no database |

## Source
- **Original spec:** `docs/API_MerchantPay.pdf`
- **Generated:** 2026-04-16
- **Last updated:** 2026-04-20 (wallet + deposit + coin-flip + cash-out feature)
- **Gaps remaining:** None

## Changelog

### 2026-04-20 — Wallet, Deposit, Coin-Flip Game, Cash-Out
Added a realistic end-to-end round-trip: player deposits via MVola, plays a coin-flip game against an in-game wallet, cashes out the balance via MVola. Files touched:

- **Created:** `state-management.md`, `features/2026-04-20_wallet-deposit-game.md`
- **Updated:** `overview.md` (expanded vision + scope), `folder-structure.md` (new `store/`, `game/`, wallet/game API routes, tabbed UI components), `tech-stack.md` (in-memory store + crypto RNG), `components.md` (all new components and routes + updated diagram and interaction matrix), `data-flow.md` (3 new flows: deposit, coin-flip round, cash-out with reserve/refund; expanded state management section), `api-contracts.md` (new `POST /api/mvola/deposit`, `GET /api/wallet/:msisdn/balance`, `GET /api/wallet/:msisdn/history`, `POST /api/game/coinflip`; refactored withdraw contract to include wallet validation + 409), `configuration.md` (note that no new env vars are required), `dev-guide.md` (full round-trip walkthrough + curl snippets for every new route + troubleshooting for insufficient-funds and deposit-stuck-pending)
- **Unchanged:** `database-schema.md` (still not applicable), `.env.example`, `package.json`, source code under `src/`
