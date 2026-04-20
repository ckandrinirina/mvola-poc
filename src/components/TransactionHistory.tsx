"use client";

import { useState, useEffect } from "react";
import { useMsisdnContext } from "./WalletHeader";

// ---- Types ------------------------------------------------------------------

interface TransactionEntry {
  kind: "transaction";
  localTxId: string;
  correlationId: string;
  direction: "deposit" | "withdraw";
  amount: number;
  status: "pending" | "completed" | "failed";
  mvolaReference?: string;
  createdAt: number;
  updatedAt: number;
}

interface GameEntry {
  kind: "game";
  sessionId: string;
  bet: number;
  choice: "heads" | "tails";
  outcome: "heads" | "tails";
  result: "win" | "loss";
  delta: number;
  balanceAfter: number;
  playedAt: number;
}

type Entry = TransactionEntry | GameEntry;

// ---- Relative time utility --------------------------------------------------

function formatRelativeTime(timestampMs: number): string {
  const now = Date.now();
  const diffMs = now - timestampMs;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString();
}

// ---- Status chip ------------------------------------------------------------

const STATUS_CLASSES: Record<string, string> = {
  completed: "px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800",
  pending: "px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800",
  failed: "px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800",
};

function StatusChip({ status }: { status: string }) {
  const cls = STATUS_CLASSES[status] ?? "px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800";
  return <span className={cls}>{status}</span>;
}

// ---- Result banner ----------------------------------------------------------

const RESULT_CLASSES: Record<string, string> = {
  win: "px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800",
  loss: "px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800",
};

function ResultBanner({ result }: { result: string }) {
  const cls = RESULT_CLASSES[result] ?? "px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800";
  return <span className={cls}>{result}</span>;
}

// ---- TransactionRow ---------------------------------------------------------

function TransactionRow({ tx }: { tx: TransactionEntry }) {
  const isDeposit = tx.direction === "deposit";
  const directionArrow = isDeposit ? "↓" : "↑";
  const amountSign = isDeposit ? `+${formatAmount(tx.amount)}` : `−${formatAmount(tx.amount)}`;
  const amountColor = isDeposit ? "text-green-700" : "text-red-700";
  const time = formatRelativeTime(tx.createdAt);

  return (
    <li className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <span
        className={`text-lg font-bold leading-none ${isDeposit ? "text-green-600" : "text-red-600"}`}
        aria-label={tx.direction}
      >
        {directionArrow}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold text-sm ${amountColor}`}>
            {amountSign} Ar
          </span>
          <StatusChip status={tx.status} />
          <span className="text-xs text-gray-400 ml-auto">{time}</span>
        </div>
        {tx.mvolaReference && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {tx.mvolaReference}
          </p>
        )}
      </div>
    </li>
  );
}

// ---- GameRow ----------------------------------------------------------------

const COIN_ICONS: Record<string, string> = {
  heads: "🪙",
  tails: "🔄",
};

function GameRow({ game }: { game: GameEntry }) {
  const deltaSign = game.delta >= 0 ? `+${formatAmount(game.delta)}` : `−${formatAmount(Math.abs(game.delta))}`;
  const time = formatRelativeTime(game.playedAt);

  return (
    <li className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <span className="text-lg leading-none" aria-label="coin-flip">
        {COIN_ICONS[game.outcome] ?? "🎮"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700">
            Bet: {formatAmount(game.bet)} Ar
          </span>
          <ResultBanner result={game.result} />
          <span className={`text-sm font-semibold ${game.delta >= 0 ? "text-green-700" : "text-red-700"}`}>
            {deltaSign} Ar
          </span>
          <span className="text-xs text-gray-400 ml-auto">{time}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">
            <span className="font-medium">{game.choice}</span>
            {" → "}
            <span className="font-medium">{game.outcome}</span>
          </span>
          <span className="text-xs text-gray-500">
            Balance after: {formatAmount(game.balanceAfter)} Ar
          </span>
        </div>
      </div>
    </li>
  );
}

// ---- TransactionHistory -----------------------------------------------------

export function TransactionHistory() {
  const { msisdn, balance } = useMsisdnContext();
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (!msisdn) return;

    let cancelled = false;

    (async () => {
      const res = await fetch(`/api/wallet/${encodeURIComponent(msisdn)}/history`);
      if (!res.ok || cancelled) return;
      const body = await res.json();
      setEntries(body.entries);
    })();

    return () => {
      cancelled = true;
    };
  }, [msisdn, balance]);

  if (entries.length === 0) {
    return <p className="text-center text-gray-500 py-8">No activity yet</p>;
  }

  return (
    <ul className="divide-y divide-gray-100">
      {entries.map((e) =>
        e.kind === "transaction" ? (
          <TransactionRow key={e.localTxId} tx={e} />
        ) : (
          <GameRow key={e.sessionId} game={e} />
        )
      )}
    </ul>
  );
}
