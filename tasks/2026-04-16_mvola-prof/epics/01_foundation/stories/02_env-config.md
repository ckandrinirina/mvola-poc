# Story 01-02: Environment Config — `.env.example` and `.gitignore`

> **Epic:** 01 — Project Foundation
> **Size:** S
> **Status:** DONE

## Description

Create the `.env.example` committed template with all required MVola environment variable names (empty values). Ensure `.env.local` is listed in `.gitignore` so secrets are never committed. This story establishes the contract between the codebase and the deployment environment.

## Acceptance Criteria

- [x] `.env.example` is committed and contains all 7 required variable names with empty values
- [x] `.env.local` is listed in `.gitignore`
- [x] `MVOLA_ENV` defaults to `sandbox` in `.env.example`
- [x] Running `cp .env.example .env.local` gives a usable starting point

## Technical Notes

Variables required (from `docs/architecture/configuration.md`):

```env
MVOLA_CONSUMER_KEY=
MVOLA_CONSUMER_SECRET=
MVOLA_MERCHANT_MSISDN=
MVOLA_PARTNER_NAME=
MVOLA_COMPANY_NAME=
MVOLA_ENV=sandbox
MVOLA_CALLBACK_URL=
```

The `create-next-app` scaffold already adds `.env*.local` to `.gitignore`. Verify this is present; if not, add it.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `.env.example` | Committed template with all variable names |
| MODIFY | `.gitignore` | Verify/add `.env.local` and `.env*.local` entries |

## Dependencies

- **Blocked by:** Story 01-01 (project must exist)
- **Blocks:** Epic 02, Epic 03 (variables are read in lib and routes)

## Related

- **Epic:** 01_foundation
- **Spec reference:** `docs/architecture/configuration.md`
