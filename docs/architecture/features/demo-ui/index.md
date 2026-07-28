---
slug: demo-ui
design: planned
---

# Demo UI (single withdraw form)

> Self-contained — a story reads this (+ folder-structure.md, + \_shared.md when noted), not other feature docs.

## Summary

The original React demo interface: a root page plus a single `WithdrawForm` client
component that exercises the MVola withdrawal flow end-to-end in a browser. Its
boundary: this feature is the wallet-unaware PoC UI. It has since been **superseded by
[tabbed-ui](../tabbed-ui/index.md)**, which replaces `page.tsx` with the tabbed
single-page app and refactors `WithdrawForm` into `CashOutForm`. This doc is retained as
the record of the shipped first-generation UI.

## Components

### `src/app/layout.tsx` — Root Layout

- **Type:** React Server Component
- **Purpose:** Root HTML shell with Tailwind base styles
- **Responsibilities:** Provide `<html>`/`<body>`, load `globals.css`, set page metadata
- **Depends on:** the [foundation](../foundation/index.md) scaffold

### `src/app/page.tsx` — Demo Page

- **Type:** React Server Component
- **Purpose:** Entry point for the demo UI
- **Responsibilities:** Render `WithdrawForm`
- **Superseded by:** [tabbed-ui](../tabbed-ui/index.md), which renders `WalletHeader` + `TabbedLayout` instead

### `src/components/WithdrawForm.tsx` — Withdraw Form

- **Type:** React Client Component (`"use client"`)
- **Purpose:** Capture a player phone number and amount, submit a withdrawal, and show its outcome
- **Responsibilities:**
  - Capture form input (player MSISDN, amount)
  - `POST /api/mvola/withdraw`
  - Poll `GET /api/mvola/status/{correlationId}` every 3 seconds until `completed` or `failed`
  - Render pending / success / failure states
- **Depends on:** [api-routes](../api-routes/index.md)
- **Superseded by:** `CashOutForm` in [tabbed-ui](../tabbed-ui/index.md)

## API

None owned. This feature consumes `POST /api/mvola/withdraw` and
`GET /api/mvola/status/[correlationId]` — see [api-routes](../api-routes/index.md).

## Data

Client-side React state only: `WithdrawForm` tracks `correlationId`, the polling
interval, and the transaction status. Nothing persists.

## Flows

The withdrawal round-trip this UI drives is documented as
[flow 1 in api-routes](../api-routes/index.md#1-player-initiates-withdrawal-happy-path).

## Shared dependencies

- [High-level request flow](../../_shared.md#high-level-request-flow)
- [Sandbox test numbers](../../_shared.md#sandbox-test-numbers)
- [dev-guide.md](../../dev-guide.md) — how to exercise the form locally
