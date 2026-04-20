# Story 08-04: `CoinFlipGame` Component — Bet + Play + Result

> **Epic:** 08 — Tabbed Demo UI
> **Size:** M
> **Status:** TODO

## Description

Create `src/components/CoinFlipGame.tsx` — the play-tab body. Reads `msisdn`, `balance`, and `refreshBalance` from `MsisdnContext`. Provides a bet amount input, heads/tails buttons, and a "Flip" action that POSTs to `/api/game/coinflip`. While waiting for the response it displays a short flip animation; on success it reveals the outcome, colors the result (green for win, red for loss), shows the new balance, and triggers `refreshBalance()`. Handles 409 "Insufficient funds" cleanly.

## Acceptance Criteria

- [ ] Component is a React client component (`"use client"`)
- [ ] Disabled when `msisdn` is empty or `balance` is 0
- [ ] Bet input: positive integer, capped at current `balance`
- [ ] Heads/tails selector (two buttons or a radio group)
- [ ] On submit POSTs `{ msisdn, bet, choice }` to `/api/game/coinflip`
- [ ] While awaiting: displays a 500–1500 ms "flipping…" animation (Tailwind transitions, no new libs)
- [ ] On 200: displays outcome (`heads` / `tails`), win/loss banner (green / red), `delta` with sign, `balanceAfter`; calls `refreshBalance()`
- [ ] On 409: displays "Insufficient funds" with the returned balance
- [ ] On 400: displays the validation message
- [ ] Component tests cover: disabled states, win rendering, loss rendering, 409 handling, refreshBalance call on success

## Technical Notes

```typescript
const [phase, setPhase] = useState<"idle" | "flipping" | "result" | "error">("idle");
const [lastOutcome, setLastOutcome] = useState<{ outcome: string; result: string; delta: number; balanceAfter: number } | null>(null);

async function handleFlip() {
  setPhase("flipping");
  await new Promise(r => setTimeout(r, 800)); // animation minimum
  const res = await fetch("/api/game/coinflip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msisdn, bet: Number(bet), choice }),
  });
  if (res.status === 409) { /* ... */ return; }
  if (!res.ok) { /* ... */ return; }
  const body = await res.json();
  setLastOutcome(body);
  setPhase("result");
  refreshBalance();
}
```

The 800 ms animation delay is purely cosmetic — it runs in parallel with the fetch, so the total user-perceived latency is `max(animation, fetch)`.

Tests mock `fetch` to return win / loss / 409 responses deterministically.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/components/CoinFlipGame.tsx` | Coin-flip tab body |
| CREATE | `src/components/__tests__/CoinFlipGame.test.tsx` | Component tests |

## Dependencies

- **Blocked by:** Stories 07-02 (coinflip route), 08-01 (context)
- **Blocks:** Story 08-07

## Related

- **Epic:** 08_tabbed-ui
- **Spec reference:** `docs/architecture/components.md` § `CoinFlipGame`, `docs/architecture/data-flow.md` § Flow 5 (Coin-Flip Round)
