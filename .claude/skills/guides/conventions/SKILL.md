---
name: guide-conventions
description: >
  Project house rules for mvola-prof — code structure, naming, style, layering, money
  handling, and idempotency conventions specific to this codebase. The authoritative
  source of "how we write code here". Use whenever writing or reviewing code in this
  project.
user-invocable: false
paths:
  - "**/*"
---

# mvola-prof House Conventions

> Hand-authored project conventions, captured from the existing codebase and confirmed
> by the maintainer. These override generic language/framework defaults.
> When a generated guide or expert conflicts with this file, **this file wins**.
> Last updated: 2026-07-28

## Naming

- **TypeScript modules:** `camelCase.ts` — `client.ts`, `reconcile.ts`, `coinflip.ts`, `wallets.ts`.
- **React components:** `PascalCase.tsx`, one component per file, filename matches the component — `DepositForm.tsx` exports `DepositForm`.
- **Route Handlers:** always `route.ts` (App Router requirement). The folder path is the URL.
- **Test files:** `<subject>.test.ts` / `.test.tsx`, inside a `__tests__/` folder.
- **Types and interfaces:** `PascalCase`. MVola *wire* types carry the `MVola` prefix (`MVolaParty`, `MVolaToken`); internal *domain* types do not (`WalletState`, `TransactionRecord`, `GameSession`).
- **Status/state unions** are lowercase string literals, never enums:
  `type TransactionStatus = "pending" | "completed" | "failed"`.
- **Module constants:** `SCREAMING_SNAKE_CASE` at module scope (`SANDBOX_AUTO_COMPLETE_MS`).
- **Store accessors** are verb-first and say what they do to the store: `getWallet`, `ensureWallet`, `creditWallet`, `debitWallet`, `createTransaction`, `updateTransactionStatus`, `resetAll`.
- **Custom errors** end in `Error` and are classes: `InsufficientFundsError`.

## File & Folder Structure

- `src/app/api/**/route.ts` — HTTP boundary only. `src/lib/**` — all logic. `src/components/**` — UI.
- **`src/lib/**` is server-only.** It is never imported from a `"use client"` file. Anything reading `process.env` lives here.
- One responsibility per lib module. `src/lib/mvola/types.ts` is the **single source of truth** for both MVola payload shapes and domain types — types are not redeclared elsewhere.
- **Tests are co-located**: `src/lib/store/__tests__/wallets.test.ts` sits beside `src/lib/store/wallets.ts`; a route's test lives in `src/app/api/<path>/__tests__/route.test.ts`.
  - The legacy mirrored tree under `src/__tests__/**` is **deprecated**. Do not add files there; move them to the co-located position when you next touch them (`@/…` imports mean nothing else changes).
- Imports use the `@/*` alias (→ `src/*`) across folders, and relative paths (`./types`) only within the same folder.
- Type-only imports use `import type { … }`.

## Code Style

- 2-space indent, double quotes, semicolons, trailing commas in multi-line literals.
- **Every exported module opens with a `/** … */` header** stating its purpose *and naming the modules it delegates to*.
- **Every exported function carries JSDoc** with `@param`/`@returns`. Route Handlers document **every status code they can return**, one `@returns` line each.
- Inline `//` comments explain **why**, not what. Where a function implements a decision tree, number the guards and reproduce the truth table in the module header (see `src/lib/mvola/reconcile.ts`).
- **Named exports only** — for components and for lib modules alike. No default exports.

```ts
// Correct — named export, documented module, documented status codes
/**
 * MVola Deposit Endpoint — POST /api/mvola/deposit
 *
 * Delegates to getToken() (auth.ts), initiateDeposit() (client.ts) and
 * createTransaction() (store/transactions). Does NOT credit the wallet.
 */

/**
 * @returns 200 `{ correlationId, localTxId, status: "pending" }` on success.
 * @returns 400 `{ error: "amount must be a positive integer" }` if amount is invalid.
 * @returns 502 `{ error: "MVola API error", details }` on MVola failure.
 */
export async function POST(req: NextRequest): Promise<NextResponse> { … }

// Incorrect — default export, no module header, undocumented failure modes
export default async function handler(req) { … }
```

## Architectural Rules

- **Layering is one-directional:** Route Handler → `src/lib/**` → external HTTP. A route never calls MVola directly.
- **`src/lib/mvola/client.ts` is the only file that talks to the MVola API.** No other module issues an MVola HTTP request.
- **`src/lib/mvola/reconcile.ts` is the only place a wallet moves as a result of an MVola outcome.** Routes never call `creditWallet`/`debitWallet` for a settlement — they call `reconcileTransaction`.
- **Wallet mutation is idempotent by construction.** `reconcileTransaction` returns early once a record leaves `pending`, so the status poll and the webhook can both fire for the same transaction without double-crediting.
- **Store modules export typed accessors only.** The underlying `Map` is never exported or reachable from outside the module.
- **Every store module exports `resetAll()`** for test isolation.
- **`MVOLA_ENV` is read in exactly one place** — `client.ts::getBaseUrl()`. No other code branches on the environment; sandbox and production follow the same code path.
- **Route Handlers do three things:** validate the request body, translate errors to status codes, and delegate. Business rules live in `src/lib/**`.
- Pure logic (`src/lib/game/coinflip.ts`) takes its randomness as an injectable parameter defaulting to the real implementation — no I/O, no globals.

## Money

- **Integer Ariary everywhere** in the store, game, and route layers. No floats, no minor units, no `Number` with decimals.
- Conversion to MVola's string representation happens **only** at the `client.ts` boundary.
- Amounts are validated as positive integers at both edges: the route rejects with 400, and the store `throw`s (`assertPositiveInteger`) as a defence-in-depth invariant.

## Error Handling

- Domain violations are **custom Error classes** thrown by the store layer (`InsufficientFundsError` carries `balance` and `requested`).
- Routes **catch and translate**; they never let an exception escape.
- Route error responses use the shape `{ error: string, details?: string }`.
- Status-code convention:
  - `400` — missing or invalid input. Malformed JSON falls through to the *same* validation path rather than getting its own branch.
  - `409` — insufficient funds.
  - `502` — upstream MVola failure (token acquisition or transaction call).
- A transaction record is created **only after** MVola returns successfully — a failed MVola call leaves no local record.
- Never fail *open*: on an ambiguous or timed-out provider response, report **still pending**, never `completed` and never `failed`.

## Preferred & Banned

- **Prefer:** platform built-ins. Native `Map` for state, native `fetch` for HTTP, `crypto.getRandomValues` for randomness. The default answer to "which library?" is "none".
- **Prefer:** discriminated string-literal unions over enums; `unknown` + narrowing over `any`.
- **Avoid:** adding a runtime dependency. `uuid` is the only one, and new ones need a justification the platform cannot meet.
- **Avoid:** a database, an ORM, or any persistence layer — the PoC is deliberately in-memory (`docs/architecture/state-management.md`).
- **Banned:** default exports; reading `process.env` outside `src/lib/`; `NEXT_PUBLIC_` for anything MVola-related.

## Must / Never

- **Always** keep MVola credentials server-side. Never log `MVOLA_CONSUMER_KEY`, `MVOLA_CONSUMER_SECRET`, or an `access_token`.
- **Always** write the failing test first (red → green → refactor), and co-locate it.
- **Always** make a wallet mutation idempotent and route it through `reconcile.ts`.
- **Always** document every status code a Route Handler can return.
- **Never** commit `.env.local`.
- **Never** credit or debit a wallet from a Route Handler directly on an MVola outcome.
- **Never** expose a store's `Map`.
- **Never** branch on `MVOLA_ENV` outside `client.ts::getBaseUrl()`.
- **Never** present a locally-produced result as an MVola transaction — a simulated callback is a development aid only, never part of a demonstration (`docs/architecture/overview.md`).

## Known Deviations

Recorded so reviewers don't mistake them for the rule:

- `src/app/api/mvola/deposit/route.ts` branches on `MVOLA_ENV` to auto-complete sandbox deposits and synthesise an `MVL-SANDBOX-…` reference. This **violates** the `MVOLA_ENV` rule and the "no locally-produced payments" rule above. It is scheduled for removal by the `mvola-api-coverage` feature (epic 09) — do not copy the pattern, and do not add new `MVOLA_ENV` branches.
- `src/components/CashOutForm.tsx` still uses a default export. Convert it to a named export on the next touch.

## References

- `docs/architecture/folder-structure.md` — the directory tree and its own Conventions section
- `docs/architecture/_shared.md` — cross-cutting infra, message formats, MVola external API reference
- `docs/architecture/state-management.md` — store schemas and invariants
- `docs/architecture/configuration.md` — environment variables and secrets handling
- `src/lib/mvola/reconcile.ts` — the reference example for module-header documentation and guard numbering
- `CLAUDE.md` — repository-level instructions
