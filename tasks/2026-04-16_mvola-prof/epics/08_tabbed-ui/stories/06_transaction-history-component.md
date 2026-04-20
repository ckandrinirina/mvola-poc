# Story 08-06: `TransactionHistory` Component — Merged History List

> **Epic:** 08 — Tabbed Demo UI
> **Size:** M
> **Status:** TODO

## Description

Create `src/components/TransactionHistory.tsx` — the history tab body. Fetches `/api/wallet/:msisdn/history`, renders each entry with kind-aware visuals. Transactions show direction arrows and status chips; game sessions show heads/tails icons and win/loss colors. Refreshes on mount, on `msisdn` change, and whenever the context's balance changes (so newly-confirmed transactions and freshly-played rounds appear automatically).

## Acceptance Criteria

- [ ] Component is a React client component (`"use client"`)
- [ ] Reads `msisdn` and `balance` from `useMsisdnContext()`
- [ ] On mount and whenever `balance` changes, GETs `/api/wallet/:msisdn/history`
- [ ] Renders a list of entries in the order returned by the API (newest first)
- [ ] Transaction entries show: direction (deposit ↓ / withdraw ↑), amount with sign, status chip (pending / completed / failed), MVola reference when present, relative time
- [ ] Game entries show: bet, choice, outcome (heads / tails), result banner (win / loss colored), delta with sign, post-balance, relative time
- [ ] Empty state: "No activity yet"
- [ ] Use `entry.localTxId` or `entry.sessionId` as the React `key`
- [ ] Component tests cover: fetches on mount, mixed history renders in correct order, empty state, status chip colors

## Technical Notes

```typescript
"use client";
import { useState, useEffect } from "react";
import { useMsisdnContext } from "./WalletHeader";

type Entry =
  | ({ kind: "transaction" } & TransactionRecord)
  | ({ kind: "game" } & GameSession);

export function TransactionHistory() {
  const { msisdn, balance } = useMsisdnContext();
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (!msisdn) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/wallet/${encodeURIComponent(msisdn)}/history`);
      if (!res.ok || cancelled) return;
      const body = await res.json();
      setEntries(body.entries);
    })();
    return () => { cancelled = true; };
  }, [msisdn, balance]);

  if (entries.length === 0) return <p>No activity yet</p>;

  return (
    <ul>
      {entries.map(e => e.kind === "transaction"
        ? <TransactionRow key={e.localTxId} tx={e} />
        : <GameRow key={e.sessionId} game={e} />)}
    </ul>
  );
}
```

Relative time formatting can be a thin util (`formatDistanceToNow`-style) or use `Intl.RelativeTimeFormat` — no new library needed.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/components/TransactionHistory.tsx` | History tab body |
| CREATE | `src/components/__tests__/TransactionHistory.test.tsx` | Component tests |

## Dependencies

- **Blocked by:** Stories 07-04 (history route), 08-01 (context)
- **Blocks:** Story 08-07

## Related

- **Epic:** 08_tabbed-ui
- **Spec reference:** `docs/architecture/components.md` § `TransactionHistory`, `docs/architecture/api-contracts.md` § `GET /api/wallet/[msisdn]/history`
