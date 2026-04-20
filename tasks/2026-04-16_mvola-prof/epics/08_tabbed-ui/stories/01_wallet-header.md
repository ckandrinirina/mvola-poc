# Story 08-01: `WalletHeader` Component — MSISDN Input + Balance Polling

> **Epic:** 08 — Tabbed Demo UI
> **Size:** M
> **Status:** DONE

## Description

Create `src/components/WalletHeader.tsx` — the top-of-page bar that captures the active player's MSISDN and displays their live wallet balance. The MSISDN is mirrored in `localStorage` so it survives a page refresh. While an MSISDN is set, the component polls `GET /api/wallet/:msisdn/balance` every 2 seconds. The header also exposes both the active MSISDN and a `refreshBalance()` trigger via a React context so child tab components can cause immediate refreshes after a successful action.

## Acceptance Criteria

- [x] Component is a React client component (`"use client"`)
- [x] Renders an MSISDN input; the value is persisted to `localStorage` under key `mvola-prof.msisdn`
- [x] On mount, reads the persisted MSISDN (if any) and populates the input
- [x] Displays the balance formatted as Ariary (e.g. `5 000 Ar`)
- [x] While an MSISDN is set, polls `GET /api/wallet/:msisdn/balance` every 2000 ms
- [x] Polling stops when the MSISDN is cleared or the component unmounts
- [x] Provides a React context (`MsisdnContext`) exposing `{ msisdn, setMsisdn, balance, refreshBalance }`
- [x] Component tests cover: initial read from localStorage, write on change, polling starts/stops, balance renders, refreshBalance triggers immediate fetch

## Technical Notes

Context skeleton:

```typescript
"use client";
import { createContext, useState, useEffect, useContext, useCallback, ReactNode } from "react";

interface MsisdnContextValue {
  msisdn: string;
  setMsisdn: (value: string) => void;
  balance: number;
  refreshBalance: () => void;
}

const MsisdnContext = createContext<MsisdnContextValue | null>(null);

export function useMsisdnContext() {
  const ctx = useContext(MsisdnContext);
  if (!ctx) throw new Error("useMsisdnContext must be used inside <WalletHeader>");
  return ctx;
}

export function WalletHeader({ children }: { children: ReactNode }) {
  const [msisdn, setMsisdnState] = useState("");
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("mvola-prof.msisdn");
    if (saved) setMsisdnState(saved);
  }, []);

  const setMsisdn = useCallback((value: string) => {
    setMsisdnState(value);
    if (value) localStorage.setItem("mvola-prof.msisdn", value);
    else localStorage.removeItem("mvola-prof.msisdn");
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!msisdn) return;
    const res = await fetch(`/api/wallet/${encodeURIComponent(msisdn)}/balance`);
    if (res.ok) {
      const data = await res.json();
      setBalance(data.balance);
    }
  }, [msisdn]);

  useEffect(() => {
    if (!msisdn) return;
    refreshBalance();
    const id = setInterval(refreshBalance, 2000);
    return () => clearInterval(id);
  }, [msisdn, refreshBalance]);

  return (
    <MsisdnContext.Provider value={{ msisdn, setMsisdn, balance, refreshBalance }}>
      <header className="... Tailwind classes ...">
        <input value={msisdn} onChange={e => setMsisdn(e.target.value.trim())} ... />
        <span>{balance.toLocaleString()} Ar</span>
      </header>
      {children}
    </MsisdnContext.Provider>
  );
}
```

Tests: mock `fetch` and `localStorage`; use jest's fake timers to verify polling cadence.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/components/WalletHeader.tsx` | Header component + `MsisdnContext` |
| CREATE | `src/components/__tests__/WalletHeader.test.tsx` | Component tests |

## Dependencies

- **Blocked by:** Story 07-03 (balance route)
- **Blocks:** Story 08-07 (`page.tsx` mounts this), stories 08-03 / 08-04 / 08-05 / 08-06 (consume the context)

## Related

- **Epic:** 08_tabbed-ui
- **Spec reference:** `docs/architecture/components.md` § `WalletHeader`, `docs/architecture/data-flow.md` § State Management (client-side)
