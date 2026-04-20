/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TabbedLayout } from "@/components/TabbedLayout";

const tabs = [
  { label: "Deposit", content: <div>Deposit Content</div> },
  { label: "Withdraw", content: <div>Withdraw Content</div> },
  { label: "Coinflip", content: <div>Coinflip Content</div> },
  { label: "History", content: <div>History Content</div> },
];

describe("TabbedLayout", () => {
  it("renders all tab triggers", () => {
    render(<TabbedLayout tabs={tabs} />);
    expect(screen.getByRole("tab", { name: /deposit/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /withdraw/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /coinflip/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /history/i })).toBeInTheDocument();
  });

  it("shows the first tab content by default", () => {
    render(<TabbedLayout tabs={tabs} />);
    expect(screen.getByText("Deposit Content")).toBeInTheDocument();
    expect(screen.queryByText("Withdraw Content")).not.toBeInTheDocument();
  });

  it("shows the correct tab content when defaultTab is provided", () => {
    render(<TabbedLayout tabs={tabs} defaultTab={2} />);
    expect(screen.getByText("Coinflip Content")).toBeInTheDocument();
    expect(screen.queryByText("Deposit Content")).not.toBeInTheDocument();
  });

  it("switches content when a tab trigger is clicked", () => {
    render(<TabbedLayout tabs={tabs} />);
    fireEvent.click(screen.getByRole("tab", { name: /withdraw/i }));
    expect(screen.getByText("Withdraw Content")).toBeInTheDocument();
    expect(screen.queryByText("Deposit Content")).not.toBeInTheDocument();
  });

  it("sets aria-selected=true on the active tab and false on others", () => {
    render(<TabbedLayout tabs={tabs} />);
    const depositTab = screen.getByRole("tab", { name: /deposit/i });
    const withdrawTab = screen.getByRole("tab", { name: /withdraw/i });

    expect(depositTab).toHaveAttribute("aria-selected", "true");
    expect(withdrawTab).toHaveAttribute("aria-selected", "false");
  });

  it("updates aria-selected after switching tabs", () => {
    render(<TabbedLayout tabs={tabs} />);
    fireEvent.click(screen.getByRole("tab", { name: /history/i }));

    const depositTab = screen.getByRole("tab", { name: /deposit/i });
    const historyTab = screen.getByRole("tab", { name: /history/i });

    expect(historyTab).toHaveAttribute("aria-selected", "true");
    expect(depositTab).toHaveAttribute("aria-selected", "false");
  });

  it("renders a tablist container", () => {
    render(<TabbedLayout tabs={tabs} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("renders a tabpanel container", () => {
    render(<TabbedLayout tabs={tabs} />);
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });

  it("active tab trigger has visually distinct styling", () => {
    render(<TabbedLayout tabs={tabs} />);
    const activeTab = screen.getByRole("tab", { name: /deposit/i });
    // Active tab should have bold/underline class
    expect(activeTab.className).toMatch(/font-bold|font-semibold|underline/);
  });

  it("inactive tab trigger does not have active styling", () => {
    render(<TabbedLayout tabs={tabs} />);
    const inactiveTab = screen.getByRole("tab", { name: /withdraw/i });
    // Inactive tab should not have bold styling
    expect(inactiveTab.className).not.toMatch(/font-bold|font-semibold/);
  });
});
