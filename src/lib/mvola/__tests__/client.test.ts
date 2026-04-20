/**
 * Tests for src/lib/mvola/client.ts — MVola HTTP Client
 *
 * Covers:
 * - initiateWithdrawal() sends POST to merchantpay endpoint
 * - getTransactionStatus() sends GET to status endpoint
 * - Both functions attach all required headers
 * - X-CorrelationID is a unique UUID per request
 * - UserAccountIdentifier is formatted as msisdn;{MVOLA_MERCHANT_MSISDN}
 * - Base URL is selected from MVOLA_ENV env var
 * - Request body includes requestDate as ISO 8601 and requestingOrganisationTransactionReference as game-withdrawal-{uuid}
 * - Returns typed responses
 * - Throws on non-200 responses with error detail
 */

describe("client.ts — initiateWithdrawal()", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      MVOLA_ENV: "sandbox",
      MVOLA_MERCHANT_MSISDN: "0343500003",
      MVOLA_PARTNER_NAME: "TestPartner",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  function mockFetchSuccess(body: object) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    } as Response);
  }

  function mockFetchError(status: number, body: object | string) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status,
      json: async () =>
        typeof body === "string" ? { error: body } : body,
      text: async () =>
        typeof body === "string" ? body : JSON.stringify(body),
    } as unknown as Response);
  }

  it("sends POST to the sandbox merchantpay endpoint", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-123" });
    const { initiateWithdrawal } = await import("../client");

    await initiateWithdrawal(
      {
        amount: "5000",
        currency: "Ar",
        descriptionText: "Game withdrawal",
        playerMsisdn: "0343500004",
      },
      "test-token"
    );

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(
      "https://devapi.mvola.mg/mvola/mm/transactions/type/merchantpay/1.0.0/"
    );
    expect(options.method).toBe("POST");
  });

  it("sends POST to the production merchantpay endpoint when MVOLA_ENV=production", async () => {
    process.env.MVOLA_ENV = "production";
    jest.resetModules();
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-123" });
    const { initiateWithdrawal } = await import("../client");

    await initiateWithdrawal(
      {
        amount: "5000",
        currency: "Ar",
        descriptionText: "Game withdrawal",
        playerMsisdn: "0343500004",
      },
      "test-token"
    );

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toBe(
      "https://api.mvola.mg/mvola/mm/transactions/type/merchantpay/1.0.0/"
    );
  });

  it("attaches all required headers", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-123" });
    const { initiateWithdrawal } = await import("../client");

    await initiateWithdrawal(
      {
        amount: "5000",
        currency: "Ar",
        descriptionText: "Game withdrawal",
        playerMsisdn: "0343500004",
      },
      "my-access-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const headers = options.headers as Record<string, string>;

    expect(headers["Authorization"]).toBe("Bearer my-access-token");
    expect(headers["UserAccountIdentifier"]).toBe("msisdn;0343500003");
    expect(headers["partnerName"]).toBe("TestPartner");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["UserLanguage"]).toBe("FR");
    expect(headers["Version"]).toBe("1.0");
    expect(headers["Cache-Control"]).toBe("no-cache");
    expect(headers["X-CorrelationID"]).toBeDefined();
    expect(typeof headers["X-CorrelationID"]).toBe("string");
    expect(headers["X-CorrelationID"].length).toBeGreaterThan(0);
  });

  it("uses a unique UUID for X-CorrelationID on each call", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "pending", serverCorrelationId: "corr-123" }),
    } as Response);
    global.fetch = fetchMock;

    const { initiateWithdrawal } = await import("../client");

    await initiateWithdrawal(
      { amount: "5000", currency: "Ar", descriptionText: "Test", playerMsisdn: "0343500004" },
      "tok"
    );
    await initiateWithdrawal(
      { amount: "5000", currency: "Ar", descriptionText: "Test", playerMsisdn: "0343500004" },
      "tok"
    );

    const headers1 = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .headers as Record<string, string>;
    const headers2 = (fetchMock.mock.calls[1] as [string, RequestInit])[1]
      .headers as Record<string, string>;

    expect(headers1["X-CorrelationID"]).not.toBe(headers2["X-CorrelationID"]);
  });

  it("includes requestDate as ISO 8601 string in the body", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-123" });
    const { initiateWithdrawal } = await import("../client");

    await initiateWithdrawal(
      {
        amount: "5000",
        currency: "Ar",
        descriptionText: "Game withdrawal",
        playerMsisdn: "0343500004",
      },
      "test-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const body = JSON.parse(options.body as string);
    expect(body.requestDate).toBeDefined();
    expect(new Date(body.requestDate).toISOString()).toBe(body.requestDate);
  });

  it("includes requestingOrganisationTransactionReference as a UUID", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-123" });
    const { initiateWithdrawal } = await import("../client");

    await initiateWithdrawal(
      {
        amount: "5000",
        currency: "Ar",
        descriptionText: "Game withdrawal",
        playerMsisdn: "0343500004",
      },
      "test-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const body = JSON.parse(options.body as string);
    expect(body.requestingOrganisationTransactionReference).toMatch(
      /^[0-9a-f-]{36}$/
    );
  });

  it("sets debitParty to merchant MSISDN and creditParty to player MSISDN", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-123" });
    const { initiateWithdrawal } = await import("../client");

    await initiateWithdrawal(
      {
        amount: "5000",
        currency: "Ar",
        descriptionText: "Game withdrawal",
        playerMsisdn: "0343500004",
      },
      "test-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const body = JSON.parse(options.body as string);

    expect(body.debitParty).toEqual([{ key: "msisdn", value: "0343500003" }]);
    expect(body.creditParty).toEqual([{ key: "msisdn", value: "0343500004" }]);
  });

  it("includes metadata with partnerName, fc, and amountFc", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-123" });
    const { initiateWithdrawal } = await import("../client");

    await initiateWithdrawal(
      {
        amount: "5000",
        currency: "Ar",
        descriptionText: "Game withdrawal",
        playerMsisdn: "0343500004",
      },
      "test-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const body = JSON.parse(options.body as string);

    expect(body.metadata).toEqual(
      expect.arrayContaining([
        { key: "partnerName", value: "TestPartner" },
        { key: "fc", value: "USD" },
        { key: "amountFc", value: "1" },
      ])
    );
  });

  it("returns a typed WithdrawalResponse", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-abc" });
    const { initiateWithdrawal } = await import("../client");

    const result = await initiateWithdrawal(
      {
        amount: "5000",
        currency: "Ar",
        descriptionText: "Game withdrawal",
        playerMsisdn: "0343500004",
      },
      "test-token"
    );

    expect(result.status).toBe("pending");
    expect(result.serverCorrelationId).toBe("corr-abc");
  });

  it("throws with error detail on non-200 response", async () => {
    mockFetchError(400, { errorCode: "ERR001", errorMessage: "Bad Request" });
    const { initiateWithdrawal } = await import("../client");

    await expect(
      initiateWithdrawal(
        {
          amount: "5000",
          currency: "Ar",
          descriptionText: "Game withdrawal",
          playerMsisdn: "0343500004",
        },
        "test-token"
      )
    ).rejects.toThrow(/400/);
  });
});

describe("client.ts — initiateDeposit()", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      MVOLA_ENV: "sandbox",
      MVOLA_MERCHANT_MSISDN: "0343500003",
      MVOLA_PARTNER_NAME: "TestPartner",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  function mockFetchSuccess(body: object) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    } as Response);
  }

  function mockFetchError(status: number, body: object | string) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status,
      json: async () =>
        typeof body === "string" ? { error: body } : body,
      text: async () =>
        typeof body === "string" ? body : JSON.stringify(body),
    } as unknown as Response);
  }

  it("sends POST to the same sandbox merchantpay endpoint as initiateWithdrawal", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-deposit-1" });
    const { initiateDeposit } = await import("../client");

    await initiateDeposit(
      { msisdn: "0343500004", amount: "5000" },
      "test-token"
    );

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(
      "https://devapi.mvola.mg/mvola/mm/transactions/type/merchantpay/1.0.0/"
    );
    expect(options.method).toBe("POST");
  });

  it("sets debitParty to player MSISDN and creditParty to merchant MSISDN", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-deposit-1" });
    const { initiateDeposit } = await import("../client");

    await initiateDeposit(
      { msisdn: "0343500004", amount: "5000" },
      "test-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const body = JSON.parse(options.body as string);

    // For deposit: player is the debitParty (pays in), merchant is the creditParty (receives)
    expect(body.debitParty).toEqual([{ key: "msisdn", value: "0343500004" }]);
    expect(body.creditParty).toEqual([{ key: "msisdn", value: "0343500003" }]);
  });

  it("uses default description 'Game deposit' when description is not provided", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-deposit-1" });
    const { initiateDeposit } = await import("../client");

    await initiateDeposit(
      { msisdn: "0343500004", amount: "5000" },
      "test-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const body = JSON.parse(options.body as string);
    expect(body.descriptionText).toBe("Game deposit");
  });

  it("uses provided description when given", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-deposit-1" });
    const { initiateDeposit } = await import("../client");

    await initiateDeposit(
      { msisdn: "0343500004", amount: "5000", description: "Custom deposit" },
      "test-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const body = JSON.parse(options.body as string);
    expect(body.descriptionText).toBe("Custom deposit");
  });

  it("uses default currency 'Ar' when currency is not provided", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-deposit-1" });
    const { initiateDeposit } = await import("../client");

    await initiateDeposit(
      { msisdn: "0343500004", amount: "5000" },
      "test-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const body = JSON.parse(options.body as string);
    expect(body.currency).toBe("Ar");
  });

  it("includes metadata with partnerName, fc, and amountFc", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-deposit-1" });
    const { initiateDeposit } = await import("../client");

    await initiateDeposit(
      { msisdn: "0343500004", amount: "5000" },
      "test-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const body = JSON.parse(options.body as string);

    expect(body.metadata).toEqual(
      expect.arrayContaining([
        { key: "partnerName", value: "TestPartner" },
        { key: "fc", value: "Ar" },
        { key: "amountFc", value: "5000" },
      ])
    );
  });

  it("includes requestDate as ISO 8601 string in the body", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-deposit-1" });
    const { initiateDeposit } = await import("../client");

    await initiateDeposit(
      { msisdn: "0343500004", amount: "5000" },
      "test-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const body = JSON.parse(options.body as string);
    expect(body.requestDate).toBeDefined();
    expect(new Date(body.requestDate).toISOString()).toBe(body.requestDate);
  });

  it("includes requestingOrganisationTransactionReference as a UUID", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-deposit-1" });
    const { initiateDeposit } = await import("../client");

    await initiateDeposit(
      { msisdn: "0343500004", amount: "5000" },
      "test-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const body = JSON.parse(options.body as string);
    expect(body.requestingOrganisationTransactionReference).toBeDefined();
    expect(typeof body.requestingOrganisationTransactionReference).toBe("string");
    expect(body.requestingOrganisationTransactionReference.length).toBeGreaterThan(0);
  });

  it("uses buildHeaders (attaches required headers)", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-deposit-1" });
    const { initiateDeposit } = await import("../client");

    await initiateDeposit(
      { msisdn: "0343500004", amount: "5000" },
      "my-deposit-token"
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const headers = options.headers as Record<string, string>;

    expect(headers["Authorization"]).toBe("Bearer my-deposit-token");
    expect(headers["UserAccountIdentifier"]).toBe("msisdn;0343500003");
    expect(headers["partnerName"]).toBe("TestPartner");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-CorrelationID"]).toBeDefined();
  });

  it("propagates errors via throwOnError on non-200 response", async () => {
    mockFetchError(400, { errorCode: "ERR001", errorMessage: "Bad Request" });
    const { initiateDeposit } = await import("../client");

    await expect(
      initiateDeposit({ msisdn: "0343500004", amount: "5000" }, "test-token")
    ).rejects.toThrow(/400/);
  });

  it("returns a typed response with status and serverCorrelationId", async () => {
    mockFetchSuccess({ status: "pending", serverCorrelationId: "corr-deposit-abc" });
    const { initiateDeposit } = await import("../client");

    const result = await initiateDeposit(
      { msisdn: "0343500004", amount: "5000" },
      "test-token"
    );

    expect(result.status).toBe("pending");
    expect(result.serverCorrelationId).toBe("corr-deposit-abc");
  });
});

describe("client.ts — getTransactionStatus()", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      MVOLA_ENV: "sandbox",
      MVOLA_MERCHANT_MSISDN: "0343500003",
      MVOLA_PARTNER_NAME: "TestPartner",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  function mockFetchSuccess(body: object) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    } as Response);
  }

  function mockFetchError(status: number, body: object | string) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status,
      json: async () =>
        typeof body === "string" ? { error: body } : body,
      text: async () =>
        typeof body === "string" ? body : JSON.stringify(body),
    } as unknown as Response);
  }

  it("sends GET to the sandbox status endpoint with correlationId", async () => {
    mockFetchSuccess({
      transactionStatus: "pending",
      serverCorrelationId: "corr-123",
      transactionReference: "MVL-001",
    });
    const { getTransactionStatus } = await import("../client");

    await getTransactionStatus("corr-123", "test-token");

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(
      "https://devapi.mvola.mg/mvola/mm/transactions/type/merchantpay/1.0.0/status/corr-123"
    );
    expect(options.method).toBe("GET");
  });

  it("sends GET to the production status endpoint when MVOLA_ENV=production", async () => {
    process.env.MVOLA_ENV = "production";
    jest.resetModules();
    mockFetchSuccess({
      transactionStatus: "completed",
      serverCorrelationId: "corr-123",
      transactionReference: "MVL-001",
    });
    const { getTransactionStatus } = await import("../client");

    await getTransactionStatus("corr-123", "test-token");

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toBe(
      "https://api.mvola.mg/mvola/mm/transactions/type/merchantpay/1.0.0/status/corr-123"
    );
  });

  it("attaches all required headers", async () => {
    mockFetchSuccess({
      transactionStatus: "pending",
      serverCorrelationId: "corr-123",
      transactionReference: "MVL-001",
    });
    const { getTransactionStatus } = await import("../client");

    await getTransactionStatus("corr-123", "my-access-token");

    const [, options] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit
    ];
    const headers = options.headers as Record<string, string>;

    expect(headers["Authorization"]).toBe("Bearer my-access-token");
    expect(headers["UserAccountIdentifier"]).toBe("msisdn;0343500003");
    expect(headers["partnerName"]).toBe("TestPartner");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["UserLanguage"]).toBe("FR");
    expect(headers["Version"]).toBe("1.0");
    expect(headers["Cache-Control"]).toBe("no-cache");
    expect(headers["X-CorrelationID"]).toBeDefined();
    expect(typeof headers["X-CorrelationID"]).toBe("string");
  });

  it("returns a typed TransactionStatusResponse", async () => {
    mockFetchSuccess({
      transactionStatus: "completed",
      serverCorrelationId: "corr-abc",
      transactionReference: "MVL-001",
    });
    const { getTransactionStatus } = await import("../client");

    const result = await getTransactionStatus("corr-abc", "test-token");

    expect(result.transactionStatus).toBe("completed");
    expect(result.serverCorrelationId).toBe("corr-abc");
    expect(result.transactionReference).toBe("MVL-001");
  });

  it("throws with error detail on non-200 response", async () => {
    mockFetchError(404, { errorMessage: "Not Found" });
    const { getTransactionStatus } = await import("../client");

    await expect(
      getTransactionStatus("unknown-id", "test-token")
    ).rejects.toThrow(/404/);
  });

  it("uses a unique UUID for X-CorrelationID on each call", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        transactionStatus: "pending",
        serverCorrelationId: "corr-123",
        transactionReference: "MVL-001",
      }),
    } as Response);
    global.fetch = fetchMock;

    const { getTransactionStatus } = await import("../client");

    await getTransactionStatus("corr-123", "tok");
    await getTransactionStatus("corr-123", "tok");

    const headers1 = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .headers as Record<string, string>;
    const headers2 = (fetchMock.mock.calls[1] as [string, RequestInit])[1]
      .headers as Record<string, string>;

    expect(headers1["X-CorrelationID"]).not.toBe(headers2["X-CorrelationID"]);
  });
});
