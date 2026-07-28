---
id: 09-01
title: Repair the `CoinFlipGame` Test Suite
epic: 09
status: todo
size: S
blocked_by: []
files: [src/__tests__/components/CoinFlipGame.test.tsx]
issue:
prior_status:
---

# Story 09-01: Repair the `CoinFlipGame` Test Suite

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

`src/__tests__/components/CoinFlipGame.test.tsx` fails with 21 errors, all identical:
`useMsisdnContext must be used inside <WalletHeader>` (`src/components/WalletHeader.tsx:28`).

The cause is stale tests, not broken behaviour. `CoinFlipGame` was refactored to read
`msisdn`, `balance` and `refreshBalance` from `MsisdnContext` (commit `1a70cdf`), but this
test file still passes them as props via a `defaultProps` spread and renders the component
bare. The other four component test files were updated to wrap in `<WalletHeader>`; this one
was not.

This story comes **first and alone**. Every remaining story in this epic changes MVola call
paths, and a failing suite masks any genuine regression those changes introduce. The baseline
must be green before anything else moves.

## Acceptance Criteria

- [ ] `npx jest src/__tests__/components/CoinFlipGame.test.tsx` passes — 21/21 checks
- [ ] `npx jest` passes fully — **332/332 checks, 23/23 suites**
- [ ] `CoinFlipGame` is rendered inside `<WalletHeader>` so the real `MsisdnContext.Provider` supplies its values, following the `Wrapper` pattern in `src/__tests__/components/TransactionHistory.test.tsx:31-38`
- [ ] The `defaultProps` spread is removed — context values are no longer passed as props
- [ ] Variants that previously used `msisdn=""` and `balance={0}` drive those states **through context**: seed (or omit) `localStorage["mvola-prof.msisdn"]` and stub the balance route response accordingly
- [ ] No production source file is modified — this story touches the test file only
- [ ] Every assertion the file made before is still made; no check is deleted to make the suite pass

## Technical Notes

`WalletHeader` derives its context values rather than accepting them:

- `msisdn` — read from `localStorage` under `mvola-prof.msisdn` on mount (`WalletHeader.tsx:43-46`)
- `balance` — fetched from `GET /api/wallet/{msisdn}/balance` and polled every 2000 ms (`WalletHeader.tsx:59-76`)

So the wrapper must control both inputs:

```tsx
import { WalletHeader } from "@/components/WalletHeader";

// localStorage mock as in TransactionHistory.test.tsx:10-29
function renderGame({ msisdn = "0343500003", balance = 5000 } = {}) {
  if (msisdn) localStorageStore["mvola-prof.msisdn"] = msisdn;
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ balance }) });
  return render(
    <WalletHeader>
      <CoinFlipGame />
    </WalletHeader>,
  );
}
```

Two cautions:

- The file uses `jest.useFakeTimers()` (`CoinFlipGame.test.tsx:27`). `WalletHeader`'s
  balance poll is a `setInterval`, so wrap the initial render and any timer advance in `act()`
  to let the balance state settle before asserting.
- `mockFetch` is global and now serves both the balance route and the coinflip route. Route
  the mock on the request URL rather than a single blanket `mockResolvedValue`, or the game's
  own POST will receive the balance payload.

If seeding context through `WalletHeader` proves unreasonably awkward for a specific check,
exporting the raw `MsisdnContext.Provider` for test use is acceptable — but prefer the
wrapper, since it is what the other four test files already do.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/__tests__/components/CoinFlipGame.test.tsx` | Wrap renders in `<WalletHeader>`; drive msisdn/balance through context instead of props |

## Dependencies

- **Blocked by:** None
- **Blocks:** Every other story in Epic 09

## Related

- **Epic:** 09_mvola-api-coverage
- **Spec reference:** `docs/specs/2026-07-28_mvola-api-coverage/pre-spec.md` § 5.6; `docs/architecture/features/mvola-api-coverage/index.md` § Test remediation
