# Epic 02: MVola Core Library

## Description

Implement the server-only MVola integration library under `src/lib/mvola/`. This epic covers all three modules: shared TypeScript types, the OAuth token manager, and the typed HTTP client. These modules are the foundation for all four API routes in Epic 03 — nothing in the routes should call the MVola API directly.

All code in this epic runs server-side only (Node.js runtime). It must never be imported from client components.

## Goals

- Define a single source of truth for all MVola payload shapes (`types.ts`)
- Implement automatic OAuth token acquisition and in-memory caching (`auth.ts`)
- Provide typed wrappers for the two MVola endpoints used in the PoC (`client.ts`)

## Scope

### In Scope
- `types.ts`: interfaces for `MVolaToken`, `WithdrawalRequest`, `WithdrawalResponse`, `TransactionStatusResponse`, `CallbackPayload`
- `auth.ts`: `getToken()` — fetch, cache, and auto-refresh OAuth token
- `client.ts`: `initiateWithdrawal(params)` and `getTransactionStatus(correlationId)`

### Out of Scope
- API routes (Epic 03)
- UI components (Epic 04)
- Any retry logic or persistent storage

## Dependencies

- **Depends on:** Epic 01 (project scaffold + env vars)
- **Blocks:** Epic 03

## Stories

| # | Story | Size | Status |
|---|-------|------|--------|
| 01 | TypeScript type definitions — `types.ts` | S | TODO |
| 02 | OAuth token manager with in-memory cache — `auth.ts` | M | TODO |
| 03 | MVola HTTP client — `client.ts` | M | TODO |

## Acceptance Criteria

- [ ] `types.ts` exports all required interfaces; no `any` types
- [ ] `auth.ts` returns a valid token on first call and returns cached token on subsequent calls within 3600s
- [ ] `auth.ts` re-fetches the token when cache is within 60s of expiry
- [ ] `client.ts` attaches all required headers (`Authorization`, `X-CorrelationID`, `UserAccountIdentifier`, `partnerName`, `Version`, `Cache-Control`, `UserLanguage`)
- [ ] `client.ts` selects base URL based on `MVOLA_ENV` env var (`devapi.mvola.mg` vs `api.mvola.mg`)
- [ ] TypeScript compiles with zero errors across all three files

## Technical Notes

- Use module-level variable for token cache in `auth.ts` (no external cache needed)
- Use `crypto.randomUUID()` (built into Node 18+) instead of `uuid` package for `X-CorrelationID` generation, or use the `uuid` package installed in Epic 01 — either is fine
- `fetch` is natively available in Node 18+ — no need for `axios` or `node-fetch`
