# Developer Guide

## Prerequisites

| Software | Version | Install |
|----------|---------|---------|
| Node.js | 18+ | https://nodejs.org or `nvm install 18` |
| npm | 10+ | Bundled with Node.js |
| ngrok (dev only) | any | https://ngrok.com/download |

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
MVOLA_CALLBACK_URL=https://xxxxx.ngrok.io/api/mvola/callback
```

Obtain credentials from the [MVola Developer Portal](https://developer.mvola.mg/devportal/).

### 4. (Dev) Expose Webhook Endpoint with ngrok

MVola needs to reach your local server for callbacks:

```bash
# Terminal 1
ngrok http 3000

# Copy the HTTPS URL (e.g. https://abc123.ngrok.io)
# Update MVOLA_CALLBACK_URL in .env.local
```

## Running the Application

```bash
# Terminal 2 (start Next.js dev server)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Testing the Full Round-Trip (Deposit → Play → Cash-Out)

The realistic end-to-end flow in the UI:

1. Open `http://localhost:3000`
2. In the **WalletHeader**, enter an MSISDN (`0343500003` for sandbox). The balance starts at `0 Ar`.
3. Switch to the **Deposit** tab, enter an amount (e.g. `10000`), click **Deposit**
4. The UI polls status; within a few seconds the balance should jump to `10000 Ar`
5. Switch to the **Play** tab, enter a bet (e.g. `1000`), pick heads or tails, click **Flip**
6. Watch the outcome and the balance change (±1000 Ar). Play a few rounds to generate history.
7. Switch to the **Cash-out** tab, adjust the amount (defaults to full balance), click **Cash out**
8. Wallet is debited immediately; UI polls status; on `completed` the record is finalised
9. Switch to the **History** tab to review every deposit, game round, and cash-out chronologically

**Restart note:** the wallet, transactions, and game sessions are in-memory only. Restarting `npm run dev` wipes them. The OAuth token cache is also reset.

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
curl http://localhost:3000/api/mvola/status/550e8400-e29b-41d4-a716-446655440000

# Simulate a callback from MVola (for local testing without sandbox)
curl -X PUT http://localhost:3000/api/mvola/callback \
  -H "Content-Type: application/json" \
  -d '{"transactionStatus":"completed","serverCorrelationId":"550e8400-e29b-41d4-a716-446655440000","transactionReference":"MVL-001","amount":"5000"}'
```

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

### Wallet balance seems stuck after a deposit
- Deposits only credit the wallet when MVola confirms `completed` (via status poll or the webhook). Check:
  - The status route is being polled by `DepositForm` (or poll it manually: `curl /api/mvola/status/<correlationId>`)
  - `MVOLA_CALLBACK_URL` is publicly reachable (ngrok up, URL current)
  - The corresponding `TransactionRecord` has `walletSettled: true` — inspect via `GET /api/wallet/:msisdn/history`

### Wallet was debited for a cash-out but MVola later failed
- The cash-out route reserves funds on request. When the transaction resolves to `failed` (via status poll or callback), the wallet is automatically refunded. Re-check `GET /api/wallet/:msisdn/balance` a few seconds after the UI shows the failure.

## Sandbox Test Accounts

| MSISDN | Use as |
|--------|--------|
| `0343500003` | Player (creditParty for withdrawals) |
| `0343500004` | Alternative test account |
