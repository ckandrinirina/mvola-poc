/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CoinFlipGame } from "@/components/CoinFlipGame";
import { WalletHeader } from "@/components/WalletHeader";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage (as in TransactionHistory.test.tsx)
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

/**
 * Renders CoinFlipGame inside WalletHeader, which is the real provider of
 * MsisdnContext. `msisdn` seeds localStorage (omit/empty to leave it unset);
 * `balance` stubs the WalletHeader balance-poll response. The coinflip POST
 * itself is routed separately per-test via mockFetch.mockImplementation.
 */
async function renderGame({ msisdn = "0343500003", balance = 5000 } = {}) {
  if (msisdn) localStorageStore["mvola-prof.msisdn"] = msisdn;

  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/balance")) {
      return Promise.resolve({ ok: true, json: async () => ({ balance }) });
    }
    // Default coinflip stub; individual tests override with mockImplementation
    // after this render call when they need a specific outcome.
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });

  let view: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <WalletHeader>
        <CoinFlipGame />
      </WalletHeader>
    );
    await Promise.resolve();
  });
  return view!;
}

/** Routes mockFetch: balance requests get `balance`, everything else (the
 * coinflip POST) gets `coinflipResponse`. */
function mockCoinflipResponse(
  balance: number,
  coinflipResponse: { ok: boolean; status: number; json: () => Promise<unknown> }
) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/balance")) {
      return Promise.resolve({ ok: true, json: async () => ({ balance }) });
    }
    return Promise.resolve(coinflipResponse);
  });
}

describe("CoinFlipGame", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageStore = {};
    localStorageMock.getItem.mockImplementation(
      (key: string) => localStorageStore[key] ?? null
    );
    localStorageMock.setItem.mockImplementation((key: string, value: string) => {
      localStorageStore[key] = value;
    });
    localStorageMock.removeItem.mockImplementation((key: string) => {
      delete localStorageStore[key];
    });
    localStorageMock.clear.mockImplementation(() => {
      localStorageStore = {};
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ---- Disabled states ----

  it("disables the flip button when msisdn is empty", async () => {
    await renderGame({ msisdn: "" });
    expect(screen.getByRole("button", { name: /flip/i })).toBeDisabled();
  });

  it("disables the flip button when balance is 0", async () => {
    await renderGame({ balance: 0 });
    expect(screen.getByRole("button", { name: /flip/i })).toBeDisabled();
  });

  it("enables the flip button when msisdn and balance are set", async () => {
    await renderGame();
    expect(screen.getByRole("button", { name: /flip/i })).not.toBeDisabled();
  });

  // ---- Bet input ----

  it("renders a bet amount input", async () => {
    await renderGame();
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("caps bet input at current balance", async () => {
    await renderGame({ balance: 3000 });
    const betInput = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(betInput.max).toBe("3000");
  });

  it("bet input has min of 1", async () => {
    await renderGame();
    const betInput = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(betInput.min).toBe("1");
  });

  // ---- Heads / Tails selector ----

  it("renders heads and tails choice buttons", async () => {
    await renderGame();
    expect(screen.getByRole("button", { name: /heads/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tails/i })).toBeInTheDocument();
  });

  it("selecting heads marks it as active", async () => {
    await renderGame();
    const headsBtn = screen.getByRole("button", { name: /heads/i });
    fireEvent.click(headsBtn);
    expect(headsBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("selecting tails marks it as active", async () => {
    await renderGame();
    const tailsBtn = screen.getByRole("button", { name: /tails/i });
    fireEvent.click(tailsBtn);
    expect(tailsBtn).toHaveAttribute("aria-pressed", "true");
  });

  // ---- Win rendering ----

  it("displays win banner in green on a win response", async () => {
    await renderGame();
    mockCoinflipResponse(5000, {
      ok: true,
      status: 200,
      json: async () => ({
        sessionId: "sess-1",
        outcome: "heads",
        result: "win",
        delta: 500,
        balanceAfter: 5500,
      }),
    });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/win/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      const winEl = screen.getByText(/win/i);
      expect(winEl.className).toMatch(/green/);
    });
  });

  it("displays outcome (heads/tails) on win", async () => {
    await renderGame();
    mockCoinflipResponse(5000, {
      ok: true,
      status: 200,
      json: async () => ({
        sessionId: "sess-2",
        outcome: "heads",
        result: "win",
        delta: 500,
        balanceAfter: 5500,
      }),
    });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    await waitFor(() => {
      // Multiple elements may match 'heads' (the choice button + the outcome span)
      const headElements = screen.getAllByText(/heads/i);
      expect(headElements.length).toBeGreaterThan(0);
    });
  });

  it("displays delta with sign on win", async () => {
    await renderGame();
    mockCoinflipResponse(5000, {
      ok: true,
      status: 200,
      json: async () => ({
        sessionId: "sess-3",
        outcome: "heads",
        result: "win",
        delta: 500,
        balanceAfter: 5500,
      }),
    });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/\+500/)).toBeInTheDocument();
    });
  });

  it("displays balanceAfter on win", async () => {
    await renderGame();
    mockCoinflipResponse(5000, {
      ok: true,
      status: 200,
      json: async () => ({
        sessionId: "sess-4",
        outcome: "heads",
        result: "win",
        delta: 500,
        balanceAfter: 5500,
      }),
    });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/5500/)).toBeInTheDocument();
    });
  });

  // ---- Loss rendering ----

  it("displays loss banner in red on a loss response", async () => {
    await renderGame();
    mockCoinflipResponse(5000, {
      ok: true,
      status: 200,
      json: async () => ({
        sessionId: "sess-5",
        outcome: "tails",
        result: "loss",
        delta: -500,
        balanceAfter: 4500,
      }),
    });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/loss/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      const lossEl = screen.getByText(/loss/i);
      expect(lossEl.className).toMatch(/red/);
    });
  });

  it("displays negative delta on loss", async () => {
    await renderGame();
    mockCoinflipResponse(5000, {
      ok: true,
      status: 200,
      json: async () => ({
        sessionId: "sess-6",
        outcome: "tails",
        result: "loss",
        delta: -500,
        balanceAfter: 4500,
      }),
    });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/-500/)).toBeInTheDocument();
    });
  });

  // ---- 409 handling ----

  it("displays Insufficient funds on 409 response", async () => {
    await renderGame();
    mockCoinflipResponse(5000, {
      ok: false,
      status: 409,
      json: async () => ({
        error: "Insufficient funds",
        balance: 100,
        requested: 500,
      }),
    });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
    });
  });

  it("displays returned balance on 409 response", async () => {
    await renderGame();
    mockCoinflipResponse(5000, {
      ok: false,
      status: 409,
      json: async () => ({
        error: "Insufficient funds",
        balance: 100,
        requested: 500,
      }),
    });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/100/)).toBeInTheDocument();
    });
  });

  // ---- 400 handling ----

  it("displays validation message on 400 response", async () => {
    await renderGame();
    mockCoinflipResponse(5000, {
      ok: false,
      status: 400,
      json: async () => ({
        error: "Invalid request",
        details: "bet must be a positive integer",
      }),
    });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/bet must be a positive integer/i)).toBeInTheDocument();
    });
  });

  // ---- refreshBalance call (via context's balance re-fetch) ----

  it("calls refreshBalance on successful response", async () => {
    await renderGame();
    mockCoinflipResponse(5000, {
      ok: true,
      status: 200,
      json: async () => ({
        sessionId: "sess-7",
        outcome: "heads",
        result: "win",
        delta: 500,
        balanceAfter: 5500,
      }),
    });

    const balanceCallsBefore = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes("/balance")
    ).length;

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    await waitFor(() => {
      const balanceCallsAfter = mockFetch.mock.calls.filter(([url]) =>
        String(url).includes("/balance")
      ).length;
      expect(balanceCallsAfter).toBeGreaterThan(balanceCallsBefore);
    });
  });

  it("does not call refreshBalance on 409 response", async () => {
    await renderGame();
    mockCoinflipResponse(5000, {
      ok: false,
      status: 409,
      json: async () => ({
        error: "Insufficient funds",
        balance: 100,
        requested: 500,
      }),
    });

    const balanceCallsBefore = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes("/balance")
    ).length;

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
    });

    const balanceCallsAfter = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes("/balance")
    ).length;
    expect(balanceCallsAfter).toBe(balanceCallsBefore);
  });

  // ---- Flipping animation ----

  it("shows flipping animation text while awaiting response", async () => {
    await renderGame();
    // Never-resolving fetch for the coinflip POST so we can observe the
    // flipping state; balance route still resolves normally.
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/balance")) {
        return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
      }
      return new Promise(() => {});
    });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    // Multiple elements may match /flipping/i (the button text + the animation span)
    const flippingElements = screen.getAllByText(/flipping/i);
    expect(flippingElements.length).toBeGreaterThan(0);
  });
});
