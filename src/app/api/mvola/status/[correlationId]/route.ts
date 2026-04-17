/**
 * MVola Transaction Status Route — GET /api/mvola/status/[correlationId]
 *
 * Proxies the transaction status check to the MVola API.
 * The client polls this endpoint every 3 seconds after initiating a withdrawal,
 * passing the correlationId returned by the withdraw route.
 *
 * Delegates token acquisition to getToken() and status retrieval to
 * getTransactionStatus() — no direct MVola HTTP calls are made here.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/mvola/auth";
import { getTransactionStatus } from "@/lib/mvola/client";

/**
 * Retrieves the current status of a MVola transaction by correlationId.
 *
 * @param _req          - The incoming Next.js request (unused beyond routing)
 * @param params.correlationId - The serverCorrelationId from the withdraw response
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
    return NextResponse.json(statusResponse);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to retrieve transaction status";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
