"use client";

import { useState, useRef, useEffect } from "react";
import { useMsisdnContext } from "./WalletHeader";

type DepositStatus = "idle" | "pending" | "completed" | "failed";

export function DepositForm() {
  const { msisdn, refreshBalance } = useMsisdnContext();
  const [amount, setAmount] = useState("");
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startPolling(id: string) {
    // Clear any existing interval before starting a new one
    stopPolling();
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
    }, 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("idle");
    setCorrelationId(null);

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
        </div>
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
