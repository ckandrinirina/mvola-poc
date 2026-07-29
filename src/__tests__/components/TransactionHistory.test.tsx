/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TransactionHistory } from "@/components/TransactionHistory";
import { WalletHeader } from "@/components/WalletHeader";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
let localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => localStorageStore[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: jest.fn(() => {
    localStorageStore = {};
  }),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Helper to wrap TransactionHistory inside WalletHeader (which provides MsisdnContext)
function Wrapper({ msisdn = "0343500003" }: { msisdn?: string } = {}) {
  return (
    <WalletHeader>
      <TransactionHistory />
    </WalletHeader>
  );
}

// Stub history response
const TRANSACTION_ENTRY = {
  kind: "transaction" as const,
  localTxId: "tx_01HW",
  correlationId: "550e8400",
  direction: "deposit",
  amount: 5000,
  status: "completed",
  mvolaReference: "MVL-2026-04-20-001",
  createdAt: 1745150200000,
  updatedAt: 1745150260000,
};

const GAME_ENTRY = {
  kind: "game" as const,
  sessionId: "gm_01HW",
  bet: 1000,
  choice: "heads",
  outcome: "tails",
  result: "loss",
  delta: -1000,
  balanceAfter: 4000,
  playedAt: 1745150300000,
};

const WIN_GAME_ENTRY = {
  kind: "game" as const,
  sessionId: "gm_02HW",
  bet: 500,
  choice: "tails",
  outcome: "tails",
  result: "win",
  delta: 500,
  balanceAfter: 4500,
  playedAt: 1745150400000,
};

const PENDING_TX_ENTRY = {
  kind: "transaction" as const,
  localTxId: "tx_02HW",
  correlationId: "550e8401",
  direction: "withdraw",
  amount: 2000,
  status: "pending",
  createdAt: 1745150100000,
  updatedAt: 1745150100000,
};

const FAILED_TX_ENTRY = {
  kind: "transaction" as const,
  localTxId: "tx_03HW",
  correlationId: "550e8402",
  direction: "withdraw",
  amount: 3000,
  status: "failed",
  createdAt: 1745150050000,
  updatedAt: 1745150060000,
};

// ---- Story 09-12 fixtures: expandable settled row ----

const SETTLED_NO_REF_ENTRY = {
  kind: "transaction" as const,
  localTxId: "tx_04HW",
  correlationId: "550e8403",
  direction: "deposit",
  amount: 1500,
  status: "completed",
  createdAt: 1745150000000,
  updatedAt: 1745150010000,
};

const FAILED_TX_WITH_REF = {
  ...FAILED_TX_ENTRY,
  localTxId: "tx_05HW",
  mvolaReference: "MVL-2026-04-20-002",
};

const MVOLA_COMPARISON_BODY = {
  mvola: {
    amount: "5000",
    currency: "Ar",
    transactionReference: "MVL-2026-04-20-001",
    transactionStatus: "completed",
    createDate: "2026-04-20T10:00:00.000Z",
    debitParty: [{ key: "msisdn", value: "0343500003" }],
    creditParty: [{ key: "msisdn", value: "0343500099" }],
  },
  local: {
    localTxId: "tx_01HW",
    correlationId: "550e8400",
    msisdn: "0343500003",
    direction: "deposit",
    amount: 5000,
    status: "completed",
    walletSettled: true,
    mvolaReference: "MVL-2026-04-20-001",
    createdAt: 1745150200000,
    updatedAt: 1745150260000,
  },
};

/**
 * Builds a fetch mock that routes by URL: `/balance`, `/api/config/polling`,
 * `/api/mvola/transaction/*` (details), and everything else as the history
 * response carrying `entries`.
 */
function buildFetchMock({
  entries,
  pollTimeoutMs = 120_000,
  detailsHandler,
}: {
  entries: unknown[];
  pollTimeoutMs?: number;
  detailsHandler?: jest.Mock;
}) {
  return (url: string) => {
    if (url.includes("/balance")) {
      return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
    }
    if (url.includes("/api/config/polling")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ pollIntervalMs: 3000, pollTimeoutMs }),
      });
    }
    if (url.includes("/api/mvola/transaction/")) {
      return detailsHandler
        ? detailsHandler(url)
        : Promise.resolve({ ok: true, json: async () => ({}) });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ msisdn: "0343500003", entries }),
    });
  };
}

describe("TransactionHistory", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    localStorageStore = {};

    localStorageMock.getItem.mockImplementation(
      (key: string) => localStorageStore[key] ?? null
    );
    localStorageMock.setItem.mockImplementation(
      (key: string, value: string) => {
        localStorageStore[key] = value;
      }
    );
    localStorageMock.removeItem.mockImplementation(
      (key: string) => {
        delete localStorageStore[key];
      }
    );
    localStorageMock.clear.mockImplementation(() => {
      localStorageStore = {};
    });

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ---- Empty state ----

  it("shows empty state when msisdn is not set", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [] }),
    });

    await act(async () => {
      render(<Wrapper />);
    });

    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("shows empty state when history returns no entries", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      // history
      return Promise.resolve({ ok: true, json: async () => ({ msisdn: "0343500003", entries: [] }) });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("No activity yet")).toBeInTheDocument();
    });
  });

  // ---- Fetching on mount ----

  it("fetches history on mount when msisdn is available", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [TRANSACTION_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/wallet/0343500003/history")
      );
    });
  });

  // ---- Mixed history renders in correct order ----

  it("renders mixed history entries in the order returned by the API", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          msisdn: "0343500003",
          entries: [GAME_ENTRY, TRANSACTION_ENTRY], // game first (newer)
        }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items.length).toBe(2);
      // First item should be game entry
      expect(items[0].textContent).toMatch(/heads|tails/i);
      // Second item should be transaction entry
      expect(items[1].textContent).toMatch(/deposit|↓/i);
    });
  });

  // ---- Transaction entries ----

  it("renders deposit transaction with down arrow direction indicator", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [TRANSACTION_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("↓")).toBeInTheDocument();
    });
  });

  it("renders withdraw transaction with up arrow direction indicator", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    const withdrawTx = { ...TRANSACTION_ENTRY, direction: "withdraw", localTxId: "tx_wd1" };

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [withdrawTx] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("↑")).toBeInTheDocument();
    });
  });

  it("renders transaction amount with positive sign for deposit", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [TRANSACTION_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/\+5.*000|\+5000/)).toBeInTheDocument();
    });
  });

  it("renders transaction amount with negative sign for withdrawal", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    const withdrawTx = { ...TRANSACTION_ENTRY, direction: "withdraw", amount: 2000, localTxId: "tx_wd2" };

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [withdrawTx] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/−2.*000|−2000|-2.*000|-2000/)).toBeInTheDocument();
    });
  });

  it("renders MVola reference when present", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [TRANSACTION_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/MVL-2026-04-20-001/)).toBeInTheDocument();
    });
  });

  // ---- Status chip colors ----

  it("renders completed status chip with green color class", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [TRANSACTION_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      const chip = screen.getByText("completed");
      expect(chip.className).toMatch(/green/);
    });
  });

  it("renders pending status chip with yellow color class", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [PENDING_TX_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      const chip = screen.getByText("pending");
      expect(chip.className).toMatch(/yellow/);
    });
  });

  it("renders failed status chip with red color class", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [FAILED_TX_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      const chip = screen.getByText("failed");
      expect(chip.className).toMatch(/red/);
    });
  });

  // ---- Game entries ----

  it("renders game entry with bet amount", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [GAME_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      const betElements = screen.getAllByText(/1.*000 Ar|1000 Ar/);
      expect(betElements.length).toBeGreaterThan(0);
      expect(betElements[0]).toBeInTheDocument();
    });
  });

  it("renders game entry with choice and outcome", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [GAME_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      // heads choice and tails outcome should be shown
      expect(screen.getByText(/heads/i)).toBeInTheDocument();
      expect(screen.getByText(/tails/i)).toBeInTheDocument();
    });
  });

  it("renders loss game result with red color", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [GAME_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      const resultBanner = screen.getByText(/loss/i);
      expect(resultBanner.className).toMatch(/red/);
    });
  });

  it("renders win game result with green color", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [WIN_GAME_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      const resultBanner = screen.getByText(/win/i);
      expect(resultBanner.className).toMatch(/green/);
    });
  });

  it("renders game delta with sign", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [WIN_GAME_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/\+500|\+.*500/)).toBeInTheDocument();
    });
  });

  it("renders post-balance for game entry", async () => {
    localStorageStore["mvola-prof.msisdn"] = "0343500003";

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ msisdn: "0343500003", entries: [GAME_ENTRY] }),
      });
    });

    await act(async () => {
      render(<Wrapper />);
      await Promise.resolve();
    });

    await waitFor(() => {
      // balanceAfter is 4000
      expect(screen.getByText(/4.*000 Ar|4000 Ar/)).toBeInTheDocument();
    });
  });

  // ---- Story 09-12: expandable settled row ----

  describe("expandable settled row", () => {
    beforeEach(() => {
      localStorageStore["mvola-prof.msisdn"] = "0343500003";
    });

    it("exposes an expand control on a completed row with an mvolaReference", async () => {
      mockFetch.mockImplementation(buildFetchMock({ entries: [TRANSACTION_ENTRY] }));

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /compare with mvola/i });
        expect(button.tagName).toBe("BUTTON");
        expect(button).toHaveAttribute("aria-expanded", "false");
      });
    });

    it("exposes an expand control on a failed settled row with an mvolaReference too", async () => {
      mockFetch.mockImplementation(buildFetchMock({ entries: [FAILED_TX_WITH_REF] }));

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /compare with mvola/i })).toBeInTheDocument();
      });
    });

    it("fetches transaction details once on expand; collapsing and re-expanding does not refetch", async () => {
      const detailsHandler = jest.fn((_url: string) =>
        Promise.resolve({ ok: true, json: async () => MVOLA_COMPARISON_BODY })
      );
      mockFetch.mockImplementation(
        buildFetchMock({ entries: [TRANSACTION_ENTRY], detailsHandler })
      );

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      const button = await screen.findByRole("button", { name: /compare with mvola/i });

      await act(async () => {
        fireEvent.click(button); // expand — first fetch
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => expect(detailsHandler).toHaveBeenCalledTimes(1));
      expect(detailsHandler.mock.calls[0][0]).toContain("MVL-2026-04-20-001");

      await act(async () => {
        fireEvent.click(button); // collapse
      });
      await act(async () => {
        fireEvent.click(button); // re-expand — must not refetch
        await Promise.resolve();
      });

      expect(detailsHandler).toHaveBeenCalledTimes(1);
    });

    it("renders MVola and local records as separate, labelled columns", async () => {
      const detailsHandler = jest.fn(() =>
        Promise.resolve({ ok: true, json: async () => MVOLA_COMPARISON_BODY })
      );
      mockFetch.mockImplementation(
        buildFetchMock({ entries: [TRANSACTION_ENTRY], detailsHandler })
      );

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      const button = await screen.findByRole("button", { name: /compare with mvola/i });
      await act(async () => {
        fireEvent.click(button);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByText(/mvola record/i)).toBeInTheDocument();
        expect(screen.getByText(/local record/i)).toBeInTheDocument();
        // MVola column renders whatever keys are present, generically
        expect(screen.getByText(/transactionStatus/)).toBeInTheDocument();
        expect(screen.getByText(/msisdn: 0343500003/)).toBeInTheDocument();
        // Local column renders its own record
        expect(screen.getByText(/walletSettled/)).toBeInTheDocument();
      });
    });

    it("shows a loading state while the details fetch is in flight", async () => {
      let resolveDetails!: (value: unknown) => void;
      const detailsHandler = jest.fn(
        () =>
          new Promise((resolve) => {
            resolveDetails = resolve;
          })
      );
      mockFetch.mockImplementation(
        buildFetchMock({ entries: [TRANSACTION_ENTRY], detailsHandler })
      );

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      const button = await screen.findByRole("button", { name: /compare with mvola/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/loading transaction details/i)).toBeInTheDocument();
      });

      await act(async () => {
        resolveDetails({ ok: true, json: async () => MVOLA_COMPARISON_BODY });
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading transaction details/i)).not.toBeInTheDocument();
        expect(screen.getByText(/mvola record/i)).toBeInTheDocument();
      });
    });

    it('renders "No local transaction carries that reference" on a 404, without fabricating a record', async () => {
      const detailsHandler = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: "No local transaction carries that reference" }),
        })
      );
      mockFetch.mockImplementation(
        buildFetchMock({ entries: [TRANSACTION_ENTRY], detailsHandler })
      );

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      const button = await screen.findByRole("button", { name: /compare with mvola/i });
      await act(async () => {
        fireEvent.click(button);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(
          screen.getByText(/no local transaction carries that reference/i)
        ).toBeInTheDocument();
        expect(screen.queryByText(/mvola record/i)).not.toBeInTheDocument();
      });
    });

    it("renders the MVola error on a 502, without fabricating a record", async () => {
      const detailsHandler = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 502,
          json: async () => ({ error: "MVola API error", details: "upstream timeout" }),
        })
      );
      mockFetch.mockImplementation(
        buildFetchMock({ entries: [TRANSACTION_ENTRY], detailsHandler })
      );

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      const button = await screen.findByRole("button", { name: /compare with mvola/i });
      await act(async () => {
        fireEvent.click(button);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByText(/mvola api error/i)).toBeInTheDocument();
        expect(screen.getByText(/upstream timeout/i)).toBeInTheDocument();
        expect(screen.queryByText(/mvola record/i)).not.toBeInTheDocument();
      });
    });

    it("offers a retry after a failed details fetch, which re-fetches", async () => {
      const detailsHandler = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => ({ error: "MVola API error", details: "boom" }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => MVOLA_COMPARISON_BODY });
      mockFetch.mockImplementation(
        buildFetchMock({ entries: [TRANSACTION_ENTRY], detailsHandler })
      );

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      const button = await screen.findByRole("button", { name: /compare with mvola/i });
      await act(async () => {
        fireEvent.click(button);
        await Promise.resolve();
        await Promise.resolve();
      });

      const retryButton = await screen.findByRole("button", { name: /retry/i });
      await act(async () => {
        fireEvent.click(retryButton);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByText(/mvola record/i)).toBeInTheDocument();
      });
      expect(detailsHandler).toHaveBeenCalledTimes(2);
    });

    it("renders PendingApprovalBanner instead of an expand control for a pending row", async () => {
      mockFetch.mockImplementation(
        buildFetchMock({ entries: [PENDING_TX_ENTRY], pollTimeoutMs: 90_000 })
      );

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByRole("status")).toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /compare with mvola/i })
        ).not.toBeInTheDocument();
      });
    });

    it("explains why a settled row without an mvolaReference cannot be opened, rather than a dead control", async () => {
      mockFetch.mockImplementation(
        buildFetchMock({ entries: [SETTLED_NO_REF_ENTRY] })
      );

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByText(/no mvola reference was recorded/i)).toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /compare with mvola/i })
        ).not.toBeInTheDocument();
      });
    });

    it("leaves game rows unaffected by row-expansion behaviour", async () => {
      mockFetch.mockImplementation(buildFetchMock({ entries: [GAME_ENTRY] }));

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getAllByText(/heads|tails/i).length).toBeGreaterThan(0);
      });
      expect(
        screen.queryByRole("button", { name: /compare with mvola/i })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("keeps the expand control keyboard-operable with aria-expanded reflecting state", async () => {
      const detailsHandler = jest.fn(() =>
        Promise.resolve({ ok: true, json: async () => MVOLA_COMPARISON_BODY })
      );
      mockFetch.mockImplementation(
        buildFetchMock({ entries: [TRANSACTION_ENTRY], detailsHandler })
      );

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      const button = await screen.findByRole("button", { name: /compare with mvola/i });
      expect(button.tagName).toBe("BUTTON"); // native button — keyboard support is free
      expect(button).toHaveAttribute("aria-expanded", "false");

      await act(async () => {
        button.focus();
        fireEvent.click(button);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("keeps a row expanded across a balance-triggered history refetch, and does not refetch details again", async () => {
      let balanceCallCount = 0;
      const detailsHandler = jest.fn((_url: string) =>
        Promise.resolve({ ok: true, json: async () => MVOLA_COMPARISON_BODY })
      );

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/balance")) {
          balanceCallCount += 1;
          // Second call onward returns a changed balance, so WalletHeader's
          // setBalance triggers TransactionHistory's [msisdn, balance] effect.
          return Promise.resolve({
            ok: true,
            json: async () => ({ balance: balanceCallCount === 1 ? 5000 : 4500 }),
          });
        }
        if (url.includes("/api/config/polling")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ pollIntervalMs: 3000, pollTimeoutMs: 120_000 }),
          });
        }
        if (url.includes("/api/mvola/transaction/")) {
          return detailsHandler(url);
        }
        // A fresh array each call — mimics a real refetch returning new objects
        // for the same logical entries (same localTxId).
        return Promise.resolve({
          ok: true,
          json: async () => ({ msisdn: "0343500003", entries: [{ ...TRANSACTION_ENTRY }] }),
        });
      });

      await act(async () => {
        render(<Wrapper />);
        await Promise.resolve();
      });

      const button = await screen.findByRole("button", { name: /compare with mvola/i });
      await act(async () => {
        fireEvent.click(button);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => expect(screen.getByText(/mvola record/i)).toBeInTheDocument());
      expect(detailsHandler).toHaveBeenCalledTimes(1);

      // Advance WalletHeader's balance poll (2000ms) so balance changes and
      // TransactionHistory's history effect (keyed on [msisdn, balance]) refetches.
      await act(async () => {
        jest.advanceTimersByTime(2000);
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /hide mvola comparison/i })).toHaveAttribute(
          "aria-expanded",
          "true"
        );
        expect(screen.getByText(/mvola record/i)).toBeInTheDocument();
      });
      expect(detailsHandler).toHaveBeenCalledTimes(1);
    });
  });
});
