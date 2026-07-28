---
name: guide-tailwindcss
description: >
  Tailwind CSS v4 best practices for mvola-prof. CSS-first configuration with @theme,
  the renamed and removed v3 utilities, automatic class detection and why dynamic class
  names fail, component extraction over @apply, dark mode, and form styling. Researched
  from official documentation. Reference for any /expert-* skill writing or reviewing styles.
user-invocable: false
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
  - "postcss.config.mjs"
---

<!-- ck-code:team GENERATED — /ck-code:team may overwrite this file on --regenerate. Delete this line to protect manual edits. -->

# Tailwind CSS Best Practices Guide (mvola-prof)

> Auto-generated from official documentation.
> Last researched: 2026-07-28
> Version in project: Tailwind CSS v4 via @tailwindcss/postcss (CSS-first, no tailwind.config.js)

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

## The v3 → v4 shift, unmistakably

This project is on Tailwind CSS **v4**, not v3. The single most important fact: **there is
no `tailwind.config.js`/`.ts` anywhere in this repo** (verified) — configuration is
CSS-first. `src/app/globals.css` is one line, `@import "tailwindcss";`, replacing the three
v3 directives `@tailwind base; @tailwind components; @tailwind utilities;`. `postcss.config.mjs`
contains only `{ "@tailwindcss/postcss": {} }` — no `postcss-import`/`autoprefixer`, both
handled internally now. Design tokens (colors, fonts, spacing, breakpoints) live in `@theme`
blocks in CSS, not a JS config object; a legacy JS config is inert unless explicitly loaded
via `@config "../../tailwind.config.js";`, which this project does not do. `corePlugins`,
`safelist`, and `separator` config keys from v3 **do not exist** in v4 at all.

## Coding Conventions

### Naming
- Default scale names (`gray-200`, `green-600`) unless a custom semantic token is defined
  in `@theme` (e.g. `--color-status-pending`); custom tokens stay kebab-case after the
  namespace prefix — `--color-status-pending`, not `--color-statusPending`.

### File Organization
- Keep `src/app/globals.css` as the single global stylesheet. Per-component CSS Modules
  don't inherit the `@theme` scope automatically and multiply Tailwind invocations (see
  Performance). All `@theme`, `@custom-variant`, and `@utility` declarations live in
  `globals.css`, grouped after the `@import "tailwindcss";` line.

### Code Style
- Order classes by category (layout → spacing → typography → color → state); there's no
  Prettier Tailwind plugin configured, so consistency is manual — follow the ordering
  already used in `DepositForm.tsx` and `TransactionHistory.tsx`.
- Prefer full literal class strings in JSX even when repetitive across branches — Oxide's
  scanner needs to see them (see Static Class Detection below).

## Patterns to Follow

### Design tokens via `@theme`
Any variable declared in the right namespace generates both a matching utility class and a
real CSS custom property — one definition, both worlds:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-brand-500: oklch(0.58 0.18 250);
  --color-status-pending:   oklch(0.75 0.15 80);
  --color-status-completed: oklch(0.65 0.17 145);
  --color-status-failed:    oklch(0.58 0.22 25);
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --spacing: 0.25rem;
}
```
```html
<div class="bg-brand-500">…</div>
<div style="background-color: var(--color-brand-500)">…</div>
```

Namespace prefixes matter — the wrong one silently produces a CSS variable with **no**
matching utility: `--color-*` (colors) · `--font-*` (families) · `--text-*` (font sizes) ·
`--spacing` (singular, the spacing base) · `--breakpoint-*` · `--ease-*` · `--radius-*`.

### Static class detection (the `Record<TransactionStatus, string>` case)
Oxide does **static text scanning** of source files; it cannot evaluate template literals
or string concatenation. Every class variant that should exist in the compiled CSS must
appear as a complete literal string somewhere in a scanned file. This project already has
the exact shape that trips this rule: `TransactionStatus` in `src/lib/mvola/types.ts` is
`"pending" | "completed" | "failed"`, and `TransactionHistory.tsx` renders a status chip
from it via a `STATUS_CLASSES` lookup map:

```tsx
// RIGHT — TransactionHistory.tsx already does this: a lookup map of full class
// strings is statically detectable. (Its current type is Record<string, string>;
// tightening it to Record<TransactionStatus, string> adds exhaustiveness checking
// for free without changing the runtime behavior.)
const STATUS_CLASSES: Record<TransactionStatus, string> = {
  completed: "px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800",
  pending:   "px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800",
  failed:    "px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800",
};
<span className={STATUS_CLASSES[status]}>{status}</span>

// WRONG — never generated, no literal class string exists anywhere to scan
<span className={`bg-${status}-100 text-${status}-800`}>{status}</span>
```

### Composition: component > `@utility` > `@apply`
- **React component** for anything with structure or behavior — a `<StatusChip status>` or
  `<TabButton active>` like the ones already in `TransactionHistory.tsx`; prefer it over
  CSS-level tricks.
- **`@utility`** only for a pure CSS-level primitive with no markup of its own:
  ```css
  @utility status-badge {
    display: inline-flex;
    border-radius: var(--radius-full);
    padding-inline: --spacing(3);
    font-size: var(--text-xs);
  }
  ```
- **`@apply` is discouraged** as a default composition tool — a v3-tutorial habit, not the
  v4-recommended path. Reserve it for overriding a third-party component's own selectors
  from an isolated stylesheet (needs `@reference "../globals.css";` there, since it doesn't
  inherit the `@theme` scope); it re-resolves theme values per context and composes worse
  with variants than `@utility` does.

### Dark mode
Default `dark:` follows `prefers-color-scheme`. For a user-toggleable theme:
```css
@custom-variant dark (&:where(.dark, .dark *));
```
then toggle the `.dark` class on `<html>` client-side. This one line fully replaces v3's
`darkMode: 'class'` config key — there is no `darkMode` config key in v4 at all.

### Arbitrary values, `--spacing()`, and `aria-*`/`data-*` variants for forms
```html
<div class="top-[117px]">                 <!-- arbitrary value -->
<div class="[mask-type:luminance]">        <!-- arbitrary property -->
<div class="gap-(--my-gap)">               <!-- CSS variable shorthand -->
<div class="py-[calc(--spacing(4)-1px)]">  <!-- --spacing() is a function, combinable with calc() -->
<input class="border border-gray-300 focus-visible:outline-2 focus-visible:outline-brand-500
              disabled:opacity-50 disabled:cursor-not-allowed" />
<button aria-busy="true" class="aria-busy:opacity-75" />
<div data-state="expanded" class="data-[state=expanded]:max-h-none data-[state=collapsed]:max-h-0" />
```
`--spacing()` is backed by the `--spacing` theme variable, so any multiple can be computed on
the fly — prefer it over raw pixel arbitrary values when the value is a spacing multiple.
`aria-*`/`data-*` variants need no config and are the right tool for the disabled/busy states
this project's forms already need (`DepositForm.tsx`, `CashOutForm.tsx` both disable submit
while `!msisdn`): bare form for boolean ARIA states (`aria-busy:`), arbitrary-value form for
one-offs (`aria-[sort=ascending]`).

## Anti-Patterns to Avoid

### Trusting v3-era classes to still mean the same thing
`DepositForm.tsx` uses `shadow-sm` on its form wrapper, `border border-gray-200` / `border
border-gray-300` on the form and input, and `focus:outline-none focus:ring-2
focus:ring-blue-500` on the input. These render correctly today (the borders carry an
explicit color, the ring replaces the suppressed outline) — but every one of these names
changed meaning in v4, and pasting v3 snippets from memory or tutorials silently changes
rendered output going forward:

| v3 | v4 | Note |
|---|---|---|
| `shadow-sm` | `shadow-xs` | the scale gained an `-xs` step; the new `shadow-sm` is different |
| `outline-none` | `outline-hidden` | `outline-none` now literally means `outline-style: none` |
| `ring` (3px, blue-500) | `ring-3` for the old width | default ring is now **1px** and **`currentColor`** |
| `bg-opacity-50` | `bg-blue-500/50` | `bg-opacity-*` / `text-opacity-*` / `ring-opacity-*` **removed** |
| bare `border` → gray-200 | bare `border` → **`currentColor`** | every `border`/`divide-*` needs an explicit color |
| placeholder → gray-400 | `currentColor` at 50% opacity | forms shift visually unless handled |
| `space-y-*` sibling selector | `:not(:last-child)` | edge cases with hidden/inline children differ |

- **WRONG:** adding a *new* bare `border` (no color utility) expecting the old gray-200 default.
- **RIGHT:** always pair `border` with an explicit color, e.g. `border border-gray-300`.
- **WHY:** in v4 bare `border` resolves to `currentColor`, not gray-200 — an uncolored border
  can render invisible or in the wrong color depending on ancestor text color.

### Interpolating dynamic values into class names
- **WRONG:** `` <span className={`bg-status-${status}`} /> `` or `` `text-${color}-600` ``.
- **RIGHT:** a `Record<Status, string>` lookup map of complete class strings, exactly like
  `TransactionHistory.tsx`'s `STATUS_CLASSES` (see Static Class Detection above).
- **WHY:** Oxide statically scans source text and never evaluates JavaScript, so the
  interpolated class never exists in the compiled CSS — the element silently gets no
  styling, with no build error and no console warning.

### Reaching for `@apply` as the default composition mechanism
- **WRONG:** wrapping every repeated utility combination in a custom class defined with
  `@apply` in `globals.css`, the way v3 tutorials taught.
- **RIGHT:** a React component for anything with structure (`<StatusChip>`), or `@utility`
  for a pure CSS-only primitive with no markup. Reserve `@apply` for overriding third-party
  component selectors you don't control.
- **WHY:** `@apply` re-resolves theme values in every stylesheet context it's used, composes
  worse with variants (`hover:`, `dark:`, `aria-*`) than `@utility` does, and hides
  markup-level intent a component would express more clearly.

### Re-adding `postcss-import` / `autoprefixer` or a `tailwind.config.js`
- **WRONG:** copying a v3-era PostCSS or Tailwind config into this project because it "looks
  more complete."
- **RIGHT:** keep `postcss.config.mjs` as the single `{ "@tailwindcss/postcss": {} }` plugin;
  put all token configuration in `@theme` blocks in `globals.css`.
- **WHY:** v4 handles import resolution and vendor prefixing internally, so the old plugins
  duplicate work and can conflict; a `tailwind.config.js` is inert unless loaded via
  `@config`, so adding one without that line is dead weight that misleads readers.

## Performance Best Practices

- Oxide's real win is **incremental rebuild latency** (watch mode is near-instant), not cold
  build time — don't chase build-time micro-optimizations that trade this away.
- Don't add unnecessary `@source` paths (never point one at `node_modules`); automatic
  content detection already scans this flat `src/` layout respecting `.gitignore`.
- Don't re-add `postcss-import` or `autoprefixer` — v4 handles both internally.
- Keep the single `globals.css` rather than splitting into many CSS Modules; isolated
  stylesheets are processed per-file and multiply Tailwind invocations.
- `@tailwindcss/postcss` is the correct integration for Next.js (webpack/Turbopack), not a
  compromise — `@tailwindcss/vite` applies only to raw Vite builds and isn't relevant here.

## Security Best Practices

- Never interpolate untrusted or user-controlled input into a `className` string, especially
  into an **arbitrary value** (`` className={`w-[${userInput}]`} ``) — arbitrary-value syntax
  is parsed into raw CSS, so unsanitized input there is a CSS-injection surface, not a
  styling bug.
- Values shown to users (MVola reference strings, error text) should drive **lookup-map
  keys**, never be spliced directly into class names or inline `style` attributes.
- Low surface area overall for a CSS framework — the risk is entirely about class strings
  built dynamically from data traceable to the MVola API or user form input.

## Testing Conventions

- Jest + React Testing Library tests assert on **behavior and accessible output** (roles,
  text, `aria-*` attributes), not Tailwind class names — class-string assertions couple
  tests to styling decisions unrelated to correctness.
- Where a class gates behavior (e.g. `disabled:` on a button), assert the DOM property:
  `expect(button).toBeDisabled()` — not `expect(button.className).toContain("disabled:bg-green-300")`.

## Framework-Specific Guidelines

### Next.js App Router + Turbopack
- `globals.css` is imported once from the root layout, so `@theme` tokens are available
  everywhere; no per-route CSS splitting exists in this project.
- Turbopack (the Next.js 16 default) uses `@tailwindcss/postcss` exactly as configured here
  — no extra Turbopack-specific Tailwind setup is needed or supported.

### Debugging: a class isn't appearing
Check, in order: is the full class string static in a scanned file (no template
interpolation)? Is the `@theme` namespace prefix right for the token type (`--color-*` vs
`--text-*` vs `--spacing`)? Is the file excluded by `.gitignore` or an overly narrow
`source(none)` + `@source`? Also worth a manual grep (no CI exists yet) for defunct v3
tokens sitting inert as no-op classes: `bg-opacity-`, `text-opacity-`, `ring-opacity-`,
`@tailwind base`, bare `outline-none` used where `outline-hidden` was meant.

## Accessibility

- After the `outline-none` → `outline-hidden` rename, keep focus visible. `DepositForm.tsx`'s
  `focus:outline-none focus:ring-2 focus:ring-blue-500` works today because the ring is a
  visible replacement — the more v4-idiomatic, keyboard-aware form is `focus-visible:outline-2
  focus-visible:outline-blue-500`, shown only for keyboard focus.
- `sr-only` / `not-sr-only` are unchanged from v3. Check contrast on custom status colors
  (`--color-status-pending` etc.) in both light and dark variants before shipping them.

This guide is used by /expert-frontend for styling guidance. On any conflict between this
guide and `/guide-conventions`, `/guide-conventions` wins.

## References

- Official docs: /docs/upgrade-guide, /docs/installation/framework-guides/nextjs, /docs/theme,
  /docs/adding-custom-styles, /docs/functions-and-directives,
  /docs/detecting-classes-in-source-files, /docs/dark-mode, /docs/hover-focus-and-other-states,
  /docs/compatibility — all under https://tailwindcss.com
- `docs/architecture/tech-stack.md` (stale on framework versions — see warning above)
- `.claude/skills/guides/conventions/SKILL.md` (`/guide-conventions` — authoritative on conflict)
