# Story 03-01: Token Route — `POST /api/mvola/token`

> **Epic:** 03 — API Routes
> **Size:** S
> **Status:** DONE

## Description

Create `src/app/api/mvola/token/route.ts` — a Next.js route handler that calls `getToken()` from `auth.ts` and returns the access token and expiry. This endpoint exists for debugging and testing purposes only; in production it would be internal or removed.

## Acceptance Criteria

- [x] `POST /api/mvola/token` returns `{ access_token, expires_in }` with status 200
- [x] Calls `getToken()` from `src/lib/mvola/auth.ts` (does not call MVola directly)
- [x] Returns 500 with `{ error: string }` if token acquisition fails
- [x] No request body required

## Technical Notes

```typescript
import { NextResponse } from "next/server";
import { getToken } from "@/lib/mvola/auth";

export async function POST() {
  try {
    const token = await getToken();
    return NextResponse.json({ access_token: token, expires_in: 3600 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to acquire token" }, { status: 500 });
  }
}
```

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/app/api/mvola/token/route.ts` | Token acquisition debug endpoint |

## Dependencies

- **Blocked by:** Story 02-02 (`getToken()` must exist)
- **Blocks:** None (independent of other routes)

## Related

- **Epic:** 03_api-routes
- **Spec reference:** `docs/architecture/api-contracts.md` — `POST /api/mvola/token`
