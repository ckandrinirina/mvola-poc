# System Components

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  Browser (Client)                   │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │           page.tsx (Demo UI)                │    │
│  │  ┌────────────────────────────────────────┐ │    │
│  │  │       WithdrawForm component           │ │    │
│  │  │  - amount input                        │ │    │
│  │  │  - player phone number input           │ │    │
│  │  │  - submit → POST /api/mvola/withdraw   │ │    │
│  │  │  - poll  → GET  /api/mvola/status/:id  │ │    │
│  │  └────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (localhost)
┌──────────────────────▼──────────────────────────────┐
│              Next.js Server (API Routes)             │
│                                                     │
│  POST /api/mvola/token         token/route.ts        │
│  POST /api/mvola/withdraw      withdraw/route.ts     │
│  GET  /api/mvola/status/:id    status/route.ts       │
│  PUT  /api/mvola/callback      callback/route.ts     │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │         src/lib/mvola/                      │    │
│  │  auth.ts    — token cache + refresh logic   │    │
│  │  client.ts  — typed MVola HTTP calls        │    │
│  │  types.ts   — shared TypeScript interfaces  │    │
│  └─────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│            MVola API (devapi.mvola.mg)               │
│                                                     │
│  POST /token                                        │
│  POST /mvola/mm/transactions/type/merchantpay/1.0.0/│
│  GET  /mvola/mm/transactions/type/merchantpay/1.0.0/│
│       status/{serverCorrelationId}                  │
└─────────────────────────────────────────────────────┘
          │ PUT callback (webhook)
          ▼
  PUT /api/mvola/callback  (on this server)
```

## Components

### `src/app/page.tsx` — Demo Page
- **Type:** React Server Component (renders `WithdrawForm`)
- **Purpose:** Entry point for the demo UI
- **Responsibilities:** Render the withdrawal form, display transaction status

### `src/components/WithdrawForm.tsx` — Withdrawal Form
- **Type:** React Client Component (`"use client"`)
- **Purpose:** Let the user enter a player phone number and withdrawal amount
- **Responsibilities:**
  - Capture form input (amount, player MSISDN)
  - `POST /api/mvola/withdraw` on submit
  - Poll `GET /api/mvola/status/{correlationId}` every 3 seconds
  - Display current status (pending / completed / failed)

### `src/app/api/mvola/token/route.ts` — Token Route
- **Type:** Next.js API Route (server-only)
- **Purpose:** Acquire and return an OAuth access token from MVola
- **Responsibilities:**
  - Call `src/lib/mvola/auth.ts` to get a valid token
  - Return the token (for debugging); in production this endpoint would be internal only

### `src/app/api/mvola/withdraw/route.ts` — Withdraw Route
- **Type:** Next.js API Route (server-only)
- **Purpose:** Initiate a payout from the merchant account to a player
- **Responsibilities:**
  - Validate request body (amount, player MSISDN)
  - Ensure a valid OAuth token (via `auth.ts`)
  - Call `client.ts` to POST to MVola Merchant Pay endpoint
  - Return `{ serverCorrelationId }` to the client for polling

### `src/app/api/mvola/status/[correlationId]/route.ts` — Status Route
- **Type:** Next.js API Route (server-only)
- **Purpose:** Check the status of a previously initiated transaction
- **Responsibilities:**
  - Ensure a valid OAuth token
  - Call `client.ts` to GET transaction status from MVola
  - Return `{ transactionStatus, transactionReference }` to the client

### `src/app/api/mvola/callback/route.ts` — Webhook Route
- **Type:** Next.js API Route (server-only)
- **Purpose:** Receive MVola's asynchronous callback when a transaction completes
- **Responsibilities:**
  - Accept `PUT` requests from MVola
  - Log the callback payload (console / future: database)
  - Return `200 OK` to acknowledge receipt

### `src/lib/mvola/auth.ts` — Token Manager
- **Type:** Server-only TypeScript module
- **Purpose:** Manage OAuth token lifecycle
- **Responsibilities:**
  - Fetch a new token using Consumer Key + Secret (Basic Auth)
  - Cache the token in memory with its expiry time
  - Automatically refresh when token is within 60 seconds of expiry

### `src/lib/mvola/client.ts` — MVola HTTP Client
- **Type:** Server-only TypeScript module
- **Purpose:** Typed wrappers around MVola API endpoints
- **Responsibilities:**
  - `initiateWithdrawal(params)` → POST to MVola Merchant Pay
  - `getTransactionStatus(correlationId)` → GET status from MVola
  - Attach required headers (`X-CorrelationID`, `UserAccountIdentifier`, etc.)

### `src/lib/mvola/types.ts` — TypeScript Types
- **Type:** Shared type definitions
- **Purpose:** Single source of truth for all MVola payload shapes
- **Responsibilities:** Define interfaces for `MVolaToken`, `WithdrawalRequest`, `TransactionResponse`, `CallbackPayload`

## Component Interaction Matrix

| From \ To | WithdrawForm | /api/mvola/* | auth.ts | client.ts | MVola API |
|-----------|-------------|--------------|---------|-----------|-----------|
| WithdrawForm | — | HTTP POST/GET | — | — | — |
| /api/mvola/* | — | — | calls | calls | — |
| auth.ts | — | — | — | — | POST /token |
| client.ts | — | — | — | — | POST/GET tx |
