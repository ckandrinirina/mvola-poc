---
id: 09-13
title: `scripts/preflight.mjs` — Demo Preflight Check
epic: 09
status: done
size: M
blocked_by: [09-01]
files: [scripts/preflight.mjs, package.json, .env.example]
issue:
prior_status:
---

# Story 09-13: `scripts/preflight.mjs` — Demo Preflight Check

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

Answer "is this demo runnable right now?" **before** an audience is watching.

The callback address is a temporary tunnel that expires. MVola cannot deliver settlement
notifications to a dead address, and after this epic the notification is a large part of what
makes settlement feel real — a dead tunnel is the single most likely cause of a demo that
stalls. Credentials can also have rotated since the last run. Both fail silently until the
moment they matter.

`npm run preflight` checks each precondition and reports one line per failure.

## Acceptance Criteria

- [x] `scripts/preflight.mjs` runs under plain Node with no new dependency
- [x] `package.json` gains `"preflight": "node scripts/preflight.mjs"`
- [x] It asserts every required variable is set: `MVOLA_CONSUMER_KEY`, `MVOLA_CONSUMER_SECRET`, `MVOLA_MERCHANT_MSISDN`, `MVOLA_PARTNER_NAME`, `MVOLA_ENV`, `MVOLA_CALLBACK_URL`
- [x] It requests a real MVola access token, proving the credentials are live
- [x] It issues a `GET` to `MVOLA_CALLBACK_URL` **from outside the process** and asserts the address is reachable
- [x] Every check runs before exiting — one broken thing does not hide the next
- [x] Each failure prints a one-line diagnosis naming the variable or check, with no stack trace
- [x] Exit code is `0` when everything passes and non-zero otherwise
- [x] **No secret is printed.** Report presence, not value; do not echo the token, the consumer key, or the secret
- [x] It reads the env files Next.js actually loads — this repo uses `.env`, not `.env.local`
- [x] A short "Preflight" section in `.env.example` or the script header states what a green run proves

## Technical Notes

Suggested output — legible at a glance, minutes before a demo:

```
MVola demo preflight
  ✓ environment variables      6/6 set
  ✓ MVola credentials          token acquired (sandbox)
  ✗ callback address           https://xxx.ngrok.app unreachable (ECONNREFUSED)

1 check failed.
```

Node 18+ has global `fetch`, so no HTTP dependency is needed. Env loading is the one wrinkle:
the script runs outside Next.js, which normally does the `.env` loading. Parse the file
directly (a dozen lines of `KEY=value` splitting) rather than adding `dotenv` for one script.
Prefer an already-set `process.env` value over the file, so `MVOLA_CALLBACK_URL=... npm run
preflight` works for a one-off check.

**Reachability, precisely.** The check is that *something answers* at the callback address from
outside this process — not that the answer is a 200. `PUT /api/mvola/callback` is the real
endpoint and a `GET` to it may legitimately return 404 or 405; both prove the tunnel is alive,
which is what is being asked. Treat a connection error, DNS failure, or timeout as the failure,
and give the timeout a short bound (a few seconds) so preflight itself never becomes the thing
that stalls.

This is the story most likely to be skipped as "not really code". It is worth its size: the
alternative is discovering an expired tunnel with an audience watching, and the failure mode it
guards is the one this epic's whole demonstration depends on.

Consider having it print the resolved `MVOLA_ENV` and merchant MSISDN — non-secret, and it
catches the case where the demo is unknowingly pointed at the wrong account.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `scripts/preflight.mjs` | The preflight check |
| MODIFY | `package.json` | Add the `preflight` script |
| MODIFY | `.env.example` | Note what preflight verifies |

## Dependencies

- **Blocked by:** Story 09-01
- **Blocks:** Story 09-14

## Related

- **Epic:** 09_mvola-api-coverage
- **Spec reference:** pre-spec § 5.6, § 9; feature doc § `scripts/preflight.mjs`

## Implementation Summary

`scripts/preflight.mjs` is a dependency-free ESM script (Node 18+ global `fetch`) with three
checks that all run regardless of earlier failures: (1) presence of all 6 required
`MVOLA_*` vars, (2) a real OAuth token request against the sandbox/production token
endpoint to prove credentials are live, (3) a `GET` to `MVOLA_CALLBACK_URL` with a 5s
abort-based timeout, treating any response (including 404/405) as reachable and only a
connection error, DNS failure, or timeout as unreachable. Core logic is exposed as pure,
independently callable functions (`parseEnvFile`, `loadEnv`, `checkEnvVars`,
`checkCredentials`, `checkCallback`, `formatLine`, `runPreflight`); `main()` only runs when
the file is executed directly, not on import. Env is read from `.env` (never `.env.local`)
with an already-set `process.env` value always winning, so `MVOLA_CALLBACK_URL=... npm run
preflight` works for one-off checks. No secret value (token, consumer key/secret) is ever
printed — only presence/validity and the non-secret resolved `MVOLA_ENV` + a masked merchant
MSISDN (`maskMsisdn` — last 3 digits only). The callback URL is displayed through `maskUrl`,
which strips any embedded Basic-auth userinfo and query string before display; the fetch
itself is issued against a credential-stripped copy of the URL too, so a URL with embedded
credentials can never reach `fetch`'s own "URL includes credentials" rejection — a path
that would otherwise echo the full, unmasked URL (secrets included) in its error message.
Failures print a single diagnostic line each (no stack traces); exit code is 0 only when
every check passes.

**Post-QA fix (round 1):** QA found the merchant MSISDN was printed in full in the
environment info line, and (on re-audit) that a callback URL with embedded credentials or
a secret query value would leak verbatim through `fetch`'s own validation error message.
Both are fixed: `maskMsisdn`/`maskUrl` mask the displayed value, and `checkCallback` now
strips credentials from the URL before it ever reaches `fetch`, closing the error-message
leak at its source rather than only masking the successful-path display.

**Post-QA fix (round 2):** an adversarial re-check found `maskUrl` still interpolated
`parsed.pathname` unmodified — a tunnel provider's per-tunnel secret token routinely lives
in the URL *path*, not the query, so the path-masking gap was a real leak, not a
theoretical one. Fixed: `maskUrl` now reduces any non-trivial pathname to a fixed
`/… (path masked)` marker (plain `/` when there is no real path), matching the same
treatment already given to userinfo and the query string. Re-verified against three
adversarial `MVOLA_CALLBACK_URL` values — a path-embedded secret, combined
userinfo+query secrets, and a malformed URL — none of the planted sentinel values appear
anywhere in stdout/stderr.

**Testing approach:** `scripts/preflight.mjs` is a real ESM (.mjs) module with no
dedicated test file in the story's original declared scope
(`scripts/preflight.mjs`, `package.json`, `.env.example`); the two most safety-critical
checks (a real OAuth token request, a real network reachability probe) are inherently
live-network operations unsuited to the Jest suite regardless. Initially verified by
running the script directly under many env combinations (no vars, partial vars,
unreachable/invalid DNS, reachable domain, path/query/userinfo-embedded secrets,
malformed URLs) and by invoking the exported pure functions directly.

A regression test was first attempted at `scripts/__tests__/preflight.test.ts` by
importing (`import` / dynamic `import()`) the module directly — both forms failed
identically with `SyntaxError: Cannot use import statement outside a module`, because
`scripts/preflight.mjs` is real ESM and `jest.config.ts` (shared, outside this story's
scope) only transforms `.tsx?` with no ESM support configured. Rather than edit that
shared config, the test was rewritten to spawn the real script as a child process
(`node:child_process` `spawnSync`) and assert on its actual stdout+stderr — end-to-end
coverage of what a demo presenter would actually see, and strictly more representative
than unit-testing the masking helpers in isolation. It **runs** (no `.skip`), covers a
path-embedded secret, a userinfo+query secret, a malformed URL, MSISDN masking (normal,
2-char, empty), and consumer key/secret, and is fully hermetic: every host is
`example.invalid` (RFC 2606 reserved, guaranteed non-resolving); a new
`MVOLA_TOKEN_BASE_URL` test-only override (never a required var, never documented to
demo operators) redirects the credentials check's OAuth request away from the real
`devapi.mvola.mg`; every spawn has an 8s timeout; the child's `cwd` is the OS temp dir so
it can never pick up a real `.env`.

QA (`ck-code:qa-validator`) independently re-ran the round-1 checks and the full Jest
suite and returned **PASS** on all 11 acceptance criteria before round 2's adversarial
re-check found the path-masking gap; the coordinator's final round then required the
subprocess rewrite above. Final full-suite state: 27 suites / 451 tests, all passed, 0
failed, 0 skipped.

**Files Touched:**
- CREATED: `scripts/preflight.mjs`
- CREATED: `scripts/__tests__/preflight.test.ts` (hermetic subprocess regression test)
- MODIFIED: `package.json:11` (added `"preflight"` script entry)
- MODIFIED: `.env.example:19-24` (appended "Preflight" section; existing keys, including
  09-09's `MVOLA_POLL_INTERVAL_MS`/`MVOLA_POLL_TIMEOUT_MS`, left untouched)
