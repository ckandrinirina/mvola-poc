# MVola Reference Material

Official MVola documentation, retrieved from the developer portal on 2026-07-28.

Kept in the repository because the portal renders as a JavaScript application
(its pages cannot be fetched directly), and because one of its own documents no
longer downloads — see "Missing document" below.

| File | Source document | Pages | Contents |
|---|---|---|---|
| `01-developer-guide.pdf` | Guide | 20 | Account creation, application declaration, API subscription, sandbox key generation, transaction approvals, go-live procedure |
| `02-authentication-api.pdf` | Token API Document | 2 | Token endpoint, Basic authentication, grant type and scope, response shape, HTTP error codes |
| `03-web-security-checklist.pdf` | Check liste sécurité site web | 15 | Nine web security controls plus a mobile application checklist — prerequisites for go-live |
| `04-charte-graphique.pdf` | Charte graphique | 23 | MVola brand and logo usage rules |
| `merchant-pay-openapi.json` | — | — | OpenAPI 3.0.1 definition for the Merchant Pay API |

The three PDFs and the branding charter are in French; the authentication
document is in English.

## API surface

MVola publishes two APIs, four operations in total.

**Authentication** — `POST https://devapi.mvola.mg/token` (sandbox),
`POST https://api.mvola.mg/token` (production). Client-credentials grant, scope
`EXT_INT_MVOLA_SCOPE`, Basic authentication with the base64-encoded consumer
key and secret. Returns a Bearer token valid for 3600 seconds.

**Merchant Pay** — based at
`/mvola/mm/transactions/type/merchantpay/1.0.0` on the same hosts:

| Operation | Path | Notes |
|---|---|---|
| Initiate transaction | `POST /` | Returns `202` with `status`, `serverCorrelationId` and `notificationMethod`. Optional `X-Callback-URL` header registers the settlement webhook |
| Transaction status | `GET /status/{serverCorrelationId}` | Requires the `partnerName` header. Returns `status`, `serverCorrelationId`, `notificationMethod`, `objectReference` |
| Transaction details | `GET /{transactionReference}` | Needs the reference of a **settled** transaction; a correlation identifier is rejected |

Every operation requires the `Version`, `X-CorrelationID` and `Cache-Control`
headers. Both `GET` operations additionally require `UserAccountIdentifier`.
Geolocation headers (`CellIdA`, `GeoLocationA`, `CellIdB`, `GeoLocationB`) are
optional throughout and unused here.

Note that the status reply names its progress field `status` — not
`transactionStatus`.

## Sandbox notes

Sandbox transactions do not settle by themselves. They stay `pending` until
approved by hand on the portal's **Transaction Approvals** page, reachable from
the account menu. Settlement then arrives by callback, or on the next status
poll.

Only MVola's designated test numbers work in the sandbox — `0343500003` and
`0343500004`. The guide is explicit that transactions using any other number
will not function.

## Missing document

The portal lists a fifth document, "Merchant Pay API", which cannot be
downloaded: MVola's server returns HTTP 500 (`Error while retrieving source URI
location`). This is a fault on their side. The OpenAPI definition included here
covers the same surface.

## Refreshing this material

The portal's underlying API is public and unauthenticated. The API identifier
below is stable.

```
BASE=https://developer.mvola.mg/api/am/devportal/v2
API=5b6887bb-a923-4cb5-84f8-f173f9408792

curl -s "$BASE/apis?limit=100"                 # list published APIs
curl -s "$BASE/apis/$API/swagger"              # OpenAPI definition
curl -s "$BASE/apis/$API/documents?limit=50"   # attached documents
curl -s "$BASE/apis/$API/documents/<documentId>/content" -o out.pdf
```
