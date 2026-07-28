# Architecture Documentation

> Generated from `docs/API_MerchantPay.pdf` (original spec) on 2026-04-16.
> Extended with the Wallet + Deposit + Coin-Flip Game + Cash-Out feature on 2026-04-20.
> Reorganized into the ck-code v4 feature-scoped layout on 2026-07-28.
> Extended with MVola API Coverage & Demo Credibility on 2026-07-28, from
> `docs/specs/2026-07-28_mvola-api-coverage/pre-spec.md`.
> Neither original specification was modified.

## Global documents

| Document | Description |
|----------|-------------|
| [overview.md](overview.md) | Project vision, goals, and target users |
| [folder-structure.md](folder-structure.md) | Complete project directory tree with annotations |
| [tech-stack.md](tech-stack.md) | Languages, frameworks, and library versions |
| [configuration.md](configuration.md) | Environment variables and configuration |
| [dev-guide.md](dev-guide.md) | Prerequisites, setup, and run instructions |
| [state-management.md](state-management.md) | In-memory store layer: wallet, transactions, game sessions |
| [\_shared.md](_shared.md) | Cross-cutting infra: architecture diagram, MVola external API reference, shared message formats, conventions |
| database-schema.md | Not applicable — PoC has no database |

## Feature documents

One self-contained doc per feature. `<slug>` matches the epic folder slug in
`tasks/2026-04-16_mvola-prof/epics/`, so `tasks/FEATURE_INDEX.md` routes to it.

| Feature | Epic | Description |
|---------|------|-------------|
| [foundation](features/foundation/index.md) | 01 | Next.js scaffold, TypeScript/Tailwind config, environment setup |
| [mvola-core-library](features/mvola-core-library/index.md) | 02 | `src/lib/mvola/` — types, OAuth token manager, HTTP client |
| [api-routes](features/api-routes/index.md) | 03 | Base MVola proxy routes: token, withdraw, status, callback |
| [demo-ui](features/demo-ui/index.md) | 04 | First-generation single withdraw form (superseded by tabbed-ui) |
| [state-store](features/state-store/index.md) | 05 | In-memory wallet / transaction / game stores + domain types |
| [wallet-aware-mvola](features/wallet-aware-mvola/index.md) | 06 | Deposit direction, wallet reserve on cash-out, idempotent reconciliation |
| [game-and-queries](features/game-and-queries/index.md) | 07 | Coin-flip game logic + route, balance and history query routes |
| [tabbed-ui](features/tabbed-ui/index.md) | 08 | Tabbed single-page app: header, deposit, play, cash-out, history |
| [wallet-deposit-game](features/wallet-deposit-game/index.md) | 05–08 | Cross-cutting spec for the deposit / game / cash-out round-trip |
| [mvola-api-coverage](features/mvola-api-coverage/index.md) | 09 | Full four-operation MVola coverage; removes the sandbox short-circuits so every demonstrated payment is real |

## Archive

`archive/` holds the pre-v4 layer docs, superseded by the feature docs above and
`_shared.md`. They are kept for history and are no longer maintained.

| Archived document | Superseded by |
|---|---|
| [archive/components.md](archive/components.md) | each feature's `## Components` + [\_shared.md](_shared.md) |
| [archive/api-contracts.md](archive/api-contracts.md) | each feature's `## API` + [\_shared.md](_shared.md) |
| [archive/data-flow.md](archive/data-flow.md) | each feature's `## Flows` + [\_shared.md](_shared.md) |

## Source
- **Original spec:** `docs/API_MerchantPay.pdf`
- **Feature specs:** `docs/specs/2026-07-28_mvola-api-coverage/pre-spec.md`
- **Generated:** 2026-04-16
- **Last updated:** 2026-07-28 (added the `mvola-api-coverage` feature; corrected the MVola
  status-response field names in `_shared.md`)
- **Gaps remaining:** two unverified MVola response shapes — see
  [mvola-api-coverage → Open items](features/mvola-api-coverage/index.md#open-items)
