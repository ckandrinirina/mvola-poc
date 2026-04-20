# Story 06-01: Deposit HTTP Client Method — `client.ts::initiateDeposit`

> **Epic:** 06 — Wallet-Aware MVola Flows
> **Size:** M
> **Status:** DONE

## Description

Extend `src/lib/mvola/client.ts` with a new `initiateDeposit(params, token)` function that reuses the existing `buildHeaders()` / `throwOnError()` helpers and hits the same Merchant Pay endpoint as `initiateWithdrawal`, but inverts the party assignment: the **player's MSISDN** becomes the `debitParty` and the **merchant MSISDN** becomes the `creditParty`. No other helper changes are required.

## Acceptance Criteria

- [x] `DepositParams` interface exported — symmetrical to `WithdrawalParams` (`msisdn`, `amount`, `description?`, `currency?`)
- [x] `initiateDeposit(params, token): Promise<TransactionResponse>` exported
- [x] Sends `POST` to the same MVola endpoint URL as `initiateWithdrawal`
- [x] `debitParty[0] = { key: "msisdn", value: params.msisdn }` (the player)
- [x] `creditParty[0] = { key: "msisdn", value: process.env.MVOLA_MERCHANT_MSISDN! }` (the merchant)
- [x] All other body fields (`requestingOrganisationTransactionReference`, `requestDate`, `metadata`) mirror the withdraw function
- [x] Uses the existing `buildHeaders()` helper (no duplication)
- [x] Uses the existing `throwOnError()` helper
- [x] Default `description = "Game deposit"`, default `currency = "Ar"`
- [x] Unit tests cover: correct URL, correct debit/credit party, correct metadata, error propagation via `throwOnError`

## Technical Notes

Both `initiateWithdrawal` and `initiateDeposit` share ~90% of their body-building code. Two acceptable implementations:

**Option A (recommended): small shared helper inside `client.ts`:**

```typescript
function buildTransactionBody(
  params: { msisdn: string; amount: number | string; description?: string; currency?: string },
  direction: "deposit" | "withdraw"
): MerchantPayRequestBody {
  const merchant = process.env.MVOLA_MERCHANT_MSISDN!;
  const player = params.msisdn;
  return {
    amount: String(params.amount),
    currency: params.currency ?? "Ar",
    descriptionText: params.description ?? (direction === "deposit" ? "Game deposit" : "Game withdrawal"),
    requestingOrganisationTransactionReference: `game-${direction}-${crypto.randomUUID()}`,
    requestDate: new Date().toISOString(),
    debitParty:  [{ key: "msisdn", value: direction === "deposit" ? player : merchant }],
    creditParty: [{ key: "msisdn", value: direction === "deposit" ? merchant : player }],
    metadata: [
      { key: "partnerName", value: process.env.MVOLA_PARTNER_NAME ?? "" },
      { key: "fc", value: "Ar" },
      { key: "amountFc", value: String(params.amount) },
    ],
  };
}
```

`initiateDeposit` and `initiateWithdrawal` then both call this helper with the appropriate `direction`. Keep the existing `initiateWithdrawal` behaviour byte-equivalent to its current output (unit tests already cover it).

**Option B:** fully independent function with the parties hard-swapped. Acceptable if Option A feels like over-engineering, but lose the common-path benefit.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/lib/mvola/client.ts` | Add `DepositParams` + `initiateDeposit` + optional shared body builder |
| MODIFY | `src/lib/mvola/__tests__/client.test.ts` | Add tests for `initiateDeposit` |

## Dependencies

- **Blocked by:** Story 05-01 (types)
- **Blocks:** Story 06-02

## Related

- **Epic:** 06_wallet-aware-mvola
- **Spec reference:** `docs/architecture/api-contracts.md` § `POST /api/mvola/deposit`, `docs/architecture/components.md` § `src/lib/mvola/client.ts`
