# Story 03-02: Withdraw Route — `POST /api/mvola/withdraw`

> **Epic:** 03 — API Routes
> **Size:** M
> **Status:** TODO

## Description

Create `src/app/api/mvola/withdraw/route.ts` — the primary payout initiation endpoint. It validates the request body, acquires an OAuth token, calls `initiateWithdrawal()` from `client.ts`, and returns the `correlationId` for the client to poll. This is the most important route in the application.

## Acceptance Criteria

- [ ] `POST /api/mvola/withdraw` accepts `{ amount, playerMsisdn, description? }` JSON body
- [ ] Returns 400 with `{ error: "amount and playerMsisdn are required" }` if either field is missing
- [ ] Calls `getToken()` then `initiateWithdrawal()` — does not call MVola directly
- [ ] Returns 200 with `{ correlationId, status: "pending" }` on success
- [ ] Returns 502 with `{ error: "MVola API error", details: string }` on MVola failure
- [ ] `amount` is passed as a string to MVola (not a number)
- [ ] `description` defaults to `"Game withdrawal"` if not provided

## Technical Notes

Request body parsing:
```typescript
const body = await req.json();
const { amount, playerMsisdn, description = "Game withdrawal" } = body;

if (!amount || !playerMsisdn) {
  return NextResponse.json(
    { error: "amount and playerMsisdn are required" },
    { status: 400 }
  );
}
```

The route calls `initiateWithdrawal` from `client.ts`, which handles building the full MVola request body including `debitParty`, `creditParty`, `metadata`, `requestDate`, and `requestingOrganisationTransactionReference`.

Response shape:
```json
{ "correlationId": "550e8400-...", "status": "pending" }
```

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/app/api/mvola/withdraw/route.ts` | Payout initiation with validation |

## Dependencies

- **Blocked by:** Story 02-02 (`getToken`), Story 02-03 (`initiateWithdrawal`)
- **Blocks:** Epic 04 (UI submits to this route)

## Related

- **Epic:** 03_api-routes
- **Spec reference:** `docs/architecture/api-contracts.md` — `POST /api/mvola/withdraw`
