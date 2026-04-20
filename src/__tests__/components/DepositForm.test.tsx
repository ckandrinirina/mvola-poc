/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WalletHeader } from "@/components/WalletHeader";
import { DepositForm } from "@/components/DepositForm";

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

/** Balance response helper */
const balanceOk = { ok: true, json: async () => ({ balance: 0 }) };

/** Wraps DepositForm inside WalletHeader so useMsisdnContext is available. */
function renderWithContext() {
  return render(
    <WalletHeader>
      <DepositForm />
    </WalletHeader>
  );
}

/** Sets the MSISDN input in the WalletHeader to a known value. */
async function setMsisdn(msisdn: string) {
  const msisdnInput = screen.getAllByRole("textbox")[0];
  await act(async () => {
    fireEvent.change(msisdnInput, { target: { value: msisdn } });
    await Promise.resolve();
  });
}

async function fillAmount(amount: string) {
  const amountInput = screen.getByRole("spinbutton");
  await act(async () => {
    fireEvent.change(amountInput, { target: { value: amount } });
    await Promise.resolve();
  });
}

async function submitForm() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /deposit/i }));
    await Promise.resolve();
  });
}

describe("DepositForm", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    localStorageStore = {};
    localStorageMock.getItem.mockImplementation(
      (key: string) => localStorageStore[key] ?? null
    );
    localStorageMock.setItem.mockImplementation(
      (key: string, value: string) => { localStorageStore[key] = value; }
    );
    localStorageMock.removeItem.mockImplementation(
      (key: string) => { delete localStorageStore[key]; }
    );
    localStorageMock.clear.mockImplementation(() => { localStorageStore = {}; });
    jest.useFakeTimers();
    // Default fallback: balance always returns 0
    mockFetch.mockResolvedValue(balanceOk);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ---- Rendering ----

  it("renders amount input and submit button", async () => {
    await act(async () => { renderWithContext(); });
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deposit/i })).toBeInTheDocument();
  });

  // ---- Disabled when msisdn is empty ----

  it("submit button is disabled when msisdn is empty", async () => {
    await act(async () => { renderWithContext(); });
    expect(screen.getByRole("button", { name: /deposit/i })).toBeDisabled();
  });

  it("submit button is enabled when msisdn is set", async () => {
    await act(async () => { renderWithContext(); });
    await setMsisdn("0343500003");
    expect(screen.getByRole("button", { name: /deposit/i })).not.toBeDisabled();
  });

  // ---- Amount input: positive integers only ----

  it("amount input has type number with min=1", async () => {
    await act(async () => { renderWithContext(); });
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.min).toBe("1");
  });

  // ---- 400 error handling ----

  it("displays error message on 400 response", async () => {
    // mockFetch default is balanceOk (repeating), so all balance fetches are handled
    // We now override specifically for the deposit POST
    let callCount = 0;
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: "amount must be a positive integer" }),
        });
      }
      // balance fetch
      return Promise.resolve(balanceOk);
    });
    void callCount;

    await act(async () => { renderWithContext(); });
    await setMsisdn("0343500003");

    await fillAmount("500");
    await submitForm();

    await waitFor(() => {
      expect(
        screen.getByText(/amount must be a positive integer/i)
      ).toBeInTheDocument();
    });
  });

  it("displays 'MVola API error' on 502 response", async () => {
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 502,
          json: async () => ({}),
        });
      }
      return Promise.resolve(balanceOk);
    });

    await act(async () => { renderWithContext(); });
    await setMsisdn("0343500003");

    await fillAmount("500");
    await submitForm();

    await waitFor(() => {
      expect(screen.getByText(/MVola API error/i)).toBeInTheDocument();
    });
  });

  // ---- Happy path: POST success + polling ----

  it("stores correlationId and shows pending state after successful POST", async () => {
    let postCalled = false;
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        postCalled = true;
        return Promise.resolve({
          ok: true,
          json: async () => ({ correlationId: "dep-corr-001" }),
        });
      }
      if (typeof url === "string" && url.includes("/status/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactionStatus: "pending" }),
        });
      }
      return Promise.resolve(balanceOk);
    });

    await act(async () => { renderWithContext(); });
    await setMsisdn("0343500003");

    await fillAmount("1000");
    await submitForm();

    await waitFor(() => {
      expect(screen.getByText(/dep-corr-001/)).toBeInTheDocument();
    });
    expect(postCalled).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });

  it("POSTs to /api/mvola/deposit with msisdn and amount", async () => {
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ correlationId: "dep-corr-002" }),
        });
      }
      if (typeof url === "string" && url.includes("/status/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactionStatus: "pending" }),
        });
      }
      return Promise.resolve(balanceOk);
    });

    await act(async () => { renderWithContext(); });
    await setMsisdn("0343500003");

    await fillAmount("2000");
    await submitForm();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/mvola/deposit",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ msisdn: "0343500003", amount: 2000 }),
        })
      );
    });
  });

  it("polls /api/mvola/status/:correlationId every 3000 ms", async () => {
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ correlationId: "poll-dep-001" }),
        });
      }
      if (typeof url === "string" && url.includes("/status/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactionStatus: "pending" }),
        });
      }
      return Promise.resolve(balanceOk);
    });

    await act(async () => { renderWithContext(); });
    await setMsisdn("0343500003");

    await fillAmount("500");
    await submitForm();

    const statusCallsAfterSubmit = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/status/")
    ).length;

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    const statusCallsAfter1 = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/status/")
    ).length;
    expect(statusCallsAfter1).toBe(statusCallsAfterSubmit + 1);

    // Verify polling URL
    expect(mockFetch).toHaveBeenCalledWith("/api/mvola/status/poll-dep-001");

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    const statusCallsAfter2 = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/status/")
    ).length;
    expect(statusCallsAfter2).toBe(statusCallsAfterSubmit + 2);
  });

  // ---- completed status: refreshBalance + success banner ----

  it("calls refreshBalance and shows success banner on completed status", async () => {
    let statusCallCount = 0;
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ correlationId: "dep-done-001" }),
        });
      }
      if (typeof url === "string" && url.includes("/status/")) {
        statusCallCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactionStatus: "completed" }),
        });
      }
      // balance fetch
      return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
    });

    await act(async () => { renderWithContext(); });
    await setMsisdn("0343500003");

    const balanceCallsBefore = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/balance")
    ).length;

    await fillAmount("500");
    await submitForm();

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/deposit completed successfully/i)).toBeInTheDocument();
    });

    // refreshBalance should trigger an additional balance fetch
    const balanceCallsAfter = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/balance")
    ).length;
    expect(balanceCallsAfter).toBeGreaterThan(balanceCallsBefore);
    void statusCallCount;
  });

  it("stops polling after completed status", async () => {
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ correlationId: "stop-dep-001" }),
        });
      }
      if (typeof url === "string" && url.includes("/status/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactionStatus: "completed" }),
        });
      }
      return Promise.resolve(balanceOk);
    });

    await act(async () => { renderWithContext(); });
    await setMsisdn("0343500003");

    await fillAmount("500");
    await submitForm();

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    const statusCallsAfterFirst = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/status/")
    ).length;

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    const statusCallsAfterSecond = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/status/")
    ).length;

    // No additional status calls after completed
    expect(statusCallsAfterSecond).toBe(statusCallsAfterFirst);
  });

  // ---- failed status: error banner ----

  it("shows 'Deposit failed' banner on failed status", async () => {
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ correlationId: "dep-fail-001" }),
        });
      }
      if (typeof url === "string" && url.includes("/status/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactionStatus: "failed" }),
        });
      }
      return Promise.resolve(balanceOk);
    });

    await act(async () => { renderWithContext(); });
    await setMsisdn("0343500003");

    await fillAmount("500");
    await submitForm();

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/deposit failed/i)).toBeInTheDocument();
    });
  });

  it("stops polling after failed status", async () => {
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ correlationId: "stop-fail-001" }),
        });
      }
      if (typeof url === "string" && url.includes("/status/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactionStatus: "failed" }),
        });
      }
      return Promise.resolve(balanceOk);
    });

    await act(async () => { renderWithContext(); });
    await setMsisdn("0343500003");

    await fillAmount("500");
    await submitForm();

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    const statusCallsAfterFirst = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/status/")
    ).length;

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    const statusCallsAfterSecond = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/status/")
    ).length;

    // No additional status calls after failed
    expect(statusCallsAfterSecond).toBe(statusCallsAfterFirst);
  });

  // ---- Cleanup on unmount ----

  it("clears interval on unmount", async () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ correlationId: "unmount-dep-001" }),
        });
      }
      if (typeof url === "string" && url.includes("/status/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactionStatus: "pending" }),
        });
      }
      return Promise.resolve(balanceOk);
    });

    const { unmount } = await act(async () => renderWithContext());
    await setMsisdn("0343500003");

    await fillAmount("500");
    await submitForm();

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
