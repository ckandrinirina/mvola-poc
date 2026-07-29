/**
 * Tests for GET /api/config/polling
 *
 * Read-only endpoint exposing the two polling knobs to the browser.
 * Must return exactly { pollIntervalMs, pollTimeoutMs } — no credentials,
 * no env dump, no MVOLA_ENV (rule R5).
 */

import { NextRequest } from "next/server";

// Mock the polling module so the route's response shape is asserted against
// known values, independent of the actual env-derived defaults.
jest.mock("@/lib/mvola/polling", () => ({
  POLL_INTERVAL_MS: 3000,
  POLL_TIMEOUT_MS: 120000,
}));

import { GET } from "@/app/api/config/polling/route";

function buildRequest(): NextRequest {
  return new NextRequest("http://localhost/api/config/polling");
}

describe("GET /api/config/polling", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with pollIntervalMs and pollTimeoutMs from the polling module", async () => {
    const response = await GET(buildRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      pollIntervalMs: 3000,
      pollTimeoutMs: 120000,
    });
  });

  it("returns exactly two keys — nothing else leaks into the payload", async () => {
    const response = await GET(buildRequest());
    const json = await response.json();

    expect(Object.keys(json).sort()).toEqual(["pollIntervalMs", "pollTimeoutMs"]);
  });

  it("never includes MVOLA_ENV, credentials, or any env dump in the response", async () => {
    const response = await GET(buildRequest());
    const text = await response.clone().text();

    expect(text).not.toMatch(/MVOLA_ENV/i);
    expect(text).not.toMatch(/MVOLA_CONSUMER/i);
    expect(text).not.toMatch(/access_token/i);
  });
});
