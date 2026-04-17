# Epic 04: Demo UI

## Description

Implement the React demo interface that lets a developer exercise the full MVola withdrawal flow end-to-end in a browser. The UI consists of a root page and a `WithdrawForm` client component. The form captures a player phone number and amount, submits to the withdraw route, and polls for status every 3 seconds until the transaction completes or fails.

This is a demo/PoC UI — the goal is clarity and functionality, not production polish.

## Goals

- Provide a working browser UI to trigger the withdrawal flow
- Display real-time transaction status (pending → completed / failed)
- Show the `correlationId` for debugging

## Scope

### In Scope
- `src/app/layout.tsx` — HTML shell with Tailwind base styles
- `src/app/page.tsx` — renders `WithdrawForm`
- `src/components/WithdrawForm.tsx` — form, submit logic, 3s polling loop, status display

### Out of Scope
- Player authentication
- Transaction history or persistence
- Production-grade error handling UI
- Mobile responsiveness beyond basic Tailwind classes

## Dependencies

- **Depends on:** Epic 03 (API routes must exist for the form to POST/GET)
- **Blocks:** Nothing (this is the final deliverable)

## Stories

| # | Story | Size | Status |
|---|-------|------|--------|
| 01 | Root layout and `page.tsx` | S | TODO |
| 02 | `WithdrawForm` component — form, submit, polling, status display | L | TODO |

## Acceptance Criteria

- [ ] Opening `http://localhost:3000` shows the withdrawal form
- [ ] Submitting with valid amount and sandbox MSISDN (`0343500003`) triggers a payout
- [ ] UI shows `correlationId` after submit
- [ ] UI polls every 3 seconds and updates displayed status
- [ ] UI shows success state when `transactionStatus === "completed"`
- [ ] UI shows error state when `transactionStatus === "failed"` or request fails
- [ ] UI shows loading state while polling
- [ ] TypeScript compiles with zero errors across UI files

## Technical Notes

`WithdrawForm` must be a `"use client"` component (uses `useState`, `useEffect`/`setInterval`).
`page.tsx` can be a React Server Component — it simply renders `WithdrawForm`.

Polling: use `setInterval` with 3000ms. Clear the interval when status is `"completed"` or `"failed"`, or when the component unmounts.
