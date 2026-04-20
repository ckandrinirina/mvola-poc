/**
 * Coin-Flip Round Handler — POST /api/game/coinflip (Story 07-02)
 *
 * Validates the request body, checks the wallet balance, debits the bet,
 * calls the pure playCoinFlip function, credits 2 * bet on a win, records
 * a GameSession, and returns { sessionId, outcome, result, delta, balanceAfter }.
 *
 * The balance-check / debit / game / credit pipeline is entirely synchronous
 * (no awaits) to preserve atomicity within the same event-loop tick.
 */

import { NextRequest, NextResponse } from "next/server";
import { playCoinFlip } from "@/lib/game/coinflip";
import { debitWallet, creditWallet, getWallet } from "@/lib/store/wallets";
import { recordGameSession } from "@/lib/store/games";
import { InsufficientFundsError, GameChoice } from "@/lib/mvola/types";

/** Valid choices the player can submit. */
const VALID_CHOICES: readonly GameChoice[] = ["heads", "tails"];

/**
 * Validates the parsed request body.
 *
 * @returns A string describing the first validation error, or null if valid.
 */
function validateBody(
  body: Record<string, unknown> | null
): string | null {
  if (!body) return "Request body is required";

  const { msisdn, bet, choice } = body;

  if (typeof msisdn !== "string" || msisdn.trim() === "") {
    return "msisdn must be a non-empty string";
  }

  if (typeof bet !== "number" || !Number.isInteger(bet) || bet <= 0) {
    return "bet must be a positive integer";
  }

  if (!VALID_CHOICES.includes(choice as GameChoice)) {
    return `choice must be "heads" or "tails"`;
  }

  return null;
}

/**
 * Handles a single coin-flip round.
 *
 * @param req - Incoming Next.js request with JSON body { msisdn, bet, choice }
 * @returns 200 `{ sessionId, outcome, result, delta, balanceAfter }` on success.
 * @returns 400 `{ error: "Invalid request", details }` on validation failure.
 * @returns 409 `{ error: "Insufficient funds", balance, requested }` when wallet < bet.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Parse body — treat malformed JSON as missing body
  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    // Intentionally swallowed — validateBody handles null body
  }

  // Validate input
  const validationError = validateBody(body);
  if (validationError) {
    return NextResponse.json(
      { error: "Invalid request", details: validationError },
      { status: 400 }
    );
  }

  const msisdn = (body!.msisdn as string).trim();
  const bet = body!.bet as number;
  const choice = body!.choice as GameChoice;

  // Synchronous block — no awaits from here to response
  try {
    // Debit the bet (throws InsufficientFundsError if balance < bet)
    debitWallet(msisdn, bet);

    // Play the round (pure function — no side effects)
    const coinFlipOutcome = playCoinFlip(bet, choice);

    // Credit 2 * bet on win (net wallet delta = +bet)
    if (coinFlipOutcome.result === "win") {
      creditWallet(msisdn, bet * 2);
    }

    // Capture balance after all wallet mutations
    const balanceAfter = getWallet(msisdn)!.balance;

    // Persist the game session
    const session = recordGameSession({
      msisdn,
      bet,
      choice,
      outcome: coinFlipOutcome.outcome,
      result: coinFlipOutcome.result,
      delta: coinFlipOutcome.delta,
      balanceAfter,
    });

    return NextResponse.json(
      {
        sessionId: session.sessionId,
        outcome: session.outcome,
        result: session.result,
        delta: session.delta,
        balanceAfter,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return NextResponse.json(
        {
          error: "Insufficient funds",
          balance: err.balance,
          requested: err.requested,
        },
        { status: 409 }
      );
    }
    // Unexpected errors bubble up as 500
    throw err;
  }
}
