/**
 * @jest-environment jsdom
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import CashOutForm from "@/components/CashOutForm";
import { WalletHeader } from "@/components/WalletHeader";

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

/** Wraps CashOutForm inside a WalletHeader providing real MsisdnContext */
function renderWithContext(balance = 5000, msisdn = "0343500003") {
  // Pre-populate localStorage so WalletHeader picks up the MSISDN
  localStorageStore["mvola-prof.msisdn"] = msisdn;

  // Wallet balance fetch
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/balance")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ balance }),
      });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  return render(
    <WalletHeader>
      <CashOutForm />
    </WalletHeader>
  );
}

/**
 * Renders with a caller-supplied `mockFetch.mockImplementation` already active
 * *before* mount. Unlike `renderWithContext`, this does not install its own
 * balance-only mock — the caller's implementation must cover `/balance` too. Needed
 * whenever a test cares about `GET /api/config/polling`: that fetch fires once from
 * `usePollingConfig`'s mount effect, before any post-render `mockImplementation`
 * reassignment would ever be seen.
 */
function renderWithMock(
  mockImpl: (url: string, options?: RequestInit) => Promise<unknown>,
  msisdn = "0343500003"
) {
  localStorageStore["mvola-prof.msisdn"] = msisdn;
  mockFetch.mockImplementation(mockImpl);
  return render(
    <WalletHeader>
      <CashOutForm />
    </WalletHeader>
  );
}

describe("CashOutForm", () => {
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

  // ---- Default amount = balance ----

  it("defaults the amount input to the current wallet balance", async () => {
    await act(async () => {
      renderWithContext(7500, "0343500003");
      await Promise.resolve();
    });

    // Let balance polling settle
    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await waitFor(() => {
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(Number(input.value)).toBe(7500);
    });
  });

  // ---- No separate MSISDN input ----

  it("does not render a separate MSISDN/phone input inside the form", async () => {
    await act(async () => {
      renderWithContext(1000, "0343500003");
      await Promise.resolve();
    });

    // The header has one textbox (MSISDN), but the form body must NOT add another
    const textboxes = screen.queryAllByRole("textbox");
    // Only the header's MSISDN input should be present
    expect(textboxes).toHaveLength(1);
  });

  // ---- 409 Insufficient funds ----

  it("displays insufficient-funds error with balance and requested amount on 409", async () => {
    await act(async () => {
      renderWithContext(3000, "0343500003");
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await waitFor(() => {
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(Number(input.value)).toBe(3000);
    });

    // Intercept the POST /api/mvola/withdraw with a 409
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/balance")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ balance: 3000 }),
        });
      }
      if (url === "/api/mvola/withdraw") {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            error: "Insufficient funds",
            balance: 3000,
            requested: 5000,
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cash.?out/i }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
      expect(screen.getByText(/3000/)).toBeInTheDocument();
      expect(screen.getByText(/5000/)).toBeInTheDocument();
    });
  });

  // ---- Completed path ----

  it("shows 'Cash-out successful' banner and calls refreshBalance on completed", async () => {
    await act(async () => {
      renderWithContext(4000, "0343500003");
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await waitFor(() => {
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(Number(input.value)).toBe(4000);
    });

    let balanceFetchCount = 0;

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/balance")) {
        balanceFetchCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ balance: 4000 }),
        });
      }
      if (url === "/api/mvola/withdraw") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ correlationId: "cid-completed" }),
        });
      }
      if (
        typeof url === "string" &&
        url.includes("/api/mvola/status/cid-completed")
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactionStatus: "completed" }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const balanceCountBefore = balanceFetchCount;

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cash.?out/i }));
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByText(/cash.?out successful/i)
      ).toBeInTheDocument();
    });

    // refreshBalance must have been called at least once after terminal
    expect(balanceFetchCount).toBeGreaterThan(balanceCountBefore);
  });

  // ---- Failed path with "wallet refunded" messaging ----

  it("shows 'Cash-out failed — wallet refunded' banner and calls refreshBalance on failed", async () => {
    await act(async () => {
      renderWithContext(4000, "0343500003");
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await waitFor(() => {
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(Number(input.value)).toBe(4000);
    });

    let balanceFetchCount = 0;

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/balance")) {
        balanceFetchCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ balance: 4000 }),
        });
      }
      if (url === "/api/mvola/withdraw") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ correlationId: "cid-failed" }),
        });
      }
      if (
        typeof url === "string" &&
        url.includes("/api/mvola/status/cid-failed")
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactionStatus: "failed" }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const balanceCountBefore = balanceFetchCount;

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cash.?out/i }));
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByText(/cash.?out failed/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/wallet refunded/i)).toBeInTheDocument();
    });

    expect(balanceFetchCount).toBeGreaterThan(balanceCountBefore);
  });

  // ---- Amount validation: capped at balance ----

  it("prevents submission when amount exceeds balance", async () => {
    await act(async () => {
      renderWithContext(2000, "0343500003");
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await waitFor(() => {
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(Number(input.value)).toBe(2000);
    });

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/balance")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ balance: 2000 }),
        });
      }
      // Withdraw should NOT be called
      return Promise.reject(new Error("withdraw called unexpectedly"));
    });

    // Change amount to exceed balance
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "9999" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cash.?out/i }));
      await Promise.resolve();
    });

    // The form should show a validation error — withdraw never called
    await waitFor(() => {
      expect(
        screen.getByText(/exceeds.*balance|cannot exceed/i)
      ).toBeInTheDocument();
    });
  });

  // ---- Form disabled after terminal ----

  it("disables the form after a completed transaction", async () => {
    await act(async () => {
      renderWithContext(4000, "0343500003");
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await waitFor(() => {
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(Number(input.value)).toBe(4000);
    });

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/balance")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ balance: 4000 }),
        });
      }
      if (url === "/api/mvola/withdraw") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ correlationId: "cid-disable" }),
        });
      }
      if (
        typeof url === "string" &&
        url.includes("/api/mvola/status/cid-disable")
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactionStatus: "completed" }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cash.?out/i }));
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /cash.?out/i })
      ).toBeDisabled();
    });
  });

  // ---- Sends correct payload ----

  it("POSTs { msisdn, amount } to /api/mvola/withdraw", async () => {
    await act(async () => {
      renderWithContext(5000, "0343500003");
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await waitFor(() => {
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(Number(input.value)).toBe(5000);
    });

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/balance")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ balance: 5000 }),
        });
      }
      if (url === "/api/mvola/withdraw") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ correlationId: "cid-payload" }),
        });
      }
      if (typeof url === "string" && url.includes("/api/mvola/status/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactionStatus: "pending" }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cash.?out/i }));
      await Promise.resolve();
    });

    await waitFor(() => {
      const call = mockFetch.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/mvola/withdraw"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body).toMatchObject({ msisdn: "0343500003", amount: 5000 });
    });
  });

  // ---- Configured polling interval + ceiling + banner (story 09-11) ----
  //
  // These use `renderWithMock` (not `renderWithContext`) because the polling-config
  // fetch fires once from `usePollingConfig`'s mount effect — it must be part of the
  // very first mock, not a later reassignment.

  it("polls at the pollIntervalMs returned by GET /api/config/polling, not the old hardcoded 3000", async () => {
    await act(async () => {
      renderWithMock((url: string) => {
        if (typeof url === "string" && url.includes("/api/config/polling")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ pollIntervalMs: 5000, pollTimeoutMs: 120000 }),
          });
        }
        if (typeof url === "string" && url.includes("/balance")) {
          return Promise.resolve({ ok: true, json: async () => ({ balance: 5000 }) });
        }
        if (url === "/api/mvola/withdraw") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ correlationId: "cfg-cash-001" }),
          });
        }
        if (typeof url === "string" && url.includes("/api/mvola/status/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ transactionStatus: "pending" }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await waitFor(() => {
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(Number(input.value)).toBe(5000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cash.?out/i }));
      await Promise.resolve();
    });

    const statusCallsAfterSubmit = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/api/mvola/status/")
    ).length;

    // The old hardcoded interval (3000 ms) must NOT trigger a poll now
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    const statusCallsAt3000 = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/api/mvola/status/")
    ).length;
    expect(statusCallsAt3000).toBe(statusCallsAfterSubmit);

    // Reaching the configured 5000 ms must trigger exactly one poll
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    const statusCallsAt5000 = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/api/mvola/status/")
    ).length;
    expect(statusCallsAt5000).toBe(statusCallsAfterSubmit + 1);
  });

  it("reaches still-pending at pollTimeoutMs without calling refreshBalance or altering the balance", async () => {
    let balanceFetchCount = 0;

    await act(async () => {
      renderWithMock((url: string) => {
        if (typeof url === "string" && url.includes("/api/config/polling")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ pollIntervalMs: 3000, pollTimeoutMs: 7000 }),
          });
        }
        if (typeof url === "string" && url.includes("/balance")) {
          balanceFetchCount++;
          return Promise.resolve({ ok: true, json: async () => ({ balance: 4000 }) });
        }
        if (url === "/api/mvola/withdraw") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ correlationId: "ceiling-cash-001" }),
          });
        }
        if (typeof url === "string" && url.includes("/api/mvola/status/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ transactionStatus: "pending" }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await waitFor(() => {
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(Number(input.value)).toBe(4000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cash.?out/i }));
      await Promise.resolve();
    });

    // Advance to just short of the 7000 ms ceiling (intermediate polls at 3000/6000
    // stay pending). WalletHeader's own balance poll (every 2000 ms, unrelated to
    // this story) also ticks in this window — expected, not what this checks.
    await act(async () => {
      jest.advanceTimersByTime(6000);
      await Promise.resolve();
    });
    const balanceCallsAt6000 = balanceFetchCount;

    // Cross the ceiling. WalletHeader's next periodic tick lands at 8000, not here —
    // so any increase in this narrow window is our own refreshBalance, and none is
    // expected: a timeout must never move the balance (rule R3).
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByText(/still pending — waiting for mvola/i)
      ).toBeInTheDocument();
    });

    // Never uses the word "failed" for this state
    expect(screen.queryByText(/cash.?out failed/i)).not.toBeInTheDocument();

    // refreshBalance must NOT have fired for the ceiling crossing itself
    expect(balanceFetchCount).toBe(balanceCallsAt6000);

    // Polling must have stopped — no further status calls after the ceiling
    const statusCallsAtCeiling = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/api/mvola/status/")
    ).length;

    await act(async () => {
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    const statusCallsAfter = mockFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/api/mvola/status/")
    ).length;
    expect(statusCallsAfter).toBe(statusCallsAtCeiling);
  });

  it("renders PendingApprovalBanner while pending, with the submission time and pollTimeoutMs", async () => {
    await act(async () => {
      renderWithMock((url: string) => {
        if (typeof url === "string" && url.includes("/api/config/polling")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ pollIntervalMs: 3000, pollTimeoutMs: 120000 }),
          });
        }
        if (typeof url === "string" && url.includes("/balance")) {
          return Promise.resolve({ ok: true, json: async () => ({ balance: 4000 }) });
        }
        if (url === "/api/mvola/withdraw") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ correlationId: "banner-cash-001" }),
          });
        }
        if (typeof url === "string" && url.includes("/api/mvola/status/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ transactionStatus: "pending" }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await waitFor(() => {
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(Number(input.value)).toBe(4000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cash.?out/i }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/waiting for mvola approval/i)).toBeInTheDocument();
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/remaining budget/i)).toBeInTheDocument();
    });
  });

  // ---- Cleanup on unmount ----

  it("clears interval and ceiling timeout on unmount", async () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    let unmount: () => void;
    await act(async () => {
      const result = renderWithMock((url: string) => {
        if (typeof url === "string" && url.includes("/api/config/polling")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ pollIntervalMs: 3000, pollTimeoutMs: 120000 }),
          });
        }
        if (typeof url === "string" && url.includes("/balance")) {
          return Promise.resolve({ ok: true, json: async () => ({ balance: 4000 }) });
        }
        if (url === "/api/mvola/withdraw") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ correlationId: "unmount-cash-001" }),
          });
        }
        if (typeof url === "string" && url.includes("/api/mvola/status/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ transactionStatus: "pending" }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });
      unmount = result.unmount;
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await waitFor(() => {
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(Number(input.value)).toBe(4000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cash.?out/i }));
      await Promise.resolve();
    });

    unmount!();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
