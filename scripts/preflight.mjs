#!/usr/bin/env node
/**
 * MVola demo preflight check.
 *
 * Answers "is this demo runnable right now?" — minutes before an audience is
 * watching, not after something silently drifted. Checks, in order and without
 * stopping at the first failure:
 *
 *   1. every required MVOLA_* environment variable is set
 *   2. the MVola credentials are live (a real OAuth access token can be acquired)
 *   3. MVOLA_CALLBACK_URL answers from outside this process (the webhook tunnel
 *      — usually a temporary ngrok address — has not expired)
 *
 * A green run proves credentials are valid and the callback tunnel is alive right
 * now. It does NOT prove a transaction will settle end-to-end.
 *
 * Run: npm run preflight
 * One-off override (skip the checked-in tunnel URL): MVOLA_CALLBACK_URL=https://new-tunnel.example npm run preflight
 *
 * Runs under plain Node (18+, global `fetch`) — no new dependency. Reads `.env`
 * directly (this script runs outside Next.js, which normally loads it), the same
 * file Next.js itself loads — never `.env.local`. An already-set `process.env`
 * value always wins over the file.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const REQUIRED_VARS = [
  "MVOLA_CONSUMER_KEY",
  "MVOLA_CONSUMER_SECRET",
  "MVOLA_MERCHANT_MSISDN",
  "MVOLA_PARTNER_NAME",
  "MVOLA_ENV",
  "MVOLA_CALLBACK_URL",
];

const FETCH_TIMEOUT_MS = 5000;

/** Parses a `.env`-style file into a plain object. Never throws on a missing file. */
export function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const contents = readFileSync(path, "utf-8");
  const result = {};
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

/**
 * Loads env for the required vars — an already-set `process.env` value always
 * wins over the `.env` file (so a one-off `VAR=... npm run preflight` works).
 */
export function loadEnv(cwd = process.cwd()) {
  const fromFile = parseEnvFile(join(cwd, ".env"));
  const merged = { ...fromFile };
  for (const key of REQUIRED_VARS) {
    if (process.env[key] !== undefined) merged[key] = process.env[key];
  }
  return merged;
}

/** Check 1: every required variable is set to a non-empty value. */
export function checkEnvVars(env) {
  const missing = REQUIRED_VARS.filter((key) => !env[key]);
  return {
    name: "environment variables",
    ok: missing.length === 0,
    detail:
      missing.length === 0
        ? `${REQUIRED_VARS.length}/${REQUIRED_VARS.length} set`
        : `missing: ${missing.join(", ")}`,
  };
}

/** Check 2: request a real MVola access token — proves the credentials are live. */
export async function checkCredentials(env) {
  const baseUrl =
    env.MVOLA_ENV === "production"
      ? "https://api.mvola.mg"
      : "https://devapi.mvola.mg";
  const credentials = Buffer.from(
    `${env.MVOLA_CONSUMER_KEY ?? ""}:${env.MVOLA_CONSUMER_SECRET ?? ""}`
  ).toString("base64");

  try {
    const response = await fetchWithTimeout(`${baseUrl}/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE",
    });

    if (!response.ok) {
      return {
        name: "MVola credentials",
        ok: false,
        detail: `token request rejected (HTTP ${response.status})`,
      };
    }

    return {
      name: "MVola credentials",
      ok: true,
      detail: `token acquired (${env.MVOLA_ENV || "unknown env"})`,
    };
  } catch (error) {
    return {
      name: "MVola credentials",
      ok: false,
      detail: `token request failed (${describeError(error)})`,
    };
  }
}

/**
 * Check 3: something answers at the callback URL from outside this process.
 *
 * The real endpoint is `PUT /api/mvola/callback`; a `GET` may legitimately return
 * 404 or 405 — both prove the tunnel is alive, which is all this asks. Only a
 * connection error, DNS failure, or timeout counts as unreachable.
 */
export async function checkCallback(env) {
  const url = env.MVOLA_CALLBACK_URL;
  if (!url) {
    return {
      name: "callback address",
      ok: false,
      detail: "MVOLA_CALLBACK_URL not set",
    };
  }

  // `fetch` refuses to send a URL with embedded Basic-auth userinfo — it throws
  // a TypeError whose message echoes the offending URL *in full, credentials
  // included*. Strip credentials ourselves before the request ever reaches
  // fetch, so that error path (and the leak it would cause) never triggers.
  // `new URL()` also doubles as the "is this even a valid URL" check, handled
  // entirely on our side so its own error message (which may echo the raw
  // input) never reaches the report either.
  let requestUrl;
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    requestUrl = parsed.toString();
  } catch {
    return {
      name: "callback address",
      ok: false,
      detail: `${maskUrl(url)} invalid URL`,
    };
  }

  try {
    await fetchWithTimeout(requestUrl, { method: "GET" });
    return {
      name: "callback address",
      ok: true,
      detail: `${maskUrl(url)} reachable`,
    };
  } catch (error) {
    return {
      name: "callback address",
      ok: false,
      detail: `${maskUrl(url)} unreachable (${describeError(error)})`,
    };
  }
}

/** Fetch with a short abort-based timeout so preflight itself never stalls. */
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Reduces any fetch failure to a one-line, non-stack-trace diagnosis. */
function describeError(error) {
  if (error?.name === "AbortError") {
    return `timeout after ${FETCH_TIMEOUT_MS / 1000}s`;
  }
  const code = error?.cause?.code || error?.code;
  if (code) return code;
  return error?.message || "unknown error";
}

/** Formats one check result as an aligned report line. */
export function formatLine(result) {
  const mark = result.ok ? "✓" : "✗";
  return `  ${mark} ${result.name.padEnd(28)} ${result.detail}`;
}

/**
 * Masks an MSISDN for display — never print the full number. An MSISDN is PII
 * and preflight is routinely run on a screen that is shared, projected, or
 * recorded minutes before a demo. Showing that a merchant number is configured
 * (and enough of it to sanity-check it's the right account) is useful; the
 * full value is not needed for that and must never be echoed.
 */
export function maskMsisdn(msisdn) {
  if (!msisdn) return "not set";
  if (msisdn.length <= 3) return "set";
  return `set (…${msisdn.slice(-3)})`;
}

/**
 * Renders a URL for display with any embedded credentials or query values
 * stripped — a callback URL could carry Basic-auth userinfo or a signed
 * token/secret in its query string, and preflight must never echo those.
 */
export function maskUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    parsed.username = "";
    parsed.password = "";
    const query = parsed.search ? " (query masked)" : "";
    return `${parsed.origin}${parsed.pathname}${query}`;
  } catch {
    return "[unparsable URL]";
  }
}

export async function runPreflight(env) {
  const results = [checkEnvVars(env)];
  // Every check below runs regardless of earlier failures — one broken thing
  // must never hide the next.
  results.push(await checkCredentials(env));
  results.push(await checkCallback(env));
  return results;
}

async function main() {
  const env = loadEnv();

  console.log("MVola demo preflight");
  if (env.MVOLA_ENV || env.MVOLA_MERCHANT_MSISDN) {
    const parts = [];
    if (env.MVOLA_ENV) parts.push(env.MVOLA_ENV);
    // Never print the full MSISDN — see maskMsisdn() doc comment.
    if (env.MVOLA_MERCHANT_MSISDN) {
      parts.push(`merchant ${maskMsisdn(env.MVOLA_MERCHANT_MSISDN)}`);
    }
    console.log(`  i ${"environment".padEnd(28)} ${parts.join(" · ")}`);
  }

  const results = await runPreflight(env);
  for (const result of results) {
    console.log(formatLine(result));
  }

  const failures = results.filter((result) => !result.ok);
  console.log();
  console.log(
    failures.length === 0
      ? "All checks passed."
      : `${failures.length} check${failures.length === 1 ? "" : "s"} failed.`
  );

  process.exitCode = failures.length === 0 ? 0 : 1;
}

// Only run when invoked directly (`node scripts/preflight.mjs` / `npm run
// preflight`) — not when imported, e.g. for testing individual checks.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Preflight crashed: ${describeError(error)}`);
    process.exitCode = 1;
  });
}
