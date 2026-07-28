/**
 * Shared MVola Status Reader
 *
 * The single interpretation of MVola's progress reply. Both the status-polling
 * route (`GET /api/mvola/status/[correlationId]`) and the webhook callback
 * route (`PUT /api/mvola/callback`) parse their MVola payload through
 * `parseMvolaStatus()` so the two entry points cannot disagree about what a
 * transaction's state is. Delegates to no other module.
 *
 * Accepts either field spelling MVola might send: `status`/`objectReference`
 * (the verified shape of the transaction-status response) or
 * `transactionStatus`/`transactionReference` (the shape the integration
 * previously assumed everywhere). See story 09-02's Technical Notes for why
 * this tolerance is deliberate rather than hedging — the callback payload's
 * real shape is unverified, and asserting one spelling risks silently
 * misreading every callback until story 09-14 records a real delivery.
 */

import type { TransactionStatus } from "./types";

const KNOWN_STATUSES: readonly TransactionStatus[] = [
  "pending",
  "completed",
  "failed",
];

/**
 * Reads MVola's progress and settled reference from an untrusted payload.
 *
 * Progress is read as `status ?? transactionStatus`; the settled reference as
 * `objectReference ?? transactionReference`. An unrecognised, missing, or
 * malformed status always yields `"pending"` — never a terminal state — so a
 * record can never settle because a payload was unreadable. `payload` being
 * `null`, `undefined`, a non-object primitive, or an array is tolerated the
 * same way rather than thrown.
 *
 * @param payload - The raw MVola status/callback response body (untrusted).
 * @returns The normalised `status`, and `reference` (`undefined` when absent
 *          or an empty string).
 */
export function parseMvolaStatus(
  payload: unknown
): { status: TransactionStatus; reference?: string } {
  const record = asPlainRecord(payload);

  const rawStatus =
    typeof record.status === "string" ? record.status : record.transactionStatus;
  const status = isKnownStatus(rawStatus) ? rawStatus : "pending";

  const rawReference = record.objectReference ?? record.transactionReference;
  const reference =
    typeof rawReference === "string" && rawReference !== "" ? rawReference : undefined;

  return { status, reference };
}

/**
 * Narrows `payload` to a plain property bag, mapping every non-object shape
 * (`null`, `undefined`, strings, numbers, booleans) and arrays — which are
 * `typeof "object"` too but carry no MVola-shaped keys — to an empty record,
 * so property reads below always land on `undefined` instead of throwing.
 */
function asPlainRecord(payload: unknown): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {};
  }
  return payload as Record<string, unknown>;
}

function isKnownStatus(value: unknown): value is TransactionStatus {
  return (
    typeof value === "string" &&
    (KNOWN_STATUSES as readonly string[]).includes(value)
  );
}
