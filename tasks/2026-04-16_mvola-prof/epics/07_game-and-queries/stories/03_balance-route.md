# Story 07-03: Balance Query Route — `GET /api/wallet/[msisdn]/balance`

> **Epic:** 07 — Game & Wallet Queries
> **Size:** S
> **Status:** DONE

## Description

Create `src/app/api/wallet/[msisdn]/balance/route.ts` — a read-only endpoint returning the current wallet balance for an MSISDN. If the MSISDN has never been seen, the route returns `{ balance: 0, updatedAt: null }` with status 200 (not 404) — this simplifies the UI which polls this route on every render.

## Acceptance Criteria

- [ ] `GET /api/wallet/[msisdn]/balance` returns 200 with `{ msisdn, balance, updatedAt }`
- [ ] For unknown MSISDN: `{ msisdn, balance: 0, updatedAt: null }`
- [ ] For known MSISDN: actual balance and `updatedAt` from the store
- [ ] `msisdn` is taken from the URL path parameter (dynamic route segment)
- [ ] No authentication, no mutation, no MVola API call
- [ ] Route tests cover: known wallet, unknown wallet (balance=0), path parameter propagation

## Technical Notes

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getWallet } from "@/lib/store/wallets";

interface RouteContext {
  params: Promise<{ msisdn: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { msisdn } = await context.params;
  const wallet = getWallet(msisdn);
  return NextResponse.json(
    {
      msisdn,
      balance: wallet?.balance ?? 0,
      updatedAt: wallet?.updatedAt ?? null,
    },
    { status: 200 },
  );
}
```

Note the `Promise<...>` on `params` — this matches the Next.js 15+ App Router dynamic-route typing already used by the existing `status/[correlationId]/route.ts`.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/app/api/wallet/[msisdn]/balance/route.ts` | Read-only balance endpoint |
| CREATE | `src/app/api/wallet/[msisdn]/balance/__tests__/route.test.ts` | Route tests |

## Dependencies

- **Blocked by:** Story 05-02
- **Blocks:** Story 08-01 (WalletHeader polls this route)

## Related

- **Epic:** 07_game-and-queries
- **Spec reference:** `docs/architecture/api-contracts.md` § `GET /api/wallet/[msisdn]/balance`
