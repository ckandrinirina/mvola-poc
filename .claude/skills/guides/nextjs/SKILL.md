---
name: guide-nextjs
description: >
  Next.js 16 App Router best practices for mvola-prof. Async params in Route Handlers,
  the inverted caching defaults, runtime selection, server/client boundary and secret
  leakage, module-level state, and the 14 to 16 migration traps. Researched from official
  documentation. Reference for any /expert-* skill writing or reviewing Next.js code.
user-invocable: false
paths:
  - "src/app/**/*.{ts,tsx}"
  - "next.config.ts"
---

<!-- ck-code:team GENERATED — /ck-code:team may overwrite this file on --regenerate. Delete this line to protect manual edits. -->

# Next.js Best Practices Guide (mvola-prof)

> Auto-generated from official documentation.
> Last researched: 2026-07-28
> Version in project: Next.js 16.2.4 (App Router)

## Project Context

**mvola-prof** is a proof-of-concept Next.js application demonstrating a realistic,
end-to-end **MVola Merchant Pay** (Madagascar mobile money) integration in a game
context: a player deposits real money from their MVola account into an in-game wallet,
plays a simulated coin-flip betting game, and cashes out the remaining balance back to
their MVola number.

**Architecture:** a single Next.js App Router project. The browser never calls MVola —
every call is proxied through server-side Route Handlers so credentials stay on the
server. There is **no database**: wallet, transaction, and game state live in
module-level `Map` singletons that die with the process.

| Area | Location | Purpose |
|---|---|---|
| MVola proxy routes | `src/app/api/mvola/**` | `token/`, `deposit/`, `withdraw/`, `status/[correlationId]/`, `callback/` (PUT webhook) |
| Internal routes | `src/app/api/wallet/[msisdn]/{balance,history}/`, `src/app/api/game/coinflip/` | read wallet state, play a round — no MVola call |
| MVola client library | `src/lib/mvola/` | `auth.ts` (OAuth token + in-memory cache), `client.ts` (HTTP + base-URL selection), `reconcile.ts` (idempotent wallet settlement), `types.ts` (all shapes) |
| State store | `src/lib/store/` | `wallets.ts`, `transactions.ts`, `games.ts` — `Map` singletons, typed accessors only, each exports `resetAll()` |
| Game logic | `src/lib/game/coinflip.ts` | pure, RNG injected for determinism |
| UI | `src/components/` | `WalletHeader`, `TabbedLayout`, `DepositForm`, `CashOutForm`, `CoinFlipGame`, `TransactionHistory` |

**Tech stack — `package.json` is authoritative:**

| Layer | Actual installed version |
|---|---|
| Framework | **Next.js 16.2.4** (App Router, Turbopack default) |
| UI | **React 19.2.4** / react-dom 19.2.4 |
| Language | TypeScript 5 (`strict: true`, `@/*` → `src/*`) |
| Styling | **Tailwind CSS v4** via `@tailwindcss/postcss` — **no `tailwind.config.js` exists** |
| Testing | **Jest 30.3** + ts-jest 29.4 + **React Testing Library 16.3** + jest-environment-jsdom 30 + user-event 14.6 |
| Runtime dep | `uuid` v13 (the only one) |
| HTTP | native `fetch` |
| Absent | no database, no ORM, no ESLint config, no Prettier config, no CI |

> ⚠️ **`docs/architecture/tech-stack.md` is stale** — it documents Next.js 14+, React 18+,
> Tailwind 3+, Node 18+, and claims ESLint + Prettier. Trust `package.json`, not that doc.
> Note also that **Next.js 16 requires Node 20.9+**; Node 18 is unsupported.

**Key constraints**
- MVola credentials (`MVOLA_CONSUMER_KEY` / `MVOLA_CONSUMER_SECRET`) are server-only,
  read exclusively inside `src/lib/mvola/`. Never `NEXT_PUBLIC_`.
- Money is **integer Ariary** internally; stringified only at the `client.ts` HTTP edge.
- Every wallet mutation must be **idempotent** — the status poll and the webhook can both
  settle the same transaction.
- `MVOLA_ENV` selects the base URL and **nothing else** (project rule R2).
- Sandbox transactions settle only after a **manual approval** in MVola's developer portal.
- All state is in-memory and resets on server restart.

**Docs & plans**
- Architecture: `docs/architecture/` — `overview.md`, `folder-structure.md`,
  `tech-stack.md`, `configuration.md`, `dev-guide.md`, `state-management.md`,
  `_shared.md`, plus one self-contained doc per feature at
  `docs/architecture/features/<slug>/index.md` (index: `docs/architecture/README.md`).
- Plans: `tasks/2026-04-16_mvola-prof/` (epics + stories), routed via `tasks/FEATURE_INDEX.md`.
- MVola reference: `docs/API_MerchantPay.pdf`, `docs/mvola-reference/`.
- House rules: `/guide-conventions` (`.claude/skills/guides/conventions/SKILL.md`) — **authoritative; wins on conflict**.

## Coding Conventions

### Naming
- Route Handler files are always named `route.ts` inside the folder that encodes the
  path; the folder — not the file — carries the meaning (`api/mvola/status/[correlationId]/route.ts`).
- Dynamic segment folders use `[param]` brackets matching the destructured name exactly
  (`[correlationId]`, `[msisdn]`) — Next generates the `RouteContext<'…'>` type from this
  literal, so the folder name and the destructured property name must agree.
- Exported HTTP method handlers are the literal uppercase verb: `GET`, `POST`, `PUT`,
  `DELETE`, `PATCH`. `OPTIONS` is auto-implemented if omitted — do not hand-write it
  unless you need non-default behavior.

### File Organization
- Route Handlers under `src/app/api/**` only orchestrate: parse the request, call into
  `src/lib/mvola/*` or `src/lib/store/*`, shape the response. No MVola HTTP calls or
  business logic inline in `route.ts`.
- Each route's tests live alongside it in `__tests__/route.test.ts`
  (e.g. `src/app/api/mvola/withdraw/__tests__/route.test.ts`), matching the existing
  layout for `callback`, `deposit`, `withdraw`, `coinflip`, `wallet/[msisdn]/balance`.
- `src/lib/mvola/` is the only place that imports MVola credentials; `src/lib/store/`
  is the only place that touches the `Map` singletons directly — routes call typed
  accessors, never `wallets.set(...)` inline.

### Code Style
- Handlers are `async function GET/POST/PUT(...)` returning `Promise<NextResponse>` —
  match the explicit return type already used in `status/[correlationId]/route.ts` and
  `wallet/[msisdn]/balance/route.ts`.
- JSDoc block above every exported handler describing params, side effects, and each
  possible status code — see the existing routes for the expected level of detail.
- Errors are caught explicitly inside the handler body and turned into a `NextResponse`
  with an appropriate status; never let a Route Handler throw uncaught.

> `/guide-conventions` (`.claude/skills/guides/conventions/SKILL.md`) holds this project's
> house rules and **wins on conflict** with anything generic in this guide.

## Patterns to Follow

### Async `params` in Route Handlers (the single most important Next 16 change)

`params` (and `searchParams`) are **Promises**, not plain objects — every 14-era
synchronous destructure is broken. This project's dynamic routes already do it right:

```ts
// src/app/api/mvola/status/[correlationId]/route.ts
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ correlationId: string }> }
): Promise<NextResponse> {
  const { correlationId } = await params;
  // ...
}
```

The same shape (`interface RouteContext { params: Promise<{ msisdn: string }> }`) is used
in `src/app/api/wallet/[msisdn]/balance/route.ts`. Both are valid: a hand-written
`{ params: Promise<{...}> }` type, or Next's **generated global type**
`RouteContext<'/api/mvola/status/[correlationId]'>` (emitted into `.next/types` by
`next dev`/`next build`/`next typegen`, no import needed) — prefer the generated form for
any *new* dynamic route once the folder exists and typegen has run. Route Handlers get
**no** `searchParams` argument at all — read `request.nextUrl.searchParams` instead.

### No cache config on any route in this project

GET Route Handlers and server-side `fetch()` are **not cached by default** in 15/16 —
inverted from Next 14. This project never needs to opt in: status polling, balance,
history, and the callback are all inherently per-request, per-user data.

```ts
// Correct for every route in src/app/api/** — no dynamic/revalidate export at all
export async function GET(request: NextRequest, context: RouteContext) { /* ... */ }
```

### Explicit `nodejs` runtime on every MVola route

```ts
export const runtime = "nodejs"; // reads process.env secrets; may need Node crypto
```

Add this to every route under `src/app/api/mvola/**`. `nodejs` is already the default,
but state it explicitly on routes that read secrets or (for `callback/route.ts`) may
later need Node's `crypto.timingSafeEqual` for signature verification — `edge`'s Web
Crypto subset and partial `process.env` access make it the wrong choice here.

### `server-only` guard on secret-reading modules

```ts
// src/lib/mvola/auth.ts — add this import
import "server-only";

const secret = process.env.MVOLA_CONSUMER_SECRET;
```

`server-only` no-ops under the server bundler condition and **throws at import time**
under the client condition — a silent secret leak becomes a build error instead.
`src/lib/mvola/auth.ts` currently reads `process.env.MVOLA_CONSUMER_KEY` without this
guard; add it.

### Idempotent webhook handling (module-level state)

`src/app/api/mvola/callback/route.ts` already models the right shape: always parse
defensively, always return 200, delegate the actual settlement to
`reconcileTransaction()` so the callback and the status-poll route (which can both
reach the same terminal transition) don't double-credit a wallet.

```ts
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const record = getTransactionByCorrelationId(body?.serverCorrelationId);
    if (record) reconcileTransaction(record, body.transactionStatus, body.transactionReference);
  } catch (err) {
    console.error("[mvola/callback] Unhandled error parsing body", err);
  }
  return NextResponse.json({ received: true }, { status: 200 }); // always 200
}
```

For a webhook that ever needs signature verification, read the body **once** and in the
right order: `await request.text()` first for HMAC verification, then `JSON.parse` the
same string — never call `.json()` and then `.text()` on the same request.

### Module-level `Map` singletons under dev HMR

`src/lib/store/wallets.ts`, `transactions.ts`, and `games.ts` rely on a bare
`new Map()` at module scope. Next.js guarantees the module evaluates once per worker in
a long-lived process, but **dev HMR (Turbopack) can re-evaluate the module on edit**,
silently resetting the wallet/transaction/game state mid-session. Guard it via
`globalThis` so a HMR reload reuses the existing map instead of creating a fresh one:

```ts
const g = globalThis as unknown as { __wallets?: Map<string, WalletState> };
const wallets = g.__wallets ?? (g.__wallets = new Map());
```

This does **not** fix multi-worker/serverless isolation — each worker still gets its own
`Map` — but that's an accepted limitation of this proof-of-concept, not something to
"fix" with a database here.

## Anti-Patterns to Avoid

### Synchronous `params` destructure
- **WRONG:** `export async function GET(req, { params }: { params: { id: string } }) { const id = params.id; }`
- **RIGHT:** `const { correlationId } = await context.params;` (see `status/[correlationId]/route.ts`)
- **WHY:** `params` is a `Promise` in Next 15/16. Synchronous property access yields
  `undefined` or a TypeError, not the value.

### Adding cache config "for performance" to a polling route
- **WRONG:** `export const revalidate = 60;` on `status/[correlationId]/route.ts` or `wallet/[msisdn]/balance/route.ts`
- **RIGHT:** No cache config at all — GET handlers are dynamic by default in Next 16.
- **WHY:** Serves stale MVola status; the client's poll loop would show `pending` forever
  even after MVola settles the transaction.

### Secret-reading module without `server-only`
- **WRONG:** `src/lib/mvola/auth.ts` reading `process.env.MVOLA_CONSUMER_SECRET` with no `import "server-only"` guard
- **RIGHT:** `import "server-only";` at the top of every file in `src/lib/mvola/` that reads credentials
- **WHY:** A future transitive import from a `"use client"` component would silently
  bundle the secret into browser JS; `server-only` turns that into a build-time throw.

### Edge runtime on the callback webhook
- **WRONG:** `export const runtime = "edge";` on `src/app/api/mvola/callback/route.ts`
- **RIGHT:** `export const runtime = "nodejs";`
- **WHY:** Signature verification (when added) needs Node's `crypto.timingSafeEqual`;
  Edge's Web Crypto subset and partial `process.env` access make it the wrong runtime
  for a credential-reading webhook.

### `NEXT_PUBLIC_` on an MVola credential
- **WRONG:** `NEXT_PUBLIC_MVOLA_CONSUMER_KEY=...` in `.env.local`
- **RIGHT:** `MVOLA_CONSUMER_KEY=...` (no prefix), read only inside `src/lib/mvola/`
- **WHY:** `NEXT_PUBLIC_`-prefixed vars are inlined into the browser bundle at build
  time — anyone opening devtools reads the credential.

### Hand-writing `RouteContext<'…'>` for a route that doesn't exist yet
- **WRONG:** Typing a new handler against `RouteContext<'/api/wallet/[msisdn]/reset'>` before the folder exists
- **RIGHT:** Scaffold the folder and `route.ts` first, run `next dev` (or `next typegen`), then reference the generated literal
- **WHY:** The type is generated from the real filesystem routes in `.next/types`; it
  does not exist until the route does.

### Reading secrets on Edge or relying on `serverRuntimeConfig`
- **WRONG:** `import getConfig from "next/config"; const { serverRuntimeConfig } = getConfig();`
- **RIGHT:** `process.env.MVOLA_CONSUMER_KEY` inside a `server-only`-guarded module, with `runtime = "nodejs"`
- **WHY:** `serverRuntimeConfig`/`publicRuntimeConfig` were **removed in Next 16** —
  `process.env` + `NEXT_PUBLIC_` is the only mechanism left.

## Performance Best Practices

- Do not add `dynamic`, `revalidate`, or `generateStaticParams` to any route under
  `src/app/api/**` — every response here is per-user, per-request MVola or wallet state.
- Client bundles stay small by default: `src/app/page.tsx` and `src/app/layout.tsx` are
  Server Components; only leaf components needing `useState`/polling
  (`DepositForm`, `CashOutForm`, `CoinFlipGame`, `TransactionHistory`) carry `"use client"`.
- Turbopack is the default dev bundler in Next 16 — no `--turbo` flag, and no
  `experimental.turbo` key (renamed to top-level `turbopack` in `next.config.ts`).
- `cacheComponents` (replaces `experimental.ppr`/`dynamicIO`/`useCache`) is **not
  relevant here** — it also disables `runtime = "edge"`, and every route is intentionally
  dynamic anyway.

## Security Best Practices

- MVola credentials never leave `src/lib/mvola/`; guard every file that reads them with
  `import "server-only"` (see Patterns to Follow above).
- Validate request bodies in every Route Handler; return 400 on missing/invalid fields
  before touching `src/lib/store/*` or calling MVola.
- The callback route always returns 200, even on parse/reconciliation failure, to avoid
  MVola retry-storming — but must never let an uncaught throw produce an unlogged 500.
- Never log full bearer tokens or raw credential values —
  `src/app/api/mvola/callback/route.ts` logs only `serverCorrelationId`/`transactionStatus`.
- `runtime = "nodejs"` (not `edge`) on every route reading `process.env` secrets or
  needing Node `crypto` for webhook signature checks.

## Testing Conventions

- Jest 30.3 + ts-jest + React Testing Library 16.3 + jest-environment-jsdom 30 +
  user-event 14.6, per `package.json` — no separate Next-specific test runner.
- Route Handler tests import the exported `GET`/`POST`/`PUT` directly and invoke it with
  a hand-built `NextRequest`, passing `{ params: Promise.resolve({ ... }) }` for dynamic
  routes — this project does not use `next-test-api-route-handler`; stay consistent with
  the existing files.
- Test files live in `__tests__/route.test.ts` next to the `route.ts` they cover.

```ts
// pattern used by src/app/api/wallet/[msisdn]/balance/__tests__/route.test.ts
import { NextRequest } from "next/server";
import { GET } from "@/app/api/wallet/[msisdn]/balance/route";

it("returns balance 0 for an unseen msisdn", async () => {
  const req = new NextRequest("http://test/api/wallet/0343500003/balance");
  const res = await GET(req, { params: Promise.resolve({ msisdn: "0343500003" }) });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ balance: 0, updatedAt: null });
});
```

## Framework-Specific Guidelines

### Removed / renamed going from 14 to 16 (silent breakage risks)
1. **Node 18 is unsupported** — Next 16 requires **Node 20.9+** and TypeScript 5.1+.
2. `params`/`searchParams` are Promises everywhere, including `generateMetadata`.
3. GET Route Handlers and `fetch()` are no longer cached by default (see above).
4. `serverRuntimeConfig`/`publicRuntimeConfig` — removed; use `process.env`/`NEXT_PUBLIC_`.
5. `experimental.ppr`/`dynamicIO`/`useCache` — removed, merged into top-level
   `cacheComponents`; using the old experimental flags throws a build error.
6. `experimental.turbo` → top-level `turbopack` key in `next.config.ts`.
7. `middleware.ts` → `proxy.ts` (export renamed to `proxy`); `middleware.ts` still works
   but is deprecated. Proxy runtime is fixed to `nodejs`.
8. `next/legacy/image` — removed entirely.
9. AMP support (`next/amp`, `useAmp`) — fully removed.
10. Turbopack is now the **default** dev bundler (was the `--turbo` opt-in flag in 14).

Bulk-migrate any straggling synchronous `params` usage with:
`npx @next/codemod@latest next-async-request-api .`

### Error handling in Route Handlers
There is no `error.tsx` equivalent for Route Handlers — an uncaught throw yields a
generic 500 with no body. `notFound()`/`redirect()` from `next/navigation` are
page/layout-only and must not be called from a `route.ts`. Every route in this project
catches explicitly and returns a shaped `NextResponse`, as in
`status/[correlationId]/route.ts`'s `catch (err) { ... return NextResponse.json({ error: message }, { status: 502 }); }`.

This guide is used by /expert-backend and /expert-frontend for Next.js-specific guidance.

## References

- https://nextjs.org/docs/app/api-reference/file-conventions/route
- https://nextjs.org/docs/app/getting-started/route-handlers
- https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime
- Next.js upgrade guides: version-15.mdx, version-16.mdx (via context7 `/vercel/next.js`)
- `docs/architecture/tech-stack.md` (stale — see Project Context above), `docs/architecture/dev-guide.md`, `docs/architecture/configuration.md`
- `.claude/skills/guides/conventions/SKILL.md` (`/guide-conventions` — authoritative on conflict)
