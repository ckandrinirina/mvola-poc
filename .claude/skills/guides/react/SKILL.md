---
name: guide-react
description: >
  React 19 best practices for mvola-prof. Client component patterns, the canonical
  polling loop with useEffectEvent and AbortController, async submit state, context,
  localStorage without hydration mismatch, and the 18 to 19 removals. Researched from
  official documentation. Reference for any /expert-* skill writing or reviewing React code.
user-invocable: false
paths:
  - "src/components/**/*.tsx"
  - "src/app/**/*.tsx"
---

<!-- ck-code:team GENERATED — /ck-code:team may overwrite this file on --regenerate. Delete this line to protect manual edits. -->

# React Best Practices Guide (mvola-prof)

> Auto-generated from official documentation.
> Last researched: 2026-07-28
> Version in project: React 19.2.4 (client components under Next.js 16 App Router)

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
- `PascalCase` component names and filenames (`DepositForm.tsx` exports `DepositForm`).
- Hooks start with `use` (`useMsisdnContext`, `useTransactionPolling`).
- **Named exports only** — this is a house rule in `/guide-conventions` and it wins on
  conflict with anything below. `CashOutForm.tsx` currently uses `export default
  function CashOutForm()`; that is a deviation from the rule, not a pattern to copy.

### File Organization
- One component per file under `src/components/`, `"use client"` at the top when the
  file uses state, effects, or context.
- Context + provider + consumer hook may live together in the owning component's file
  (see `WalletHeader.tsx`, which defines `MsisdnContext` and `useMsisdnContext`
  alongside the `WalletHeader` component) — do not split into a separate `context.ts`
  unless the provider grows past a single component's concerns.

### Code Style
- Type props with an inline destructured type or a named `<Component>Props` interface
  — both appear in the codebase; prefer the interface once a component has 3+ props.
- No `React.FC` — destructure props directly, type children as `ReactNode` explicitly.

## Patterns to Follow

### The Canonical Polling Pattern

Three components poll a terminal-state endpoint or a live value: `DepositForm` and
`CashOutForm` poll `/api/mvola/status/[correlationId]` until `completed`/`failed`;
`WalletHeader` polls `/api/wallet/[msisdn]/balance` on an interval. **None of the three
currently do this correctly** — see Anti-Patterns below. This is the target shape:

```tsx
import { useState, useEffect, useEffectEvent } from "react";

type Status = "idle" | "polling" | "completed" | "failed" | "timeout";

function useTransactionPolling(
  correlationId: string | null,
  { intervalMs = 3000, timeoutMs = 120_000 } = {}
) {
  const [status, setStatus] = useState<Status>("idle");

  // useEffectEvent (19.2): always reads the latest props/state WITHOUT being a
  // reactive dependency — no stale closures, and the effect never re-subscribes.
  const onTick = useEffectEvent(async (signal: AbortSignal) => {
    const res = await fetch(`/api/mvola/status/${correlationId}`, { signal });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const { transactionStatus } = await res.json();
    if (transactionStatus === "completed" || transactionStatus === "failed") {
      setStatus(transactionStatus);
    }
    return transactionStatus;
  });

  useEffect(() => {
    if (!correlationId) return;
    const controller = new AbortController();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const start = Date.now();
    setStatus("polling");

    const tick = async () => {
      try {
        const s = await onTick(controller.signal);
        if (cancelled) return;
        if (s === "completed" || s === "failed") return; // terminal — stop scheduling
        if (Date.now() - start > timeoutMs) { setStatus("timeout"); return; }
        timer = setTimeout(tick, intervalMs);
      } catch (err) {
        if (!cancelled && !controller.signal.aborted) setStatus("failed");
      }
    };
    timer = setTimeout(tick, intervalMs);

    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [correlationId, timeoutMs]);

  return status;
}
```

Why this exact shape, design choice by design choice:
- **Recursive `setTimeout`, not `setInterval`.** `setInterval` keeps firing even while
  the previous fetch is in flight — request pile-up on a slow network, and an older
  response can resolve after a newer one and roll the UI backward. The recursive
  `setTimeout` only schedules the next tick after the current one settles.
- **`useEffectEvent`** replaces the old "ref mirrors the latest callback" hack. It
  reads the current `correlationId` on every tick without being a dependency of the
  effect, so the effect (and its timer) is never torn down and rebuilt on an unrelated
  re-render. Pre-19.2 fallback: `const ref = useRef(onTick); useEffect(() => {
  ref.current = onTick; });`
- **`AbortController`** cancels the in-flight fetch on unmount or when `correlationId`
  changes — no setState-after-unmount warning, no stale response clobbering fresher
  state.
- **Terminal states just stop scheduling.** There is no separate "should I still poll"
  boolean to keep in sync — returning from `tick` without calling `setTimeout` again is
  the only signal needed.
- **`AbortError` is discriminated from a real failure.** The `catch` block checks
  `controller.signal.aborted` before flipping to `"failed"` — an abort caused by your
  own cleanup must never be reported as a transaction failure.
- **A timeout ceiling exists.** `Date.now() - start > timeoutMs` bounds the loop; a
  transaction that never reaches a terminal state stops polling instead of running
  forever.

**`DepositForm.tsx` (lines 15–47) uses a raw `setInterval`, no `AbortController`, and
no timeout ceiling** — confirmed by reading the file:

```tsx
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
intervalRef.current = setInterval(async () => {
  const res = await fetch(`/api/mvola/status/${id}`);
  // ...
}, 3000);
```

`CashOutForm.tsx` (lines 25, 44–55) has the identical gap. Upgrade path for both: delete
the `intervalRef` state, replace `startPolling`/`stopPolling` with the
`useTransactionPolling` hook above, and drive rendering off its returned `status`
instead of the local `DepositStatus`/`TransactionStatus` state.

### Async Submit — Plain `useState` Beats `useActionState` Here

`useActionState` and `useFormStatus` are built for `<form action={serverAction}>` —
a **Server Action**. This project POSTs to a **REST Route Handler**
(`/api/mvola/deposit`, `/api/mvola/withdraw`) from a client component, so
`useFormStatus` would report nothing useful (there is no enclosing action to track).
Use plain state, optionally `useTransition` for `isPending` (React 19: it accepts an
async function):

```tsx
const [isPending, startTransition] = useTransition();

function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  startTransition(async () => {
    try {
      const res = await fetch("/api/mvola/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msisdn, amount: Number(amount) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");
      setCorrelationId((await res.json()).correlationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  });
}
```

`useOptimistic` fits `CoinFlipGame.handleFlip` well (show the flip result immediately,
reconcile once `/api/game/coinflip` resolves) — but it **must** be called inside
`startTransition`, or React warns.

### Context (MsisdnContext)

`WalletHeader.tsx` defines `MsisdnContext`, `useMsisdnContext`, and the
`WalletHeader` component together, and mounts the provider once wrapping
`TabbedLayout`'s children. Keep it that way — one provider instance, not one per tab,
or each tab gets its own MSISDN:

```tsx
const value = useMemo(() => ({ msisdn, setMsisdn, balance, refreshBalance }), [msisdn, setMsisdn, balance, refreshBalance]);
return <MsisdnContext.Provider value={value}>{children}</MsisdnContext.Provider>;
```

- The consuming hook throws when used outside the provider (already true of
  `useMsisdnContext` — keep that guard on any new context).
- Keep `useMemo` on the context value **even with the React Compiler on** — the
  compiler memoizes a component's own computations, not the context-consumer skip that
  a stable value object enables.
- `WalletHeader`'s current `contextValue` object (lines 78–83) is rebuilt every render
  without `useMemo` — every consumer of `useMsisdnContext` re-renders on every
  `WalletHeader` render. Wrap it in `useMemo` per the snippet above.

### `localStorage` Without Hydration Mismatch

**Never** read `localStorage` in the render body or as a `useState` lazy initializer —
that runs during SSR/prerender and throws or produces a real mismatch. `WalletHeader`
already uses the correct mounted-gate shape (SSR-safe `useState("")`, then read in a
mount-only effect):

```tsx
const [msisdn, setMsisdnState] = useState("");            // SSR-safe default
useEffect(() => {
  const saved = localStorage.getItem(MSISDN_KEY);
  if (saved) setMsisdnState(saved);
}, []);
```

Prefer `useSyncExternalStore` if cross-tab sync becomes a requirement (the `storage`
event only fires in **other** tabs — invoke the callback manually after your own
`setItem` if same-tab reactivity across two mounted instances is also needed):

```tsx
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const getSnapshot = () => localStorage.getItem(MSISDN_KEY) ?? "";
const getServerSnapshot = () => "";                        // must match the server render
export const useStoredMsisdn = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
```

## Anti-Patterns to Avoid

- **WRONG** (`DepositForm.tsx`, `CashOutForm.tsx`):
  ```tsx
  intervalRef.current = setInterval(async () => {
    const res = await fetch(`/api/mvola/status/${id}`);
    // ...
  }, 3000);
  ```
  → **RIGHT:** the recursive `setTimeout` + `AbortController` + `useEffectEvent` loop in
  `useTransactionPolling` above.
  → **WHY:** `setInterval` piles up overlapping requests on a slow network and has no
  request-cancellation story; a stale response can resolve after a fresher one and roll
  the UI backward. There is also no timeout ceiling, so a transaction that never
  reaches a terminal state polls forever.

- **WRONG** (`CashOutForm.tsx`, lines 27–32):
  ```tsx
  useEffect(() => {
    if (!loading && transactionStatus === null) {
      setAmount(balance);
    }
  }, [balance, loading, transactionStatus]);
  ```
  → **RIGHT:** derive the default during render, or reset only on an explicit user
  action (e.g. a "reset" button), not via an effect watching the prop.
  → **WHY:** this is the "adjusting state when a prop changes" anti-pattern — an extra
  render where `amount` and `balance` are briefly desynced, plus an effect that fires
  on every unrelated `loading`/`transactionStatus` change.

- **WRONG:** `useEffect(() => { if (submitted) fetch("/api/mvola/deposit", …); }, [submitted, form])`
  → **RIGHT:** call `fetch` directly inside the `onSubmit` handler (see `DepositForm.handleSubmit`).
  → **WHY:** the POST is caused by a user event, not by the component being displayed.
  Effects are for synchronizing with external systems; an effect-triggered POST also
  re-fires on any stray dependency change and again on the StrictMode dev remount.

- **WRONG:** `forwardRef((props, ref) => …)` in new code.
  → **RIGHT:** destructure `ref` as a plain prop — `function AmountInput({ value, ref }: Props)`.
  → **WHY:** `forwardRef` is legacy in React 19; keeping both idioms fragments the codebase.

- **WRONG:** `useRef()` with no argument.
  → **RIGHT:** `useRef<HTMLInputElement>(null)`.
  → **WHY:** `@types/react` 19 removed the zero-arg overload — this is now a compile
  error, not a lint warning. Codemod: `types-react-codemod` `refobject-defaults`.

- **WRONG:** `useState(() => localStorage.getItem("msisdn"))`.
  → **RIGHT:** SSR-safe default + mount-only effect, or `useSyncExternalStore`.
  → **WHY:** the lazy initializer runs during the server render pass, where
  `localStorage` does not exist — this throws, it does not silently return `null`.

## Performance Best Practices

- Enable the React Compiler (see below) to auto-memoize form and game render logic;
  keep `useMemo` on the `MsisdnContext` value regardless — the compiler memoizes a
  component's own computations, not a context provider's referential stability.
- Prefer the recursive `setTimeout` loop over `setInterval` everywhere a fetch is on
  the other end, to avoid overlapping in-flight requests.
- If `TransactionHistory` grows a row-expansion feature, cache each row's detail fetch
  in the row's own state so collapse/expand doesn't re-fetch, and abort the fetch if
  the row collapses before it resolves.
- Don't flip a poll to `"failed"` after one bad tick — transient network blips
  shouldn't fail a deposit that is still settling server-side; let the timeout bound it
  instead (see `useTransactionPolling`).

## Security Best Practices

- Never read `MVOLA_CONSUMER_KEY` / `MVOLA_CONSUMER_SECRET` (or anything
  `NEXT_PUBLIC_`-adjacent) inside a `"use client"` file — those values must stay inside
  `src/lib/mvola/`, called only from Route Handlers.
- Never render unsanitized HTML (`dangerouslySetInnerHTML`) — MSISDN, amounts, and
  MVola references are always rendered as text.
- Treat the MSISDN in `localStorage` as non-sensitive UX convenience state, not a
  credential — it is a phone number the user already typed, not a secret.

## Testing Conventions

- `act` comes from `react` / `@testing-library/react`, **never**
  `react-dom/test-utils` — that entry point is removed in React 19 and throws.
- RTL wraps `render` / `fireEvent` / `user-event` in `act` already; prefer
  `await screen.findBy*` / `waitFor` over a manual `act` call.
- In React 19, `act()` always returns a promise — `await act(async () => { … })`.
- Testing the polling hook with fake timers:
  ```tsx
  jest.useFakeTimers();
  render(<DepositForm />);
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(await screen.findByText(/pending/i)).toBeInTheDocument();
  ```
  Prefer `jest.advanceTimersByTimeAsync` when a tick itself awaits a `fetch` — it
  flushes microtasks between callbacks, whereas the sync variant can leave a pending
  promise unresolved.
- Pass `userEvent.setup({ advanceTimers: jest.advanceTimersByTime })` whenever a test
  uses fake timers together with `user-event`.

## Framework-Specific Guidelines

### React 18 → 19 removals (not deprecations)
`propTypes`, `defaultProps` on function components, string refs, `ReactDOM.render`,
and `ReactDOM.hydrate` are **removed**, not deprecated — `defaultProps` on a function
component is now silently ignored. Use TypeScript default parameters instead of
`defaultProps`.

### `ref` is a plain prop
`element.ref` is deprecated in favour of `element.props.ref`; new components should
destructure `ref` directly rather than wrap in `forwardRef` (see Anti-Patterns).

### `useRef()` requires an argument
Bare `useRef()` is a compile error under `@types/react` 19 — always pass an initial
value, e.g. `useRef<HTMLInputElement>(null)`.

### The new JSX transform is mandatory
`"jsx": "react-jsx"` must be set in `tsconfig.json` — Next.js 16 defaults this
correctly, so this should never need manual attention in this project, but verify it
if a `tsconfig.json` edit ever touches `compilerOptions.jsx`.

### `useActionState` / `useFormStatus` are the wrong tool here
Both are part of the Actions API and expect a `<form action={fn}>` bound to a Server
Action. Every mutating call in this project is a REST POST to a Route Handler from a
client component (`fetch("/api/mvola/deposit", …)`), so there is no action for
`useFormStatus` to observe. Use plain `useState` + `useTransition` instead (see Async
Submit above).

### React Compiler
Stable (1.0, Oct 2025) but **opt-in** — enable via `reactCompiler: true` in
`next.config.ts`, and run `eslint-plugin-react-compiler` first to catch violations
before turning it on. Manual memoization is still required for: the `MsisdnContext`
provider value, any dependency crossing a non-compiled module boundary, and anything
relying on referential stability inside a `useEffect` dependency array (e.g. the
polling hook's `onTick`). Let the compiler subsume memoization inside render logic —
row filtering in `TransactionHistory`, computed `className` strings in
`DepositForm`/`CashOutForm`.

### Error boundaries
Error boundaries still require **class components** in React 19 — there is no
function-component API for them. If one is added, wrap each `TabbedLayout` tab's
content individually so one tab's crash doesn't blank the whole page.

## References

- https://react.dev/blog/2025/10/01/react-19-2 (useEffectEvent, Activity)
- https://react.dev/blog/2024/04/25/react-19-upgrade-guide
- https://react.dev/blog/2025/10/07/react-compiler-1
- https://react.dev/learn/you-might-not-need-an-effect
- https://react.dev/reference/react/useSyncExternalStore
- https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler
- https://nextjs.org/docs/messages/react-hydration-error
- Project: `src/components/DepositForm.tsx`, `src/components/CashOutForm.tsx`,
  `src/components/WalletHeader.tsx`, `docs/architecture/features/mvola-core-library/index.md`

This guide is used by **/expert-frontend** for React-specific guidance.
