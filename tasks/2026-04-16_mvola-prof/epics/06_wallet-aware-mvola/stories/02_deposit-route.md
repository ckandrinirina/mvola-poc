# Story 06-02: Deposit Route — `POST /api/mvola/deposit`

> **Epic:** 06 — Wallet-Aware MVola Flows
> **Size:** M
> **Status:** TODO

## Description

Create `src/app/api/mvola/deposit/route.ts` — the route the browser calls to start a deposit (user → merchant). Validates the body, acquires an OAuth token, calls `initiateDeposit()`, records a **pending** `TransactionRecord` with `direction="deposit"` and `walletSettled=false`, and returns the correlation metadata for the client to poll. It must **never** credit the wallet directly; the wallet is only credited later by the status route or the callback route once MVola confirms the transaction.

## Acceptance Criteria

- [ ] `POST /api/mvola/deposit` accepts `{ msisdn: string, amount: string | number }` JSON body
- [ ] Returns 400 `{ error: "msisdn and amount are required" }` if either field is missing
- [ ] Returns 400 `{ error: "amount must be a positive integer" }` if amount can't be coerced to a positive integer
- [ ] Calls `getToken()` then `initiateDeposit({ msisdn, amount: <integer> }, token)`
- [ ] On success, calls `createTransaction({ msisdn, direction: "deposit", amount, correlationId: serverCorrelationId, walletSettled: false })`
- [ ] Returns 200 `{ correlationId, localTxId, status: "pending" }`
- [ ] Returns 502 `{ error: "MVola API error", details: <string> }` on MVola throw — no transaction record is created
- [ ] Wallet balance for the MSISDN is unchanged by a successful 200 response
- [ ] Route tests cover: 400 bad body, 200 happy path with store assertions, 502 on MVola error, wallet unchanged

## Technical Notes

Pattern mirrors the existing withdraw route. Key differences:
- Schema has `msisdn` (not `playerMsisdn`)
- No wallet mutation at request time
- Create the `TransactionRecord` **after** MVola returns a `serverCorrelationId`, so we never store a transaction for a request that never reached MVola

Skeleton:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/mvola/auth";
import { initiateDeposit } from "@/lib/mvola/client";
import { createTransaction } from "@/lib/store/transactions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { msisdn } = body;
    const amount = Number(body.amount);
    if (!msisdn || !Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "msisdn and amount are required; amount must be a positive integer" },
        { status: 400 },
      );
    }
    const token = await getToken();
    const mvolaResponse = await initiateDeposit({ msisdn, amount }, token);
    const record = createTransaction({
      msisdn,
      direction: "deposit",
      amount,
      correlationId: mvolaResponse.serverCorrelationId,
      walletSettled: false,
    });
    return NextResponse.json(
      { correlationId: record.correlationId, localTxId: record.localTxId, status: "pending" },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "MVola API error", details: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
```

Tests should mock `initiateDeposit` and assert `createTransaction` is called with the expected input; also assert `getWallet(msisdn)?.balance` is `0` (or `undefined`) after a successful call.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/app/api/mvola/deposit/route.ts` | Deposit initiation route |
| CREATE | `src/app/api/mvola/deposit/__tests__/route.test.ts` | Route tests |

## Dependencies

- **Blocked by:** Stories 05-03, 06-01
- **Blocks:** Story 08-03 (DepositForm calls this route)

## Related

- **Epic:** 06_wallet-aware-mvola
- **Spec reference:** `docs/architecture/api-contracts.md` § `POST /api/mvola/deposit`, `docs/architecture/data-flow.md` § Flow 4 (Deposit)
