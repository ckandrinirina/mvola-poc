/**
 * MVola Callback Webhook — PUT /api/mvola/callback
 *
 * MVola calls this endpoint asynchronously via HTTP PUT when a transaction
 * completes (or fails). The route MUST always return 200 OK; any other status
 * causes MVola to retry the notification.
 *
 * On each delivery the route:
 *  1. Parses the JSON body and reads serverCorrelationId directly (it is not
 *     part of parseMvolaStatus()'s contract).
 *  2. Looks up the local TransactionRecord by serverCorrelationId.
 *  3. Reads the reported status and reference through parseMvolaStatus()
 *     (`@/lib/mvola/status`) — the same reader the status-polling route uses
 *     — so a callback and a status poll reaching the same conclusion cannot
 *     disagree about what MVola said (rule R4). An unreadable status parses
 *     as "pending", which reconcileTransaction() treats as a no-op (rule R3).
 *  4. Invokes reconcileTransaction() when the record is found; the helper
 *     enforces idempotency via the walletSettled flag (see story 06-04).
 *  5. Returns 200 { received: true } in every case — even for unknown
 *     correlationIds, parse errors, and reconciliation errors — to prevent
 *     MVola from retrying indefinitely.
 *
 * Personal data is NOT logged; only serverCorrelationId and transactionStatus
 * are included in log lines.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTransactionByCorrelationId } from "@/lib/store/transactions";
import { reconcileTransaction } from "@/lib/mvola/reconcile";
import { parseMvolaStatus } from "@/lib/mvola/status";

/**
 * Handles the asynchronous MVola payment notification.
 *
 * @param req - The incoming PUT request from MVola.
 * @returns A 200 JSON response `{ received: true }` in all cases.
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { serverCorrelationId } = body ?? {};

    if (!serverCorrelationId) {
      console.warn(
        "[mvola/callback] Missing serverCorrelationId in payload",
        body
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const record = getTransactionByCorrelationId(serverCorrelationId);

    if (!record) {
      console.warn(
        "[mvola/callback] Unknown correlationId",
        serverCorrelationId
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    try {
      const { status, reference } = parseMvolaStatus(body);
      reconcileTransaction(record, status, reference);
    } catch (reconcileErr) {
      console.error(
        "[mvola/callback] Reconciliation error for correlationId",
        serverCorrelationId,
        reconcileErr
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[mvola/callback] Unhandled error parsing body", err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
