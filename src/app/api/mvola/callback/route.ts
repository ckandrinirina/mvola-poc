/**
 * MVola Callback Webhook — PUT /api/mvola/callback
 *
 * MVola calls this endpoint asynchronously via HTTP PUT when a transaction
 * completes (or fails). The route MUST always return 200 OK; any other status
 * causes MVola to retry the notification.
 *
 * On each delivery the route:
 *  1. Parses the JSON body and extracts serverCorrelationId, transactionStatus,
 *     and transactionReference.
 *  2. Looks up the local TransactionRecord by serverCorrelationId.
 *  3. Invokes reconcileTransaction() when the record is found; the helper
 *     enforces idempotency via the walletSettled flag (see story 06-04).
 *  4. Returns 200 { received: true } in every case — even for unknown
 *     correlationIds, parse errors, and reconciliation errors — to prevent
 *     MVola from retrying indefinitely.
 *
 * Personal data is NOT logged; only serverCorrelationId and transactionStatus
 * are included in log lines.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTransactionByCorrelationId } from "@/lib/store/transactions";
import { reconcileTransaction } from "@/lib/mvola/reconcile";

/**
 * Handles the asynchronous MVola payment notification.
 *
 * @param req - The incoming PUT request from MVola.
 * @returns A 200 JSON response `{ received: true }` in all cases.
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { serverCorrelationId, transactionStatus, transactionReference } =
      body ?? {};

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
      reconcileTransaction(record, transactionStatus, transactionReference);
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
