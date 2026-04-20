# Tech Stack

## Overview

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js | 14+ | Full-stack React framework (App Router) |
| Language | TypeScript | 5+ | Type-safe JavaScript |
| Runtime | Node.js | 18+ | Server runtime for API routes |
| HTTP client | Native `fetch` | — | Call MVola API from server routes |
| Styling | Tailwind CSS | 3+ | Utility-first CSS for demo UI |
| Package manager | npm | 10+ | Dependency management |
| State (in-memory) | Native `Map` | — | Wallet, transaction, and game-session stores in `src/lib/store/` — module-level singletons; no new runtime dependency |
| Game RNG | `crypto.getRandomValues` | Node 18+ built-in | Coin-flip outcome in `src/lib/game/coinflip.ts` — cryptographically-seeded, no external RNG library |

## Frontend

### Language & Runtime
- **Language:** TypeScript 5+
- **Runtime:** Browser (React client components)

### Frameworks
- **Next.js 14+** (App Router): Provides both the React frontend and the server-side API route infrastructure in a single project

### Key Libraries
| Library | Purpose |
|---------|---------|
| React 18+ | UI rendering |
| Tailwind CSS 3+ | Demo UI styling |

## Backend (Next.js API Routes)

### Language & Runtime
- **Language:** TypeScript 5+
- **Runtime:** Node.js 18+ (via Next.js server)

### Key Libraries
| Library | Purpose |
|---------|---------|
| Native `fetch` | HTTP calls to MVola API (available in Node 18+) |
| `uuid` | Generate unique `X-CorrelationID` headers per request |

## MVola API Integration

### Communication
- **Protocol:** HTTPS REST (JSON)
- **Auth:** OAuth 2.0 Client Credentials flow
- **Sandbox base URL:** `https://devapi.mvola.mg`
- **Production base URL:** `https://api.mvola.mg`

### Serialization
- **Format:** JSON (`Content-Type: application/json`) for transaction calls
- **Format:** `application/x-www-form-urlencoded` for token requests

## State & Simulation

### In-Memory Store
- **Implementation:** Native `Map` objects at module scope in `src/lib/store/{wallets,transactions,games}.ts`
- **Lifetime:** Single server process — wiped on restart (matches existing OAuth token-cache behaviour in `src/lib/mvola/auth.ts`)
- **Concurrency model:** Single-process assumption, no locking; Node's single-threaded event loop is sufficient for PoC
- **Rationale:** Zero new runtime dependencies, mirrors an existing pattern in the codebase, sufficient for a demo and straightforward to migrate to SQLite/Postgres later

### Game Simulation
- **Location:** `src/lib/game/coinflip.ts` — pure function, no I/O
- **Randomness:** Derived from a single uniform byte produced by `crypto.getRandomValues`
- **Testability:** Accepts an optional random source injection point so tests can force deterministic outcomes

## Development Tools

| Tool | Purpose |
|------|---------|
| ESLint | Code linting |
| Prettier | Code formatting |
| ngrok (optional) | Expose local server for MVola webhook callbacks during dev |
