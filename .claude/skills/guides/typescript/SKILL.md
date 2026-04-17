---
name: guide-typescript
description: >
  TypeScript 5+ best practices and coding standards for mvola-prof. Strict
  mode conventions, type vs. interface, discriminated unions, narrowing,
  unknown over any, and project-specific guidelines. Reference for any
  /expert-* skill writing or reviewing TypeScript code.
user-invocable: false
---

# TypeScript Best Practices Guide (mvola-prof)

> Auto-generated from official documentation via context7.
> Last researched: 2026-04-17
> Version in project: TypeScript 5+

## Project Context

mvola-prof is a Next.js 14+ App Router project. Every file under `src/` is
TypeScript. Strict mode is on. Server code (`src/lib/mvola/`, `src/app/api/`)
runs on Node.js 18+; client code (`src/components/`, `"use client"` files)
runs in the browser.

## Coding Conventions

### Naming
- **Variables, functions:** `camelCase` — `getToken`, `cachedToken`, `correlationId`
- **Types and interfaces:** `PascalCase` — `MVolaToken`, `WithdrawalRequest`, `TransactionResponse`
- **Type parameters:** `T`, `U`, or descriptive `TPayload`, `TResponse`
- **Constants:** `SCREAMING_SNAKE_CASE` only for module-level true constants — `REFRESH_BUFFER_MS = 60_000`
- **Files:** `camelCase.ts` for modules (`auth.ts`, `client.ts`); `PascalCase.tsx` for React components (`WithdrawForm.tsx`)
- **Booleans:** prefix with `is`, `has`, `should` — `isTokenValid`, `hasExpired`

### File Organization
- One module per file; one default-exported React component per `.tsx` file
- Co-locate types with the domain (`src/lib/mvola/types.ts` for all MVola payload types)
- Import order: Node built-ins → third-party → `@/` aliases → relative
- Use the `@/` path alias (configured in `tsconfig.json`) for `src/` imports — `import { getToken } from "@/lib/mvola/auth"`

### Code Style
- Prettier-formatted (semicolons, double quotes, trailing commas)
- 2-space indentation
- Max line length 100 (Prettier default 80; project uses 100)
- Doc comments (`/** ... */`) only on exported functions when behavior isn't obvious from the signature

## Patterns to Follow

### `interface` vs. `type`

**Use `interface` for object shapes that may be extended:**
```ts
export interface WithdrawalRequest {
  amount: string;
  playerMsisdn: string;
  description?: string;
}
```

**Use `type` for unions, intersections, mapped types, and primitives:**
```ts
export type TransactionStatus = "pending" | "completed" | "failed";
export type WithdrawalResult = SuccessResult | ErrorResult;
```

### Discriminated Unions for Status

Model finite states as a discriminated union with a literal `kind`/`status` tag.
TypeScript narrows automatically inside `switch`/`if` branches.

```ts
type WithdrawalState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "pending"; correlationId: string }
  | { status: "completed"; correlationId: string; reference: string }
  | { status: "failed"; error: string };

function describe(s: WithdrawalState): string {
  switch (s.status) {
    case "idle":       return "Ready";
    case "submitting": return "Sending…";
    case "pending":    return `Waiting on ${s.correlationId}`;
    case "completed":  return `Done — ${s.reference}`;
    case "failed":     return `Failed: ${s.error}`;
  }
}
```

### `unknown` over `any`

Untrusted input (parsed JSON, third-party responses) is `unknown`. Narrow before use.

```ts
async function parseWithdrawBody(req: Request): Promise<WithdrawalRequest> {
  const raw: unknown = await req.json();
  if (
    typeof raw !== "object" || raw === null ||
    typeof (raw as any).amount !== "string" ||
    typeof (raw as any).playerMsisdn !== "string"
  ) {
    throw new Error("Invalid body");
  }
  return raw as WithdrawalRequest;
}
```

(For larger projects, prefer `zod` for runtime validation. PoC scope here.)

### Error Narrowing

`catch (err)` gives you `unknown` in strict mode. Always narrow before using.

```ts
try {
  await getToken();
} catch (err) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return Response.json({ error: message }, { status: 502 });
}
```

### Async/Await Everywhere

```ts
// GOOD
const token = await getToken();
const result = await initiateWithdrawal(token, body);

// AVOID
return getToken().then(token => initiateWithdrawal(token, body));
```

### Optional Chaining + Nullish Coalescing

```ts
const description = body.description ?? "Game withdrawal";
const reference = response?.transactionReference ?? "n/a";
```

## Anti-Patterns to Avoid

### `any`
- **What:** Disables all type checking
- **Why bad:** Defeats TypeScript's purpose; bugs sneak in
- **Instead:** `unknown` + narrowing, or define the proper type

### Type assertions to bypass errors
```ts
// BAD
const token = (response as any).access_token;

// GOOD — declare the response type
interface TokenResponse { access_token: string; expires_in: number; }
const token = (response as TokenResponse).access_token;
// EVEN BETTER — validate the shape before asserting
```

### Non-null assertion (`!`) outside test code
```ts
// BAD in production code
const key = process.env.MVOLA_CONSUMER_KEY!;

// GOOD
const key = process.env.MVOLA_CONSUMER_KEY;
if (!key) throw new Error("MVOLA_CONSUMER_KEY not set");
```

### Mixing `interface` and `type` for the same shape
- Pick one per shape. Project convention: `interface` for object shapes, `type` for unions/aliases.

## Performance Best Practices

- Avoid recomputing in render — use `useMemo` only when measurably needed (PoC: rarely needed)
- Don't allocate types at runtime (types disappear at compile time — they have no perf impact, but importing huge type-only modules slows the type checker)
- Use `import type { … }` for type-only imports to keep them out of the JS output:
  ```ts
  import type { MVolaToken } from "./types";
  ```

## Security Best Practices

- **Never type secrets as a public field** — keep credential env-var access in server-only modules (`src/lib/mvola/`)
- **Validate at boundaries** — every `request.json()` returns `unknown`; narrow before trusting
- **Don't `JSON.stringify` objects that contain secrets** for logging — log specific safe fields only

## Testing Conventions

- Test files: `*.test.ts` next to the source
- Use Vitest (when test infra is added) — native TS, no Babel needed
- Type test factories explicitly:
  ```ts
  function buildWithdrawBody(overrides: Partial<WithdrawalRequest> = {}): WithdrawalRequest {
    return { amount: "1000", playerMsisdn: "0343500003", ...overrides };
  }
  ```

## Build & Tooling

- `npx tsc --noEmit` — typecheck without emit (CI step)
- `next build` — Next.js compiles TS via SWC (fast, no separate `tsc` step at build time)
- ESLint with `@typescript-eslint` rules (default in Next.js)
- Prettier for formatting

## References

- Official docs: https://www.typescriptlang.org/docs/
- Handbook narrowing: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- Project: `tsconfig.json`, `docs/architecture/tech-stack.md`

This guide is used by **/expert-frontend**, **/expert-backend**, **/expert-qa**, and **/expert-analyst** for TypeScript-specific guidance.
