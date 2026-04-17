---
name: guide-tailwindcss
description: >
  Tailwind CSS 3+ best practices for mvola-prof. Utility-first conventions,
  responsive variants, dark mode, when to extract components, and form/button
  styling for the demo UI. Reference for any /expert-* skill writing or
  reviewing styles.
user-invocable: false
---

# Tailwind CSS Best Practices Guide (mvola-prof)

> Auto-generated from official documentation via context7 (`/tailwindlabs/tailwindcss.com`).
> Last researched: 2026-04-17
> Version in project: Tailwind CSS 3+

## Project Context

The PoC has one styled surface: the withdrawal form. Tailwind utility classes
are applied directly in `WithdrawForm.tsx`. No custom CSS files are expected
beyond the Tailwind base import in `src/app/globals.css` (or `app/layout.tsx`).

## Coding Conventions

### Class Order

Recommended order (matches Prettier `prettier-plugin-tailwindcss` if installed):
1. Layout (`flex`, `grid`, `block`)
2. Box model (`p-*`, `m-*`, `w-*`, `h-*`)
3. Visual (`bg-*`, `border-*`, `rounded-*`, `shadow-*`)
4. Typography (`text-*`, `font-*`)
5. Interactive states (`hover:*`, `focus:*`, `disabled:*`)
6. Responsive variants last (`sm:*`, `md:*`, `lg:*`)

```tsx
<button className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-300 sm:px-6">
  Withdraw
</button>
```

### Conditional Classes

Use template literals for simple cases; consider `clsx` only when conditions
proliferate.

```tsx
<button
  className={`rounded-md px-4 py-2 ${
    status === "submitting" ? "bg-gray-300" : "bg-blue-600 text-white"
  }`}
>
  Submit
</button>
```

### Don't Build Class Names Dynamically

Tailwind scans source files for **complete class strings**. Partial concatenation
breaks the JIT compiler.

```tsx
// BAD — Tailwind cannot detect `text-red-500` because it's never present as a string
const color = "red";
<div className={`text-${color}-500`} />

// GOOD — full class names appear in the source
<div className={status === "failed" ? "text-red-500" : "text-green-500"} />
```

## Patterns to Follow

### Form Layout

```tsx
<form className="mx-auto flex max-w-md flex-col gap-4 p-6">
  <label className="flex flex-col gap-1">
    <span className="text-sm font-medium text-gray-700">Amount (Ariary)</span>
    <input
      type="text"
      className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
    />
  </label>
  <button
    type="submit"
    className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
  >
    Withdraw
  </button>
</form>
```

### Status Indicator

Use distinct colors for each `Status` discriminant.

```tsx
{status === "pending" && (
  <p className="text-sm text-yellow-600">Pending — polling MVola…</p>
)}
{status === "completed" && (
  <p className="text-sm text-green-600">Withdrawal completed</p>
)}
{status === "failed" && (
  <p className="text-sm text-red-600">{error}</p>
)}
```

### Responsive

Mobile-first: base classes apply to all sizes; `sm:`, `md:`, `lg:` add
overrides at the relevant breakpoint.

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
  <input className="w-full sm:w-1/2" />
  <input className="w-full sm:w-1/2" />
</div>
```

### Focus States (Accessibility)

Always provide a visible focus ring on interactive elements. Use `focus:` or
`focus-visible:` variants — don't remove the outline without replacing it.

```tsx
<input className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none" />
```

## When to Extract a Component

Don't extract a CSS class for every repeated combination. Extract a **React
component** when the same styled element appears in multiple places.

```tsx
// GOOD — extract a React component
function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
    >
      {children}
    </button>
  );
}
```

For the PoC — the form is the only surface — inline utilities are fine.
Extract only if you find yourself copying the same long class string twice.

## Anti-Patterns to Avoid

### `@apply` for everything
- **What:** Pulling all utilities into custom CSS classes via `@apply`
- **Why bad:** Reintroduces the problem Tailwind solves (CSS file growth, naming bikeshed)
- **Instead:** Use utilities inline; extract React components for repetition

### Dynamic class string composition
- **What:** `` `text-${color}-500` ``
- **Why bad:** Tailwind's content scanner doesn't see the full class — purges it
- **Instead:** Map condition to a literal full class string

### Removing focus rings without replacement
- **What:** `focus:outline-none` with no `focus:ring-*` or `focus:border-*`
- **Why bad:** Breaks keyboard navigation accessibility
- **Instead:** Replace the default outline with a custom-styled focus ring

### Inline `style={{...}}` for what utilities cover
- **What:** `<div style={{ padding: "1rem" }} />`
- **Why bad:** Bypasses the design system; inconsistent spacing
- **Instead:** `<div className="p-4" />`

## Performance Best Practices

- Tailwind v3+ uses JIT — only classes used in your source are emitted to CSS
- The output CSS file is typically <10KB gzipped
- Don't inline `style={{}}` for animatable properties when a Tailwind transition utility (`transition-colors`) does the job

## Security Best Practices

- Tailwind has no runtime — no security surface beyond standard CSS
- Don't render user input as a class name (`className={userInput}`) — could enable styling injection

## Testing Conventions

- Don't assert on Tailwind class names in tests — they're implementation detail
- Use React Testing Library to query by role, label, or visible text instead
- Visual regression: optional — out of scope for the PoC

## Build & Tooling

- Tailwind config: `tailwind.config.ts` at project root
- Globals (`@tailwind base; @tailwind components; @tailwind utilities;`) in `src/app/globals.css`
- Imported once in `src/app/layout.tsx`
- Optional: `prettier-plugin-tailwindcss` for automatic class sorting

## References

- Official docs: https://tailwindcss.com/docs
- Utility-first thinking: https://tailwindcss.com/docs/styling-with-utility-classes
- Project: `src/components/WithdrawForm.tsx`

This guide is used by **/expert-frontend** for styling guidance.
