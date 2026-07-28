# Configuration

## Configuration Files

### `.env.local` — Secret credentials (NOT committed to git)

Copy `.env.example` to `.env.local` and fill in your values.

```env
# MVola OAuth Credentials (from developer.mvola.mg/devportal)
MVOLA_CONSUMER_KEY=your_consumer_key_here
MVOLA_CONSUMER_SECRET=your_consumer_secret_here

# Merchant Account
MVOLA_MERCHANT_MSISDN=034XXXXXXX

# Partner Info (as registered on the MVola developer portal)
MVOLA_PARTNER_NAME=MyGame
MVOLA_COMPANY_NAME=MyGame Company

# Environment: "sandbox" uses devapi.mvola.mg, "production" uses api.mvola.mg
MVOLA_ENV=sandbox

# Publicly accessible URL where MVola will send PUT webhook callbacks
# Use an ngrok RESERVED domain so this value stays valid between runs
MVOLA_CALLBACK_URL=https://your-reserved-domain.ngrok-free.app/api/mvola/callback

# Polling policy for pending transactions
MVOLA_POLL_INTERVAL_MS=3000
MVOLA_POLL_TIMEOUT_MS=120000
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MVOLA_CONSUMER_KEY` | Yes | — | OAuth consumer key from MVola portal |
| `MVOLA_CONSUMER_SECRET` | Yes | — | OAuth consumer secret from MVola portal |
| `MVOLA_MERCHANT_MSISDN` | Yes | — | Merchant MVola phone number (debitParty) |
| `MVOLA_PARTNER_NAME` | Yes | — | Partner name as registered with MVola |
| `MVOLA_COMPANY_NAME` | Yes | — | Company name as registered with MVola |
| `MVOLA_ENV` | No | `sandbox` | `sandbox` or `production` — selects the base URL and **nothing else** |
| `MVOLA_CALLBACK_URL` | Yes | — | Public URL for MVola webhook PUT callbacks |
| `MVOLA_POLL_INTERVAL_MS` | No | `3000` | How often a pending transaction is re-checked |
| `MVOLA_POLL_TIMEOUT_MS` | No | `120000` | When the UI stops waiting and reports **still pending** (never failure) |

> **`MVOLA_ENV` selects the base URL only.** No other behaviour may branch on it — sandbox
> and production follow the same path (rule R2). It previously also disabled the cash-out
> and status calls; see
> [mvola-api-coverage](features/mvola-api-coverage/index.md).

> **Sizing `MVOLA_POLL_TIMEOUT_MS`.** Sandbox transactions settle only after a manual
> approval in MVola's developer portal, so the ceiling has to accommodate a human. Two
> minutes is the default; too short and a live demonstration reports a timeout while the
> presenter is still clicking.

---

### `.env.example` — Committed template

```env
MVOLA_CONSUMER_KEY=
MVOLA_CONSUMER_SECRET=
MVOLA_MERCHANT_MSISDN=
MVOLA_PARTNER_NAME=
MVOLA_COMPANY_NAME=
MVOLA_ENV=sandbox
MVOLA_CALLBACK_URL=
MVOLA_POLL_INTERVAL_MS=3000
MVOLA_POLL_TIMEOUT_MS=120000
```

---

### `next.config.ts`

No special configuration needed for the PoC beyond defaults.

---

## Environment Variable Usage in Code

| Variable | Used in |
|----------|---------|
| `MVOLA_CONSUMER_KEY` | `src/lib/mvola/auth.ts` |
| `MVOLA_CONSUMER_SECRET` | `src/lib/mvola/auth.ts` |
| `MVOLA_MERCHANT_MSISDN` | `src/lib/mvola/client.ts` (debitParty) |
| `MVOLA_PARTNER_NAME` | `src/lib/mvola/client.ts` (metadata + headers) |
| `MVOLA_COMPANY_NAME` | `src/lib/mvola/client.ts` (metadata) |
| `MVOLA_ENV` | `src/lib/mvola/client.ts` (base URL selection — and nowhere else) |
| `MVOLA_CALLBACK_URL` | `src/lib/mvola/client.ts` (passed in transaction request), `scripts/preflight.mjs` |
| `MVOLA_POLL_INTERVAL_MS` | `src/lib/mvola/polling.ts` |
| `MVOLA_POLL_TIMEOUT_MS` | `src/lib/mvola/polling.ts` |

All variables are accessed only in server-side code (`src/lib/mvola/`). They are **never** passed to client components or referenced in `"use client"` files.

---

## Secrets Management

- **NEVER commit `.env.local`** — it is already in `.gitignore`
- **NEVER log** `MVOLA_CONSUMER_KEY` or `MVOLA_CONSUMER_SECRET`
- The `access_token` is cached in memory only and never written to disk

---

## Environment Variables by Feature

| Feature | Variables introduced |
|---------|----------------------|
| Base MVola integration | `MVOLA_CONSUMER_KEY`, `MVOLA_CONSUMER_SECRET`, `MVOLA_MERCHANT_MSISDN`, `MVOLA_PARTNER_NAME`, `MVOLA_COMPANY_NAME`, `MVOLA_ENV`, `MVOLA_CALLBACK_URL` |
| Wallet / deposit / coin-flip / cash-out | None — in-memory `Map` stores need no connection string, and `crypto.getRandomValues` needs no RNG key |
| [mvola-api-coverage](features/mvola-api-coverage/index.md) | `MVOLA_POLL_INTERVAL_MS`, `MVOLA_POLL_TIMEOUT_MS` |

If persistence is added later (SQLite, Postgres, or a file-backed store), new variables would
be introduced then.

---

## Webhook Callback URL

MVola must be able to reach `PUT /api/mvola/callback`, and the settlement notification is
what makes the demo feel real — a dead callback address is the most likely cause of a
demonstration that appears to stall.

### Reserved domain (required for a repeatable demo)

An ephemeral tunnel URL changes on every restart, which silently invalidates
`MVOLA_CALLBACK_URL`. ngrok's free tier includes **one reserved static domain**; claim it
once and the value stops changing.

```bash
# One-time, in the ngrok dashboard: claim a static domain
ngrok http 3000 --domain=your-reserved-domain.ngrok-free.app

# In .env.local — set once, no longer edited between runs
MVOLA_CALLBACK_URL=https://your-reserved-domain.ngrok-free.app/api/mvola/callback
```

### Verify before demonstrating

```bash
npm run preflight
```

Checks that every required variable is set, that the credentials still obtain a token, and
that `MVOLA_CALLBACK_URL` is reachable from outside the process. Run it before any
demonstration — see [dev-guide.md](dev-guide.md#demo-runbook).
