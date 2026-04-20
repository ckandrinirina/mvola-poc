# Story 08-03: `DepositForm` Component — Deposit POST + Polling

> **Epic:** 08 — Tabbed Demo UI
> **Size:** M
> **Status:** TODO

## Description

Create `src/components/DepositForm.tsx` — the deposit tab body. Reads the active MSISDN from `MsisdnContext`, captures an amount, POSTs to `/api/mvola/deposit`, and then polls `/api/mvola/status/:correlationId` every 3 seconds until the transaction reaches `completed` or `failed`. On `completed`, calls `refreshBalance()` from the context so the header updates immediately; on `failed`, displays a clear error.

## Acceptance Criteria

- [ ] Component is a React client component (`"use client"`)
- [ ] Reads `msisdn` and `refreshBalance` from `useMsisdnContext()`
- [ ] Amount input accepts positive integers only
- [ ] Disabled when `msisdn` is empty
- [ ] On submit POSTs `{ msisdn, amount }` to `/api/mvola/deposit`
- [ ] Handles 400 by displaying the error message; 502 by displaying "MVola API error"
- [ ] On 200 success, stores the returned `correlationId` and starts polling `/api/mvola/status/:correlationId` every 3000 ms
- [ ] Displays intermediate status (`pending`) with a spinner
- [ ] Stops polling and calls `refreshBalance()` on `completed`; displays success banner
- [ ] Stops polling and displays "Deposit failed" banner on `failed`
- [ ] Cleans up the interval on unmount or when the user initiates a new deposit
- [ ] Component tests cover: validation, happy path (mock fetch returning pending then completed), 400 validation error, failed status handling, balance refresh is called on completion

## Technical Notes

Borrow the polling pattern from the existing `WithdrawForm.tsx` (`useRef<NodeJS.Timeout>` + `setInterval` + cleanup). Only the payload keys (`msisdn` instead of `playerMsisdn`) and the endpoint URL change.

```typescript
"use client";
import { useState, useRef, useEffect } from "react";
import { useMsisdnContext } from "./WalletHeader";

export function DepositForm() {
  const { msisdn, refreshBalance } = useMsisdnContext();
  const [amount, setAmount] = useState("");
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "completed" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/mvola/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msisdn, amount: Number(amount) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Request failed");
      return;
    }
    const body = await res.json();
    setCorrelationId(body.correlationId);
    setStatus("pending");
    startPolling(body.correlationId);
  }

  function startPolling(id: string) {
    intervalRef.current = setInterval(async () => {
      const res = await fetch(`/api/mvola/status/${id}`);
      if (!res.ok) return;
      const body = await res.json();
      if (body.transactionStatus === "completed" || body.transactionStatus === "failed") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setStatus(body.transactionStatus);
        if (body.transactionStatus === "completed") refreshBalance();
      }
    }, 3000);
  }

  return ( /* ... JSX ... */ );
}
```

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/components/DepositForm.tsx` | Deposit tab body |
| CREATE | `src/components/__tests__/DepositForm.test.tsx` | Component tests |

## Dependencies

- **Blocked by:** Stories 06-02 (deposit route), 06-04 (status reconciliation), 08-01 (context)
- **Blocks:** Story 08-07

## Related

- **Epic:** 08_tabbed-ui
- **Spec reference:** `docs/architecture/components.md` § `DepositForm`, `docs/architecture/data-flow.md` § Flow 4 (Deposit)
