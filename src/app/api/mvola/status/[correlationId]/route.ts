/**
 * MVola Transaction Status Route — GET /api/mvola/status/[correlationId]
 *
 * Proxies the transaction status check to the MVola API AND, on the first
 * terminal transition for a known correlationId, reconciles the local
 * wallet + transaction store via `reconcileTransaction`. The reconciliation
 * is a side-effect: the response body always mirrors MVola's reply so the
 * caller sees the same status regardless of local state.
 *
 * Delegates token acquisition to getToken() and status retrieval to
 * getTransactionStatus() — no direct MVola HTTP calls are made here.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/mvola/auth";
import { getTransactionStatus } from "@/lib/mvola/client";
import { getTransactionByCorrelationId } from "@/lib/store/transactions";
import { reconcileTransaction } from "@/lib/mvola/reconcile";

/**
 * Retrieves the current status of a MVola transaction by correlationId and
 * applies wallet-side reconciliation when the transaction reaches a terminal
 * state for the first time. An unknown correlationId (no local record) is
 * tolerated — the MVola response is still forwarded unchanged.
 *
 * @param _req          - The incoming Next.js request (unused beyond routing)
 * @param params.correlationId - The serverCorrelationId from the withdraw/deposit response
 *
 * @returns 200 `{ transactionStatus, serverCorrelationId, transactionReference }` on success.
 * @returns 502 `{ error: string }` if MVola returns an error or the token cannot be acquired.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ correlationId: string }> }
): Promise<NextResponse> {
  const { correlationId } = await params;

  try {
    const token = await getToken();
    const statusResponse = await getTransactionStatus(correlationId, token);

    // Side-effect: reconcile local wallet state on the first terminal hit.
    // A missing local record (unknown correlationId) is tolerated — we just
    // skip the reconciliation and still return MVola's body to the caller.
    const record = getTransactionByCorrelationId(correlationId);
    if (record) {
      reconcileTransaction(
        record,
        statusResponse.transactionStatus,
        statusResponse.transactionReference
      );
    }

    return NextResponse.json(statusResponse);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to retrieve transaction status";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
