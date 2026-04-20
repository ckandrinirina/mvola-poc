/**
 * MVola HTTP Client
 *
 * Provides the typed functions that call the external MVola transaction API:
 * - initiateWithdrawal(): POST to the merchant pay endpoint (merchant debits, player credits)
 * - initiateDeposit(): POST to the merchant pay endpoint (player debits, merchant credits)
 * - getTransactionStatus(): GET from the transaction status endpoint
 *
 * Both transaction functions accept a `token` parameter (obtained from auth.ts) and attach
 * all required headers defined in the MVola API specification.
 *
 * This is the single integration point for MVola transaction calls — no other
 * file in the codebase should call these MVola endpoints directly.
 */

import type { WithdrawalResponse, TransactionStatusResponse } from "./types";

/**
 * Parameters for initiating a withdrawal.
 */
export interface WithdrawalParams {
  amount: string;
  currency: string;
  descriptionText: string;
  playerMsisdn: string;
}

/**
 * Parameters for initiating a deposit.
 * Symmetrical to WithdrawalParams, using the player's MSISDN as the debitParty.
 */
export interface DepositParams {
  /** The player's MSISDN — becomes the debitParty in the MVola request */
  msisdn: string;
  /** Amount to deposit (as a string or number) */
  amount: number | string;
  /** Optional description; defaults to "Game deposit" */
  description?: string;
  /** Optional currency code; defaults to "Ar" */
  currency?: string;
}

/**
 * Resolves the MVola base URL from the MVOLA_ENV environment variable.
 * Defaults to sandbox (devapi.mvola.mg) when MVOLA_ENV is not "production".
 */
function getBaseUrl(): string {
  return process.env.MVOLA_ENV === "production"
    ? "https://api.mvola.mg"
    : "https://devapi.mvola.mg";
}

/**
 * Builds the common headers required for every MVola transaction API call.
 *
 * @param token - A valid MVola Bearer access token (from auth.ts)
 * @returns A record of all required headers
 */
function buildHeaders(
  token: string,
  callbackUrl?: string,
  userAccountMsisdn?: string
): Record<string, string> {
  const accountMsisdn = userAccountMsisdn ?? process.env.MVOLA_MERCHANT_MSISDN;
  const headers: Record<string, string> = {
    Accept: "*/*",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Version: "1.0",
    "X-CorrelationID": crypto.randomUUID(),
    UserLanguage: "FR",
    UserAccountIdentifier: `msisdn;${accountMsisdn}`,
    partnerName: process.env.MVOLA_PARTNER_NAME!,
    "Cache-Control": "no-cache",
  };
  if (callbackUrl) headers["X-Callback-URL"] = callbackUrl;
  return headers;
}

/**
 * Throws a descriptive error when MVola returns a non-200 response.
 *
 * @param response - The fetch Response object
 * @param context - Short label to identify which call failed
 */
async function throwOnError(response: Response, context: string): Promise<void> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `MVola ${context} returned ${response.status}: ${body}`
    );
  }
}

/**
 * Initiates a withdrawal by calling the MVola merchant pay endpoint.
 *
 * POST {BASE_URL}/mvola/mm/transactions/type/merchantpay/1.0.0/
 *
 * @param params - Withdrawal parameters (amount, currency, description, player MSISDN)
 * @param token  - A valid MVola Bearer access token
 * @returns The WithdrawalResponse containing status and serverCorrelationId
 * @throws {Error} When MVola returns a non-200 response
 */
export async function initiateWithdrawal(
  params: WithdrawalParams,
  token: string
): Promise<WithdrawalResponse> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/mvola/mm/transactions/type/merchantpay/1.0.0/`;
  const merchantMsisdn = process.env.MVOLA_MERCHANT_MSISDN!;
  const partnerName = process.env.MVOLA_PARTNER_NAME!;

  const body = {
    amount: params.amount,
    currency: params.currency,
    descriptionText: params.descriptionText,
    requestingOrganisationTransactionReference: crypto.randomUUID(),
    originalTransactionReference: crypto.randomUUID(),
    requestDate: new Date().toISOString(),
    debitParty: [{ key: "msisdn", value: merchantMsisdn }],
    creditParty: [{ key: "msisdn", value: params.playerMsisdn }],
    metadata: [
      { key: "partnerName", value: partnerName },
      { key: "fc", value: "USD" },
      { key: "amountFc", value: "1" },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(token, process.env.MVOLA_CALLBACK_URL),
    body: JSON.stringify(body),
  });

  await throwOnError(response, "merchant pay endpoint");

  return response.json() as Promise<WithdrawalResponse>;
}

/**
 * Initiates a deposit by calling the MVola merchant pay endpoint.
 *
 * POST {BASE_URL}/mvola/mm/transactions/type/merchantpay/1.0.0/
 *
 * The party assignment is the inverse of initiateWithdrawal:
 * - debitParty: the player's MSISDN (the player sends funds to the merchant)
 * - creditParty: the merchant's MSISDN (the merchant receives the funds)
 *
 * @param params - Deposit parameters (msisdn, amount, optional description and currency)
 * @param token  - A valid MVola Bearer access token
 * @returns The WithdrawalResponse containing status and serverCorrelationId
 * @throws {Error} When MVola returns a non-200 response
 */
export async function initiateDeposit(
  params: DepositParams,
  token: string
): Promise<WithdrawalResponse> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/mvola/mm/transactions/type/merchantpay/1.0.0/`;
  const merchantMsisdn = process.env.MVOLA_MERCHANT_MSISDN!;
  const partnerName = process.env.MVOLA_PARTNER_NAME!;
  const amount = String(params.amount);

  const body = {
    amount,
    currency: params.currency ?? "Ar",
    descriptionText: params.description ?? "Game deposit",
    requestingOrganisationTransactionReference: crypto.randomUUID(),
    originalTransactionReference: crypto.randomUUID(),
    requestDate: new Date().toISOString(),
    debitParty: [{ key: "msisdn", value: params.msisdn }],
    creditParty: [{ key: "msisdn", value: merchantMsisdn }],
    metadata: [
      { key: "partnerName", value: partnerName },
      { key: "fc", value: "Ar" },
      { key: "amountFc", value: amount },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(token, process.env.MVOLA_CALLBACK_URL),
    body: JSON.stringify(body),
  });

  await throwOnError(response, "deposit merchant pay endpoint");

  return response.json() as Promise<WithdrawalResponse>;
}

/**
 * Retrieves the status of a pending transaction from the MVola status endpoint.
 *
 * GET {BASE_URL}/mvola/mm/transactions/type/merchantpay/1.0.0/status/{serverCorrelationId}
 *
 * @param serverCorrelationId - The correlation ID returned by initiateWithdrawal
 * @param token               - A valid MVola Bearer access token
 * @returns The TransactionStatusResponse
 * @throws {Error} When MVola returns a non-200 response
 */
export async function getTransactionStatus(
  serverCorrelationId: string,
  token: string
): Promise<TransactionStatusResponse> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/mvola/mm/transactions/type/merchantpay/1.0.0/status/${serverCorrelationId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(token),
  });

  await throwOnError(response, "transaction status endpoint");

  return response.json() as Promise<TransactionStatusResponse>;
}
