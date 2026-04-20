/**
 * MVola Withdraw Endpoint — POST /api/mvola/withdraw
 *
 * Wallet-aware cash-out route. The in-game wallet is the source of truth
 * for available funds, so the route:
 *
 *   1. Validates the request body (msisdn + positive-integer amount).
 *      `playerMsisdn` is accepted as a legacy alias for `msisdn`.
 *   2. Reserves the funds by debiting the wallet BEFORE any async work.
 *      If the wallet has insufficient balance, returns 409 immediately.
 *   3. Acquires an OAuth token and calls `initiateWithdrawal()`. If either
 *      step throws synchronously, the wallet is refunded and a 502 is
 *      returned — no transaction record is created.
 *   4. On success, records a `TransactionRecord` with `walletSettled=true`
 *      and returns `{ correlationId, localTxId, status: "pending" }`.
 *
 * The route does NOT call MVola's HTTP endpoints directly — it delegates
 * entirely to `getToken()` (auth.ts) and `initiateWithdrawal()` (client.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/mvola/auth";
import { initiateWithdrawal } from "@/lib/mvola/client";
import { createTransaction, getTransactionByCorrelationId } from "@/lib/store/transactions";
import { creditWallet, debitWallet } from "@/lib/store/wallets";
import { InsufficientFundsError } from "@/lib/mvola/types";
import { reconcileTransaction } from "@/lib/mvola/reconcile";

const DEFAULT_DESCRIPTION = "Game withdrawal";
const SANDBOX_AUTO_COMPLETE_MS = 3000;

/**
 * Parsed, validated request body. Only produced after validation succeeds.
 */
interface WithdrawInput {
  msisdn: string;
  amount: number;
  description: string;
}

/**
 * Parses the raw body into a validated `WithdrawInput`, or returns a
 * `NextResponse` describing the 400 validation failure.
 *
 * Accepts `playerMsisdn` as a legacy alias for `msisdn`.
 * Accepts `amount` as either a number or a numeric string; rejects
 * anything that isn't a positive integer.
 */
function parseBody(
  raw: Record<string, unknown> | null,
): WithdrawInput | NextResponse {
  const msisdn =
    (raw?.msisdn as string | undefined) ??
    (raw?.playerMsisdn as string | undefined);
  const rawAmount = raw?.amount as string | number | undefined;

  if (!msisdn || rawAmount === undefined || rawAmount === null || rawAmount === "") {
    return NextResponse.json(
      { error: "msisdn and amount are required" },
      { status: 400 },
    );
  }

  const parsedAmount =
    typeof rawAmount === "number" ? rawAmount : Number(rawAmount);

  if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive integer" },
      { status: 400 },
    );
  }

  const description =
    (raw?.description as string | undefined) ?? DEFAULT_DESCRIPTION;

  return { msisdn, amount: parsedAmount, description };
}

/**
 * Reserves `amount` from the wallet via `debitWallet`. On insufficient
 * funds, returns a 409 response. Any other error propagates.
 */
function reserveFunds(msisdn: string, amount: number): NextResponse | null {
  try {
    debitWallet(msisdn, amount);
    return null;
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return NextResponse.json(
        {
          error: "Insufficient funds",
          balance: err.balance,
          requested: err.requested,
        },
        { status: 409 },
      );
    }
    throw err;
  }
}

/**
 * Handles a withdraw request end-to-end. See module docstring for the flow.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- 1. Parse + validate body ---
  let rawBody: Record<string, unknown> | null = null;
  try {
    rawBody = await req.json();
  } catch {
    // Malformed JSON falls through as missing fields.
  }

  const parsed = parseBody(rawBody);
  if (parsed instanceof NextResponse) {
    return parsed;
  }
  const { msisdn, amount, description } = parsed;

  // --- 2. Reserve funds synchronously (before any await) ---
  const reserveFailure = reserveFunds(msisdn, amount);
  if (reserveFailure) return reserveFailure;

  // --- 3. Call MVola; refund the wallet on any sync error ---
  // Sandbox-only shim: the MVola developer sandbox does not support the
  // payout direction (merchant → customer) for this partner account, so
  // calling initiateWithdrawal() always returns 4002. Skip the MVola call
  // when not in production and generate a fake correlationId that the
  // auto-complete timer below will reconcile. Production still hits MVola.
  const isSandbox = process.env.MVOLA_ENV !== "production";
  let correlationId: string;
  if (isSandbox) {
    correlationId = crypto.randomUUID();
  } else {
    try {
      const token = await getToken();
      const mvolaResponse = await initiateWithdrawal(
        {
          amount: String(amount),
          currency: "Ar",
          descriptionText: description,
          playerMsisdn: msisdn,
        },
        token,
      );
      correlationId = mvolaResponse.serverCorrelationId;
    } catch (err) {
      creditWallet(msisdn, amount); // refund
      const details = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "MVola API error", details },
        { status: 502 },
      );
    }
  }

  // --- 4. Record the transaction; wallet has already been settled ---
  const record = createTransaction({
    msisdn,
    direction: "withdraw",
    amount,
    correlationId,
    walletSettled: true,
  });

  // Sandbox demo: auto-complete after a short delay so the pending → completed
  // transition is visible without relying on MVola (which never fires the
  // callback in sandbox for the payout direction).
  if (isSandbox) {
    const timer = setTimeout(() => {
      const latest = getTransactionByCorrelationId(record.correlationId);
      if (latest && latest.status === "pending") {
        reconcileTransaction(latest, "completed", `MVL-SANDBOX-${record.localTxId.slice(0, 8)}`);
      }
    }, SANDBOX_AUTO_COMPLETE_MS);
    timer.unref?.();
  }

  return NextResponse.json({
    correlationId: record.correlationId,
    localTxId: record.localTxId,
    status: "pending",
  });
}
