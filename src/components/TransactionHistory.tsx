"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useMsisdnContext } from "./WalletHeader";
import { PendingApprovalBanner } from "./PendingApprovalBanner";
import type { TransactionComparison } from "@/lib/mvola/types";

/** Fallback used until `/api/config/polling` resolves — matches `POLL_TIMEOUT_MS`'s
 * own default in `src/lib/mvola/polling.ts`, so a pending row reads correctly even
 * during the brief window before the config fetch settles. */
const DEFAULT_POLL_TIMEOUT_MS = 120_000;

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

// ---- Generic record-column rendering -----------------------------------------

/** A MVola `debitParty`/`creditParty`-shaped element: `{ key, value }`. */
function isPartyLike(value: unknown): value is { key: unknown; value: unknown } {
  return typeof value === "object" && value !== null && "key" in value && "value" in value;
}

/**
 * Formats an arbitrary field value for display without assuming a fixed shape —
 * the MVola details response's key set is not fixed (story 09-07/09-14), so this
 * renders whatever comes back instead of reading named fields.
 */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isPartyLike)) {
      return (value as { key: unknown; value: unknown }[])
        .map((p) => `${String(p.key)}: ${String(p.value)}`)
        .join(", ");
    }
    return value.map((v) => formatFieldValue(v)).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Renders one labelled, source-attributed column of an arbitrary record's fields. */
function RecordColumn({ title, record }: { title: string; record: Record<string, unknown> }) {
  const fields = Object.entries(record).filter(([, v]) => v !== undefined);
  return (
    <div className="flex-1 min-w-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
        {title}
      </h4>
      <dl className="space-y-1">
        {fields.map(([key, value]) => (
          <div key={key} className="flex gap-1 text-xs text-gray-700">
            <dt className="font-medium shrink-0">{key}:</dt>
            <dd className="truncate">{formatFieldValue(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---- Settled-row comparison (expand control + fetch-once panel) -------------

type DetailsState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "loaded"; comparison: TransactionComparison };

/**
 * A settled (`completed`/`failed`) row's MVola-comparison affordance. Fetches
 * `GET /api/mvola/transaction/{mvolaReference}` once, lazily, on first expand —
 * state lives here (not in a child unmounted on collapse) so collapsing and
 * re-expanding never re-fetches.
 */
function SettledRowComparison({ mvolaReference }: { mvolaReference: string }) {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<DetailsState>({ phase: "idle" });
  const fetchedRef = useRef(false);

  const loadDetails = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const res = await fetch(
        `/api/mvola/transaction/${encodeURIComponent(mvolaReference)}`
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          res.status === 404
            ? (body.error ?? "No local transaction carries that reference")
            : `${body.error ?? "MVola API error"}${body.details ? `: ${body.details}` : ""}`;
        setState({ phase: "error", message });
        return;
      }
      setState({ phase: "loaded", comparison: body as TransactionComparison });
    } catch {
      setState({ phase: "error", message: "Could not reach the server — try again" });
    }
  }, [mvolaReference]);

  const handleToggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      if (next && !fetchedRef.current) {
        fetchedRef.current = true;
        void loadDetails();
      }
      return next;
    });
  };

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        className="text-xs font-medium text-blue-700 underline"
      >
        {expanded ? "Hide MVola comparison" : "Compare with MVola"}
      </button>
      {expanded && (
        <div className="mt-2">
          {state.phase === "loading" && (
            <p aria-live="polite" className="text-xs text-gray-500">
              Loading transaction details…
            </p>
          )}
          {state.phase === "error" && (
            <div role="alert" className="space-y-1 text-xs text-red-700">
              <p>{state.message}</p>
              <button
                type="button"
                onClick={() => void loadDetails()}
                className="font-medium underline"
              >
                Retry
              </button>
            </div>
          )}
          {state.phase === "loaded" && (
            <div className="flex gap-4">
              <RecordColumn title="MVola record" record={state.comparison.mvola} />
              {/* TransactionRecord has no index signature (unlike TransactionDetailsResponse),
                  so it needs an explicit widening to the generic renderer's Record shape —
                  every one of its fields is already a concrete, known-safe value. */}
              <RecordColumn
                title="Local record"
                record={state.comparison.local as unknown as Record<string, unknown>}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- TransactionRow ---------------------------------------------------------

function TransactionRow({
  tx,
  pollTimeoutMs,
}: {
  tx: TransactionEntry;
  pollTimeoutMs: number;
}) {
  const isDeposit = tx.direction === "deposit";
  const directionArrow = isDeposit ? "↓" : "↑";
  const amountSign = isDeposit ? `+${formatAmount(tx.amount)}` : `−${formatAmount(tx.amount)}`;
  const amountColor = isDeposit ? "text-green-700" : "text-red-700";
  const time = formatRelativeTime(tx.createdAt);
  const isSettled = tx.status === "completed" || tx.status === "failed";

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
        {tx.status === "pending" && (
          <div className="mt-2">
            <PendingApprovalBanner startedAt={tx.createdAt} pollTimeoutMs={pollTimeoutMs} />
          </div>
        )}
        {isSettled && tx.mvolaReference && (
          <SettledRowComparison mvolaReference={tx.mvolaReference} />
        )}
        {isSettled && !tx.mvolaReference && (
          <p className="mt-1 text-xs text-gray-400 italic">
            No MVola reference was recorded at settlement — nothing to compare.
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
  const [pollTimeoutMs, setPollTimeoutMs] = useState(DEFAULT_POLL_TIMEOUT_MS);

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

  // Fetched once, independent of msisdn/balance — the polling ceiling shown by
  // PendingApprovalBanner doesn't depend on which wallet is active, and this
  // must not re-run (and re-render every row) on every balance tick.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/config/polling");
        if (!res.ok || cancelled) return;
        const body = await res.json();
        if (typeof body.pollTimeoutMs === "number") {
          setPollTimeoutMs(body.pollTimeoutMs);
        }
      } catch {
        // Keep DEFAULT_POLL_TIMEOUT_MS — a config-fetch failure must not break history.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (entries.length === 0) {
    return <p className="text-center text-gray-500 py-8">No activity yet</p>;
  }

  return (
    <ul className="divide-y divide-gray-100">
      {entries.map((e) =>
        e.kind === "transaction" ? (
          <TransactionRow key={e.localTxId} tx={e} pollTimeoutMs={pollTimeoutMs} />
        ) : (
          <GameRow key={e.sessionId} game={e} />
        )
      )}
    </ul>
  );
}
