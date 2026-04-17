# Project Folder Structure

## Overview

A standard Next.js 14+ App Router project. All MVola API calls are proxied through server-side API routes in `src/app/api/mvola/` to keep credentials out of the browser. The MVola HTTP client and token logic live in `src/lib/mvola/`.

## Directory Tree

```
mvola-prof/
├── src/
│   ├── app/                            # Next.js App Router root
│   │   ├── layout.tsx                  # Root HTML layout
│   │   ├── page.tsx                    # Demo UI: withdrawal form
│   │   └── api/
│   │       └── mvola/                  # Server-side MVola proxy routes
│   │           ├── token/
│   │           │   └── route.ts        # POST — fetch/refresh OAuth token
│   │           ├── withdraw/
│   │           │   └── route.ts        # POST — initiate payout to player
│   │           ├── status/
│   │           │   └── [correlationId]/
│   │           │       └── route.ts    # GET — poll transaction status
│   │           └── callback/
│   │               └── route.ts        # PUT — receive MVola webhook
│   ├── lib/
│   │   └── mvola/                      # MVola API client (server-only)
│   │       ├── client.ts               # HTTP calls to devapi/api.mvola.mg
│   │       ├── auth.ts                 # Token fetch + in-memory cache
│   │       └── types.ts                # TypeScript types for MVola payloads
│   └── components/
│       └── WithdrawForm.tsx            # React form: amount + phone number
├── docs/
│   ├── API_MerchantPay.pdf             # Original MVola API spec (read-only)
│   └── architecture/                   # This documentation set
├── .env.local                          # Secrets — NOT committed
├── .env.example                        # Template — committed
├── next.config.ts
├── tsconfig.json
├── package.json
└── CLAUDE.md
```

## Key Directories Explained

### `src/app/api/mvola/`
All four Next.js route handlers that proxy calls to the MVola API. Running entirely on the server, they have access to environment variables (credentials) and are never bundled into the client.

### `src/lib/mvola/`
Reusable MVola client logic. `auth.ts` manages token lifecycle (fetch on first use, return cached token while valid). `client.ts` provides typed functions for each MVola endpoint. `types.ts` holds shared TypeScript interfaces.

### `src/components/`
Stateless React UI components. `WithdrawForm.tsx` is the only component needed for the PoC demo.

## Conventions

- File names: `camelCase` for TypeScript files, `PascalCase` for React components
- API route files are always named `route.ts` (Next.js App Router convention)
- Server-only code lives in `src/lib/` — never imported from client components
- All MVola types are defined once in `src/lib/mvola/types.ts`
