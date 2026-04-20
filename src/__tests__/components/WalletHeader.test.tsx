/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WalletHeader, useMsisdnContext } from "@/components/WalletHeader";

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

// Helper consumer component to expose context values
function ContextConsumer() {
  const { msisdn, balance, refreshBalance } = useMsisdnContext();
  return (
    <div>
      <span data-testid="ctx-msisdn">{msisdn}</span>
      <span data-testid="ctx-balance">{balance}</span>
      <button onClick={refreshBalance} data-testid="ctx-refresh">
        refresh
      </button>
    </div>
  );
}

describe("WalletHeader", () => {
  beforeEach(() => {
    // Reset mock call counts and return values
    jest.resetAllMocks();
    // Reset the underlying store
    localStorageStore = {};
    // Restore the mock implementations after resetAllMocks
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
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 0 }),
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ---- Rendering ----

  it("renders an MSISDN input", () => {
    render(<WalletHeader />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders a balance display", () => {
    render(<WalletHeader />);
    // balance display contains "Ar"
    expect(screen.getByText(/Ar/)).toBeInTheDocument();
  });

  // ---- localStorage: read on mount ----

  it("reads persisted MSISDN from localStorage on mount", async () => {
    localStorageMock.getItem.mockReturnValue("0343500001");

    await act(async () => {
      render(<WalletHeader />);
    });

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("0343500001");
    expect(localStorageMock.getItem).toHaveBeenCalledWith("mvola-prof.msisdn");
  });

  it("starts with empty input when localStorage has no MSISDN", async () => {
    await act(async () => {
      render(<WalletHeader />);
    });

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  // ---- localStorage: write on change ----

  it("persists MSISDN to localStorage when input changes", async () => {
    await act(async () => {
      render(<WalletHeader />);
    });

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "0343500002" },
      });
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "mvola-prof.msisdn",
      "0343500002"
    );
  });

  it("removes MSISDN from localStorage when input is cleared", async () => {
    localStorageMock.getItem.mockReturnValue("0343500001");

    await act(async () => {
      render(<WalletHeader />);
    });

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith("mvola-prof.msisdn");
  });

  // ---- Polling: starts when MSISDN is set ----

  it("polls balance immediately when MSISDN is set", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 1000 }),
    });

    await act(async () => {
      render(<WalletHeader />);
    });

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "0343500003" },
      });
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/wallet/0343500003/balance"
    );
  });

  it("polls balance every 2000 ms while MSISDN is set", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 500 }),
    });

    await act(async () => {
      render(<WalletHeader />);
    });

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "0343500004" },
      });
      await Promise.resolve();
    });

    const callsAfterSet = mockFetch.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(mockFetch.mock.calls.length).toBe(callsAfterSet + 1);

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(mockFetch.mock.calls.length).toBe(callsAfterSet + 2);
  });

  // ---- Polling: stops when MSISDN is cleared ----

  it("stops polling when MSISDN is cleared", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 200 }),
    });

    await act(async () => {
      render(<WalletHeader />);
    });

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "0343500005" },
      });
      await Promise.resolve();
    });

    // Clear the MSISDN
    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
      await Promise.resolve();
    });

    const callsAfterClear = mockFetch.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(mockFetch.mock.calls.length).toBe(callsAfterClear);
  });

  it("stops polling on unmount", async () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 300 }),
    });

    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(<WalletHeader />));
    });

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "0343500006" },
      });
      await Promise.resolve();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  // ---- Balance display ----

  it("displays the balance formatted with Ariary suffix", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 5000 }),
    });

    await act(async () => {
      render(<WalletHeader />);
    });

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "0343500007" },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/5.*000.*Ar|5000.*Ar/)).toBeInTheDocument();
    });
  });

  // ---- Context: exposes msisdn, balance, refreshBalance ----

  it("exposes msisdn via MsisdnContext", async () => {
    await act(async () => {
      render(
        <WalletHeader>
          <ContextConsumer />
        </WalletHeader>
      );
    });

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "0343500008" },
      });
      await Promise.resolve();
    });

    expect(screen.getByTestId("ctx-msisdn").textContent).toBe("0343500008");
  });

  it("exposes balance via MsisdnContext", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 7500 }),
    });

    await act(async () => {
      render(
        <WalletHeader>
          <ContextConsumer />
        </WalletHeader>
      );
    });

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "0343500009" },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("ctx-balance").textContent).toBe("7500");
    });
  });

  it("refreshBalance triggers an immediate fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 100 }),
    });

    await act(async () => {
      render(
        <WalletHeader>
          <ContextConsumer />
        </WalletHeader>
      );
    });

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "0343500010" },
      });
      await Promise.resolve();
    });

    const callsBefore = mockFetch.mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByTestId("ctx-refresh"));
      await Promise.resolve();
    });

    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(mockFetch).toHaveBeenLastCalledWith("/api/wallet/0343500010/balance");
  });

  it("useMsisdnContext throws when used outside WalletHeader", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ContextConsumer />)).toThrow(
      "useMsisdnContext must be used inside <WalletHeader>"
    );
    consoleSpy.mockRestore();
  });
});
