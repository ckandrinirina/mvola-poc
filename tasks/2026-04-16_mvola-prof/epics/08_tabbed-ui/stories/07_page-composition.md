# Story 08-07: Compose `page.tsx` + `layout.tsx`

> **Epic:** 08 — Tabbed Demo UI
> **Size:** S
> **Status:** TODO

## Description

Refactor `src/app/page.tsx` to compose the header and tabbed layout built in the earlier stories: `WalletHeader` wraps `TabbedLayout` whose four tabs render `DepositForm`, `CoinFlipGame`, `CashOutForm`, and `TransactionHistory`. Update `src/app/layout.tsx` metadata to "MVola PoC — Wallet Demo". Manually verify the end-to-end flow in the browser against the MVola sandbox.

## Acceptance Criteria

- [ ] `src/app/page.tsx` renders `<WalletHeader>` with `<TabbedLayout tabs={[...]}>` as a child
- [ ] Tabs: `[{ label: "Deposit", content: <DepositForm /> }, { label: "Play", content: <CoinFlipGame /> }, { label: "Cash-out", content: <CashOutForm /> }, { label: "History", content: <TransactionHistory /> }]`
- [ ] `layout.tsx` metadata updated: title "MVola PoC — Wallet Demo", description mentions the full round-trip
- [ ] Old `WithdrawForm` import is removed (replaced by `CashOutForm` — was handled by story 08-05 at file level, here we update the import site)
- [ ] Manual browser verification against sandbox:
  - [ ] Enter MSISDN `0343500003` → balance shows 0 Ar
  - [ ] Deposit 10000 → poll succeeds → header shows 10000 Ar
  - [ ] Play several rounds with various bets → balance drifts as expected
  - [ ] Cash out remaining balance → poll succeeds → header shows 0 Ar
  - [ ] History tab lists every deposit, every round, and the cash-out in chronological order
  - [ ] Hard-reload the page → MSISDN persists (from localStorage), balance is still 0 (matches server state)
  - [ ] Restart `npm run dev` → MSISDN persists in localStorage but balance resets to 0 (expected per `state-management.md`)
- [ ] `npm run build` passes with no TypeScript errors

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
