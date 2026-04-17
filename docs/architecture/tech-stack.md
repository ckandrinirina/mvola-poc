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

## Development Tools

| Tool | Purpose |
|------|---------|
| ESLint | Code linting |
| Prettier | Code formatting |
| ngrok (optional) | Expose local server for MVola webhook callbacks during dev |
