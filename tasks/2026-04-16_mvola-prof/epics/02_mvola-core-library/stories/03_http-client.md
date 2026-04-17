# Story 02-03: MVola HTTP Client — `client.ts`

> **Epic:** 02 — MVola Core Library
> **Size:** M
> **Status:** DONE

## Description

Implement `src/lib/mvola/client.ts` with two typed functions: `initiateWithdrawal()` and `getTransactionStatus()`. These are the only places in the codebase that call the external MVola API for transaction operations. Both functions accept a `token` parameter (from `auth.ts`) and attach all required headers defined in the MVola API spec.

## Acceptance Criteria

- [x] `initiateWithdrawal(params, token)` sends `POST` to MVola merchant pay endpoint
- [x] `getTransactionStatus(correlationId, token)` sends `GET` to MVola status endpoint
- [x] Both functions attach all required headers: `Authorization`, `X-CorrelationID`, `UserAccountIdentifier`, `partnerName`, `Content-Type`, `UserLanguage`, `Version`, `Cache-Control`
- [x] `X-CorrelationID` is a unique UUID per request (use `uuid` or `crypto.randomUUID()`)
- [x] `UserAccountIdentifier` is formatted as `msisdn;{MVOLA_MERCHANT_MSISDN}`
- [x] Base URL is selected from `MVOLA_ENV` env var
- [x] Request body for `initiateWithdrawal` includes `requestDate` as ISO 8601 string and `requestingOrganisationTransactionReference` as `game-withdrawal-{uuid}`
- [x] Returns typed responses using interfaces from `types.ts`
- [x] Throws on non-200 responses with error detail from MVola response body

## Technical Notes

Required headers for transaction calls:
```typescript
const headers = {
  "Authorization": `Bearer ${token}`,
  "X-CorrelationID": crypto.randomUUID(),
  "UserAccountIdentifier": `msisdn;${process.env.MVOLA_MERCHANT_MSISDN}`,
  "partnerName": process.env.MVOLA_PARTNER_NAME!,
  "Content-Type": "application/json",
  "UserLanguage": "en",
  "Version": "1.0",
  "Cache-Control": "no-cache",
};
```

MVola merchant pay endpoint:
```
POST {BASE_URL}/mvola/mm/transactions/type/merchantpay/1.0.0/
```

Status endpoint:
```
GET {BASE_URL}/mvola/mm/transactions/type/merchantpay/1.0.0/status/{serverCorrelationId}
```

Withdrawal body shape (from `docs/architecture/data-flow.md`):
- `debitParty`: merchant MSISDN (`MVOLA_MERCHANT_MSISDN`)
- `creditParty`: player MSISDN (passed in by the route)
- `metadata`: includes `partnerName`, `fc: "Ar"`, `amountFc`

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/mvola/client.ts` | `initiateWithdrawal` and `getTransactionStatus` |

## Dependencies

- **Blocked by:** Story 02-01 (types), Story 02-02 (token — though token is passed in, not called directly)
- **Blocks:** Story 03-02, Story 03-03

## Related

- **Epic:** 02_mvola-core-library
- **Spec reference:** `docs/architecture/api-contracts.md`, `docs/architecture/components.md`
