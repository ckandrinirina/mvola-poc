/**
 * Tests for src/lib/mvola/auth.ts — OAuth Token Manager
 *
 * Covers:
 * - First call fetches a token via POST /token
 * - Subsequent calls within validity window return cached token (no fetch)
 * - Refreshes when within 60 seconds of expiry
 * - Throws descriptive error on non-200 response
 * - Uses correct Authorization header (Basic base64)
 * - Uses correct request body (URL-encoded)
 * - Selects base URL from MVOLA_ENV
 */

// We use jest.spyOn on global.fetch to avoid real HTTP calls
describe("auth.ts — getToken()", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      MVOLA_CONSUMER_KEY: "testKey",
      MVOLA_CONSUMER_SECRET: "testSecret",
      MVOLA_ENV: "sandbox",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  function mockFetchSuccess(access_token: string, expires_in: number) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token,
        scope: "EXT_INT_MVOLA_SCOPE",
        token_type: "Bearer",
        expires_in,
      }),
    } as Response);
  }

  function mockFetchError(status: number, body: string) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status,
      text: async () => body,
    } as unknown as Response);
  }

  it("fetches a token on first call", async () => {
    mockFetchSuccess("token-abc", 3600);
    const { getToken } = await import("../auth");

    const token = await getToken();

    expect(token).toBe("token-abc");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("sends correct Authorization Basic header", async () => {
    mockFetchSuccess("token-abc", 3600);
    const { getToken } = await import("../auth");
    await getToken();

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const expectedBase64 = Buffer.from("testKey:testSecret").toString("base64");
    expect((options.headers as Record<string, string>)["Authorization"]).toBe(
      `Basic ${expectedBase64}`
    );
  });

  it("sends correct URL-encoded body", async () => {
    mockFetchSuccess("token-abc", 3600);
    const { getToken } = await import("../auth");
    await getToken();

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(options.body).toBe(
      "grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE"
    );
  });

  it("uses devapi.mvola.mg base URL for sandbox", async () => {
    mockFetchSuccess("token-abc", 3600);
    const { getToken } = await import("../auth");
    await getToken();

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toBe("https://devapi.mvola.mg/token");
  });

  it("uses api.mvola.mg base URL for production", async () => {
    process.env.MVOLA_ENV = "production";
    jest.resetModules();
    mockFetchSuccess("token-abc", 3600);
    const { getToken } = await import("../auth");
    await getToken();

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toBe("https://api.mvola.mg/token");
  });

  it("returns cached token on subsequent calls within validity window", async () => {
    mockFetchSuccess("token-abc", 3600);
    const { getToken } = await import("../auth");

    const first = await getToken();
    const second = await getToken();

    expect(first).toBe("token-abc");
    expect(second).toBe("token-abc");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes token when within 60 seconds of expiry", async () => {
    // Use a single mock that returns different values on successive calls
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "token-stale",
          scope: "EXT_INT_MVOLA_SCOPE",
          token_type: "Bearer",
          // expires_in=30 means expiresAt = now + 30s, which is < now + 60s threshold
          expires_in: 30,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "token-fresh",
          scope: "EXT_INT_MVOLA_SCOPE",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      } as Response);

    global.fetch = fetchMock;

    const { getToken } = await import("../auth");

    const first = await getToken();
    expect(first).toBe("token-stale");

    // Second call — token should be refreshed because it's within 60s of expiry
    const second = await getToken();
    expect(second).toBe("token-fresh");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws descriptive error on non-200 response", async () => {
    mockFetchError(401, "Unauthorized");
    const { getToken } = await import("../auth");

    await expect(getToken()).rejects.toThrow(/MVola token endpoint/i);
  });

  it("exports only getToken as named export", async () => {
    mockFetchSuccess("token-abc", 3600);
    const mod = await import("../auth");
    const exportedKeys = Object.keys(mod);
    expect(exportedKeys).toEqual(["getToken"]);
  });
});
