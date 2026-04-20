# Project Overview

## Vision

`mvola-prof` is a proof-of-concept Next.js application demonstrating a **realistic, end-to-end MVola Merchant Pay integration** in a lightweight game context. A single player deposits money from their MVola account into an in-game wallet, plays a simulated coin-flip betting game, and cashes out the remaining balance back to their MVola number. The goal is to produce a working, well-structured reference implementation that covers both payment directions (user → merchant and merchant → user) and can be adapted into a real game backend.

## Goals

- Implement the full MVola payment lifecycle in **both directions**: OAuth authentication → deposit (user → merchant) and payout (merchant → user) → status polling → webhook reception
- Maintain an **in-game wallet** that only reflects MVola-settled funds (credit on confirmed deposit, debit on confirmed cash-out)
- Simulate a simple **coin-flip game** that consumes and produces wallet balance, demonstrating how real game state interacts with payments
- Keep all MVola API credentials server-side (Next.js API routes) — never exposed to the browser
- Provide a single-page demo UI with tabbed sections (**Deposit / Play / Cash-out / History**) showing the full round-trip end-to-end
- Work against the MVola sandbox environment so no real money is involved during development

## Target Users

- **Developers** integrating MVola payments into a game: use this PoC as a reference implementation for the full deposit → play → cash-out lifecycle
- **QA testers** verifying the payment flow: use the demo UI against the MVola sandbox for both deposit and cash-out directions

## Key Constraints

- PoC scope only — in-memory state, no persistent database, single server process
- Credentials must stay server-side (Next.js API routes handle all MVola calls)
- The sandbox environment uses test phone numbers (`0343500003`, `0343500004`)
- OAuth tokens expire after 3600 seconds and must be refreshed automatically
- Wallet state is keyed by MSISDN and survives only within a single server process — restart wipes the wallet and history
- Every wallet mutation must be **idempotent** — the status poll and the webhook may both fire for the same transaction

## Scope

### In Scope
- OAuth 2.0 token acquisition and in-memory caching
- **Deposit** (user → merchant) via MVola Merchant Pay API with confirmation-driven wallet credit
- **Cash-out** (merchant → user) via MVola Merchant Pay API with reserve-on-request / refund-on-failure wallet semantics
- Transaction status polling and webhook callback endpoint with idempotent reconciliation
- **In-memory wallet store** keyed by player MSISDN with balance, transactions, and game history
- **Coin-flip game simulation** — bet from wallet, 50/50 outcome, win doubles the bet / lose forfeits it
- **Transaction + game history** endpoint per MSISDN
- Single-page React UI with tabs: Deposit / Play / Cash-out / History

### Out of Scope / Future
- Persistent storage (database, file-backed store)
- Multi-player concurrency beyond a single active MSISDN in the UI
- Multi-merchant support
- Full production hardening (rate limiting, retry queues, audit logs, RNG certification, house edge tuning)
- Player authentication / session management
- Real-game integration (leaderboards, game lobbies, matchmaking)
