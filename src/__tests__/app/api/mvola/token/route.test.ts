/**
 * Tests for POST /api/mvola/token route
 *
 * Debug endpoint that calls getToken() from auth.ts and returns the
 * access token and expiry. Covers the happy path and error handling.
 */

import { POST } from "@/app/api/mvola/token/route";

// Mock the auth module so we don't make real HTTP calls
jest.mock("@/lib/mvola/auth");

import { getToken } from "@/lib/mvola/auth";

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;

describe("POST /api/mvola/token", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with access_token and expires_in on success", async () => {
    mockGetToken.mockResolvedValue("mock-access-token");

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      access_token: "mock-access-token",
      expires_in: 3600,
    });
  });

  it("calls getToken() from auth.ts", async () => {
    mockGetToken.mockResolvedValue("another-token");

    await POST();

    expect(mockGetToken).toHaveBeenCalledTimes(1);
  });

  it("returns 500 with { error } when getToken() throws", async () => {
    mockGetToken.mockRejectedValue(new Error("MVola token endpoint returned 401: Unauthorized"));

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: "Failed to acquire token" });
  });

  it("returns 500 with { error } for any thrown value", async () => {
    mockGetToken.mockRejectedValue("something unexpected");

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: "Failed to acquire token" });
  });

  it("does not require a request body", async () => {
    mockGetToken.mockResolvedValue("token-no-body");

    // POST() takes no arguments — calling it with no body should work fine
    const response = await POST();

    expect(response.status).toBe(200);
  });
});
