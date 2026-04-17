/**
 * MVola Withdraw Endpoint — POST /api/mvola/withdraw
 *
 * Primary payout initiation route. Validates the incoming request body,
 * acquires an OAuth token, calls initiateWithdrawal() from client.ts,
 * and returns the correlationId for the caller to poll.
 *
 * Does NOT call the MVola API directly — delegates entirely to:
 * - getToken()          from auth.ts   (token acquisition + caching)
 * - initiateWithdrawal() from client.ts (HTTP call to MVola merchant pay)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/mvola/auth";
import { initiateWithdrawal } from "@/lib/mvola/client";

/**
 * Initiates a withdrawal by validating the request, acquiring a token,
 * and delegating to initiateWithdrawal().
 *
 * @param req - The incoming Next.js request containing the JSON body
 * @returns 200 `{ correlationId, status: "pending" }` on success.
 * @returns 400 `{ error }` if required fields are missing.
 * @returns 502 `{ error: "MVola API error", details }` on MVola failure.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Parse and validate the request body
  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    // Malformed JSON — treat as missing required fields
  }

  const amount = body?.amount as string | undefined;
  const playerMsisdn = body?.playerMsisdn as string | undefined;
  const description = (body?.description as string | undefined) ?? "Game withdrawal";

  if (!amount || !playerMsisdn) {
    return NextResponse.json(
      { error: "amount and playerMsisdn are required" },
      { status: 400 }
    );
  }

  // Acquire token then call MVola — both failures surface as 502
  try {
    const token = await getToken();

    const result = await initiateWithdrawal(
      {
        amount: String(amount),
        currency: "Ar",
        descriptionText: description,
        playerMsisdn,
      },
      token
    );

    return NextResponse.json({
      correlationId: result.serverCorrelationId,
      status: "pending",
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "MVola API error", details },
      { status: 502 }
    );
  }
}
