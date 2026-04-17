/**
 * MVola Token Debug Endpoint — POST /api/mvola/token
 *
 * Returns the current MVola access token and a fixed expiry hint.
 * This endpoint is intended for debugging and testing only; it should
 * be removed or restricted before going to production.
 *
 * Does NOT call the MVola API directly — delegates entirely to
 * `getToken()` from auth.ts, which handles caching and refresh.
 */

import { NextResponse } from "next/server";
import { getToken } from "@/lib/mvola/auth";

/**
 * Acquires a valid MVola access token and returns it to the caller.
 *
 * @returns 200 `{ access_token, expires_in }` on success.
 * @returns 500 `{ error }` if token acquisition fails for any reason.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const token = await getToken();
    return NextResponse.json({ access_token: token, expires_in: 3600 });
  } catch {
    return NextResponse.json(
      { error: "Failed to acquire token" },
      { status: 500 }
    );
  }
}
