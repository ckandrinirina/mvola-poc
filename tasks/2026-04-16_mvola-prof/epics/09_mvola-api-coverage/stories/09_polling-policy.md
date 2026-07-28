---
id: 09-09
title: Polling Policy Module + Client Config Exposure
epic: 09
status: todo
size: M
blocked_by: [09-01]
files: [src/lib/mvola/polling.ts, src/app/api/config/polling/route.ts, .env.example, src/lib/mvola/__tests__/polling.test.ts, src/app/api/config/polling/__tests__/route.test.ts]
issue:
prior_status:
---

# Story 09-09: Polling Policy Module + Client Config Exposure

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

Both forms hardcode their own poll interval — `DepositForm.tsx:46` and the equivalent in
`CashOutForm.tsx`, each `3000` — and **neither has a ceiling**. A transaction that never
settles is polled forever, with the UI saying "Pending…" indefinitely.

That mattered less when a 3-second timer settled everything. After story 09-05 a sandbox
transaction sits `pending` until a human approves it in MVola's developer portal, so the wait
is now genuinely open-ended and needs a stated budget.

Create `src/lib/mvola/polling.ts` as the single source for the two knobs, and a small server
route to hand them to the browser. The poll ceiling matters more here than it normally would:
too short and a live demonstration reports a timeout while the presenter is still clicking.

## Acceptance Criteria

- [ ] `src/lib/mvola/polling.ts` exports `POLL_INTERVAL_MS` from `MVOLA_POLL_INTERVAL_MS`, default `3000`
- [ ] It exports `POLL_TIMEOUT_MS` from `MVOLA_POLL_TIMEOUT_MS`, default `120000`
- [ ] A non-numeric, zero, negative, or absent env value falls back to the default rather than producing `NaN`
- [ ] `GET /api/config/polling` returns `{ pollIntervalMs, pollTimeoutMs }` and **nothing else** — no credentials, no env dump, no `MVOLA_ENV` (rule R5)
- [ ] The browser never reads `process.env` directly
- [ ] Both variables are documented in `.env.example` with their defaults and a note that the ceiling is sized for a manual approval
- [ ] Tests cover: both defaults, both overrides, each invalid-value fallback, and the route's exact response shape
- [ ] `npx jest` passes fully

## Technical Notes

```typescript
function readMs(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const POLL_INTERVAL_MS = readMs("MVOLA_POLL_INTERVAL_MS", 3000);
export const POLL_TIMEOUT_MS = readMs("MVOLA_POLL_TIMEOUT_MS", 120000);
```

Module-level constants are read once at import. That is fine for a demo and matches how
`client.ts` reads `MVOLA_ENV`, but it means tests must re-import with `jest.resetModules()`
after mutating `process.env` rather than expecting a live re-read.

**Why a route rather than `NEXT_PUBLIC_`.** `NEXT_PUBLIC_` variables are inlined at build time,
so changing the ceiling before a demo would require a rebuild — exactly the friction this epic
is trying to remove. A route keeps the values server-owned and adjustable by restarting the dev
server. It also keeps the "browser never reads `process.env`" rule literally true rather than
true-by-technicality.

Keep the route's payload minimal and explicitly enumerated. Do not spread anything derived from
`process.env` into it; a config endpoint that grows by accident is how credentials leak.

**`POLL_TIMEOUT_MS` is a reporting boundary, not a decision.** Reaching it means the client stops
asking. It must never cause a wallet mutation and must never be reported as failure — the
transaction may still settle by callback afterwards (rule R3). Stories 09-10 and 09-11 enforce
that in the UI; this story only supplies the number.

Leave `WalletHeader.tsx:13`'s separate `POLL_INTERVAL_MS = 2000` alone. That is the wallet
balance refresh, a different concern, and is out of scope for this epic.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/mvola/polling.ts` | The two knobs with validated defaults |
| CREATE | `src/app/api/config/polling/route.ts` | Hand the knobs to the browser |
| CREATE | `src/lib/mvola/__tests__/polling.test.ts` | Defaults, overrides, invalid-value fallbacks |
| CREATE | `src/app/api/config/polling/__tests__/route.test.ts` | Exact response shape; no leakage |
| MODIFY | `.env.example` | Document `MVOLA_POLL_INTERVAL_MS` and `MVOLA_POLL_TIMEOUT_MS` |

## Dependencies

- **Blocked by:** Story 09-01
- **Blocks:** Story 09-10

## Related

- **Epic:** 09_mvola-api-coverage
- **Spec reference:** pre-spec § 9; feature doc § `polling.ts`, § Timing
