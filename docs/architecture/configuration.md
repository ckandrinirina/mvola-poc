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
# Use ngrok during local development: https://abc123.ngrok.io
MVOLA_CALLBACK_URL=https://your-public-url.com/api/mvola/callback
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MVOLA_CONSUMER_KEY` | Yes | — | OAuth consumer key from MVola portal |
| `MVOLA_CONSUMER_SECRET` | Yes | — | OAuth consumer secret from MVola portal |
| `MVOLA_MERCHANT_MSISDN` | Yes | — | Merchant MVola phone number (debitParty) |
| `MVOLA_PARTNER_NAME` | Yes | — | Partner name as registered with MVola |
| `MVOLA_COMPANY_NAME` | Yes | — | Company name as registered with MVola |
| `MVOLA_ENV` | No | `sandbox` | `sandbox` or `production` |
| `MVOLA_CALLBACK_URL` | Yes | — | Public URL for MVola webhook PUT callbacks |

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
| `MVOLA_ENV` | `src/lib/mvola/client.ts` (base URL selection) |
| `MVOLA_CALLBACK_URL` | `src/lib/mvola/client.ts` (passed in transaction request) |

All variables are accessed only in server-side code (`src/lib/mvola/`). They are **never** passed to client components or referenced in `"use client"` files.

---

## Secrets Management

- **NEVER commit `.env.local`** — it is already in `.gitignore`
- **NEVER log** `MVOLA_CONSUMER_KEY` or `MVOLA_CONSUMER_SECRET`
- The `access_token` is cached in memory only and never written to disk

---

## Webhook Callback URL — Local Development

MVola must be able to reach your `PUT /api/mvola/callback` endpoint.
During local development, use [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
# Copy the https://xxxxx.ngrok.io URL
# Set MVOLA_CALLBACK_URL=https://xxxxx.ngrok.io/api/mvola/callback in .env.local
```
