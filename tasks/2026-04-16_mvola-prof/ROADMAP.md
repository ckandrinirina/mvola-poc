# Implementation Roadmap: mvola-prof

> **2026-04-20 update:** Phases 1–4 (Epics 01–04) are DONE. Phases 5–8 (Epics 05–08) below add the wallet / deposit / coin-flip / cash-out-with-wallet feature.

## Dependency Graph

```
┌───────────────────── DONE ─────────────────────┐
│ Epic 01: Foundation                             │
│     │                                           │
│     ▼                                           │
│ Epic 02: MVola Core Library                     │
│   02-01 types.ts                                │
│     │                                           │
│     ▼                                           │
│   02-02 auth.ts ──────────────────────┐         │
│     │                                  │        │
│     ▼                                  │        │
│   02-03 client.ts                      │        │
│     │                                  │        │
│     ▼                                  ▼        │
│ Epic 03: API Routes           03-01 token/route │
│   03-02 withdraw/route.ts                       │
│   03-03 status/route.ts      (parallel with 04) │
│   03-04 callback/route.ts                       │
│     │                                           │
│     ▼                                           │
│ Epic 04: Demo UI                                │
│   04-01 layout + page.tsx                       │
│     │                                           │
│     ▼                                           │
│   04-02 WithdrawForm.tsx                        │
└─────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────── NEW (2026-04-20) ───────────────┐
│ Epic 05: State Store Layer                      │
│   05-01 types.ts (domain)                       │
│     │                                           │
│     ├─▶ 05-02 wallets.ts                        │
│     ├─▶ 05-03 transactions.ts                   │
│     └─▶ 05-04 games.ts                          │
│         │                                       │
│         ▼                                       │
│ Epic 06: Wallet-Aware MVola Flows               │
│   06-01 client.ts::initiateDeposit              │
│     │                                           │
│     ▼                                           │
│   06-02 deposit/route.ts                        │
│   06-03 withdraw/route.ts (refactor)            │
│   06-04 status/route.ts (refactor) ──┐          │
│     │                                 │         │
│     ▼                                 ▼         │
│   06-05 callback/route.ts (refactor: same       │
│         helper as 06-04)                        │
│         │                                       │
│         │        ┌──── Epic 07 (parallel) ────┐ │
│         │        │ 07-01 coinflip.ts           │ │
│         │        │   │                         │ │
│         │        │   ▼                         │ │
│         │        │ 07-02 game/coinflip/route   │ │
│         │        │ 07-03 wallet/balance/route  │ │
│         │        │ 07-04 wallet/history/route  │ │
│         │        └─────────────────────────────┘ │
│         ▼                                       │
│ Epic 08: Tabbed Demo UI                         │
│   08-01 WalletHeader    (needs 07-03)           │
│   08-02 TabbedLayout    (no deps)               │
│   08-03 DepositForm     (needs 06-02, 06-04)    │
│   08-04 CoinFlipGame    (needs 07-02)           │
│   08-05 CashOutForm     (needs 06-03)           │
│   08-06 TransactionHistory (needs 07-04)        │
│     │                                           │
│     ▼                                           │
│   08-07 page.tsx + layout.tsx composition       │
└─────────────────────────────────────────────────┘
```

## Recommended Implementation Order

### Phase 1: Foundation
**Goal:** Working Next.js dev server with correct folder layout

1. **Story 01-01** — Scaffold Next.js 14+ with TypeScript & Tailwind (S)
   - Must come first; everything depends on the project existing
2. **Story 01-02** — `.env.example` and `.gitignore` (S)
   - Can be done immediately after 01-01; safe to do in same session

---

### Phase 2: MVola Core Library
**Goal:** All MVola logic is implemented and TypeScript-typed before any route uses it

3. **Story 02-01** — `types.ts` type definitions (S)
   - Defines interfaces used by all subsequent files; must come first in this phase
4. **Story 02-02** — `auth.ts` token manager (M)
   - Depends on `MVolaToken` type from 02-01
5. **Story 02-03** — `client.ts` HTTP client (M)
   - Depends on types from 02-01; token is passed in, not called directly

---

### Phase 3: API Routes
**Goal:** All 4 server routes are working and testable via curl

6. **Story 03-01** — `token/route.ts` (S) — can start as soon as 02-02 is done
7. **Story 03-02** — `withdraw/route.ts` (M) — requires 02-02 + 02-03
8. **Stories 03-03 + 03-04** — `status/route.ts` + `callback/route.ts` (S + S)
   - 03-03 requires 02-03; 03-04 requires only 02-01 — both can run in parallel after 03-02

---

### Phase 4: Demo UI
**Goal:** Full end-to-end withdrawal flow working in the browser

9. **Story 04-01** — Root layout and `page.tsx` (S)
10. **Story 04-02** — `WithdrawForm.tsx` (L)
    - The final and most complex UI piece; test with sandbox number `0343500003`

---

### Phase 5: State Store Layer (NEW — 2026-04-20)
**Goal:** All in-memory stores (wallets / transactions / games) exist with typed accessors and unit-test coverage, before any feature route touches them.

11. **Story 05-01** — Domain type extensions in `types.ts` (S)
    - Must come first in this phase; all stores import these types
12. **Stories 05-02 + 05-03 + 05-04** — Three stores in parallel (M + M + S)
    - All depend only on 05-01; no ordering between them

---

### Phase 6: Wallet-Aware MVola Flows (NEW — 2026-04-20)
**Goal:** Money moves in/out of the wallet via MVola end-to-end, testable with curl.

13. **Story 06-01** — `initiateDeposit` in `client.ts` (M) — parallel with 05-xx after 05-01
14. **Story 06-02** — `deposit/route.ts` (M) — needs 06-01 + 05-03
15. **Story 06-03** — Refactor `withdraw/route.ts` (L) — needs 05-02 + 05-03
16. **Story 06-04** — Refactor `status/route.ts` + `reconcile.ts` helper (L) — needs 05-02 + 05-03
17. **Story 06-05** — Refactor `callback/route.ts` (M) — needs 06-04's helper

---

### Phase 7: Game & Wallet Queries (NEW — 2026-04-20)
**Goal:** Coin-flip simulation runs against the wallet; read-only balance and history routes available.

18. **Story 07-01** — Pure `coinflip.ts` (S) — parallel with 05-xx/06-xx after 05-01
19. **Story 07-02** — `game/coinflip/route.ts` (M) — needs 07-01 + 05-02 + 05-04
20. **Story 07-03** — `wallet/balance/route.ts` (S) — needs 05-02
21. **Story 07-04** — `wallet/history/route.ts` (M) — needs 05-03 + 05-04

Phases 6 and 7 can run mostly in parallel after Phase 5 completes.

---

### Phase 8: Tabbed Demo UI (NEW — 2026-04-20)
**Goal:** Full deposit → play → cash-out → history round-trip working in the browser.

22. **Story 08-02** — `TabbedLayout` (S) — no deps, can start anytime in parallel
23. **Story 08-01** — `WalletHeader` + `MsisdnContext` (M) — needs 07-03
24. **Story 08-03** — `DepositForm` (M) — needs 06-02 + 06-04 + 08-01
25. **Story 08-04** — `CoinFlipGame` (M) — needs 07-02 + 08-01
26. **Story 08-05** — Refactor `WithdrawForm` → `CashOutForm` (M) — needs 06-03 + 08-01
27. **Story 08-06** — `TransactionHistory` (M) — needs 07-04 + 08-01
28. **Story 08-07** — Compose `page.tsx` + `layout.tsx` (S) — needs 08-01…08-06

---

## Parallelization Opportunities

### Phases 1–4 (DONE)

| Stories | Can run in parallel | Reason |
|---------|---------------------|--------|
| 01-01 + 01-02 | Yes | 01-02 only needs the project to exist |
| 03-01 + 03-02 | No | 03-01 finishes fast; do sequentially |
| 03-03 + 03-04 | Yes | Both need auth + types but are independent |
| 04-01 + 04-02 | No | 04-02 needs the page from 04-01 |

### Phases 5–8 (NEW)

| Stories | Can run in parallel | Reason |
|---------|---------------------|--------|
| 05-02 + 05-03 + 05-04 + 06-01 + 07-01 | Yes — all 5 | Each only depends on 05-01 |
| 06-02 + 06-03 + 06-04 | Yes — all 3 | 06-02 depends on 06-01+05-03; 06-03 on 05-02+05-03; 06-04 on 05-02+05-03. Independent once 05-xx + 06-01 are in. |
| 06-05 + 07-02/07-03/07-04 | Yes | 06-05 depends on 06-04; Epic 07 is entirely separate from 06-05 |
| 08-02 + everything else in Epic 08 | Yes | 08-02 has no dependencies; the rest only wait on the corresponding server-side story |
| 08-01 + 08-03 + 08-04 + 08-05 + 08-06 | Yes, with their blockers cleared | Once their blockers are in, all five can be built independently |
| 08-07 | Must be last | Integrates every other Epic 08 story |

## Critical Path

### Phases 1–4 (DONE)

```
01-01 → 02-01 → 02-02 → 02-03 → 03-02 → 04-02
```

### Phases 5–8 (NEW)

```
05-01 → 05-02 → 06-03 → 08-05 → 08-07
```
(five sequential stories; 05-03/05-04 and 07-01 run in parallel with 05-02; Epic 06/07 mostly in parallel with each other; 08-01…08-06 mostly in parallel, ending at 08-07)

## Risk Areas

### Phases 1–4 (mitigated — all DONE)

| Risk | Impact | Mitigation |
|------|--------|------------|
| MVola sandbox credentials not available | High — blocks all integration testing | Obtain from developer.mvola.mg early; create account before Phase 2 |
| Webhook callback URL not publicly accessible | Medium — callback route can't be tested | Set up ngrok before Phase 3; note URL changes on restart |
| Token expiry mid-session | Low — handled by auth.ts | 60s refresh buffer in auth.ts covers normal usage |
| `amount` type mismatch (number vs string) | Low — MVola rejects numbers | Enforce string type in `WithdrawalRequest` interface |

### Phases 5–8 (new risks)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Double-credit on webhook + status poll | High — breaks wallet invariants | `walletSettled` flag + single `reconcileTransaction()` helper shared between status and callback routes (story 06-04) |
| Wallet refund missed on failed withdraw | High — player loses money | Refund logic in 06-03 (sync MVola error) and 06-04 (reconciled failed status) both covered by tests |
| Race between balance check and debit | Medium — negative balances | All balance-check + mutate pairs kept synchronous (no `await` between them); enforced by route structure in 06-03 and 07-02 |
| `crypto.getRandomValues` unavailable in test env | Low — test flake | Inject RNG into `playCoinFlip` for deterministic tests (story 07-01) |
| `WithdrawForm` tests break on refactor | Medium — CI red | 08-05 migrates tests; accept `playerMsisdn` as alias during rollout (06-03) |
| In-memory state lost on server restart mid-demo | Low — by design for PoC | Documented in `state-management.md`; dev-guide troubleshooting entry points to restart as root cause |

## Milestones

| Milestone | Epics Included | Deliverable |
|-----------|---------------|-------------|
| Dev Environment Ready | Epic 01 | Runnable Next.js project with env template |
| MVola Library Complete | Epic 02 | Token management + typed HTTP client, testable in isolation |
| API Layer Complete | Epic 03 | All 4 routes testable via curl against MVola sandbox |
| PoC Complete (v1) | Epic 04 | Single-direction withdrawal flow working in browser end-to-end |
| State Foundation | Epic 05 | Wallet / transaction / game stores in-memory, fully unit-tested |
| Full Money Lifecycle | Epic 06 | Deposit + wallet-aware cash-out + idempotent reconciliation, testable via curl |
| Game + Query API | Epic 07 | Coin-flip round routes + balance + history routes, testable via curl |
| Realistic Demo (v2) | Epic 08 | Tabbed UI with full deposit → play → cash-out → history round-trip in the browser |
