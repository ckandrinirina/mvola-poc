---
slug: mvola-core-library
design: planned
---

# MVola Core Library

> Self-contained — a story reads this (+ folder-structure.md, + \_shared.md when noted), not other feature docs.

## Summary

The server-only MVola integration library under `src/lib/mvola/`: shared TypeScript
types, the OAuth token manager, and the typed HTTP client. Its boundary: this feature
speaks to MVola and nothing else — it owns no routes, no wallet state, and no UI.
Nothing outside `src/lib/mvola/` may call the MVola API directly. The deposit direction
(`initiateDeposit`) and the reconciliation helper are added later by
[wallet-aware-mvola](../wallet-aware-mvola/index.md); the domain half of `types.ts` is
owned by [state-store](../state-store/index.md).

## Components

### `src/lib/mvola/auth.ts` — Token Manager

- **Type:** Server-only TypeScript module
- **Purpose:** Manage OAuth token lifecycle
- **Responsibilities:**
  - Fetch a new token using Consumer Key + Secret (Basic Auth)
  - Cache the token in memory with its expiry time
  - Automatically refresh when the token is within 60 seconds of expiry
- **Depends on:** MVola `POST /token` (see [\_shared.md](../../_shared.md#post-token--oauth-token))

### `src/lib/mvola/client.ts` — MVola HTTP Client

- **Type:** Server-only TypeScript module
- **Purpose:** Typed wrappers around MVola API endpoints (both payment directions)
- **Responsibilities:**
  - `initiateWithdrawal(params, token)` → POST to MVola Merchant Pay (debitParty = merchant, creditParty = player)
  - `initiateDeposit(params, token)` → POST to MVola Merchant Pay (debitParty = player, creditParty = merchant) — added by [wallet-aware-mvola](../wallet-aware-mvola/index.md)
  - `getTransactionStatus(correlationId, token)` → GET status from MVola
  - Attach required headers (`X-CorrelationID`, `UserAccountIdentifier`, etc.) via the `buildHeaders()` helper
  - Both `initiateDeposit` and `initiateWithdrawal` share the same URL, headers, and error handling; they only differ in the `debitParty`/`creditParty` pair
- **Depends on:** `auth.ts` for the bearer token (passed in, not called directly), `types.ts`

### `src/lib/mvola/types.ts` — TypeScript Types

- **Type:** Shared type definitions
- **Purpose:** Single source of truth for all MVola payload shapes **and** internal domain types
- **Responsibilities:** Define interfaces for:
  - MVola shapes (owned here): `MVolaToken`, `WithdrawalRequest`, `TransactionResponse`, `CallbackPayload`, `TransactionStatus`, `MVolaParty`
  - Domain shapes (owned by [state-store](../state-store/index.md), same file): `WalletState`, `TransactionRecord`, `TransactionDirection`, `GameSession`, `GameChoice`, `GameResult`, `CoinFlipOutcome`
- **Depends on:** nothing

## API

This feature exposes no HTTP routes; it consumes the MVola external API. The full
endpoint reference (headers, `/token`, initiate transaction, status, status codes,
sandbox numbers) lives in
[\_shared.md → MVola external API reference](../../_shared.md#mvola-external-api-reference).

## Data

The in-memory OAuth token cache (`auth.ts` module-level variable): survives the process
lifetime, reset on server restart. No other state.

## Flows

### Token refresh

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

## Shared dependencies

- [MVola external API reference](../../_shared.md#mvola-external-api-reference)
- [Shared message formats](../../_shared.md#shared-message-formats)
- [Conventions](../../_shared.md#conventions) — monetary unit converts at the `client.ts` boundary
- [configuration.md](../../configuration.md) — consumer key/secret, base URL, merchant MSISDN
