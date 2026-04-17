/**
 * MVola Callback Webhook — PUT /api/mvola/callback
 *
 * MVola calls this endpoint asynchronously via HTTP PUT when a transaction
 * completes (or fails). The route MUST always return 200 OK; any other status
 * causes MVola to retry the notification.
 *
 * In this PoC the full payload is logged to console so it can be inspected
 * during development via ngrok or server logs.
 */

import { NextRequest, NextResponse } from "next/server";
import type { CallbackPayload } from "@/lib/mvola/types";

/**
 * Handles the asynchronous MVola payment notification.
 *
 * @param req - The incoming PUT request from MVola.
 * @returns A 200 JSON response `{ received: true }` in all cases.
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  // Accept any JSON body — even an unexpected shape — to prevent retries.
  const payload: CallbackPayload = await req.json();

  console.log("[MVola Callback]", JSON.stringify(payload, null, 2));

  return NextResponse.json({ received: true });
}
