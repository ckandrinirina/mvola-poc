---
name: guide-testing
description: >
  Jest 30 + React Testing Library 16 + ts-jest testing conventions for mvola-prof.
  Route Handler tests with Promise-wrapped params, fetch mocking, resetting in-memory
  singleton stores, polling components with fake timers, and deterministic RNG. Researched
  from official documentation. Reference for any /expert-* skill writing or reviewing tests.
user-invocable: false
paths:
  - "**/__tests__/**/*.{ts,tsx}"
  - "jest.config.ts"
  - "jest.setup.ts"
---

<!-- ck-code:team GENERATED — /ck-code:team may overwrite this file on --regenerate. Delete this line to protect manual edits. -->

# Testing Best Practices Guide (mvola-prof)

> Auto-generated from official documentation.
> Last researched: 2026-07-28
> Version in project: Jest 30.3 + ts-jest 29.4 + React Testing Library 16.3 + user-event 14.6

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

**Tests are co-located** in `src/**/__tests__/`, sibling to the module they cover
(`src/lib/store/wallets.ts` → `src/lib/store/__tests__/wallets.test.ts`) — the project
standard. 13 of 23 files already follow this; the remaining 10 (components plus a few
routes) sit in a **deprecated** mirrored `src/__tests__/**` tree and move to co-located
`__tests__/` on next touch via `git mv` (`@/…` imports don't change; `testMatch` already
globs both trees). **Trade-off:** co-location binds a test to its module so a rename
can't silently orphan it; the mirrored tree has no compiler-enforced link and rots on
rename. Name files `<module>.test.ts`/`.test.tsx` matching the source basename; `describe`
names the unit, `it` states observable behavior, not implementation.

**Environment strategy:** global `testEnvironment: "node"` is correct — most of the suite
(lib, store, game, routes) is pure Node/TS with no DOM — with per-file jsdom opt-in for
component tests via `/** @jest-environment jsdom */`. jsdom bootstrap is the largest
per-file cost and only ~6 of 23 files render React, so this split keeps the majority fast.

## Patterns to Follow

### Route Handler tests (Next 16 Promise-wrapped `params`)

Next 16 types the second Route Handler argument's `params` as `Promise<{...}>`, even
though the resolved value is already known synchronously in tests. Always wrap it:

```ts
// GET with a dynamic segment
import { NextRequest } from "next/server";
import { GET } from "@/app/api/wallet/[msisdn]/balance/route";

it("returns 200 with balance and updatedAt for a known wallet", async () => {
  const req = new NextRequest("http://localhost/api/wallet/0343500003/balance");
  const response = await GET(req, { params: Promise.resolve({ msisdn: "0343500003" }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ msisdn: "0343500003", balance: 0, updatedAt: null });
});

// POST with a JSON body
import { POST } from "@/app/api/mvola/deposit/route";

it("initiates a deposit and returns a correlationId", async () => {
  const req = new NextRequest("http://localhost/api/mvola/deposit", {
    method: "POST",
    body: JSON.stringify({ msisdn: "0343500003", amount: 5000 }),
    headers: { "Content-Type": "application/json" },
  });
  const response = await POST(req);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(
    expect.objectContaining({ correlationId: expect.any(String) })
  );
});
```

### Mocking `fetch` with a real `Response`

Prefer `jest.spyOn` plus a real `Response` over assigning `global.fetch` directly:

```ts
let fetchSpy: jest.SpiedFunction<typeof global.fetch>;

beforeEach(() => {
  fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ status: "pending", serverCorrelationId: "corr-123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
});
afterEach(() => fetchSpy.mockRestore());

it("attaches the Authorization header", async () => {
  await initiateDeposit({ msisdn: "0343500003", amount: 5000 }, "tok");
  const [, options] = fetchSpy.mock.calls[0];
  expect(options?.headers).toMatchObject({ Authorization: "Bearer tok" });
});
```

A real `Response` (global in Node 18+/jsdom 30) gives `.text()`, `.headers`, `.clone()`
for free and type-checks correctly, and `mockRestore()` guarantees `global.fetch` is
never left patched across files. This should replace the project's current
`global.fetch = jest.fn()` pattern, seen in `DepositForm.test.tsx` — see the anti-pattern
below for why.

### Resetting module-level `Map` singletons

Default: call the exported `resetAll()` in `beforeEach` — every store in
`src/lib/store/` (`wallets.ts`, `transactions.ts`, `games.ts`) exports one:

```ts
import { creditWallet, getWallet, resetAll } from "@/lib/store/wallets";

beforeEach(() => resetAll());

it("credits a new wallet", () => {
  creditWallet("0343500003", 5000);
  expect(getWallet("0343500003")?.balance).toBe(5000);
});
```

Reserve `jest.resetModules()` + dynamic `import()` for modules baking a `process.env`
value into a closure **at import time** — `client.ts` and `auth.ts`, which read
`MVOLA_ENV` on load to pick a base URL. No exported reset helper fixes that; the captured
value predates any test code running:

```ts
beforeEach(() => {
  jest.resetModules();
  process.env.MVOLA_ENV = "production";
});

it("uses the production base URL", async () => {
  const { initiateDeposit } = await import("@/lib/mvola/client");
  // …assert against the production host
});
```

### Polling component tests (fake timers + user-event)

```tsx
/** @jest-environment jsdom */
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  jest.useFakeTimers();
  user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
});
afterEach(() => {
  jest.runOnlyPendingTimers(); // kill any interval the component left running
  jest.useRealTimers();
});

it("polls until completed and then stops", async () => {
  fetchSpy
    .mockResolvedValueOnce(json({ transactionStatus: "pending" }))
    .mockResolvedValueOnce(json({ transactionStatus: "completed" }));

  render(<DepositForm />);
  await user.type(screen.getByLabelText(/amount/i), "5000");
  await user.click(screen.getByRole("button", { name: /deposit/i }));

  await act(async () => {
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
  });
  await waitFor(() => expect(screen.getByText(/completed/i)).toBeInTheDocument());
});
```

The `await Promise.resolve()` inside `act` is **load-bearing**: `advanceTimersByTime`
fires the interval callback synchronously, but its `fetch().then(setState)` resolves on
a later microtask that `act` doesn't otherwise wrap — omit it and React throws "not
wrapped in act", or the assertion races the update. `jest.runOnlyPendingTimers()` in
`afterEach` matters specifically here: an interval a previous test left running can fire
mid-test and cause an unrelated flake.

### Deterministic randomness by injection

`src/lib/game/coinflip.ts`'s `playCoinFlip(bet, choice, rng)` takes an injectable
`rng: () => "heads" | "tails"` defaulting to a `crypto.getRandomValues`-backed impl:

```ts
it("resolves a win when the forced RNG matches the player's choice", () => {
  const result = playCoinFlip({ bet: 500, choice: "heads" }, () => "heads");
  expect(result.outcome).toBe("win");
});

it("stays statistically balanced with the real default RNG", () => {
  let heads = 0;
  for (let i = 0; i < 1000; i++) {
    if (playCoinFlip({ bet: 500, choice: "heads" }).roll === "heads") heads++;
  }
  expect(heads).toBeGreaterThan(400);
  expect(heads).toBeLessThan(600);
});
```

Prefer this over mocking `globalThis.crypto`: a forced RNG asserts a specific outcome
deterministically, and a second test still exercises the real default path with a
statistical check, keeping the production default covered instead of permanently
bypassed.

## Anti-Patterns to Avoid

**WRONG:** `global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => body } as Response)`
**RIGHT:** `jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))`
**WHY:** plain assignment permanently replaces `global.fetch` unless manually restored;
faking a partial shape forces `as unknown as Response` casts that defeat type-checking.

**WRONG:** `jest.resetModules()` to reset a `Map`-backed store between tests
**RIGHT:** `beforeEach(() => resetAll())`
**WHY:** `resetModules` re-evaluates the whole graph (slow), and a test file that imported
the store *before* the reset keeps a stale instance disconnected from the freshly
re-imported one — the classic "why isn't my mock affecting the store" bug.

**WRONG:** `import { act } from "react-dom/test-utils"`
**RIGHT:** `import { act } from "@testing-library/react"`
**WHY:** removed in React 19 and throws on import; RTL 16 re-exports React's own `act`
and sets `IS_REACT_ACT_ENVIRONMENT` automatically.

**WRONG:** `jest.advanceTimersByTime(3000)` bare, when the callback does `fetch().then(setState)`
**RIGHT:** `await act(async () => { jest.advanceTimersByTime(3000); await Promise.resolve(); })`
**WHY:** the state update lands on a microtask `act` didn't wrap → "not wrapped in act".

**WRONG:** `await GET(req, { params: { msisdn: "0343500003" } })`
**RIGHT:** `await GET(req, { params: Promise.resolve({ msisdn: "0343500003" }) })`
**WHY:** Next 16 declares `params` as a `Promise`. A bare object fails `strict`
type-checking; `any`-casting it makes the `await` succeed by accident and masks the
mismatch instead of surfacing it.

**WRONG:** `isolatedModules: true` set anywhere in the ts-jest transform config
**RIGHT:** leave it off; keep full type-checking
**WHY:** it compiles file-by-file and misses cross-file type errors — runs degrade from
"does it type-check" to "does it transpile", the wrong trade for a TDD loop that wants a
broken `params: Promise<…>` signature caught before the assertion runs. If ever adopted
it belongs inside the transform options object; the top-level `isolatedModules` key is
deprecated.

## Performance

The `node`/jsdom split (jsdom bootstrap is the largest fixed per-file cost) and
`resetAll()` (O(store size), synchronous, versus `jest.resetModules()` re-evaluating the
whole graph) are the suite's two biggest levers today. Jest 30's `unrs-resolver` and
opt-in `testEnvironmentOptions.globalsCleanup` report ~37% faster runs and ~77% lower
peak memory on large TS suites — no action needed at 23 files, worth revisiting as the
suite grows. Coverage stays opt-in (below); instrumentation slows every file, and the
fast TDD loop matters more day to day than default coverage numbers.

## Testing Conventions

**Assertion style:** `toBe` for primitives and status codes · `toEqual` for full response
JSON bodies · `toThrow` / `rejects.toThrow(/regex/)` for errors, including `client.ts`
throwing on a non-2xx MVola response · `expect.arrayContaining` /
`expect.objectContaining` for partial metadata. For custom errors, prefer this over
`try/catch/fail()` (`fail` is legacy and untyped under strict `@types/jest`):
```ts
expect(() => debitWallet(MSISDN, 100)).toThrow(InsufficientFundsError);
try {
  debitWallet(MSISDN, 100);
} catch (err) {
  expect(err).toBeInstanceOf(InsufficientFundsError);
  expect((err as InsufficientFundsError).balance).toBe(50);
}
```

**TDD loop:** write the failing test first, params wrapper and fetch mock included —
both fail loudly under `strict` TypeScript on a wrong shape, exactly the signal a
red-then-green loop should catch before the assertion runs. Run only the touched file
during the loop (`jest <path>`); full suite before calling a story done. With
`isolatedModules` off, a compile failure is as valid a red signal as a failing `expect`.

## Framework-Specific Guidelines

**Jest 30 / ts-jest 29 specifics:** the installed pairing (ts-jest 29.4 + Jest 30.3) is
officially supported (`jest: "^29.0.0 || ^30.0.0"` peer range). Jest 30 needs Node
`^18.14 || ^20 || ^22 || >=24` and TypeScript `>=5.4`; `package.json` pins only `^5` —
verify the resolved version satisfies this. The inline transform override
`tsconfig: { module: "commonjs", moduleResolution: "node" }` is necessary: ts-jest can't
execute `esnext`/`bundler` output under Jest's CommonJS runner, so test-time resolution
knowingly differs slightly from `next build`.

**ts-jest vs `next/jest` (SWC) — keep ts-jest, four reasons:**
1. TDD benefits from ts-jest's **real type-checking** during the run; `next/jest` uses
   SWC, which strips types without checking them — a wrong `params: Promise<{...}>`
   signature would only surface at `next build`, too late for a red-green loop.
2. The suite is almost entirely pure Node/TS logic with no CSS Modules, `next/font`, or
   `next/image` — exactly what `next/jest` exists to auto-configure, and none apply here.
3. Switching costs a full config rewrite for a startup-time win that matters mainly on
   large suites; at 23 files the loop is already fast.
4. Revisit only if the suite grows heavily into CSS-Module-based component testing.

**React Testing Library 16 / React 19:** import `act` from `@testing-library/react`, not
`react-dom/test-utils` (removed in React 19, throws on import). RTL 16 sets
`IS_REACT_ACT_ENVIRONMENT` automatically — no setup file entry needed. `user-event` v14
requires `setup()` over the legacy top-level API; pass
`{ advanceTimers: jest.advanceTimersByTime }` whenever fake timers are active, or its
delays hang. `@testing-library/jest-dom` v6: plain `import "@testing-library/jest-dom"`
is correct here (`/jest-globals` is only for `@jest/globals` consumers, unused here).

### Layer-boundary testing

`client.ts` **throws** on a non-2xx MVola response; the Route Handler above it **catches**
and returns a JSON error. Test both layers independently, not only the outermost one:

```ts
// client.ts layer — expects a thrown rejection
it("throws on a non-2xx MVola response", async () => {
  fetchSpy.mockResolvedValue(new Response("Bad Request", { status: 400 }));
  await expect(initiateDeposit({ msisdn: "0343500003", amount: 5000 }, "tok")).rejects.toThrow(/400/);
});

// Route Handler layer — expects a caught, converted JSON error
it("returns a JSON error when the client throws", async () => {
  jest.spyOn(mvolaClient, "initiateDeposit").mockRejectedValue(new Error("MVola 400"));
  const req = new NextRequest("http://localhost/api/mvola/deposit", {
    method: "POST",
    body: JSON.stringify({ msisdn: "0343500003", amount: 5000 }),
  });
  const response = await POST(req);
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: expect.any(String) });
});
```

### Recommended `jest.config.ts` improvements

The current config works; these are recommendations, not yet applied:
- **Drop the redundant `preset: "ts-jest"`** — the explicit `transform` block already wins
  and `testMatch`/`moduleNameMapper` are hand-specified, so the preset only adds noise.
- **Add `"/\\.next/"` to `testPathIgnorePatterns`** — harmless today only because
  `testMatch` is scoped to `__tests__`, but a latent footgun if that scoping changes.
- **Add opt-in coverage**, kept out of the default fast loop:
  `coverageProvider: "v8"` (not `"babel"` — this is a ts-jest pipeline, no Babel pass),
  `collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/__tests__/**", "!src/**/*.d.ts"]`,
  `coverageDirectory: "<rootDir>/coverage"`, plus a `"test:coverage": "jest --coverage"`
  script.
- **Add `@testing-library/dom` to `package.json` explicitly** — RTL 16's peer dependency,
  currently resolving only via a lockfile-only transitive install.
- **Consolidate the repeated `import "@testing-library/jest-dom"`**, inlined in every
  component test today, into a `jest.setup.ts` wired via `setupFilesAfterEach`.

## References

- https://jestjs.io/docs/30.0/upgrading-to-jest30 · /configuration · /ecmascript-modules
- https://kulshekhar.github.io/ts-jest/docs/getting-started/options/isolatedModules · /presets
- https://testing-library.com/docs/react-testing-library/api · /using-fake-timers
- https://kentcdodds.com/blog/fix-the-not-wrapped-in-act-warning
- `/guide-conventions` (`.claude/skills/guides/conventions/SKILL.md`) — house rules; wins on any conflict with this guide.
- This guide is used by `/expert-qa`, `/expert-backend`, and `/expert-frontend` for testing guidance.
