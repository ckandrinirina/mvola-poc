---
name: guide-nextjs
description: >
  Next.js 14+ App Router best practices for mvola-prof. Server vs. Client
  Components, Route Handlers, dynamic segments, env vars, and Node runtime
  selection. Reference for any /expert-* skill writing or reviewing Next.js
  code.
user-invocable: false
---

# Next.js Best Practices Guide (mvola-prof)

> Auto-generated from official documentation via context7 (`/vercel/next.js/v15.1.8`).
> Last researched: 2026-04-17
> Version in project: Next.js 14+ (App Router)

## Project Context

mvola-prof is a single Next.js 14+ App Router project. The frontend (a single
demo page + form) and the backend (4 MVola proxy routes) live in the same
project. All MVola credentials are server-only env vars.

## Coding Conventions

### File & Folder Naming (App Router)

Special files Next.js recognizes inside `src/app/`:

| File | Purpose |
|------|---------|
| `layout.tsx` | Shared layout wrapping pages |
| `page.tsx` | Routable page (UI) |
| `route.ts` | API endpoint (Route Handler) |
| `loading.tsx` | Loading UI |
| `error.tsx` | Error boundary UI |
| `not-found.tsx` | 404 UI |

Project layout (per `docs/architecture/folder-structure.md`):
- `src/app/page.tsx` → `/`
- `src/app/api/mvola/withdraw/route.ts` → `POST /api/mvola/withdraw`
- `src/app/api/mvola/status/[correlationId]/route.ts` → `GET /api/mvola/status/:correlationId`

### Server vs. Client Components

- **Default = Server Component.** Runs on the server, no JS shipped to the browser.
- **Add `"use client"` only when you need:** `useState`, `useEffect`, browser APIs, event handlers, refs.
- **Push `"use client"` as deep in the tree as possible** — keep parents as Server Components to ship less JS.

In this project:
- `src/app/page.tsx` — **Server Component** (just renders the form)
- `src/app/layout.tsx` — **Server Component**
- `src/components/WithdrawForm.tsx` — **Client Component** (`"use client"` — needs `useState` + polling)

## Patterns to Follow

### Route Handler — Basic POST

```ts
// src/app/api/mvola/withdraw/route.ts
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  // ... handle
  return Response.json({ correlationId: "abc-123" });
}
```

### Route Handler — Dynamic Segment

In Next.js 15+, `params` is a `Promise` and must be awaited. Next.js 14 still
allows the synchronous form, but **prefer the awaited form** to be forward-compatible.

```ts
// src/app/api/mvola/status/[correlationId]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ correlationId: string }> },
) {
  const { correlationId } = await params;
  // ... fetch status
  return Response.json({ transactionStatus: "pending" });
}
```

### Route Handler — Webhook (return 200 even on error)

Third-party callers retry on non-2xx. Always return 200 once received and parsed,
even if downstream handling fails — log the failure separately.

```ts
// src/app/api/mvola/callback/route.ts
export async function PUT(request: Request) {
  try {
    const text = await request.text();
    console.log("MVola callback:", text);
  } catch (err) {
    console.error("Failed to read callback body", err);
  }
  return new Response("OK", { status: 200 });
}
```

### Returning JSON

Use the static `Response.json()` helper:

```ts
return Response.json({ ok: true });
return Response.json({ error: "bad input" }, { status: 400 });
```

### Environment Variables

- **Server-only (default):** `process.env.MVOLA_CONSUMER_KEY` — only available in server code (Route Handlers, Server Components, `src/lib/`)
- **Client-exposed:** Must be prefixed `NEXT_PUBLIC_*` and is **inlined into the JS bundle at build time** — visible to any browser
- **NEVER prefix MVola credentials with `NEXT_PUBLIC_`** — that would publish them
- `.env.local` for development (gitignored); platform env vars in production (Vercel dashboard, etc.)

```ts
// GOOD — used inside src/lib/mvola/auth.ts (server-only)
const key = process.env.MVOLA_CONSUMER_KEY;
if (!key) throw new Error("MVOLA_CONSUMER_KEY not set");

// BAD — never put secrets here, never read in a "use client" file
const key = process.env.NEXT_PUBLIC_MVOLA_CONSUMER_KEY;
```

### Path Aliases

Use `@/` to import from `src/`:

```ts
import { getToken } from "@/lib/mvola/auth";
import type { MVolaToken } from "@/lib/mvola/types";
```

### Runtime Selection

Route Handlers run on the Node.js runtime by default — required here because
the MVola client uses `Buffer` and reads `process.env`. **Do not opt into Edge runtime**
for these routes (`export const runtime = "edge"` would break things).

## Anti-Patterns to Avoid

### Calling MVola directly from a Client Component
- **What:** `fetch("https://devapi.mvola.mg/...")` from `WithdrawForm.tsx`
- **Why bad:** Exposes credentials and CORS will fail
- **Instead:** Always go through `/api/mvola/*` server routes

### Putting `"use client"` at the top of `app/layout.tsx`
- **What:** Marks the entire app as client-rendered
- **Why bad:** Ships all components as JS, loses RSC benefits
- **Instead:** Keep layouts as Server Components; mark only leaf interactive components as client

### `NEXT_PUBLIC_` on a secret
- **What:** `NEXT_PUBLIC_MVOLA_CONSUMER_KEY=...`
- **Why bad:** Inlined into the browser bundle — anyone can read it
- **Instead:** No prefix; access only from server-only files

### Forgetting to `await params`
- **What:** `const id = params.correlationId` (sync) in a Next.js 15+ codebase
- **Why bad:** Will start logging warnings, then break in a future version
- **Instead:** `const { correlationId } = await params;`

### Dynamic `import()` of server-only code from a client component
- **What:** Importing `src/lib/mvola/auth.ts` into `WithdrawForm.tsx`
- **Why bad:** Bundles secret-reading code into the browser
- **Instead:** Client only talks to `/api/mvola/*` routes

## Performance Best Practices

- Keep client bundles small — most of the app is Server Components
- Use `loading.tsx` for streaming UI on slow data fetches
- Cache aggressively only when data is shared and safe — MVola transaction status is **per-user, never cache**
- For polling APIs (status route), set `cache: "no-store"` if you ever fetch from a Server Component (here we fetch from the client, so N/A)

## Security Best Practices

- All MVola env vars: server-only, no `NEXT_PUBLIC_` prefix
- Validate request bodies at Route Handlers — return 400 on missing/invalid fields
- For webhook routes, verify origin if MVola provides a signature header (currently spec doesn't — flag as production gap)
- Never log `process.env.MVOLA_CONSUMER_KEY` or full bearer tokens

## Testing Conventions

- Route Handlers can be tested by importing the exported function and calling it with a constructed `Request`:
  ```ts
  import { POST } from "@/app/api/mvola/withdraw/route";

  it("returns 400 when amount is missing", async () => {
    const req = new Request("http://test/api/mvola/withdraw", {
      method: "POST",
      body: JSON.stringify({ playerMsisdn: "0343500003" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
  ```
- E2E: Playwright against `npm run dev` on port 3000

## Build & Tooling

- `npm run dev` — dev server with hot reload
- `npm run build` — production build (`.next/` output)
- `npm start` — run the production server
- `npm run lint` — Next.js's ESLint preset
- `npx tsc --noEmit` — typecheck

## Framework-Specific Guidelines

### Webhook Callback URL in Local Dev
- MVola needs a public URL to PUT the callback
- Use ngrok: `ngrok http 3000`, then set `MVOLA_CALLBACK_URL=https://xxxxx.ngrok.io/api/mvola/callback`
- See `docs/architecture/dev-guide.md`

### Avoid Next.js Caching for MVola Calls
- All MVola fetches are dynamic per-user — pass `cache: "no-store"` to any server-side `fetch()` of MVola
- (In this project, MVola is called from Route Handlers, which are dynamic by default — but be explicit)

## References

- Official docs: https://nextjs.org/docs
- Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Project: `docs/architecture/components.md`, `docs/architecture/api-contracts.md`

This guide is used by **/expert-frontend** (page, layout, client components) and **/expert-backend** (Route Handlers, env vars).
