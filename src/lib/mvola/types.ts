/**
 * MVola TypeScript Type Definitions
 *
 * Single source of truth for all MVola request and response payload shapes.
 * Imported by auth.ts, client.ts, and API routes.
 */

/**
 * Represents a party in a MVola transaction (debit or credit side).
 * Used in WithdrawalRequest and CallbackPayload.
 */
export interface MVolaParty {
  key: string;
  value: string;
}

/**
 * OAuth token response from MVola POST /token endpoint.
 */
export interface MVolaToken {
  access_token: string;
  scope: string;
  token_type: string;
  expires_in: number;
}

/**
 * Request body sent to the MVola merchant pay endpoint
 * POST /mvola/mm/transactions/type/merchantpay/1.0.0/
 */
export interface WithdrawalRequest {
  amount: string;
  currency: string;
  descriptionText: string;
  requestingOrganisationTransactionReference: string;
  requestDate: string;
  debitParty: MVolaParty[];
  creditParty: MVolaParty[];
  metadata: MVolaParty[];
}

/**
 * Response from the MVola merchant pay endpoint.
 */
export interface WithdrawalResponse {
  status: string;
  serverCorrelationId: string;
}

/**
 * Union type for the possible states of a MVola transaction.
 */
export type TransactionStatus = "pending" | "completed" | "failed";

/**
 * Response from the MVola transaction status endpoint
 * GET /mvola/mm/transactions/type/merchantpay/1.0.0/status/{serverCorrelationId}
 */
export interface TransactionStatusResponse {
  transactionStatus: TransactionStatus;
  serverCorrelationId: string;
  transactionReference: string;
}

/**
 * Payload sent by MVola to the webhook callback URL
 * PUT /api/mvola/callback
 */
export interface CallbackPayload {
  transactionStatus: TransactionStatus;
  serverCorrelationId: string;
  transactionReference: string;
  amount: string;
  currency: string;
  debitParty: MVolaParty[];
  creditParty: MVolaParty[];
}

// --- Domain types (new) ---

/**
 * Direction of a wallet transaction.
 */
export type TransactionDirection = "deposit" | "withdraw";

/**
 * Current state of a wallet.
 * All monetary amounts are integer Ariary.
 */
export interface WalletState {
  msisdn: string;
  balance: number; // integer Ariary, always >= 0
  createdAt: number;
  updatedAt: number;
}

/**
 * Immutable record of a single wallet transaction.
 * All monetary amounts are integer Ariary.
 */
export interface TransactionRecord {
  localTxId: string;
  correlationId: string;
  msisdn: string;
  direction: TransactionDirection;
  amount: number;
  status: TransactionStatus;
  walletSettled: boolean;
  mvolaReference?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Possible choices for the coin-flip game.
 */
export type GameChoice = "heads" | "tails";

/**
 * Outcome of a coin-flip game round.
 */
export type GameResult = "win" | "loss";

/**
 * Full record of a single coin-flip game session.
 * All monetary amounts are integer Ariary.
 */
export interface GameSession {
  sessionId: string;
  msisdn: string;
  bet: number;
  choice: GameChoice;
  outcome: GameChoice;
  result: GameResult;
  delta: number; // +bet on win, -bet on loss
  balanceAfter: number;
  playedAt: number;
}

/**
 * Result of a coin flip computation, before recording to the wallet.
 */
export interface CoinFlipOutcome {
  outcome: GameChoice;
  result: GameResult;
  delta: number;
}

/**
 * Thrown when a wallet operation is attempted with insufficient balance.
 */
export class InsufficientFundsError extends Error {
  public readonly balance: number;
  public readonly requested: number;

  constructor(balance: number, requested: number) {
    super(
      `Insufficient funds: balance=${balance}, requested=${requested}`
    );
    this.name = "InsufficientFundsError";
    this.balance = balance;
    this.requested = requested;
  }
}
