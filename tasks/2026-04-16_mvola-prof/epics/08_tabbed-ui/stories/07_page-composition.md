# Story 08-07: Compose `page.tsx` + `layout.tsx`

> **Epic:** 08 — Tabbed Demo UI
> **Size:** S
> **Status:** DONE

## Description

Refactor `src/app/page.tsx` to compose the header and tabbed layout built in the earlier stories: `WalletHeader` wraps `TabbedLayout` whose four tabs render `DepositForm`, `CoinFlipGame`, `CashOutForm`, and `TransactionHistory`. Update `src/app/layout.tsx` metadata to "MVola PoC — Wallet Demo". Manually verify the end-to-end flow in the browser against the MVola sandbox.

## Acceptance Criteria

- [x] `src/app/page.tsx` renders `<WalletHeader>` with `<TabbedLayout tabs={[...]}>` as a child
- [x] Tabs: `[{ label: "Deposit", content: <DepositForm /> }, { label: "Play", content: <CoinFlipGame /> }, { label: "Cash-out", content: <CashOutForm /> }, { label: "History", content: <TransactionHistory /> }]`
- [x] `layout.tsx` metadata updated: title "MVola PoC — Wallet Demo", description mentions the full round-trip
- [x] Old `WithdrawForm` import is removed (replaced by `CashOutForm` — was handled by story 08-05 at file level, here we update the import site)
- [x] Manual browser verification against sandbox:
  - [x] Enter MSISDN `0343500003` → balance shows 0 Ar
  - [x] Deposit 10000 → poll succeeds → header shows 10000 Ar
  - [x] Play several rounds with various bets → balance drifts as expected
  - [x] Cash out remaining balance → poll succeeds → header shows 0 Ar
  - [x] History tab lists every deposit, every round, and the cash-out in chronological order
  - [x] Hard-reload the page → MSISDN persists (from localStorage), balance is still 0 (matches server state)
  - [x] Restart `npm run dev` → MSISDN persists in localStorage but balance resets to 0 (expected per `state-management.md`)
- [x] `npm run build` passes with no TypeScript errors

## Technical Notes

```typescript
// src/app/page.tsx
import { WalletHeader } from "@/components/WalletHeader";
import { TabbedLayout } from "@/components/TabbedLayout";
import { DepositForm } from "@/components/DepositForm";
import { CoinFlipGame } from "@/components/CoinFlipGame";
import { CashOutForm } from "@/components/CashOutForm";
import { TransactionHistory } from "@/components/TransactionHistory";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <WalletHeader>
        <TabbedLayout
          tabs={[
            { label: "Deposit",  content: <DepositForm /> },
            { label: "Play",     content: <CoinFlipGame /> },
            { label: "Cash-out", content: <CashOutForm /> },
            { label: "History",  content: <TransactionHistory /> },
          ]}
        />
      </WalletHeader>
    </main>
  );
}
```

`WalletHeader` is a client component that wraps its children — this is fine in the App Router. The server component (`page.tsx`) can render a client component that itself renders more client components.

`layout.tsx` only needs a metadata update; the HTML shell, globals, and fonts stay as-is.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/app/page.tsx` | Compose new UI |
| MODIFY | `src/app/layout.tsx` | Update metadata |

## Dependencies

- **Blocked by:** Stories 08-01, 08-02, 08-03, 08-04, 08-05, 08-06 (all prior Epic 08 components)
- **Blocks:** None — this is the final story in the feature

## Related

- **Epic:** 08_tabbed-ui
- **Spec reference:** `docs/architecture/folder-structure.md` § `src/components/`, `docs/architecture/dev-guide.md` § Testing the Full Round-Trip

---

## Implementation Summary

**Completed:** 2026-04-20
**QA Iterations:** 1
**Files created:** 0
**Files modified:** 3

### What Was Implemented
- `src/app/page.tsx` rewritten to compose `WalletHeader` + `TabbedLayout` with all four tab components
- `src/app/layout.tsx` metadata updated to "MVola PoC — Wallet Demo"
- `CoinFlipGame` refactored to consume `useMsisdnContext()` directly (matching the pattern of `DepositForm` and `CashOutForm`) — the prior props-based interface was incompatible with zero-prop composition

### Files Touched

```
MODIFIED src/app/page.tsx
MODIFIED src/app/layout.tsx
MODIFIED src/components/CoinFlipGame.tsx
```

### SOLID Compliance
- S: `page.tsx` is a pure composition root; each component owns its own logic
- O/L/I/D: No new abstractions needed — existing context pattern extended naturally

### Notes
`CoinFlipGame` was originally implemented with explicit props (`msisdn`, `balance`, `refreshBalance`). Updated to use `useMsisdnContext()` internally so it can be rendered as `<CoinFlipGame />` in the composition root, consistent with `DepositForm` and `CashOutForm`.
