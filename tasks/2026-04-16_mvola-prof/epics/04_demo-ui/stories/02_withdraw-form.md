# Story 04-02: WithdrawForm Component — Form, Submit, Polling, Status Display

> **Epic:** 04 — Demo UI
> **Size:** L
> **Status:** DONE

## Description

Implement `src/components/WithdrawForm.tsx` — the core demo UI component. It renders a form with amount and player MSISDN inputs, submits to `POST /api/mvola/withdraw`, then polls `GET /api/mvola/status/[correlationId]` every 3 seconds until the transaction reaches a terminal state (`completed` or `failed`). Status is displayed inline with appropriate visual feedback.

## Acceptance Criteria

- [x] Component has `"use client"` directive at the top
- [x] Form has: amount input (number, required), player MSISDN input (text, required), submit button
- [x] On submit: disables the form and calls `POST /api/mvola/withdraw`
- [x] On 400/error response from withdraw: shows error message, re-enables form
- [x] On success: displays the `correlationId` and starts polling every 3 seconds
- [x] Polling calls `GET /api/mvola/status/{correlationId}`
- [x] Status display cycles through: `"Initiating..."` → `"Pending..."` → `"Completed"` or `"Failed"`
- [x] Polling stops when status is `"completed"` or `"failed"`
- [x] `setInterval` is cleared on component unmount (no memory leak)
- [x] All state managed with `useState`; polling managed with `useEffect` or `useRef`
- [x] Default MSISDN input placeholder shows `0343500003` (sandbox test number)
- [x] TypeScript compiles without errors; no `any` types

## Technical Notes

State to manage:
```typescript
const [amount, setAmount] = useState("");
const [playerMsisdn, setPlayerMsisdn] = useState("");
const [correlationId, setCorrelationId] = useState<string | null>(null);
const [transactionStatus, setTransactionStatus] = useState<string | null>(null);
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
```

Polling pattern (use `useRef` to store interval ID for cleanup):
```typescript
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

const startPolling = (id: string) => {
  intervalRef.current = setInterval(async () => {
    const res = await fetch(`/api/mvola/status/${id}`);
    const data = await res.json();
    setTransactionStatus(data.transactionStatus);
    if (data.transactionStatus === "completed" || data.transactionStatus === "failed") {
      clearInterval(intervalRef.current!);
    }
  }, 3000);
};

useEffect(() => {
  return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
}, []);
```

Status display should be visually distinct:
- `pending` → yellow/amber text
- `completed` → green text
- `failed` → red text

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/components/WithdrawForm.tsx` | Main demo form with polling |

## Dependencies

- **Blocked by:** Story 04-01 (page must render it), Story 03-02 (withdraw route), Story 03-03 (status route)
- **Blocks:** Nothing — this is the final story

## Related

- **Epic:** 04_demo-ui
- **Spec reference:** `docs/architecture/components.md` — WithdrawForm, `docs/architecture/data-flow.md` — Player Initiates Withdrawal (Happy Path)

---

## Implementation Plan

**Planned:** 2026-04-17
**Skills loaded:** build (TDD orchestrator)
**SOLID approach:** Single client component; polling logic isolated in `startPolling`; cleanup via `useEffect` return

### Subtasks
1. [x] Write tests (12 tests from acceptance criteria)
2. [x] Implement WithdrawForm component
3. [x] Refactor for SOLID compliance (already clean)
4. [x] QA validation
5. [x] Update docs and commit

### Design Notes
- `TransactionStatus` union type instead of `string | null` for type safety
- `intervalRef` stores interval ID for both early stop (terminal status) and unmount cleanup
- `statusClass()` and `statusLabel()` extract display logic from JSX

---

## Implementation Summary

**Completed:** 2026-04-17
**TDD Iterations:** 1 (red → green → refactor)
**QA Iterations:** 1
**Tests written:** 12
**Files created:** 2
**Files modified:** 1

### What Was Implemented
- Full `WithdrawForm` client component with form, submit, polling, and status display
- 12 component tests using `@testing-library/react` with jsdom environment
- Installed `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`

### Files Touched

```
CREATED  src/components/WithdrawForm.tsx
CREATED  src/__tests__/components/WithdrawForm.test.tsx
MODIFIED package.json (added @testing-library/* devDependencies)
MODIFIED package-lock.json
```

### SOLID Compliance
- S: Component owns form state; `startPolling` has one job; display helpers isolated
- O: Status colors/labels extensible without modifying core submit logic
- L: N/A (no type hierarchy)
- I: N/A (no interfaces)
- D: `fetch` is the browser global — standard for client components
