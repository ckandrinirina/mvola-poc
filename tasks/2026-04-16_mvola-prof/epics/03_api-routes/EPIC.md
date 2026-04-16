# Epic 03: API Routes

## Description

Implement the four Next.js App Router API routes that proxy all MVola communication server-side. The browser never calls MVola directly — it calls these routes instead. Each route handles request validation, calls the MVola library (`auth.ts` + `client.ts`), and returns a clean JSON response to the client.

All routes live in `src/app/api/mvola/` and are server-only (they have access to `process.env`). No credentials are ever returned to the browser.

## Goals

- Expose `POST /api/mvola/token` for debug/test token inspection
- Expose `POST /api/mvola/withdraw` — the primary payout initiation endpoint
- Expose `GET /api/mvola/status/[correlationId]` — for client-side polling
- Expose `PUT /api/mvola/callback` — to receive MVola asynchronous webhook

## Scope

### In Scope
- 4 Next.js route handler files using `NextResponse`
- Input validation for the withdraw route
- Proper HTTP status codes and JSON error responses

### Out of Scope
- Authentication of the caller (PoC — no player auth)
- Rate limiting or retry queues
- Persisting callback data to a database

## Dependencies

- **Depends on:** Epic 02 (auth.ts + client.ts must exist)
- **Blocks:** Epic 04 (UI calls these routes)

## Stories

| # | Story | Size | Status |
|---|-------|------|--------|
| 01 | Token route — `POST /api/mvola/token` | S | TODO |
| 02 | Withdraw route — `POST /api/mvola/withdraw` | M | TODO |
| 03 | Status route — `GET /api/mvola/status/[correlationId]` | S | TODO |
| 04 | Callback route — `PUT /api/mvola/callback` | S | TODO |

## Acceptance Criteria

- [ ] All 4 routes respond with correct HTTP status codes
- [ ] Withdraw route returns 400 when `amount` or `playerMsisdn` is missing
- [ ] Withdraw route returns `{ correlationId, status: "pending" }` on success
- [ ] Status route returns `{ transactionStatus, serverCorrelationId, transactionReference }`
- [ ] Callback route returns 200 OK and logs the payload to console
- [ ] No MVola credentials appear in any route response body
- [ ] Token route is accessible at `POST /api/mvola/token`

## Technical Notes

Use Next.js 14 App Router route handler pattern:
```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // ...
  return NextResponse.json({ ... }, { status: 200 });
}
```

Stories 03-03 and 03-04 can be implemented in parallel after 03-02 is done.
