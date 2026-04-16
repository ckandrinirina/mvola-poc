# Project Overview

## Vision

`mvola-prof` is a proof-of-concept Next.js application demonstrating how to integrate the MVola Merchant Pay API into a game for player withdrawals and payouts. The goal is to produce a working, well-structured reference implementation that can be adapted into a real game backend.

## Goals

- Implement the full MVola payment lifecycle: OAuth authentication → payout initiation → status polling → webhook reception
- Keep all MVola API credentials server-side (Next.js API routes) — never exposed to the browser
- Provide a simple demo UI showing the withdrawal flow end-to-end
- Work against the MVola sandbox environment so no real money is involved during development

## Target Users

- **Developers** integrating MVola payments into a game: use this PoC as a reference implementation
- **QA testers** verifying the payment flow: use the demo UI against the MVola sandbox

## Key Constraints

- PoC scope only — no real game logic, no persistent database
- Credentials must stay server-side (Next.js API routes handle all MVola calls)
- The sandbox environment uses test phone numbers (`0343500003`, `0343500004`)
- OAuth tokens expire after 3600 seconds and must be refreshed automatically

## Scope

### In Scope
- OAuth 2.0 token acquisition and in-memory caching
- Payout (withdrawal) initiation via MVola Merchant Pay API
- Transaction status polling
- Webhook callback endpoint for MVola notifications
- Demo React UI to trigger the withdrawal flow

### Out of Scope / Future
- Actual game logic or game state management
- Persistent storage (database)
- Multi-merchant support
- Full production hardening (rate limiting, retry queues, audit logs)
- Player authentication / session management
