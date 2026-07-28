# Developer Guide

## Prerequisites

| Software | Version | Install |
|----------|---------|---------|
| Node.js | 18+ | https://nodejs.org or `nvm install 18` |
| npm | 10+ | Bundled with Node.js |
| ngrok (with a reserved domain) | any | https://ngrok.com/download |

> ngrok is **required**, not optional. MVola delivers settlement notifications by webhook,
> and settlement is what the demo exists to show. Claim the free tier's one reserved static
> domain so `MVOLA_CALLBACK_URL` stays valid between runs — see
> [configuration.md](configuration.md#webhook-callback-url).

## Setup

### 1. Clone the Repository
```bash
git clone <repo-url>
cd mvola-prof
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env.local
```

Edit `.env.local` with your MVola sandbox credentials:

```env
MVOLA_CONSUMER_KEY=your_consumer_key
MVOLA_CONSUMER_SECRET=your_consumer_secret
MVOLA_MERCHANT_MSISDN=034XXXXXXX
MVOLA_PARTNER_NAME=MyGame
MVOLA_COMPANY_NAME=MyGame Company
MVOLA_ENV=sandbox
MVOLA_CALLBACK_URL=https://your-reserved-domain.ngrok-free.app/api/mvola/callback
MVOLA_POLL_INTERVAL_MS=3000
MVOLA_POLL_TIMEOUT_MS=120000
```

Obtain credentials from the [MVola Developer Portal](https://developer.mvola.mg/devportal/).

### 4. Expose the Webhook Endpoint

MVola must reach your local server to deliver settlement notifications. Use your reserved
domain so the URL does not change between runs:

```bash
# Terminal 1
ngrok http 3000 --domain=your-reserved-domain.ngrok-free.app
```

## Running the Application

```bash
# Terminal 2 (start Next.js dev server)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Preflight

```bash
npm run preflight
```

Verifies the environment is set, the credentials still obtain a token, and
`MVOLA_CALLBACK_URL` is reachable from outside the process. Exits non-zero with a one-line
diagnosis per failure. **Run it immediately before any live sandbox run or demonstration —
it is the gate, not a suggestion.**

> **What a green run proves — and does not.** A green `npm run preflight` proves three
> things are true *right now*: every `MVOLA_*` variable is set, the credentials can obtain a
> real access token, and something answers at `MVOLA_CALLBACK_URL` from outside this
> process. It does **not** prove a transaction will actually settle end-to-end — that
> depends on a human approving it in MVola's developer portal, which preflight cannot do and
> does not check. A green preflight followed by a transaction that never settles almost
> always means the approval step was skipped or performed on the wrong transaction, not that
> preflight lied.

## Live Sandbox Walkthrough — Operator Runbook

This is the runbook for story 09-14: driving a real deposit and a real cash-out through the
MVola sandbox, with both approvals performed by a human in MVola's developer portal, and
capturing the real payloads MVola returns. **Nothing in this run may be simulated or
fabricated** — the whole point is to observe what MVola actually sends.

> **Nothing settles on its own.** The sandbox auto-complete shims that used to fake
> settlement after a few seconds were removed in stories 09-05 and 09-15. Every transaction
> in this walkthrough now sits `pending` until a human clicks Approve in MVola's developer
> portal. If you do not know this going in, the app will look hung at steps 3 and 8 — it
> is not; it is waiting for you.

### 0. Prerequisites — obtaining and setting each variable

Set these in `.env.local` (never commit it, never paste a secret *value* anywhere — screen,
chat, doc, or commit message). `.env.example` lists the same keys with empty values as a
template.

| Variable | Where to get it | Notes |
|---|---|---|
| `MVOLA_CONSUMER_KEY` | MVola Developer Portal → your app → API keys | Secret — set only in `.env.local` |
| `MVOLA_CONSUMER_SECRET` | Same screen, next to the consumer key | Secret — set only in `.env.local` |
| `MVOLA_MERCHANT_MSISDN` | The sandbox merchant number assigned to your portal app | Not secret, but still an MSISDN — avoid pasting it into shared docs |
| `MVOLA_PARTNER_NAME` | Whatever name you registered the app under in the portal | Sent as a header, not secret |
| `MVOLA_COMPANY_NAME` | Same registration screen | Cosmetic only |
| `MVOLA_ENV` | Literal value `sandbox` for this run | Only `client.ts::getBaseUrl()` reads this (rule R2) |
| `MVOLA_CALLBACK_URL` | The public HTTPS URL your tunnel exposes, ending in `/api/mvola/callback` | See step 2 below — must be set *after* the tunnel is up |
| `MVOLA_POLL_INTERVAL_MS` | Leave at default `3000` unless you have a reason to change it | |
| `MVOLA_POLL_TIMEOUT_MS` | Leave at default `120000` (2 min) unless a prior run showed approvals routinely take longer — see the timing note at the end of this runbook | |

### 1. Start the callback tunnel and set `MVOLA_CALLBACK_URL`

```bash
# Terminal 1 — keep this running for the whole session
ngrok http 3000 --domain=your-reserved-domain.ngrok-free.app
```

Set `MVOLA_CALLBACK_URL=https://your-reserved-domain.ngrok-free.app/api/mvola/callback` in
`.env.local`. A reserved domain keeps this URL stable across restarts — a free-tier random
subdomain changes every time ngrok restarts, silently breaking the callback until preflight
is re-run.

Leave ngrok's local inspector open in a browser tab at `http://localhost:4040` — it is where
you will read the raw callback payload in step 6 without adding any logging to the app.

### 2. Start the app and run the gate

```bash
# Terminal 2
npm run dev
```

```bash
# Terminal 3 — the gate. Do not proceed past a red check.
npm run preflight
```

If any check fails, stop here and see Troubleshooting below — do not start the walkthrough
on a red preflight.

### 3. The walkthrough

Open `http://localhost:3000`. Steps marked **(portal)** are performed by you, in MVola's
developer portal's transaction-approvals page — off-app, and the moments the whole
demonstration depends on.

| # | Step | Do this | Capture into slot |
|---|------|---------|---|
| 1 | Wallet loads at zero | Enter the player number (`0343500003`) in **WalletHeader** | — |
| 2 | Deposit initiated | **Deposit** tab → amount → Deposit. State shows `pending`, a correlation ID is displayed | **Deposit initiation** slot |
| — | Token acquired | (happens automatically behind step 2) | **Token response (redacted)** slot |
| 3 | **(portal)** Approve the deposit | Open the transaction-approvals page, find the transaction by the correlation ID shown in the UI, and approve it | — |
| 4 | Settlement arrives | Watch the UI: balance is credited, state becomes `completed`, either via the pending banner's poll or immediately after approval | **Status poll response** slot, and note whether it arrived by callback or by poll |
| — | Callback captured | Check the ngrok inspector (`http://localhost:4040`) for the `PUT /api/mvola/callback` request; open it and read the body | **Callback body** slot |
| 5 | Details match | Expand the settled row in **History**; compare MVola's record to the local one | **Transaction-details response** slot |
| 6 | Play a round | **Play** tab → bet, heads/tails. Balance moves; no MVola call is made | — |
| 7 | Cash-out submitted | **Cash-out** tab → amount → Cash out. Funds are reserved immediately; state shows `pending` | **Cash-out initiation** slot |
| 7b | *(optional)* Reject instead | In the portal, reject the cash-out approval instead of accepting it; confirm the wallet is refunded | — |
| 8 | **(portal)** Approve the cash-out | Same transaction-approvals page, this transaction's correlation ID | — |
| 9 | Cash-out settles | Balance/state updates to `completed` | **Cash-out status/callback** slot |
| 10 | Review history | **History** tab: both payments and the game round are present, each traceable to a real MVola reference | — |

Record wall-clock time from "approved in portal" to "settlement visible in the app" for at
least one of the two approvals — see the timing note below.

### 4. After the run

- Paste every captured payload into the Capture Log section below, redacting MSISDNs
  (replace all but the last 3 digits, matching how `preflight` already masks them).
- Copy the callback's observed field names into `docs/architecture/_shared.md` § Shared
  message formats, in the slot marked for it.
- Copy the details response's observed key set into the feature doc's API section, in the
  slot marked for it.
- Remove this section's reliance on any temporary verbose logging if you added any — none
  should be needed, since the ngrok inspector already shows the raw callback body.

## Capture Log — Live Run Evidence

**Every block below must stay empty until it holds a real captured payload from this run.**
Never fill these in by hand from memory, from the shapes documented elsewhere in this repo,
or from what you expect MVola to return — a fabricated entry here would be indistinguishable
from real evidence later, which is worse than leaving it empty. Redact MSISDNs before
pasting (keep only the last 3 digits, e.g. `034…003`); never paste secret credential values.

### Token response (redacted)

```
PASTE ACTUAL RESPONSE HERE — DO NOT FILL IN BY HAND
(redact the access_token value itself — its presence and expires_in are enough)
```

### Deposit initiation response

```
PASTE ACTUAL RESPONSE HERE — DO NOT FILL IN BY HAND
```

### Status poll response(s) — deposit

```
PASTE ACTUAL RESPONSE HERE — DO NOT FILL IN BY HAND
```

### Callback body — deposit settlement (from the ngrok inspector)

```
PASTE ACTUAL RESPONSE HERE — DO NOT FILL IN BY HAND
```

### Transaction-details response — deposit

```
PASTE ACTUAL RESPONSE HERE — DO NOT FILL IN BY HAND
```

### Cash-out initiation response

```
PASTE ACTUAL RESPONSE HERE — DO NOT FILL IN BY HAND
```

### Status poll response(s) / callback body — cash-out settlement

```
PASTE ACTUAL RESPONSE HERE — DO NOT FILL IN BY HAND
```

### Observed timings

```
Approval (portal) → settlement visible in app: PASTE OBSERVED DURATION HERE
Was MVOLA_POLL_TIMEOUT_MS (120s default) enough headroom? PASTE YES/NO + NOTE HERE
```

### Presenter comfort note (spec § 11)

```
Did the presenter perform both portal approvals live, or hand them to a second person?
PASTE THE ANSWER HERE AFTER THE REHEARSAL
```

**If a transaction stays pending:** it is waiting for your approval, or the callback cannot
reach you. Check the portal first, then ngrok's inspector at `http://localhost:4040`. The
poll ceiling (`MVOLA_POLL_TIMEOUT_MS`, default 2 min) reports **still pending** rather than
failure — the wallet never moves on a client-side timeout.

**Restart note:** the wallet, transactions, and game sessions are in-memory only. Restarting
`npm run dev` wipes them, including any transaction whose reference you were about to open.

## Testing Individual API Routes

```bash
# --- Identity / auth ---

# Get an OAuth token (debug only)
curl -X POST http://localhost:3000/api/mvola/token

# --- Deposit (user → merchant) ---

# Initiate a deposit
curl -X POST http://localhost:3000/api/mvola/deposit \
  -H "Content-Type: application/json" \
  -d '{"msisdn":"0343500003","amount":"5000"}'

# --- Wallet (internal, no MVola) ---

# Check balance
curl http://localhost:3000/api/wallet/0343500003/balance

# Full history (transactions + game rounds)
curl http://localhost:3000/api/wallet/0343500003/history

# --- Coin-flip game (internal, no MVola) ---

curl -X POST http://localhost:3000/api/game/coinflip \
  -H "Content-Type: application/json" \
  -d '{"msisdn":"0343500003","bet":1000,"choice":"heads"}'

# --- Cash-out (merchant → user) ---

curl -X POST http://localhost:3000/api/mvola/withdraw \
  -H "Content-Type: application/json" \
  -d '{"msisdn":"0343500003","amount":"1000","description":"Test cash-out"}'

# --- Status reconciliation ---

# Poll status (replace with real correlationId from deposit/withdraw response)
# Stays "pending" until the transaction is approved in the MVola portal
curl http://localhost:3000/api/mvola/status/550e8400-e29b-41d4-a716-446655440000

# --- Transaction details (settled transactions only) ---

# Use the mvolaReference from a completed transaction in /history
curl http://localhost:3000/api/mvola/transaction/MVL-2026-07-28-001

# --- Simulating a callback locally ---

# Both field spellings are accepted (parseMvolaStatus). MVola's status response
# uses status/objectReference; the callback's own shape is not yet verified.
curl -X PUT http://localhost:3000/api/mvola/callback \
  -H "Content-Type: application/json" \
  -d '{"status":"completed","serverCorrelationId":"550e8400-e29b-41d4-a716-446655440000","objectReference":"MVL-001","amount":"5000"}'
```

> A simulated callback is a **development** aid only. It must never stand in for MVola
> during a demonstration — nothing presented as an MVola transaction may be produced locally.

## Build for Production

```bash
npm run build
npm start
```

## Troubleshooting

### Predictable live-run failures (story 09-14)

The four failures most likely to interrupt a live sandbox run, in the order to check them:

### Tunnel expired (ngrok URL no longer resolves or changed)

- Symptom: `npm run preflight` fails the "callback address" check, or a transaction never
  settles despite being approved in the portal
- Fix: confirm ngrok is still running in its terminal; if it restarted, the URL may have
  changed (a reserved domain should prevent this — see Prerequisites). Update
  `MVOLA_CALLBACK_URL` in `.env.local` to match, then re-run `npm run preflight`
- ngrok's own inspector at `http://localhost:4040` shows whether *any* requests are arriving
  at the tunnel at all, which narrows this down from "MVola isn't calling us" to "our tunnel
  is down"

### Credentials rejected

- Symptom: `npm run preflight` fails the "MVola credentials" check, or `401 Unauthorized`
  appears in the server log
- Fix: re-check `MVOLA_CONSUMER_KEY` and `MVOLA_CONSUMER_SECRET` against the portal (typos,
  stale copy-paste, or a regenerated secret invalidating the old one); confirm
  `MVOLA_ENV=sandbox` is set so the token request targets `devapi.mvola.mg` and not
  production

### Transaction stuck pending

- Symptom: the pending banner never clears after what should have been an approval
- Most likely cause, in order: **(1)** it has not actually been approved yet — return to the
  portal's transaction-approvals page; **(2)** the approval was performed on a *different*
  transaction than the one being watched — cross-check the correlation ID shown in the UI
  against the one approved in the portal; **(3)** the callback cannot reach the server (see
  "callback never arrives" below) but polling should still catch the settlement within
  `MVOLA_POLL_INTERVAL_MS` regardless
- Reaching `MVOLA_POLL_TIMEOUT_MS` reports **still pending**, never failure — the wallet
  never moves on a client-side timeout, and reloading resumes polling

### Callback never arrives

- Symptom: the transaction eventually settles by poll, but the ngrok inspector shows no
  `PUT /api/mvola/callback` request at all
- Fix: confirm `MVOLA_CALLBACK_URL` in `.env.local` matches the tunnel's current address
  exactly, including the `/api/mvola/callback` path; re-run `npm run preflight`, which
  specifically checks this address is reachable from outside the process
- This is not fatal to the walkthrough — status polling reaches the same settled state
  independently (rule R4) — but the callback body is one of the required captures for this
  story, so it must be resolved before the run counts as complete for AC purposes

### `401 Unauthorized` from MVola
- Check `MVOLA_CONSUMER_KEY` and `MVOLA_CONSUMER_SECRET` are correct
- Verify you are using the right environment (`MVOLA_ENV=sandbox`)

### `400 Bad Request` from MVola
- Ensure `MVOLA_MERCHANT_MSISDN` is a valid merchant number registered in the portal
- Verify `playerMsisdn` uses the sandbox test number (`0343500003`)
- Check `amount` is a string, not a number

### MVola callback never arrives
- Confirm `MVOLA_CALLBACK_URL` points to a publicly accessible URL (ngrok)
- Restart ngrok and update `MVOLA_CALLBACK_URL` if the URL changed
- Check ngrok web interface at `http://localhost:4040` to inspect incoming PUT requests

### Token expired errors in logs
- The in-memory token cache is reset on every server restart
- This is expected behavior — `auth.ts` will re-fetch automatically on the next request

### `409 Insufficient funds` from `/api/game/coinflip` or `/api/mvola/withdraw`
- The in-memory wallet was wiped by a server restart — deposit again before playing or cashing out
- Or the bet/cash-out exceeds the current balance — call `GET /api/wallet/:msisdn/balance` to confirm

### A transaction stays `pending`
This is usually correct behaviour, not a bug. Sandbox transactions settle only after a
manual approval. In order of likelihood:
- **It has not been approved yet** — approve it on the MVola developer portal's
  transaction-approvals page
- **The callback cannot reach you** — `MVOLA_CALLBACK_URL` is stale or ngrok is down; check
  ngrok's inspector at `http://localhost:4040`, and run `npm run preflight`
- **Polling stopped** — the UI stops asking at `MVOLA_POLL_TIMEOUT_MS`. That reports *still
  pending*, not failure; reload to resume, or raise the ceiling

### Wallet balance seems stuck after a deposit
- Deposits only credit the wallet when MVola confirms `completed` (via status poll or the webhook). Check:
  - The transaction has been approved in the MVola portal
  - The status route is being polled by `DepositForm` (or poll it manually: `curl /api/mvola/status/<correlationId>`)
  - `MVOLA_CALLBACK_URL` is publicly reachable (ngrok up, URL current)
  - The corresponding `TransactionRecord` has `walletSettled: true` — inspect via `GET /api/wallet/:msisdn/history`

### Transaction details returns 404, or the row will not expand
- The details operation needs a reference MVola issues **at settlement** — a pending
  transaction has none, and the row is not expandable until it settles
- A settled transaction with no `mvolaReference` predates the reference-retention change,
  or was settled by a callback whose payload carried no reference. Check
  `GET /api/wallet/:msisdn/history`
- Nothing is fabricated to fill this gap — a synthesised record would defeat the purpose of
  the view

### Wallet was debited for a cash-out but MVola later failed
- The cash-out route reserves funds on request. When the transaction resolves to `failed` (via status poll or callback), the wallet is automatically refunded. Re-check `GET /api/wallet/:msisdn/balance` a few seconds after the UI shows the failure.

## Sandbox Test Accounts

| MSISDN | Use as |
|--------|--------|
| `0343500003` | Player (creditParty for withdrawals) |
| `0343500004` | Alternative test account |
