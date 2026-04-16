# Project Overview: mvola-prof

## Vision

`mvola-prof` is a proof-of-concept Next.js application demonstrating how to integrate the MVola Merchant Pay API into a game for player withdrawals and payouts. It serves as a working, well-structured reference implementation that developers can adapt into a real game backend.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Browser (Client)                   │
│  ┌─────────────────────────────────────────────┐   │
│  │  page.tsx → WithdrawForm                    │   │
│  │  - amount + phone input                     │   │
│  │  - POST /api/mvola/withdraw on submit        │   │
│  │  - poll GET /api/mvola/status/:id every 3s  │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (localhost)
┌──────────────────────▼──────────────────────────────┐
│              Next.js Server (API Routes)             │
│                                                     │
│  POST /api/mvola/token      → token/route.ts        │
│  POST /api/mvola/withdraw   → withdraw/route.ts     │
│  GET  /api/mvola/status/:id → status/route.ts       │
│  PUT  /api/mvola/callback   → callback/route.ts     │
│                                                     │
│  src/lib/mvola/                                     │
│    auth.ts   — token cache + refresh               │
│    client.ts — typed MVola HTTP calls              │
│    types.ts  — shared TypeScript interfaces        │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│            MVola API (devapi.mvola.mg)               │
│  POST /token                                        │
│  POST /mvola/mm/transactions/type/merchantpay/1.0.0/│
│  GET  /mvola/mm/transactions/.../status/:id         │
└─────────────────────────────────────────────────────┘
          │ PUT webhook callback
          ▼
  PUT /api/mvola/callback  (this server)
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14+ |
| Language | TypeScript | 5+ |
| Runtime | Node.js | 18+ |
| HTTP client | Native `fetch` | — |
| Styling | Tailwind CSS | 3+ |
| Package manager | npm | 10+ |
| UUID generation | `uuid` | latest |

## Components

### `src/lib/mvola/types.ts`
- **Purpose:** Single source of truth for all MVola payload shapes
- **Key types:** `MVolaToken`, `WithdrawalRequest`, `TransactionResponse`, `CallbackPayload`

### `src/lib/mvola/auth.ts`
- **Purpose:** Manage OAuth 2.0 token lifecycle (Client Credentials flow)
- **Key responsibilities:** Fetch token, cache in memory with expiry, auto-refresh 60s before expiry

### `src/lib/mvola/client.ts`
- **Purpose:** Typed wrappers around MVola API endpoints
- **Key responsibilities:** `initiateWithdrawal()`, `getTransactionStatus()`, attach required headers

### `src/app/api/mvola/token/route.ts`
- **Purpose:** Debug/test endpoint to acquire a fresh OAuth token

### `src/app/api/mvola/withdraw/route.ts`
- **Purpose:** Initiate a payout from merchant to player; validates input and returns `correlationId`

### `src/app/api/mvola/status/[correlationId]/route.ts`
- **Purpose:** Poll transaction status by `serverCorrelationId`

### `src/app/api/mvola/callback/route.ts`
- **Purpose:** Receive MVola asynchronous webhook PUT; log and return 200

### `src/components/WithdrawForm.tsx`
- **Purpose:** Demo React form — captures amount + MSISDN, submits, polls, displays status

## Key Design Decisions

- **Server-side credentials only:** All MVola API calls go through Next.js API routes; credentials never reach the browser.
- **In-memory token cache:** Simple module-level variable in `auth.ts`; refreshed automatically. Resets on server restart (acceptable for PoC).
- **No database:** PoC only — no persistent storage. All state is ephemeral.
- **Native `fetch`:** Node.js 18+ ships with `fetch`; no extra HTTP library needed.

## Non-Functional Requirements

- **Security:** Credentials server-side only; never logged or bundled into client JS.
- **Reliability:** Token auto-refresh prevents 401 mid-flow.
- **Compatibility:** Sandbox (`devapi.mvola.mg`) only; configurable for production via `MVOLA_ENV`.

## References

- Architecture docs: `docs/architecture/`
- Generated: 2026-04-16
