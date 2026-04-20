# Story 07-04: History Query Route — `GET /api/wallet/[msisdn]/history`

> **Epic:** 07 — Game & Wallet Queries
> **Size:** M
> **Status:** TODO

## Description

Create `src/app/api/wallet/[msisdn]/history/route.ts` — a read-only endpoint returning a merged, time-sorted array of every `TransactionRecord` and `GameSession` for the given MSISDN. Each entry is tagged with `kind: "transaction"` or `kind: "game"` so the UI can render them uniformly. Returns an empty array for unknown MSISDN.

## Acceptance Criteria

- [ ] `GET /api/wallet/[msisdn]/history` returns 200 with `{ msisdn, entries: Array<TransactionEntry | GameEntry> }`
- [ ] Transaction entry shape: `{ kind: "transaction", localTxId, correlationId, direction, amount, status, walletSettled, mvolaReference?, createdAt, updatedAt }`
- [ ] Game entry shape: `{ kind: "game", sessionId, bet, choice, outcome, result, delta, balanceAfter, playedAt }`
- [ ] Entries sorted by timestamp descending (use `createdAt` for transactions, `playedAt` for games)
- [ ] Empty array for unknown MSISDN (200 status, not 404)
- [ ] Route tests cover: pure-deposit history, pure-game history, mixed history with correct sort order, empty case

## Technical Notes

```typescript
import { NextRequest, NextResponse } from "next/server";
import { listTransactionsByMsisdn } from "@/lib/store/transactions";
import { listGameSessionsByMsisdn } from "@/lib/store/games";

interface RouteContext {
  params: Promise<{ msisdn: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { msisdn } = await context.params;
  const transactions = listTransactionsByMsisdn(msisdn).map(t => ({
    kind: "transaction" as const,
    ...t,
    _sortKey: t.createdAt,
  }));
  const games = listGameSessionsByMsisdn(msisdn).map(g => ({
    kind: "game" as const,
    ...g,
    _sortKey: g.playedAt,
  }));
  const entries = [...transactions, ...games]
    .sort((a, b) => b._sortKey - a._sortKey)
    .map(({ _sortKey, ...rest }) => rest);
  return NextResponse.json({ msisdn, entries }, { status: 200 });
}
```

Strip the transient `_sortKey` before serializing. Data is small (single-player, in-memory) so no pagination is needed.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/app/api/wallet/[msisdn]/history/route.ts` | Merged transaction + game history |
| CREATE | `src/app/api/wallet/[msisdn]/history/__tests__/route.test.ts` | Route tests |

## Dependencies

- **Blocked by:** Stories 05-03, 05-04
- **Blocks:** Story 08-06 (TransactionHistory component)

## Related

- **Epic:** 07_game-and-queries
- **Spec reference:** `docs/architecture/api-contracts.md` § `GET /api/wallet/[msisdn]/history`
