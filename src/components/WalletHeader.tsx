"use client";

import {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  ReactNode,
} from "react";

const MSISDN_KEY = "mvola-prof.msisdn";
const POLL_INTERVAL_MS = 2000;

// ---- Context ----------------------------------------------------------------

interface MsisdnContextValue {
  msisdn: string;
  setMsisdn: (value: string) => void;
  balance: number;
  refreshBalance: () => void;
}

const MsisdnContext = createContext<MsisdnContextValue | null>(null);

export function useMsisdnContext(): MsisdnContextValue {
  const ctx = useContext(MsisdnContext);
  if (!ctx) throw new Error("useMsisdnContext must be used inside <WalletHeader>");
  return ctx;
}

// ---- Component --------------------------------------------------------------

interface WalletHeaderProps {
  children?: ReactNode;
}

export function WalletHeader({ children }: WalletHeaderProps) {
  const [msisdn, setMsisdnState] = useState("");
  const [balance, setBalance] = useState(0);

  // Read persisted MSISDN from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(MSISDN_KEY);
    if (saved) setMsisdnState(saved);
  }, []);

  // Persist MSISDN changes to localStorage
  const setMsisdn = useCallback((value: string) => {
    setMsisdnState(value);
    if (value) {
      localStorage.setItem(MSISDN_KEY, value);
    } else {
      localStorage.removeItem(MSISDN_KEY);
    }
  }, []);

  // Fetch wallet balance for the current MSISDN
  const refreshBalance = useCallback(async () => {
    if (!msisdn) return;
    const res = await fetch(`/api/wallet/${encodeURIComponent(msisdn)}/balance`);
    if (res.ok) {
      const data = await res.json();
      setBalance(data.balance);
    }
  }, [msisdn]);

  // Start/stop polling when MSISDN changes
  useEffect(() => {
    if (!msisdn) return;

    refreshBalance();
    const id = setInterval(refreshBalance, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [msisdn, refreshBalance]);

  const contextValue: MsisdnContextValue = {
    msisdn,
    setMsisdn,
    balance,
    refreshBalance,
  };

  return (
    <MsisdnContext.Provider value={contextValue}>
      <header className="flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <label htmlFor="msisdn-input" className="text-sm font-medium text-gray-700 whitespace-nowrap">
          MSISDN
        </label>
        <input
          id="msisdn-input"
          type="text"
          value={msisdn}
          onChange={(e) => setMsisdn(e.target.value.trim())}
          placeholder="0343500003"
          className="flex-1 max-w-xs rounded border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="ml-auto text-sm font-semibold text-gray-800">
          {balance.toLocaleString()} Ar
        </span>
      </header>
      {children}
    </MsisdnContext.Provider>
  );
}
