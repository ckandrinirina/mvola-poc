"use client";

import { useState, ReactNode, KeyboardEvent } from "react";

interface Tab {
  label: string;
  content: ReactNode;
}

interface TabbedLayoutProps {
  tabs: Array<Tab>;
  defaultTab?: number;
}

export function TabbedLayout({ tabs, defaultTab = 0 }: TabbedLayoutProps) {
  const [active, setActive] = useState(defaultTab);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === "ArrowRight") {
      const next = (index + 1) % tabs.length;
      setActive(next);
    } else if (e.key === "ArrowLeft") {
      const prev = (index - 1 + tabs.length) % tabs.length;
      setActive(prev);
    }
  };

  return (
    <div>
      <div role="tablist" className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={
              i === active
                ? "px-4 py-2 text-sm font-bold underline text-blue-600 border-b-2 border-blue-600"
                : "px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="p-4">
        {tabs[active]?.content}
      </div>
    </div>
  );
}
