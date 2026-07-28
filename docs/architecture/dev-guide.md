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
diagnosis per failure. Run it before any demonstration.

## Demo Runbook

The sequence to present to a reviewer. Steps 4 and 9 are performed **by you, in MVola's
developer portal** — sandbox transactions do not settle on their own, and that manual
approval is the most convincing part of the demonstration: a balance changing after an
approval made elsewhere is something a local timer cannot imitate.

| # | Step | Expected |
|---|------|----------|
| 0 | `npm run preflight` | All checks pass before the audience is watching |
| 1 | Enter the player number (`0343500003`) in **WalletHeader** | Balance `0 Ar` |
| 2 | **Deposit** tab → amount → Deposit | State `pending`, MVola correlation ID shown |
| 3 | — | Pending banner names the approval step it is waiting for |
| 4 | **Approve in the MVola portal's transaction-approvals page** | — |
| 5 | Return to the app | Balance credited, state `completed` |
| 6 | Expand the settled row in **History** | MVola's own record beside the local entry |
| 7 | **Play** tab → bet, heads/tails | Balance moves on the outcome; no MVola involvement |
| 8 | **Cash-out** tab → amount → Cash out | Funds reserved immediately, state `pending` |
| 8b | *(optional)* **Reject** the approval instead | Wallet refunded; the failure path shown |
| 9 | **Approve in the MVola portal** | — |
| 10 | Return to the app | Cash-out `completed` |
| 11 | **History** tab | Both payments and the game round, each traceable to MVola |

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
