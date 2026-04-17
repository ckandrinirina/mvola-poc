/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import WithdrawForm from "@/components/WithdrawForm";

const mockFetch = jest.fn();
global.fetch = mockFetch;

function fillAndSubmit(amount = "1000", msisdn = "0343500003") {
  fireEvent.change(screen.getByRole("spinbutton"), {
    target: { value: amount },
  });
  fireEvent.change(screen.getByPlaceholderText("0343500003"), {
    target: { value: msisdn },
  });
  fireEvent.click(screen.getByRole("button", { name: /withdraw/i }));
}

describe("WithdrawForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders form with amount input, MSISDN input, and submit button", () => {
    render(<WithdrawForm />);
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0343500003")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /withdraw/i })
    ).toBeInTheDocument();
  });

  it("MSISDN input has placeholder 0343500003", () => {
    render(<WithdrawForm />);
    expect(screen.getByPlaceholderText("0343500003")).toBeInTheDocument();
  });

  it("disables form while submitting", async () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves

    render(<WithdrawForm />);
    fillAndSubmit();

    expect(screen.getByRole("button", { name: /withdraw/i })).toBeDisabled();
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    expect(screen.getByPlaceholderText("0343500003")).toBeDisabled();
  });

  it("shows error message and re-enables form on 400 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "amount and playerMsisdn are required" }),
    });

    render(<WithdrawForm />);
    fillAndSubmit();

    await waitFor(() => {
      expect(
        screen.getByText(/amount and playerMsisdn are required/i)
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /withdraw/i })).not.toBeDisabled();
  });

  it("displays correlationId after successful withdraw", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ correlationId: "test-correlation-123" }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ transactionStatus: "pending" }),
      });

    render(<WithdrawForm />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/test-correlation-123/)).toBeInTheDocument();
    });
  });

  it("starts polling every 3 seconds after successful withdraw", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ correlationId: "poll-id" }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ transactionStatus: "pending" }),
      });

    render(<WithdrawForm />);

    await act(async () => {
      fillAndSubmit();
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith("/api/mvola/status/poll-id");

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("stops polling when status is completed", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ correlationId: "done-id" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactionStatus: "completed" }),
      });

    render(<WithdrawForm />);

    await act(async () => {
      fillAndSubmit();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    const callCount = mockFetch.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(mockFetch.mock.calls.length).toBe(callCount);
  });

  it("stops polling when status is failed", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ correlationId: "fail-id" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactionStatus: "failed" }),
      });

    render(<WithdrawForm />);

    await act(async () => {
      fillAndSubmit();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    const callCount = mockFetch.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(mockFetch.mock.calls.length).toBe(callCount);
  });

  it("clears interval on unmount", async () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ correlationId: "unmount-id" }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ transactionStatus: "pending" }),
      });

    const { unmount } = render(<WithdrawForm />);

    await act(async () => {
      fillAndSubmit();
      await Promise.resolve();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("shows pending status with amber styling", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ correlationId: "style-id" }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ transactionStatus: "pending" }),
      });

    render(<WithdrawForm />);

    await act(async () => {
      fillAndSubmit();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    await waitFor(() => {
      const statusEl = screen.getByText(/pending/i);
      expect(statusEl.className).toMatch(/amber|yellow/);
    });
  });

  it("shows completed status with green styling", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ correlationId: "style-id" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactionStatus: "completed" }),
      });

    render(<WithdrawForm />);

    await act(async () => {
      fillAndSubmit();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    await waitFor(() => {
      const statusEl = screen.getByText(/completed/i);
      expect(statusEl.className).toMatch(/green/);
    });
  });

  it("shows failed status with red styling", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ correlationId: "style-id" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactionStatus: "failed" }),
      });

    render(<WithdrawForm />);

    await act(async () => {
      fillAndSubmit();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    await waitFor(() => {
      const statusEl = screen.getByText(/failed/i);
      expect(statusEl.className).toMatch(/red/);
    });
  });
});
