---
id: 09-03
title: Status Route — Remove the Sandbox Short-Circuit
epic: 09
status: todo
size: M
blocked_by: [09-02]
files: [src/app/api/mvola/status/[correlationId]/route.ts, src/__tests__/app/api/mvola/status/[correlationId]/route.test.ts]
issue:
prior_status:
---

# Story 09-03: Status Route — Remove the Sandbox Short-Circuit

> **Epic:** 09 — MVola API Coverage & Demo Credibility

## Description

`GET /api/mvola/status/[correlationId]` currently answers from local state whenever
`MVOLA_ENV !== "production"` (`status/[correlationId]/route.ts:45-53`). Since sandbox is the
only environment the demo is ever run in, the route never asks MVola during a demonstration.
The polling a viewer watches is a conversation with the application about itself.

Delete the `|| isSandbox` clause so polling reaches MVola, and read the reply through
`parseMvolaStatus()` so the polling path and the callback path share one interpretation.

**Keep** the narrower skip: when the local record is already terminal (`status !== "pending"`),
return local truth without re-asking. A settled transaction will not change. The distinction
that matters is that after this change, a terminal state is only ever reached *because MVola
said so* — never because a timer expired.

## Acceptance Criteria

- [ ] The `isSandbox` constant and the `|| isSandbox` clause at `route.ts:45-46` are deleted
- [ ] `MVOLA_ENV` is not referenced anywhere in this file
- [ ] A `pending` local record in a non-production environment results in a real `getTransactionStatus()` call
- [ ] A terminal local record (`completed` / `failed`) still returns local truth **without** calling MVola or acquiring a token
- [ ] The MVola reply is passed through `parseMvolaStatus()` before both reconciliation and the response
- [ ] `reconcileTransaction()` receives the parsed status and parsed reference
- [ ] An unknown `correlationId` (no local record) is still tolerated: reconciliation is skipped, MVola's body is still returned
- [ ] The response body keeps `transactionStatus` and `transactionReference` **and** adds `status` and `objectReference`, so existing UI polling (`DepositForm.tsx:38`, `CashOutForm.tsx`) keeps working unchanged
- [ ] A MVola error or token failure still returns `502 { error }`
- [ ] Tests cover: sandbox env reaches MVola, terminal record skips MVola, `status`-spelled reply reconciles, `transactionStatus`-spelled reply reconciles identically, unknown correlationId, 502 path
- [ ] `npx jest` passes fully

## Technical Notes

The short-circuit block becomes:

```typescript
const localRecord = getTransactionByCorrelationId(correlationId);

// Optimisation only: a settled transaction will not change. After this epic that
// terminal state is only ever reached because MVola said so.
if (localRecord && localRecord.status !== "pending") {
  return NextResponse.json({
    transactionStatus: localRecord.status,
    status: localRecord.status,
    serverCorrelationId: correlationId,
    transactionReference: localRecord.mvolaReference ?? "",
    objectReference: localRecord.mvolaReference ?? "",
  });
}
```

and the live path:

```typescript
const token = await getToken();
const statusResponse = await getTransactionStatus(correlationId, token);
const { status, reference } = parseMvolaStatus(statusResponse);

if (localRecord) {
  reconcileTransaction(localRecord, status, reference);
}

return NextResponse.json({
  ...statusResponse,
  transactionStatus: status,
  status,
  transactionReference: reference ?? "",
  objectReference: reference ?? "",
});
```

Spreading `statusResponse` first and overriding after keeps any additional keys MVola sends
visible for debugging while guaranteeing both spellings are present and agree.

Delete the stale comment block at `route.ts:38-43` — it explains a sandbox rationale that no
longer holds ("withdraw uses a fake one because the payout direction is unsupported"). Story
09-05 removes the fake correlation ID that sentence refers to.

The existing test file mocks `getToken` and `getTransactionStatus`. Tests asserting the old
sandbox behaviour must be rewritten to assert the new behaviour, not deleted — the count of
covered scenarios should go up, not down.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/app/api/mvola/status/[correlationId]/route.ts` | Delete the sandbox clause; parse via `parseMvolaStatus()`; emit both spellings |
| MODIFY | `src/__tests__/app/api/mvola/status/[correlationId]/route.test.ts` | Rewrite sandbox expectations; add both-spelling and terminal-skip coverage |

## Dependencies

- **Blocked by:** Story 09-02
- **Blocks:** Story 09-14

## Related

- **Epic:** 09_mvola-api-coverage
- **Related stories:** 09-04 (same interpretation, callback path)
- **Spec reference:** pre-spec § 5.3, § 5.4; feature doc § Status route, § Flow B
