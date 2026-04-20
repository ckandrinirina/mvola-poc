# Epic 08: Tabbed Demo UI

## Description

Replace the current single-form demo UI with a richer single-page app that makes the full deposit → play → cash-out → history round-trip tangible in the browser. A persistent header holds the active player's MSISDN (stored in `localStorage`) and shows the live wallet balance. A tab switcher hosts the four task-specific components.

All components are React client components that call the server routes created in Epics 06 and 07. No new dependencies are added — styling stays Tailwind v4, state stays `useState` + `useEffect` + React Context, and tests stay in React Testing Library / jest as in Epic 04.

## Goals

- Introduce a persistent `WalletHeader` (MSISDN input + live balance poll)
- Introduce a `TabbedLayout` holding four tab bodies
- Implement four task-specific components: `DepositForm`, `CoinFlipGame`, `CashOutForm` (refactor of the existing `WithdrawForm`), `TransactionHistory`
- Compose them in `src/app/page.tsx`; update `src/app/layout.tsx` metadata
- Cover all components with React Testing Library tests
- Manually verify the end-to-end flow against the MVola sandbox in a browser

## Scope

### In Scope
- 6 new / refactored components in `src/components/`
- `src/app/page.tsx` and `src/app/layout.tsx` updates
- A small `MsisdnContext` (React context) to share the active MSISDN and a balance-refresh callback among siblings
- Component tests under `src/components/__tests__/`

### Out of Scope
- New styling libraries, animation libraries, form libraries
- Authentication / user accounts
- Persistent client state beyond `localStorage` for the active MSISDN
- Routing (`/deposit`, `/play`, `/cashout`) — all tabs live under `/`

## Dependencies

- **Depends on:** Epic 06 (deposit, withdraw, reconciliation routes) + Epic 07 (game, balance, history routes)
- **Blocks:** None — this is the final user-visible epic

## Stories

| # | Story | Size | Status |
|---|-------|------|--------|
| 01 | `WalletHeader` component — MSISDN input + balance polling | M | DONE |
| 02 | `TabbedLayout` component — tab switcher | S | DONE |
| 03 | `DepositForm` component — deposit POST + polling | M | DONE |
| 04 | `CoinFlipGame` component — bet + play + result | M | DONE |
| 05 | Refactor `WithdrawForm` → `CashOutForm` — wallet-aware | M | DONE |
| 06 | `TransactionHistory` component — merged history list | M | DONE |
| 07 | Compose `page.tsx` + `layout.tsx` | S | DONE |

## Acceptance Criteria

- [ ] `WalletHeader` persists MSISDN in `localStorage` under `mvola-prof.msisdn` and polls the balance route every 2 s when an MSISDN is set
- [ ] Active MSISDN and a `refreshBalance()` callback are shared via `MsisdnContext`
- [ ] `TabbedLayout` renders the 4 tabs and switches bodies without page navigation
- [ ] `DepositForm`, `CoinFlipGame`, `CashOutForm`, `TransactionHistory` each refresh the header balance on success
- [ ] `CashOutForm` defaults the amount to the current balance and shows "Insufficient funds" (409) / "Wallet refunded" (failed) messages appropriately
- [ ] `TransactionHistory` lists entries newest-first with icons distinguishing transaction vs game entries
- [ ] No component imports from `src/lib/store/*` — everything goes through the API
- [ ] Dev-server manual test: enter MSISDN → deposit → play several rounds → cash out → history shows every step

## Technical Notes

- Keep the styling consistent with Epic 04: Tailwind utility classes only, gray background, rounded cards.
- Use `crypto.randomUUID()` only server-side; the UI need not generate IDs.
- For keyboards and accessibility, give each tab trigger a `role="tab"` + `aria-selected`.
- Manual QA: Open `http://localhost:3000`, use sandbox MSISDN `0343500003`, confirm every tab's happy path, then verify that restarting `npm run dev` wipes the wallet (expected — see `state-management.md`).
