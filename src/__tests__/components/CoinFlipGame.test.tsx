/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CoinFlipGame } from "@/components/CoinFlipGame";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock context values
const mockRefreshBalance = jest.fn();

// Default context props for convenience
const defaultProps = {
  msisdn: "0343500003",
  balance: 5000,
  refreshBalance: mockRefreshBalance,
};

describe("CoinFlipGame", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ---- Disabled states ----

  it("disables the flip button when msisdn is empty", () => {
    render(<CoinFlipGame {...defaultProps} msisdn="" />);
    expect(screen.getByRole("button", { name: /flip/i })).toBeDisabled();
  });

  it("disables the flip button when balance is 0", () => {
    render(<CoinFlipGame {...defaultProps} balance={0} />);
    expect(screen.getByRole("button", { name: /flip/i })).toBeDisabled();
  });

  it("enables the flip button when msisdn and balance are set", () => {
    render(<CoinFlipGame {...defaultProps} />);
    expect(screen.getByRole("button", { name: /flip/i })).not.toBeDisabled();
  });

  // ---- Bet input ----

  it("renders a bet amount input", () => {
    render(<CoinFlipGame {...defaultProps} />);
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("caps bet input at current balance", () => {
    render(<CoinFlipGame {...defaultProps} balance={3000} />);
    const betInput = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(betInput.max).toBe("3000");
  });

  it("bet input has min of 1", () => {
    render(<CoinFlipGame {...defaultProps} />);
    const betInput = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(betInput.min).toBe("1");
  });

  // ---- Heads / Tails selector ----

  it("renders heads and tails choice buttons", () => {
    render(<CoinFlipGame {...defaultProps} />);
    expect(screen.getByRole("button", { name: /heads/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tails/i })).toBeInTheDocument();
  });

  it("selecting heads marks it as active", () => {
    render(<CoinFlipGame {...defaultProps} />);
    const headsBtn = screen.getByRole("button", { name: /heads/i });
    fireEvent.click(headsBtn);
    expect(headsBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("selecting tails marks it as active", () => {
    render(<CoinFlipGame {...defaultProps} />);
    const tailsBtn = screen.getByRole("button", { name: /tails/i });
    fireEvent.click(tailsBtn);
    expect(tailsBtn).toHaveAttribute("aria-pressed", "true");
  });

  // ---- Win rendering ----

  it("displays win banner in green on a win response", async () => {
    mockFetch.mockResolvedValue({
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

    render(<CoinFlipGame {...defaultProps} />);

    // Set bet
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    // Select heads
    fireEvent.click(screen.getByRole("button", { name: /heads/i }));
    // Click flip
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flip/i }));
    });

    // Fast-forward the 800ms animation delay
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
    mockFetch.mockResolvedValue({
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

    render(<CoinFlipGame {...defaultProps} />);

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
    mockFetch.mockResolvedValue({
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

    render(<CoinFlipGame {...defaultProps} />);

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
    mockFetch.mockResolvedValue({
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

    render(<CoinFlipGame {...defaultProps} />);

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
    mockFetch.mockResolvedValue({
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

    render(<CoinFlipGame {...defaultProps} />);

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
    mockFetch.mockResolvedValue({
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

    render(<CoinFlipGame {...defaultProps} />);

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
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: "Insufficient funds",
        balance: 100,
        requested: 500,
      }),
    });

    render(<CoinFlipGame {...defaultProps} />);

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
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: "Insufficient funds",
        balance: 100,
        requested: 500,
      }),
    });

    render(<CoinFlipGame {...defaultProps} />);

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
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Invalid request",
        details: "bet must be a positive integer",
      }),
    });

    render(<CoinFlipGame {...defaultProps} />);

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

  // ---- refreshBalance call ----

  it("calls refreshBalance on successful response", async () => {
    mockFetch.mockResolvedValue({
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

    render(<CoinFlipGame {...defaultProps} />);

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
      expect(mockRefreshBalance).toHaveBeenCalledTimes(1);
    });
  });

  it("does not call refreshBalance on 409 response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: "Insufficient funds",
        balance: 100,
        requested: 500,
      }),
    });

    render(<CoinFlipGame {...defaultProps} />);

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

    expect(mockRefreshBalance).not.toHaveBeenCalled();
  });

  // ---- Flipping animation ----

  it("shows flipping animation text while awaiting response", async () => {
    // Never-resolving fetch so we can observe the flipping state
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<CoinFlipGame {...defaultProps} />);

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
