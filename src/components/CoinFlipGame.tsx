"use client";

import { useState } from "react";
import { useMsisdnContext } from "./WalletHeader";

// ---- Types ------------------------------------------------------------------

type GameChoice = "heads" | "tails";
type Phase = "idle" | "flipping" | "result" | "error";

interface OutcomeData {
  outcome: string;
  result: string;
  delta: number;
  balanceAfter: number;
}

interface ErrorData {
  message: string;
  balance?: number;
}

// ---- Component --------------------------------------------------------------

export function CoinFlipGame() {
  const { msisdn, balance, refreshBalance } = useMsisdnContext();
  const [bet, setBet] = useState("1");
  const [choice, setChoice] = useState<GameChoice>("heads");
  const [phase, setPhase] = useState<Phase>("idle");
  const [lastOutcome, setLastOutcome] = useState<OutcomeData | null>(null);
  const [errorData, setErrorData] = useState<ErrorData | null>(null);

  const isDisabled = !msisdn || balance === 0;

  async function handleFlip() {
    setPhase("flipping");
    setLastOutcome(null);
    setErrorData(null);

    // Run animation delay in parallel with fetch
    const animationDelay = new Promise<void>((r) => setTimeout(r, 800));

    const fetchPromise = fetch("/api/game/coinflip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msisdn, bet: Number(bet), choice }),
    });

    // Wait for both animation and fetch to complete
    const [res] = await Promise.all([fetchPromise, animationDelay]);

    if (res.status === 409) {
      const body = await res.json();
      setErrorData({
        message: "Insufficient funds",
        balance: body.balance,
      });
      setPhase("error");
      return;
    }

    if (!res.ok) {
      const body = await res.json();
      setErrorData({
        message: body.details ?? body.error ?? "An error occurred",
      });
      setPhase("error");
      return;
    }

    const body = await res.json();
    setLastOutcome(body);
    setPhase("result");
    refreshBalance();
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-md">
      <h2 className="text-lg font-semibold text-gray-800">Coin Flip Game</h2>

      {/* Bet input */}
      <div className="flex flex-col gap-1">
        <label htmlFor="bet-input" className="text-sm font-medium text-gray-700">
          Bet amount (Ar)
        </label>
        <input
          id="bet-input"
          type="number"
          role="spinbutton"
          min="1"
          max={String(balance)}
          value={bet}
          onChange={(e) => setBet(e.target.value)}
          disabled={isDisabled}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      {/* Heads / Tails selector */}
      <div className="flex gap-3">
        <button
          type="button"
          aria-pressed={choice === "heads"}
          onClick={() => setChoice("heads")}
          disabled={isDisabled}
          className={`flex-1 rounded py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            choice === "heads"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Heads
        </button>
        <button
          type="button"
          aria-pressed={choice === "tails"}
          onClick={() => setChoice("tails")}
          disabled={isDisabled}
          className={`flex-1 rounded py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            choice === "tails"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Tails
        </button>
      </div>

      {/* Flip button */}
      <button
        type="button"
        onClick={handleFlip}
        disabled={isDisabled || phase === "flipping"}
        className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {phase === "flipping" ? "Flipping…" : "Flip"}
      </button>

      {/* Flipping animation */}
      {phase === "flipping" && (
        <div className="flex items-center justify-center gap-2 text-indigo-600 animate-pulse">
          <span className="text-2xl">🪙</span>
          <span className="text-sm font-medium">Flipping…</span>
        </div>
      )}

      {/* Result display */}
      {phase === "result" && lastOutcome && (
        <div className="rounded border p-4 bg-gray-50">
          <p className="text-sm text-gray-600 mb-2">
            Outcome: <span className="font-semibold capitalize">{lastOutcome.outcome}</span>
          </p>
          <p
            className={`text-base font-bold capitalize ${
              lastOutcome.result === "win" ? "text-green-600" : "text-red-600"
            }`}
          >
            {lastOutcome.result}
          </p>
          <p className="text-sm mt-1">
            Delta:{" "}
            <span
              className={lastOutcome.delta >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}
            >
              {lastOutcome.delta >= 0 ? `+${lastOutcome.delta}` : lastOutcome.delta}
            </span>
          </p>
          <p className="text-sm mt-1 text-gray-700">
            New balance: <span className="font-semibold">{lastOutcome.balanceAfter}</span> Ar
          </p>
        </div>
      )}

      {/* Error display */}
      {phase === "error" && errorData && (
        <div className="rounded border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">{errorData.message}</p>
          {errorData.balance !== undefined && (
            <p className="text-sm text-red-600 mt-1">
              Available balance: <span className="font-semibold">{errorData.balance}</span> Ar
            </p>
          )}
        </div>
      )}
    </div>
  );
}
