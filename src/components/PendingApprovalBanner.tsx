"use client";

/**
 * PendingApprovalBanner — the approval affordance
 *
 * Sandbox MVola transactions do not settle on their own: they stay `pending` until a
 * human approves them in MVola's developer portal. This component gives that wait a
 * voice — what is being waited on, how long it has been waiting, how much polling
 * budget remains, and a link to where the approval happens — so a viewer sees a
 * system waiting on a person, not a hung application.
 *
 * Purely presentational: it takes its timing from props (never hardcodes MVola's
 * `POLL_INTERVAL_MS`/`POLL_TIMEOUT_MS`) and owns no transaction state itself. Callers
 * (DepositForm, CashOutForm, TransactionHistory) decide whether a transaction is
 * pending; this component decides only what to say while it is.
 */

import { useEffect, useState } from "react";

/** MVola's developer-portal root — the sub-path for "Transaction Approvals" is reached
 * via in-portal navigation (hover the account menu → "Transaction Approvals") and has
 * no stable direct URL documented anywhere in the developer guide, so linking the root
 * and naming the page in the link text avoids a link that 404s in front of an audience. */
const DEVELOPER_PORTAL_URL = "https://developer.mvola.mg/devportal/";

/** How often the elapsed/remaining display refreshes, in milliseconds. */
const TICK_MS = 1000;

export interface PendingApprovalBannerProps {
  /**
   * ms epoch when the transaction was submitted. `null`/`undefined` means there is no
   * pending transaction to show — the component renders nothing in that case.
   */
  startedAt: number | null | undefined;
  /** ms budget before the client reports "still pending" instead of settling. */
  pollTimeoutMs: number;
  /**
   * Caller-controlled override for the timed-out state. When omitted, the banner
   * derives it from elapsed time reaching `pollTimeoutMs` on its own clock.
   */
  timedOut?: boolean;
}

/**
 * Formats a millisecond duration as `m:ss` for compact display.
 *
 * @param ms - the duration in milliseconds; negative values clamp to zero
 * @returns a `minutes:seconds` string, seconds zero-padded to two digits
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Renders the pending-approval affordance for a sandbox MVola transaction.
 *
 * @param props - {@link PendingApprovalBannerProps}
 * @returns the banner element while `startedAt` is set, otherwise `null`
 */
export function PendingApprovalBanner({
  startedAt,
  pollTimeoutMs,
  timedOut,
}: PendingApprovalBannerProps) {
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second so elapsed/remaining stay live. No timer is started (and none
  // needs clearing) when there is nothing pending to show.
  useEffect(() => {
    if (startedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [startedAt]);

  if (startedAt == null) return null;

  const elapsedMs = Math.max(0, now - startedAt);
  const remainingMs = Math.max(0, pollTimeoutMs - elapsedMs);
  const isTimedOut = timedOut ?? elapsedMs >= pollTimeoutMs;

  return (
    <div
      role="status"
      className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
    >
      {isTimedOut ? (
        <>
          <p className="font-semibold">
            Still pending — MVola has not settled this yet
          </p>
          <p>
            Settlement may still arrive by callback — this is not the end of the
            road, and nothing has moved on the strength of this timeout.
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold">Waiting for MVola approval</p>
          <p>
            This sandbox transaction stays pending until a human approves it in
            MVola&apos;s developer portal — it will not settle on its own.
          </p>
          <p>
            Elapsed: <span className="font-mono">{formatDuration(elapsedMs)}</span>
            {" · "}
            Remaining budget:{" "}
            <span className="font-mono">{formatDuration(remainingMs)}</span>
          </p>
        </>
      )}
      <a
        href={DEVELOPER_PORTAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block font-medium underline hover:text-amber-900"
      >
        Open MVola Developer Portal — Transaction Approvals
      </a>
    </div>
  );
}
