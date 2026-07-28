/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PendingApprovalBanner } from "@/components/PendingApprovalBanner";

const POLL_TIMEOUT_MS = 120_000;

describe("PendingApprovalBanner", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders nothing when there is no pending transaction (startedAt is null)", () => {
    const { container } = render(
      <PendingApprovalBanner startedAt={null} pollTimeoutMs={POLL_TIMEOUT_MS} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("states plainly that settlement is waiting on a manual approval in MVola's developer portal", () => {
    const { container } = render(
      <PendingApprovalBanner startedAt={Date.now()} pollTimeoutMs={POLL_TIMEOUT_MS} />
    );
    expect(container.textContent).toMatch(/manual|human/i);
    expect(container.textContent).toMatch(/mvola/i);
    expect(container.textContent).toMatch(/developer portal/i);
  });

  it("shows elapsed time and advances it at least once per second", async () => {
    const startedAt = Date.now();
    render(
      <PendingApprovalBanner startedAt={startedAt} pollTimeoutMs={POLL_TIMEOUT_MS} />
    );

    expect(screen.getByText(/0:00/)).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(screen.getByText(/0:05/)).toBeInTheDocument();
  });

  it("shows the remaining budget derived from pollTimeoutMs", async () => {
    const startedAt = Date.now();
    render(
      <PendingApprovalBanner startedAt={startedAt} pollTimeoutMs={POLL_TIMEOUT_MS} />
    );

    // 120_000ms budget => 2:00 remaining at t=0
    expect(screen.getByText(/2:00/)).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    // 110_000ms remaining => 1:50
    expect(screen.getByText(/1:50/)).toBeInTheDocument();
  });

  it("links to MVola's developer-portal transaction-approvals page, opening in a new tab safely", () => {
    render(
      <PendingApprovalBanner startedAt={Date.now()} pollTimeoutMs={POLL_TIMEOUT_MS} />
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringContaining("developer.mvola.mg"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });

  it("switches to the still-pending wording on reaching the ceiling, never an error style", async () => {
    const startedAt = Date.now();
    render(
      <PendingApprovalBanner startedAt={startedAt} pollTimeoutMs={POLL_TIMEOUT_MS} />
    );

    await act(async () => {
      jest.advanceTimersByTime(POLL_TIMEOUT_MS);
      await Promise.resolve();
    });

    expect(
      screen.getByText(/still pending.*mvola has not settled this yet/i)
    ).toBeInTheDocument();

    const banner = screen.getByRole("status");
    expect(banner.className).not.toMatch(/\bred-/);
    expect(banner.className).toMatch(/amber/);
  });

  it("respects a caller-controlled timedOut override even before the natural ceiling", () => {
    render(
      <PendingApprovalBanner
        startedAt={Date.now()}
        pollTimeoutMs={POLL_TIMEOUT_MS}
        timedOut
      />
    );
    expect(
      screen.getByText(/still pending.*mvola has not settled this yet/i)
    ).toBeInTheDocument();
  });

  it("explains that settlement may still arrive by callback once timed out — not a dead end", () => {
    render(
      <PendingApprovalBanner startedAt={Date.now()} pollTimeoutMs={POLL_TIMEOUT_MS} timedOut />
    );
    expect(screen.getByText(/callback/i)).toBeInTheDocument();
  });

  it('never renders the word "failed", while pending or once timed out', () => {
    const { container: pendingContainer } = render(
      <PendingApprovalBanner startedAt={Date.now()} pollTimeoutMs={POLL_TIMEOUT_MS} />
    );
    expect(pendingContainer.textContent).not.toMatch(/failed/i);

    const { container: timedOutContainer } = render(
      <PendingApprovalBanner
        startedAt={Date.now()}
        pollTimeoutMs={POLL_TIMEOUT_MS}
        timedOut
      />
    );
    expect(timedOutContainer.textContent).not.toMatch(/failed/i);
  });

  it("clears its interval on unmount so no timer survives the component", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const { unmount } = render(
      <PendingApprovalBanner startedAt={Date.now()} pollTimeoutMs={POLL_TIMEOUT_MS} />
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
