// Runs `node scripts/preflight.mjs` as a real child process rather than
// importing it. An earlier version of this file used static/dynamic `import`
// of the .mjs module and could not execute under Jest: jest.config.ts (shared,
// outside this story's scope) only transforms `.tsx?` and has no ESM support,
// so both import forms failed with "Cannot use import statement outside a
// module". Spawning the script as a subprocess sidesteps that entirely — it
// tests the real end-to-end stdout/stderr a demo presenter would actually see,
// which is also strictly more representative than unit-testing the masking
// helpers in isolation.
//
// Hermetic by construction:
//   - every host used is `example.invalid` (IANA-reserved, guaranteed
//     non-resolving — RFC 2606) or `.invalid`-suffixed; never a real endpoint.
//   - MVOLA_TOKEN_BASE_URL redirects the credentials check's OAuth request
//     away from the real `devapi.mvola.mg` to `example.invalid` too, so
//     no variant below makes any real outbound network call.
//   - no real credential is ever used — every secret value is a sentinel.
//   - the child process is spawned with an explicit timeout, so a stuck DNS
//     lookup fails the test instead of hanging CI.
//   - the child's cwd is the OS temp dir, not the repo, so it can never pick
//     up a real `.env` file's values.
//
// These variants are all EXPECTED to fail their checks (bad/missing
// credentials, unreachable/malformed callback) — that's fine and not what's
// under test. What's under test is that no planted secret ever appears in
// the combined stdout+stderr.

import { spawnSync } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";

const SCRIPT_PATH = path.resolve(__dirname, "../preflight.mjs");
const SPAWN_TIMEOUT_MS = 8_000;

/** Runs the real preflight script in a controlled, hermetic env and returns combined output. */
function runPreflight(env: Record<string, string>) {
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: os.tmpdir(), // never the repo — must never pick up a real .env
    env: {
      // Minimal PATH only; deliberately NOT inheriting the caller's full
      // process.env so no ambient MVOLA_* value can leak into a variant.
      PATH: process.env.PATH ?? "",
      ...env,
    },
    encoding: "utf-8",
    timeout: SPAWN_TIMEOUT_MS,
  });

  if (result.error) {
    throw result.error;
  }

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    combined: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    status: result.status,
  };
}

// Never a real MVola endpoint — redirects the OAuth check to a non-resolving host too.
const NO_NETWORK_ENV = { MVOLA_TOKEN_BASE_URL: "https://example.invalid" };

describe("scripts/preflight.mjs (end-to-end, subprocess)", () => {
  it("never leaks a secret embedded in the callback URL path", () => {
    const { combined } = runPreflight({
      ...NO_NETWORK_ENV,
      MVOLA_CALLBACK_URL:
        "https://example.invalid/cb/SECRETPATH555?sig=SIGLEAK444",
    });
    expect(combined).not.toContain("SECRETPATH555");
    expect(combined).not.toContain("SIGLEAK444");
  });

  it("never leaks Basic-auth userinfo or a query secret in the callback URL", () => {
    const { combined } = runPreflight({
      ...NO_NETWORK_ENV,
      MVOLA_CALLBACK_URL:
        "https://user:SECRETTOKEN333@example.invalid/cb?sig=SIGLEAK444",
    });
    expect(combined).not.toContain("SECRETTOKEN333");
    expect(combined).not.toContain("SIGLEAK444");
  });

  it("never echoes a malformed callback URL's embedded secrets", () => {
    const { combined } = runPreflight({
      ...NO_NETWORK_ENV,
      MVOLA_CALLBACK_URL: "ht!tp://x:SECRETTOKEN333@@@?sig=SIGLEAK444",
    });
    expect(combined).not.toContain("SECRETTOKEN333");
    expect(combined).not.toContain("SIGLEAK444");
  });

  it("masks the merchant MSISDN to its last 3 digits only", () => {
    const { combined } = runPreflight({
      ...NO_NETWORK_ENV,
      MVOLA_MERCHANT_MSISDN: "0340000999",
    });
    expect(combined).not.toContain("0340000999");
    expect(combined).toContain("999");
  });

  it("never crashes or leaks a short (below-3-char) MSISDN", () => {
    const { status, combined } = runPreflight({
      ...NO_NETWORK_ENV,
      MVOLA_MERCHANT_MSISDN: "42",
    });
    expect(status).not.toBeNull();
    expect(combined).not.toContain("42");
  });

  it("never crashes on an empty MSISDN", () => {
    const { status, combined } = runPreflight({
      ...NO_NETWORK_ENV,
      MVOLA_MERCHANT_MSISDN: "",
    });
    expect(status).not.toBeNull();
    // An empty value means the "environment" info line has nothing to show
    // for MSISDN — there is no value to leak, only confirm no crash output.
    expect(combined).not.toMatch(/undefined|NaN/);
  });

  it("never prints the consumer key or consumer secret", () => {
    const { combined } = runPreflight({
      ...NO_NETWORK_ENV,
      MVOLA_CONSUMER_KEY: "SENTINELKEY777",
      MVOLA_CONSUMER_SECRET: "SENTINELSECRET888",
    });
    expect(combined).not.toContain("SENTINELKEY777");
    expect(combined).not.toContain("SENTINELSECRET888");
  });

  it("exits non-zero when checks fail (sanity check on the harness itself)", () => {
    const { status } = runPreflight({
      ...NO_NETWORK_ENV,
      MVOLA_CALLBACK_URL: "https://example.invalid/cb",
    });
    expect(status).not.toBe(0);
  });
});
