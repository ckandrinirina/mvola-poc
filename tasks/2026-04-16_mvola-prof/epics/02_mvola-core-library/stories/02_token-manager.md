# Story 02-02: OAuth Token Manager — `auth.ts`

> **Epic:** 02 — MVola Core Library
> **Size:** M
> **Status:** DONE

## Description

Implement `src/lib/mvola/auth.ts` — the module that manages the MVola OAuth 2.0 Client Credentials token lifecycle. It fetches a new token when needed, caches it in memory with its expiry time, and automatically refreshes when the token is within 60 seconds of expiring. All API routes call `getToken()` before making any MVola request.

## Acceptance Criteria

- [x] `getToken()` is the only exported function
- [x] On first call, fetches a token via `POST https://devapi.mvola.mg/token` (or `api.mvola.mg` based on `MVOLA_ENV`)
- [x] Uses `Authorization: Basic Base64(MVOLA_CONSUMER_KEY:MVOLA_CONSUMER_SECRET)`
- [x] Request body is `grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE` (URL-encoded)
- [x] On success, caches `{ access_token, expiresAt }` in a module-level variable
- [x] On subsequent calls within validity window, returns cached token without a network call
- [x] Refreshes when `Date.now() >= expiresAt - 60_000` (60s before expiry)
- [x] Throws a descriptive error if the MVola token endpoint returns non-200
- [x] Uses `MVolaToken` interface from `types.ts`
- [x] Reads `MVOLA_CONSUMER_KEY`, `MVOLA_CONSUMER_SECRET`, `MVOLA_ENV` from `process.env`

## Technical Notes

Token caching pattern:

```typescript
interface CachedToken {
  access_token: string;
  expiresAt: number; // Date.now() ms
}

let cachedToken: CachedToken | null = null;

export async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.access_token;
  }
  // fetch new token...
  cachedToken = { access_token, expiresAt: Date.now() + expires_in * 1000 };
  return cachedToken.access_token;
}
```

Base URL selection:
```typescript
const BASE_URL = process.env.MVOLA_ENV === "production"
  ? "https://api.mvola.mg"
  : "https://devapi.mvola.mg";
```

Use `Buffer.from(`${key}:${secret}`).toString("base64")` for Basic auth encoding in Node.js.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/mvola/auth.ts` | Token fetch, cache, and refresh logic |

## Dependencies

- **Blocked by:** Story 02-01 (needs `MVolaToken` type)
- **Blocks:** Story 02-03, Story 03-01

## Related

- **Epic:** 02_mvola-core-library
- **Spec reference:** `docs/architecture/data-flow.md` (Token Refresh Flow), `docs/architecture/api-contracts.md`
