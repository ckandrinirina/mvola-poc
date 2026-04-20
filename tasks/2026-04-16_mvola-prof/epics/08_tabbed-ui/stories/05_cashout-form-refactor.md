# Story 08-05: Refactor `WithdrawForm` → `CashOutForm` — Wallet-Aware

> **Epic:** 08 — Tabbed Demo UI
> **Size:** M
> **Status:** DONE

## Description

Refactor the existing `src/components/WithdrawForm.tsx` into `src/components/CashOutForm.tsx` — same polling pattern, new contract. The amount input defaults to the current wallet balance (capped at balance). Uses `msisdn` from `MsisdnContext` instead of a manual phone-number input. Handles the new 409 "Insufficient funds" response from `POST /api/mvola/withdraw`. When the status becomes `failed`, displays a "Wallet refunded" banner (reassures the user the reservation was reversed). Calls `refreshBalance()` on all terminal transitions.

## Acceptance Criteria

- [x] Component is a React client component (`"use client"`)
- [x] Reads `msisdn`, `balance`, `refreshBalance` from `useMsisdnContext()`
- [x] No separate phone-number input in this component (header owns it)
- [x] Amount input defaults to `balance` on mount and on balance change; capped at balance; validation rejects > balance
- [x] On submit POSTs `{ msisdn, amount }` to `/api/mvola/withdraw`
- [x] On 409: displays "Insufficient funds" with the returned `balance` and `requested`
- [x] On 200: stores `correlationId`, polls `/api/mvola/status/:id` every 3 s
- [x] On `completed`: "Cash-out successful" banner, refresh balance, disable form until reset
- [x] On `failed`: "Cash-out failed — wallet refunded" banner, refresh balance (shows refunded amount)
- [x] Old `WithdrawForm.tsx` and its tests are removed or moved to the new filename
- [x] The old `page.tsx` import of `WithdrawForm` is updated (done in this story to avoid broken build)
- [x] Component tests cover: default amount = balance, 409 handling, completed path, failed path with "refunded" messaging, refreshBalance called on terminal transitions

## Technical Notes

This is a structural refactor, not a rewrite. Start from `src/components/WithdrawForm.tsx` and:

1. Rename the file to `CashOutForm.tsx` (and update the default export name)
2. Replace the MSISDN input with a read from `useMsisdnContext()`
3. Change the payload key from `playerMsisdn` to `msisdn`
4. Add a 409-branch in the response handling
5. Initialize amount to `balance` (via `useState(balance)` + sync on balance change)
6. Add the "Wallet refunded" banner on `failed` status
7. Call `refreshBalance()` inside the poller when status becomes terminal

Move the existing `__tests__/WithdrawForm.test.tsx` to `__tests__/CashOutForm.test.tsx` and update the imports / payload assertions.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE / RENAME | `src/components/CashOutForm.tsx` | Wallet-aware cash-out form |
| DELETE | `src/components/WithdrawForm.tsx` | Replaced by CashOutForm |
| CREATE / RENAME | `src/components/__tests__/CashOutForm.test.tsx` | Migrated tests |
| DELETE | `src/components/__tests__/WithdrawForm.test.tsx` | Replaced |

## Dependencies

- **Blocked by:** Stories 06-03 (wallet-aware withdraw route), 06-04 + 06-05 (reconciliation), 08-01 (context)
- **Blocks:** Story 08-07

## Related

- **Epic:** 08_tabbed-ui
- **Spec reference:** `docs/architecture/components.md` § `CashOutForm`, `docs/architecture/data-flow.md` § Flow 6 (Cash-Out)
