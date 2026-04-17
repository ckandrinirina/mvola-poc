/**
 * MVola OAuth Token Manager
 *
 * Manages the MVola OAuth 2.0 Client Credentials token lifecycle:
 * - Fetches a new token when needed
 * - Caches it in memory with its expiry time
 * - Automatically refreshes when within 60 seconds of expiring
 *
 * All API routes should call `getToken()` before making any MVola request.
 */

import type { MVolaToken } from "./types";

interface CachedToken {
  access_token: string;
  /** Expiry timestamp in milliseconds (Date.now() scale) */
  expiresAt: number;
}

/** Module-level token cache — reset on server restart */
let cachedToken: CachedToken | null = null;

/**
 * Returns a valid MVola access token.
 *
 * On first call (or after expiry / within 60s of expiry), fetches a fresh
 * token from the MVola token endpoint. Otherwise returns the cached token
 * without a network call.
 *
 * @throws {Error} When the MVola token endpoint returns a non-200 response.
 */
export async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.access_token;
  }

  const token = await fetchToken();

  cachedToken = {
    access_token: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };

  return cachedToken.access_token;
}

/**
 * Fetches a fresh OAuth token from the MVola token endpoint.
 *
 * @throws {Error} When the response status is not 200.
 */
async function fetchToken(): Promise<MVolaToken> {
  const key = process.env.MVOLA_CONSUMER_KEY ?? "";
  const secret = process.env.MVOLA_CONSUMER_SECRET ?? "";
  const env = process.env.MVOLA_ENV;

  const BASE_URL =
    env === "production" ? "https://api.mvola.mg" : "https://devapi.mvola.mg";

  const credentials = Buffer.from(`${key}:${secret}`).toString("base64");

  const response = await fetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `MVola token endpoint returned ${response.status}: ${body}`
    );
  }

  return response.json() as Promise<MVolaToken>;
}
