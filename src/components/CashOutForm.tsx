"use client";

import { useState, useEffect, useRef } from "react";
import { useMsisdnContext } from "@/components/WalletHeader";
import { PendingApprovalBanner } from "@/components/PendingApprovalBanner";

type TransactionStatus = "pending" | "completed" | "failed" | "still-pending" | null;

interface InsufficientFundsError {
  balance: number;
  requested: number;
}

/** Fallbacks used until `GET /api/config/polling` resolves, and whenever it fails —
 * the client must never block polling on that fetch (see `usePollingConfig` below). */
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_POLL_TIMEOUT_MS = 120000;

interface PollingConfig {
  pollIntervalMs: number;
  pollTimeoutMs: number;
}

/**
 * Reads the server's polling policy once per mount via `GET /api/config/polling`.
 *
 * Never reads `src/lib/mvola/polling.ts` directly — that module is server-only. A
 * failed or malformed response is not fatal: the defaults above are used instead so
 * polling itself is never blocked on this fetch (story 09-11 AC1).
 */
function usePollingConfig(): PollingConfig {
  const [config, setConfig] = useState<PollingConfig>({
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    pollTimeoutMs: DEFAULT_POLL_TIMEOUT_MS,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config/polling")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("config fetch failed"))))
      .then((body) => {
        if (cancelled) return;
        const pollIntervalMs =
          typeof body?.pollIntervalMs === "number" && body.pollIntervalMs > 0
            ? body.pollIntervalMs
            : DEFAULT_POLL_INTERVAL_MS;
        const pollTimeoutMs =
          typeof body?.pollTimeoutMs === "number" && body.pollTimeoutMs > 0
            ? body.pollTimeoutMs
            : DEFAULT_POLL_TIMEOUT_MS;
        setConfig({ pollIntervalMs, pollTimeoutMs });
      })
      .catch(() => {
        // Keep the defaults already set as initial state — a broken config route
        // must never prevent polling from starting.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}

export default function CashOutForm() {
  const { msisdn, balance, refreshBalance } = useMsisdnContext();

  const [amount, setAmount] = useState<number>(balance);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] =
    useState<TransactionStatus>(null);
  const [error, setError] = useState<string | null>(null);
  const [insufficientFunds, setInsufficientFunds] =
    useState<InsufficientFundsError | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);

  const config = usePollingConfig();
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync amount with balance changes (keeps default = balance)
  useEffect(() => {
    if (!loading && transactionStatus === null) {
      setAmount(balance);
    }
  }, [balance, loading, transactionStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isTerminal =
    transactionStatus === "completed" || transactionStatus === "failed";

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  const startPolling = (id: string) => {
    // Clear any existing interval/timeout before starting new ones
    stopPolling();
    const { pollIntervalMs, pollTimeoutMs } = configRef.current;

    intervalRef.current = setInterval(async () => {
      const res = await fetch(`/api/mvola/status/${id}`);
      const data = await res.json();
      const status = data.transactionStatus as TransactionStatus;
      setTransactionStatus(status);
      if (status === "completed" || status === "failed") {
        stopPolling();
        refreshBalance();
      }
    }, pollIntervalMs);

    // Reaching the ceiling is a reporting boundary only (rule R3): it must never set
    // the status to "failed", never call `refreshBalance()`, and never show an error
    // style — the transaction may yet settle by callback.
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setTransactionStatus("still-pending");
    }, pollTimeoutMs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation: amount must not exceed balance
    if (amount > balance) {
      setError("Amount cannot exceed your current balance.");
      return;
    }

    setError(null);
    setInsufficientFunds(null);
    setLoading(true);
    setSubmittedAt(null);

    // Clear any existing polling before new submit
    stopPolling();

    const res = await fetch("/api/mvola/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msisdn, amount }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409) {
        setInsufficientFunds({ balance: data.balance, requested: data.requested });
      } else {
        setError(data.error ?? "An error occurred");
      }
      setLoading(false);
      return;
    }

    setCorrelationId(data.correlationId);
    setTransactionStatus("pending");
    setSubmittedAt(Date.now());
    startPolling(data.correlationId);
  };

  const statusClass = () => {
    if (transactionStatus === "completed") return "text-green-600 font-semibold";
    if (transactionStatus === "failed") return "text-red-600 font-semibold";
    return "text-amber-500 font-semibold";
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm space-y-4 rounded border border-gray-200 p-6 shadow-sm"
    >
      <div>
        <label
          htmlFor="cashout-amount"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Amount (Ar)
        </label>
        <input
          id="cashout-amount"
          type="number"
          required
          min={1}
          disabled={loading || isTerminal}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {insufficientFunds && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700">
          <p className="font-semibold">Insufficient funds</p>
          <p>
            Wallet balance: <span className="font-mono">{insufficientFunds.balance}</span> Ar
          </p>
          <p>
            Requested: <span className="font-mono">{insufficientFunds.requested}</span> Ar
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || isTerminal}
        className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
      >
        Cash Out
      </button>

      {correlationId && (
        <div className="mt-4 space-y-1 text-sm">
          <p className="text-gray-500">
            Correlation ID:{" "}
            <span className="font-mono text-gray-800">{correlationId}</span>
          </p>
          <p>
            Status:{" "}
            <span className={statusClass()}>
              {transactionStatus === "pending" && "Pending..."}
              {transactionStatus === "completed" && "Cash-out successful"}
              {transactionStatus === "failed" && (
                <>
                  Cash-out failed —{" "}
                  <span className="italic">wallet refunded</span>
                </>
              )}
              {transactionStatus === "still-pending" &&
                "Still pending — waiting for MVola"}
              {!transactionStatus && "Initiating..."}
            </span>
          </p>
        </div>
      )}

      {(transactionStatus === "pending" || transactionStatus === "still-pending") &&
        submittedAt != null && (
          <PendingApprovalBanner
            startedAt={submittedAt}
            pollTimeoutMs={config.pollTimeoutMs}
            timedOut={transactionStatus === "still-pending"}
          />
        )}
    </form>
  );
}
