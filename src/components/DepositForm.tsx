"use client";

import { useState, useRef, useEffect } from "react";
import { useMsisdnContext } from "./WalletHeader";
import { PendingApprovalBanner } from "./PendingApprovalBanner";

type DepositStatus = "idle" | "pending" | "completed" | "failed" | "still-pending";

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

export function DepositForm() {
  const { msisdn, refreshBalance } = useMsisdnContext();
  const [amount, setAmount] = useState("");
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);

  const config = usePollingConfig();
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup interval + ceiling timeout on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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

  function startPolling(id: string) {
    // Clear any existing interval/timeout before starting new ones
    stopPolling();
    const { pollIntervalMs, pollTimeoutMs } = configRef.current;

    intervalRef.current = setInterval(async () => {
      const res = await fetch(`/api/mvola/status/${id}`);
      if (!res.ok) return;
      const body = await res.json();
      const txStatus: DepositStatus = body.transactionStatus;
      if (txStatus === "completed" || txStatus === "failed") {
        stopPolling();
        setStatus(txStatus);
        if (txStatus === "completed") {
          refreshBalance();
        }
      }
    }, pollIntervalMs);

    // Reaching the ceiling is a reporting boundary only (rule R3): it must never set
    // `status` to "failed", never call `refreshBalance()`, and never show an error
    // style — the transaction may yet settle by callback.
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setStatus("still-pending");
    }, pollTimeoutMs);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("idle");
    setCorrelationId(null);
    setSubmittedAt(null);

    // Clear any existing polling before new submit
    stopPolling();

    const res = await fetch("/api/mvola/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msisdn, amount: Number(amount) }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 502) {
        setError("MVola API error");
      } else {
        setError(body.error ?? "Request failed");
      }
      return;
    }

    const body = await res.json();
    setCorrelationId(body.correlationId);
    setStatus("pending");
    setSubmittedAt(Date.now());
    startPolling(body.correlationId);
  }

  const statusClass = () => {
    if (status === "completed") return "text-green-600 font-semibold";
    if (status === "failed") return "text-red-600 font-semibold";
    return "text-amber-500 font-semibold";
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm space-y-4 rounded border border-gray-200 p-6 shadow-sm"
    >
      <div>
        <label
          htmlFor="deposit-amount"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Amount (Ar)
        </label>
        <input
          id="deposit-amount"
          type="number"
          min="1"
          step="1"
          required
          disabled={!msisdn}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={!msisdn}
        className="w-full rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-green-300"
      >
        Deposit
      </button>

      {correlationId && (
        <div className="mt-4 space-y-1 text-sm">
          <p className="text-gray-500">
            Correlation ID:{" "}
            <span className="font-mono text-gray-800">{correlationId}</span>
          </p>
          {status === "pending" && (
            <p className={statusClass()}>
              <span className="inline-block mr-1 animate-spin" aria-hidden="true">⟳</span>
              Pending...
            </p>
          )}
          {status === "still-pending" && (
            <p className="text-amber-600 font-semibold">
              Still pending — waiting for MVola
            </p>
          )}
        </div>
      )}

      {(status === "pending" || status === "still-pending") && submittedAt != null && (
        <PendingApprovalBanner
          startedAt={submittedAt}
          pollTimeoutMs={config.pollTimeoutMs}
          timedOut={status === "still-pending"}
        />
      )}

      {status === "completed" && (
        <div
          role="status"
          className="rounded bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700"
        >
          Deposit completed successfully.
        </div>
      )}

      {status === "failed" && (
        <div
          role="alert"
          className="rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700"
        >
          Deposit failed
        </div>
      )}
    </form>
  );
}
