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
import { parseMvolaStatus } from "@/lib/mvola/status";

/**
 * Retrieves the current status of a MVola transaction by correlationId and
 * applies wallet-side reconciliation when the transaction reaches a terminal
 * state for the first time. An unknown correlationId (no local record) is
 * tolerated — the MVola response is still forwarded unchanged. Delegates
 * interpretation of MVola's reply to parseMvolaStatus() so this route and
 * the callback route can never disagree about what a transaction's state is.
 *
 * @param _req          - The incoming Next.js request (unused beyond routing)
 * @param params.correlationId - The serverCorrelationId from the withdraw/deposit response
 *
 * @returns 200 `{ transactionStatus, status, serverCorrelationId, transactionReference, objectReference }` on success.
 * @returns 502 `{ error: string }` if MVola returns an error or the token cannot be acquired.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ correlationId: string }> }
): Promise<NextResponse> {
  const { correlationId } = await params;

  const localRecord = getTransactionByCorrelationId(correlationId);

  // Optimisation only: a settled transaction will not change. After this epic
  // that terminal state is only ever reached because MVola said so.
  if (localRecord && localRecord.status !== "pending") {
    return NextResponse.json({
      transactionStatus: localRecord.status,
      status: localRecord.status,
      serverCorrelationId: correlationId,
      transactionReference: localRecord.mvolaReference ?? "",
      objectReference: localRecord.mvolaReference ?? "",
    });
  }

  try {
    const token = await getToken();
    const statusResponse = await getTransactionStatus(correlationId, token);
    const { status, reference } = parseMvolaStatus(statusResponse);

    // Side-effect: reconcile local wallet state on the first terminal hit.
    // A missing local record (unknown correlationId) is tolerated — we just
    // skip the reconciliation and still return MVola's body to the caller.
    if (localRecord) {
      reconcileTransaction(localRecord, status, reference);
    }

    return NextResponse.json({
      ...statusResponse,
      transactionStatus: status,
      status,
      transactionReference: reference ?? "",
      objectReference: reference ?? "",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to retrieve transaction status";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
