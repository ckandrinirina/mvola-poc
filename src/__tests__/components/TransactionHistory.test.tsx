/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
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
});
