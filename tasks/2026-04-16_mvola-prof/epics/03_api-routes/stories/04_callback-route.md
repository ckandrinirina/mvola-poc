# Story 03-04: Callback Route — `PUT /api/mvola/callback`

> **Epic:** 03 — API Routes
> **Size:** S
> **Status:** TODO

## Description

Create `src/app/api/mvola/callback/route.ts` — a webhook endpoint that receives MVola's asynchronous `PUT` notification when a transaction completes. The route must respond with `200 OK`; any other status causes MVola to retry. In the PoC, the payload is logged to console.

## Acceptance Criteria

- [ ] `PUT /api/mvola/callback` accepts a JSON body matching `CallbackPayload` from `types.ts`
- [ ] Logs the full callback payload to `console.log`
- [ ] Returns `200 OK` with `{ received: true }` on success
- [ ] Returns `200 OK` even if the payload is unexpected (to prevent MVola retries)
- [ ] The route is accessible at the path MVola will call: `/api/mvola/callback`

## Technical Notes

Must export `PUT` (not `POST`) — MVola sends a HTTP PUT:
```typescript
export async function PUT(req: NextRequest) {
  const payload = await req.json();
  console.log("[MVola Callback]", JSON.stringify(payload, null, 2));
  return NextResponse.json({ received: true });
}
```

The public URL for this route is set in `MVOLA_CALLBACK_URL` env var. During local dev, expose via ngrok (see `docs/architecture/dev-guide.md`).

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/app/api/mvola/callback/route.ts` | MVola webhook receiver |

## Dependencies

- **Blocked by:** Story 02-01 (`CallbackPayload` type)
- **Blocks:** None (independent of UI)

## Related

- **Epic:** 03_api-routes
- **Spec reference:** `docs/architecture/api-contracts.md` — `PUT /api/mvola/callback`, `docs/architecture/data-flow.md` — Webhook Callback Reception
