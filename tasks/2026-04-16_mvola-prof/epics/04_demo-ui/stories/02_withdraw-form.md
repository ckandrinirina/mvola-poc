# Story 04-02: WithdrawForm Component — Form, Submit, Polling, Status Display

> **Epic:** 04 — Demo UI
> **Size:** L
> **Status:** TODO

## Description

Implement `src/components/WithdrawForm.tsx` — the core demo UI component. It renders a form with amount and player MSISDN inputs, submits to `POST /api/mvola/withdraw`, then polls `GET /api/mvola/status/[correlationId]` every 3 seconds until the transaction reaches a terminal state (`completed` or `failed`). Status is displayed inline with appropriate visual feedback.

## Acceptance Criteria

- [ ] Component has `"use client"` directive at the top
- [ ] Form has: amount input (number, required), player MSISDN input (text, required), submit button
- [ ] On submit: disables the form and calls `POST /api/mvola/withdraw`
- [ ] On 400/error response from withdraw: shows error message, re-enables form
- [ ] On success: displays the `correlationId` and starts polling every 3 seconds
- [ ] Polling calls `GET /api/mvola/status/{correlationId}`
- [ ] Status display cycles through: `"Initiating..."` → `"Pending..."` → `"Completed"` or `"Failed"`
- [ ] Polling stops when status is `"completed"` or `"failed"`
- [ ] `setInterval` is cleared on component unmount (no memory leak)
- [ ] All state managed with `useState`; polling managed with `useEffect` or `useRef`
- [ ] Default MSISDN input placeholder shows `0343500003` (sandbox test number)
- [ ] TypeScript compiles without errors; no `any` types

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
