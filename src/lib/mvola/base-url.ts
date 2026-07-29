/**
 * MVola Base URL Resolver
 *
 * Architecture rule R2: exactly ONE place in the codebase reads `MVOLA_ENV` to
 * resolve the MVola API base URL — this module. Both `auth.ts` (token endpoint)
 * and `client.ts` (transaction endpoints) import `getBaseUrl()` from here so that
 * a hostname change or a new environment can never be applied to one call site
 * and missed on the other, which would otherwise mean acquiring an OAuth token
 * from one MVola environment while posting transactions to another.
 *
 * This module depends on nothing else in the mvola library (in particular, not
 * on auth.ts or client.ts) so that both of those files can safely import it
 * without creating an import cycle.
 */

const PRODUCTION_BASE_URL = "https://api.mvola.mg";
const SANDBOX_BASE_URL = "https://devapi.mvola.mg";

/**
 * Resolves the MVola base URL from the MVOLA_ENV environment variable.
 * Defaults to sandbox (devapi.mvola.mg) when MVOLA_ENV is unset, empty, or any
 * value other than exactly "production".
 */
export function getBaseUrl(): string {
  return process.env.MVOLA_ENV === "production"
    ? PRODUCTION_BASE_URL
    : SANDBOX_BASE_URL;
}
