/**
 * Balance Query Route — GET /api/wallet/[msisdn]/balance
 *
 * Read-only endpoint returning the current wallet balance for an MSISDN.
 * If the MSISDN has never been seen, returns { balance: 0, updatedAt: null }
 * with status 200 — this simplifies the UI which polls this route on every render.
 *
 * No authentication, no mutation, no MVola API call.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWallet } from "@/lib/store/wallets";

interface RouteContext {
  params: Promise<{ msisdn: string }>;
}

/**
 * Returns the current wallet balance for the given MSISDN.
 *
 * @param _req            - The incoming Next.js request (unused beyond routing)
 * @param context.params  - Dynamic route params containing the msisdn path segment
 *
 * @returns 200 `{ msisdn, balance, updatedAt }` — balance defaults to 0 and updatedAt
 *          to null when the MSISDN is not found in the store.
 */
export async function GET(_req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { msisdn } = await context.params;
  const wallet = getWallet(msisdn);
  return NextResponse.json(
    {
      msisdn,
      balance: wallet?.balance ?? 0,
      updatedAt: wallet?.updatedAt ?? null,
    },
    { status: 200 },
  );
}
