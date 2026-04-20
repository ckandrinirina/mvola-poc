# Story 08-02: `TabbedLayout` Component — Tab Switcher

> **Epic:** 08 — Tabbed Demo UI
> **Size:** S
> **Status:** DONE

## Description

Create `src/components/TabbedLayout.tsx` — a simple tab switcher that renders four labelled tab triggers and displays the active tab's body. It takes the four tab bodies as props (one per tab) and uses local `useState` for the active index. No external tab library. Keyboard-accessible with `role="tab"` + `aria-selected`.

## Acceptance Criteria

- [x] Component is a React client component (`"use client"`)
- [x] Accepts `tabs: Array<{ label: string; content: ReactNode }>` as props (4 items expected)
- [x] Renders tab triggers in a row; active trigger has a distinct visual (e.g. bold + underline)
- [x] Clicking a trigger updates the active index; the body area shows `tabs[active].content`
- [x] Each trigger has `role="tab"` and `aria-selected={i === active}`
- [x] Default active index = `0` (first tab)
- [x] Optional `defaultTab?: number` prop to override the initial index
- [x] Component tests cover: initial render (first tab shown), switching, aria-selected correctness, keyboard left/right navigation (nice-to-have)

## Technical Notes

```typescript
"use client";
import { useState, ReactNode } from "react";

interface TabbedLayoutProps {
  tabs: Array<{ label: string; content: ReactNode }>;
  defaultTab?: number;
}

export function TabbedLayout({ tabs, defaultTab = 0 }: TabbedLayoutProps) {
  const [active, setActive] = useState(defaultTab);
  return (
    <div>
      <div role="tablist" className="flex gap-2 border-b">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={i === active ? "... active classes ..." : "... inactive classes ..."}
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
```

This component is intentionally presentation-only — it does not know about `MsisdnContext` or any API. It receives rendered nodes as props.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/components/TabbedLayout.tsx` | Presentational tab switcher |
| CREATE | `src/components/__tests__/TabbedLayout.test.tsx` | Component tests |

## Dependencies

- **Blocked by:** None (can be built in parallel with any other 08-* story)
- **Blocks:** Story 08-07 (`page.tsx` uses this)

## Related

- **Epic:** 08_tabbed-ui
- **Spec reference:** `docs/architecture/components.md` § `TabbedLayout`
