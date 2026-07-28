/**
 * MVola Transaction Details Route — GET /api/mvola/transaction/[transactionReference]
 *
 * Serves MVola's authoritative record of a settled transaction beside this
 * application's own record of it, so a reviewer can see that local
 * bookkeeping and MVola's ledger agree. The comparison is presented, not
 * asserted: the response carries no verdict/match/diff field, and the
 * `mvola` object is forwarded unaltered — reshaping it to resemble `local`
 * would defeat the point of showing two independently-kept records side by
 * side.
 *
 * Delegates the local lookup to getTransactionByMvolaReference() (store) and
 * the MVola call to getToken() (auth.ts) + getTransactionDetails()
 * (client.ts) — no direct MVola HTTP calls are made here.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/mvola/auth";
import { getTransactionDetails } from "@/lib/mvola/client";
import { getTransactionByMvolaReference } from "@/lib/store/transactions";

export const runtime = "nodejs";

/**
 * Retrieves MVola's record of a settled transaction alongside the local
 * record that carries the same reference. The local record is checked
 * first: it costs nothing, avoids an unnecessary token acquisition and
 * MVola round-trip for a reference this application has never seen, and
 * makes the 404 path independent of MVola's availability.
 *
 * @param _req                       - The incoming Next.js request (unused beyond routing)
 * @param params.transactionReference - The reference MVola issued at settlement
 *
 * @returns 200 `{ mvola, local }` — `mvola` forwarded verbatim from getTransactionDetails(),
 *          `local` the TransactionRecord found via getTransactionByMvolaReference().
 * @returns 404 `{ error: "No local transaction carries that reference" }` when no local
 *          record carries the reference. MVola is not called on this path.
 * @returns 502 `{ error: "MVola API error", details }` when token acquisition or the
 *          MVola details call fails. Nothing is fabricated — a MVola rejection is
 *          surfaced as-is, never masked with a synthesised record.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ transactionReference: string }> }
): Promise<NextResponse> {
  const { transactionReference } = await params;

  const local = getTransactionByMvolaReference(transactionReference);
  if (!local) {
    return NextResponse.json(
      { error: "No local transaction carries that reference" },
      { status: 404 }
    );
  }

  try {
    const token = await getToken();
    const mvola = await getTransactionDetails(transactionReference, token);
    return NextResponse.json({ mvola, local });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "MVola API error", details },
      { status: 502 }
    );
  }
}
