/**
 * MVola Deposit Endpoint — POST /api/mvola/deposit
 *
 * Deposit initiation route. Validates the incoming request body,
 * acquires an OAuth token, calls initiateDeposit() from client.ts,
 * records a pending TransactionRecord, and returns the correlation metadata
 * for the client to poll.
 *
 * Important: This route does NOT credit the wallet. A deposit credits the
 * wallet only on confirmed settlement, which MVola reports later through the
 * callback webhook or a status poll; both reconcile through `reconcile.ts`
 * (rule R3). The record therefore stays `pending` with `walletSettled=false`
 * until MVola says otherwise.
 *
 * This route arms no timer and never completes a transaction itself (rule R1).
 * It reads no environment variable either — `client.ts::getBaseUrl()` is the
 * single place the target environment is selected, and it changes the base URL
 * and nothing else (rule R2). In sandbox a deposit therefore stays `pending`
 * until it is approved by hand in MVola's developer portal.
 *
 * Does NOT call the MVola API directly — delegates entirely to:
 * - getToken()         from auth.ts             (token acquisition + caching)
 * - initiateDeposit()  from client.ts           (HTTP call to MVola merchant pay)
 * - createTransaction() from store/transactions (records pending tx)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/mvola/auth";
import { initiateDeposit } from "@/lib/mvola/client";
import { createTransaction } from "@/lib/store/transactions";

/**
 * Initiates a deposit by validating the request, acquiring a token,
 * calling MVola, and recording a pending transaction.
 *
 * @param req - The incoming Next.js request containing the JSON body
 * @returns 200 `{ correlationId, localTxId, status: "pending" }` on success.
 * @returns 400 `{ error: "msisdn and amount are required" }` if either field is absent.
 * @returns 400 `{ error: "amount must be a positive integer" }` if amount is invalid.
 * @returns 502 `{ error: "MVola API error", details }` on MVola failure (no tx recorded).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Parse request body — treat malformed JSON as missing fields
  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    // Malformed JSON — fall through to validation which will return 400
  }

  const msisdn = body?.msisdn as string | undefined;
  const rawAmount = body?.amount;

  // Validate presence of required fields first
  if (!msisdn || rawAmount === undefined || rawAmount === null) {
    return NextResponse.json(
      { error: "msisdn and amount are required" },
      { status: 400 }
    );
  }

  // Coerce and validate amount as a positive integer
  const amount = Number(rawAmount);
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive integer" },
      { status: 400 }
    );
  }

  // Acquire token then call MVola — both failures surface as 502
  // Transaction record is only created after MVola returns successfully
  try {
    const token = await getToken();

    const mvolaResponse = await initiateDeposit({ msisdn, amount }, token);

    const record = createTransaction({
      msisdn,
      direction: "deposit",
      amount,
      correlationId: mvolaResponse.serverCorrelationId,
      walletSettled: false,
    });

    return NextResponse.json(
      {
        correlationId: record.correlationId,
        localTxId: record.localTxId,
        status: "pending",
      },
      { status: 200 }
    );
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "MVola API error", details },
      { status: 502 }
    );
  }
}
