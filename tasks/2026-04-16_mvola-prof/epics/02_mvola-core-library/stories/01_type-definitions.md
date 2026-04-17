# Story 02-01: TypeScript Type Definitions — `types.ts`

> **Epic:** 02 — MVola Core Library
> **Size:** S
> **Status:** DONE

## Description

Create `src/lib/mvola/types.ts` with all TypeScript interfaces for MVola request and response payloads. This file is the single source of truth imported by `auth.ts`, `client.ts`, and the API routes. No `any` types allowed.

## Acceptance Criteria

- [x] `MVolaToken` interface defined with `access_token`, `scope`, `token_type`, `expires_in`
- [x] `WithdrawalRequest` interface defined with all required fields for the merchant pay POST body
- [x] `WithdrawalResponse` interface defined with `status`, `serverCorrelationId`
- [x] `TransactionStatusResponse` interface defined with `transactionStatus`, `serverCorrelationId`, `transactionReference`
- [x] `CallbackPayload` interface defined with all fields from the MVola webhook PUT body
- [x] Zero `any` types — all fields explicitly typed
- [x] File compiles without TypeScript errors

## Technical Notes

Reference the exact payload shapes from `docs/architecture/api-contracts.md` and `docs/architecture/data-flow.md`.

Key type: `transactionStatus` should be typed as a union: `"pending" | "completed" | "failed"`.

The `debitParty` and `creditParty` fields are arrays of `{ key: string; value: string }` — define a `MVolaParty` interface for reuse.

```typescript
export interface MVolaParty {
  key: string;
  value: string;
}
```

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/mvola/types.ts` | All MVola TypeScript interfaces |

## Dependencies

- **Blocked by:** Story 01-01 (project scaffold)
- **Blocks:** Story 02-02, Story 02-03

## Related

- **Epic:** 02_mvola-core-library
- **Spec reference:** `docs/architecture/api-contracts.md`, `docs/architecture/data-flow.md`
