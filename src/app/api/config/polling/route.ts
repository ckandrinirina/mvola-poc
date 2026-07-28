/**
 * Polling Config Route — GET /api/config/polling
 *
 * Hands the browser the two polling knobs from `src/lib/mvola/polling.ts` — the interval
 * between status polls and the ceiling before the client reports "still pending". Kept as
 * a route rather than a `NEXT_PUBLIC_` env var so the ceiling can be adjusted (e.g. before
 * a demo) by restarting the dev server, without a rebuild.
 *
 * The payload is explicitly enumerated and MUST stay minimal: no credentials, no env dump,
 * no `MVOLA_ENV` (rule R5). Do not spread anything derived from `process.env` into it.
 */

import { NextRequest, NextResponse } from "next/server";
import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "@/lib/mvola/polling";

/**
 * Returns the current polling policy for the browser to use.
 *
 * @returns 200 `{ pollIntervalMs, pollTimeoutMs }` — always this exact shape, nothing else.
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {
      pollIntervalMs: POLL_INTERVAL_MS,
      pollTimeoutMs: POLL_TIMEOUT_MS,
    },
    { status: 200 },
  );
}
