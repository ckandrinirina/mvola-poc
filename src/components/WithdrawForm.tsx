"use client";

import { useState, useEffect, useRef } from "react";

type TransactionStatus = "pending" | "completed" | "failed" | null;

export default function WithdrawForm() {
  const [amount, setAmount] = useState("");
  const [playerMsisdn, setPlayerMsisdn] = useState("");
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] =
    useState<TransactionStatus>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startPolling = (id: string) => {
    intervalRef.current = setInterval(async () => {
      const res = await fetch(`/api/mvola/status/${id}`);
      const data = await res.json();
      const status = data.transactionStatus as TransactionStatus;
      setTransactionStatus(status);
      if (status === "completed" || status === "failed") {
        clearInterval(intervalRef.current!);
      }
    }, 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/mvola/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, playerMsisdn }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "An error occurred");
      setLoading(false);
      return;
    }

    setCorrelationId(data.correlationId);
    setTransactionStatus("pending");
    startPolling(data.correlationId);
  };

  const statusClass = () => {
    if (transactionStatus === "completed") return "text-green-600 font-semibold";
    if (transactionStatus === "failed") return "text-red-600 font-semibold";
    return "text-amber-500 font-semibold";
  };

  const statusLabel = () => {
    if (!transactionStatus) return "Initiating...";
    if (transactionStatus === "pending") return "Pending...";
    if (transactionStatus === "completed") return "Completed";
    return "Failed";
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm space-y-4 rounded border border-gray-200 p-6 shadow-sm"
    >
      <div>
        <label
          htmlFor="amount"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Amount (Ar)
        </label>
        <input
          id="amount"
          type="number"
          required
          disabled={loading}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>

      <div>
        <label
          htmlFor="playerMsisdn"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Player MSISDN
        </label>
        <input
          id="playerMsisdn"
          type="text"
          required
          disabled={loading}
          placeholder="0343500003"
          value={playerMsisdn}
          onChange={(e) => setPlayerMsisdn(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
      >
        Withdraw
      </button>

      {correlationId && (
        <div className="mt-4 space-y-1 text-sm">
          <p className="text-gray-500">
            Correlation ID:{" "}
            <span className="font-mono text-gray-800">{correlationId}</span>
          </p>
          <p>
            Status:{" "}
            <span className={statusClass()}>{statusLabel()}</span>
          </p>
        </div>
      )}
    </form>
  );
}
