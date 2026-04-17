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

## Testing the Withdrawal Flow

1. Open `http://localhost:3000`
2. Enter amount (e.g. `1000`) and player MSISDN (`0343500003` for sandbox)
3. Click **Withdraw**
4. The UI displays `correlationId` and polls for status every 3 seconds
5. In the sandbox, transactions typically complete within a few seconds
6. Check your ngrok terminal / server logs for the incoming PUT callback

## Testing Individual API Routes

```bash
# Get an OAuth token
curl -X POST http://localhost:3000/api/mvola/token

# Initiate a withdrawal
curl -X POST http://localhost:3000/api/mvola/withdraw \
  -H "Content-Type: application/json" \
  -d '{"amount":"1000","playerMsisdn":"0343500003","description":"Test payout"}'

# Poll status (replace with real correlationId)
curl http://localhost:3000/api/mvola/status/550e8400-e29b-41d4-a716-446655440000

# Simulate a callback (MVola sends PUT)
curl -X PUT http://localhost:3000/api/mvola/callback \
  -H "Content-Type: application/json" \
  -d '{"transactionStatus":"completed","serverCorrelationId":"550e8400-e29b-41d4-a716-446655440000","transactionReference":"MVL-001","amount":"1000"}'
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

## Sandbox Test Accounts

| MSISDN | Use as |
|--------|--------|
| `0343500003` | Player (creditParty for withdrawals) |
| `0343500004` | Alternative test account |
