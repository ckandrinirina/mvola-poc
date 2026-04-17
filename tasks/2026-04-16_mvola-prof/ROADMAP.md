# Implementation Roadmap: mvola-prof

## Dependency Graph

```
Epic 01: Foundation
    │
    ▼
Epic 02: MVola Core Library
  02-01 types.ts
    │
    ▼
  02-02 auth.ts ──────────────────────┐
    │                                  │
    ▼                                  │
  02-03 client.ts                      │
    │                                  │
    ▼                                  ▼
Epic 03: API Routes           03-01 token/route.ts
  03-02 withdraw/route.ts    (needs only auth.ts)
  03-03 status/route.ts      (parallel with 03-04)
  03-04 callback/route.ts    (needs only types.ts)
    │
    ▼
Epic 04: Demo UI
  04-01 layout + page.tsx
    │
    ▼
  04-02 WithdrawForm.tsx
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

## Parallelization Opportunities

| Stories | Can run in parallel | Reason |
|---------|---------------------|--------|
| 01-01 + 01-02 | Yes | 01-02 only needs the project to exist |
| 03-01 + 03-02 | No | 03-01 finishes fast; do sequentially |
| 03-03 + 03-04 | Yes | Both need auth + types but are independent |
| 04-01 + 04-02 | No | 04-02 needs the page from 04-01 |

## Critical Path

```
01-01 → 02-01 → 02-02 → 02-03 → 03-02 → 04-02
```

This is the longest sequential chain. Everything else hangs off this path or runs in parallel to it.

## Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| MVola sandbox credentials not available | High — blocks all integration testing | Obtain from developer.mvola.mg early; create account before Phase 2 |
| Webhook callback URL not publicly accessible | Medium — callback route can't be tested | Set up ngrok before Phase 3; note URL changes on restart |
| Token expiry mid-session | Low — handled by auth.ts | 60s refresh buffer in auth.ts covers normal usage |
| `amount` type mismatch (number vs string) | Low — MVola rejects numbers | Enforce string type in `WithdrawalRequest` interface |

## Milestones

| Milestone | Epics Included | Deliverable |
|-----------|---------------|-------------|
| Dev Environment Ready | Epic 01 | Runnable Next.js project with env template |
| MVola Library Complete | Epic 02 | Token management + typed HTTP client, testable in isolation |
| API Layer Complete | Epic 03 | All 4 routes testable via curl against MVola sandbox |
| PoC Complete | Epic 04 | Full withdrawal flow working in browser end-to-end |
