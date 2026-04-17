# Story 04-01: Root Layout and `page.tsx`

> **Epic:** 04 — Demo UI
> **Size:** S
> **Status:** DONE

## Description

Implement `src/app/layout.tsx` (root HTML shell with Tailwind base styles) and `src/app/page.tsx` (the demo page that renders `WithdrawForm`). Both files replace the create-next-app boilerplate created in Story 01-01.

## Acceptance Criteria

- [x] `layout.tsx` provides a valid HTML5 shell with `<html>`, `<body>`, Tailwind font classes
- [x] `layout.tsx` imports `globals.css` for Tailwind base styles
- [x] `page.tsx` is a React Server Component (no `"use client"`)
- [x] `page.tsx` renders a page title and the `<WithdrawForm />` component
- [x] Page is readable and has basic centering/padding via Tailwind
- [x] TypeScript compiles without errors

## Technical Notes

```tsx
// src/app/page.tsx
import WithdrawForm from "@/components/WithdrawForm";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-6">MVola Withdrawal Demo</h1>
      <WithdrawForm />
    </main>
  );
}
```

`WithdrawForm` does not exist yet at this point — it will be implemented in Story 04-02. Use a placeholder stub if needed to keep the TypeScript build passing.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/app/layout.tsx` | Replace boilerplate with clean shell |
| MODIFY | `src/app/page.tsx` | Replace boilerplate with WithdrawForm renderer |
| MODIFY | `src/app/globals.css` | Tailwind `@tailwind` directives only |

## Dependencies

- **Blocked by:** Story 01-01 (scaffold), Epic 03 (routes must exist)
- **Blocks:** Story 04-02 (WithdrawForm must have a page to live on)

## Related

- **Epic:** 04_demo-ui
- **Spec reference:** `docs/architecture/components.md` — Demo Page
