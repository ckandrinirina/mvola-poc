---
name: guide-react
description: >
  React 18+ best practices for mvola-prof. Client component patterns,
  useState/useEffect for the polling loop, controlled inputs, async submit
  with error/loading states, and effect cleanup. Reference for any /expert-*
  skill writing or reviewing React code.
user-invocable: false
---

# React Best Practices Guide (mvola-prof)

> Auto-generated from official documentation via context7 (`/reactjs/react.dev`).
> Last researched: 2026-04-17
> Version in project: React 18+

## Project Context

The only React component the PoC needs is `src/components/WithdrawForm.tsx` —
a Client Component that captures input, POSTs to `/api/mvola/withdraw`, and
polls `/api/mvola/status/[correlationId]` every 3 seconds until the
transaction reaches a terminal status.

## Coding Conventions

### Component Naming
- `PascalCase` filenames and component names: `WithdrawForm.tsx` exports `WithdrawForm`
- One default-exported component per file
- Co-locate small subcomponents only used by the parent in the same file

### Hook Rules
- Hooks called at the top level of the component (no conditionals, loops, or nested functions)
- Hooks named `useXxx` only inside Client Components or other hooks
- Don't read hooks inside event handlers (use refs/state instead)

### Props Typing
- Define props as a TypeScript `interface` named `<Component>Props`
- Prefer explicit prop types over inline destructuring types

```tsx
interface WithdrawFormProps {
  defaultAmount?: string;
}

export function WithdrawForm({ defaultAmount = "" }: WithdrawFormProps) { ... }
```

## Patterns to Follow

### Controlled Form with Status State

Model the form's lifecycle as discrete states. Disable inputs/buttons based on state.

```tsx
"use client";
import { useState } from "react";

type Status = "idle" | "submitting" | "pending" | "completed" | "failed";

export function WithdrawForm() {
  const [amount, setAmount] = useState("");
  const [msisdn, setMsisdn] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/mvola/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, playerMsisdn: msisdn }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      // ... start polling
      setStatus("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="amount">Amount (Ariary)</label>
      <input
        id="amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={status === "submitting" || status === "pending"}
      />
      <button
        type="submit"
        disabled={!amount || !msisdn || status !== "idle"}
      >
        Withdraw
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

### Effect with Cleanup (the polling loop)

**Always return a cleanup function from `useEffect` that clears any timers,
subscriptions, or connections.** This is the most common React bug.

```tsx
import { useEffect, useRef } from "react";

useEffect(() => {
  if (!correlationId || status === "completed" || status === "failed") return;
  const id = setInterval(async () => {
    const res = await fetch(`/api/mvola/status/${correlationId}`);
    const json = await res.json();
    if (json.transactionStatus === "completed") setStatus("completed");
    else if (json.transactionStatus === "failed") setStatus("failed");
  }, 3000);
  return () => clearInterval(id); // Cleanup on unmount or dep change
}, [correlationId, status]);
```

### Async in Effects

`useEffect` callbacks **cannot be async** directly. Define an inner async function
or use an IIFE.

```tsx
// GOOD
useEffect(() => {
  let cancelled = false;
  (async () => {
    const data = await fetch("/api/something");
    if (!cancelled) setState(await data.json());
  })();
  return () => { cancelled = true; };
}, []);

// BAD
useEffect(async () => { ... }, []); // ❌ TypeScript will error
```

### Avoid Stale Closures

If your effect callback reads state, list it in deps. If you need the latest value
without re-running the effect, use a `ref`.

```tsx
const statusRef = useRef(status);
useEffect(() => { statusRef.current = status; }, [status]);
```

## Anti-Patterns to Avoid

### Forgetting to clean up timers/subscriptions
- **What:** `useEffect(() => { setInterval(...); }, [])` with no return
- **Why bad:** Timer keeps firing after unmount → memory leak, network calls on a dead component
- **Instead:** Always `return () => clearInterval(id)`

### Mutating state directly
- **What:** `state.items.push(x)` then `setState(state)`
- **Why bad:** React won't re-render; equality check passes
- **Instead:** `setState({ ...state, items: [...state.items, x] })`

### Reading `process.env.MVOLA_*` in a Client Component
- **What:** Any reference to MVola env vars in a `"use client"` file
- **Why bad:** Either inlined into the browser bundle (if `NEXT_PUBLIC_*`) or undefined
- **Instead:** Client talks to `/api/mvola/*` routes only — credentials never leave the server

### Conditional hooks
- **What:** `if (loaded) { useState(...) }`
- **Why bad:** Breaks the rules of hooks; React tracks hooks by call order
- **Instead:** Always call hooks at the top level

### Heavy work in render
- **What:** Calling `JSON.parse(huge)` or sorting a 10k-item array on every render
- **Why bad:** Janky UI, wasted CPU
- **Instead:** `useMemo` only when the work is measurable, or precompute outside the component

## Performance Best Practices

- Most PoC components don't need `useMemo`/`useCallback` — premature optimization
- Use `key` props on list items (stable IDs, not array indexes when items reorder)
- Lazy-load heavy components with `React.lazy` if needed (not needed for this PoC)

## Security Best Practices

- **Never render unsanitized HTML** — avoid `dangerouslySetInnerHTML`
- **Don't put secrets into the React tree** — even via props (they end up in the bundle)
- **Always render the user's MSISDN as text**, not as HTML

## Testing Conventions

- Use React Testing Library (when test infra is added)
- Test from the user's perspective — query by role, label text, not by class names
- Mock `fetch` at the network boundary

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

it("disables submit when fields are empty", () => {
  render(<WithdrawForm />);
  expect(screen.getByRole("button", { name: /withdraw/i })).toBeDisabled();
});
```

## Framework-Specific Guidelines

### Server vs. Client Components
- This project uses Next.js App Router. See `/guide-nextjs` for the boundary rules.
- Most React knowledge transfers; the difference is where the component runs.

### React 18 vs. React 19
- The project targets React 18+. React 19 added `useTransition` for actions and
  the `<form action={fn}>` pattern. PoC scope keeps the manual `useState` pattern
  shown above for clarity.

## References

- Official docs: https://react.dev
- Effects & cleanup: https://react.dev/learn/synchronizing-with-effects
- Form state: https://react.dev/learn/reacting-to-input-with-state
- Project: `src/components/WithdrawForm.tsx`, `docs/architecture/components.md`

This guide is used by **/expert-frontend** for React-specific guidance.
