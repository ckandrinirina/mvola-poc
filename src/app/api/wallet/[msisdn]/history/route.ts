/**
 * History Query Route — GET /api/wallet/[msisdn]/history
 *
 * Returns a merged, time-sorted array of every TransactionRecord and
 * GameSession for the given MSISDN. Each entry is tagged with:
 *   - kind: "transaction" for wallet transactions
 *   - kind: "game" for coin-flip game sessions
 *
 * Sorting uses createdAt for transactions and playedAt for games (descending).
 * Returns an empty array for an unknown MSISDN (200, not 404).
 */

import { NextRequest, NextResponse } from "next/server";
import { listTransactionsByMsisdn } from "@/lib/store/transactions";
import { listGameSessionsByMsisdn } from "@/lib/store/games";

interface RouteContext {
  params: Promise<{ msisdn: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { msisdn } = await context.params;

  const transactions = listTransactionsByMsisdn(msisdn).map((t) => ({
    kind: "transaction" as const,
    localTxId: t.localTxId,
    correlationId: t.correlationId,
    direction: t.direction,
    amount: t.amount,
    status: t.status,
    walletSettled: t.walletSettled,
    ...(t.mvolaReference !== undefined
      ? { mvolaReference: t.mvolaReference }
      : {}),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    _sortKey: t.createdAt,
  }));

  const games = listGameSessionsByMsisdn(msisdn).map((g) => ({
    kind: "game" as const,
    sessionId: g.sessionId,
    bet: g.bet,
    choice: g.choice,
    outcome: g.outcome,
    result: g.result,
    delta: g.delta,
    balanceAfter: g.balanceAfter,
    playedAt: g.playedAt,
    _sortKey: g.playedAt,
  }));

  const entries = [...transactions, ...games]
    .sort((a, b) => b._sortKey - a._sortKey)
    .map(({ _sortKey, ...rest }) => rest);

  return NextResponse.json({ msisdn, entries }, { status: 200 });
}
