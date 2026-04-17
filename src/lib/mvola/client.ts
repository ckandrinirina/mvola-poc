/**
 * MVola HTTP Client
 *
 * Provides the two typed functions that call the external MVola transaction API:
 * - initiateWithdrawal(): POST to the merchant pay endpoint
 * - getTransactionStatus(): GET from the transaction status endpoint
 *
 * Both functions accept a `token` parameter (obtained from auth.ts) and attach
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
function buildHeaders(token: string, callbackUrl?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "*/*",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Version: "1.0",
    "X-CorrelationID": crypto.randomUUID(),
    UserLanguage: "FR",
    UserAccountIdentifier: `msisdn;${process.env.MVOLA_MERCHANT_MSISDN}`,
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
