---
slug: foundation
design: planned
---

# Project Foundation

> Self-contained — a story reads this (+ folder-structure.md, + \_shared.md when noted), not other feature docs.

## Summary

The Next.js 14+ App Router scaffold with TypeScript strict mode and Tailwind CSS, plus
the environment configuration that every other feature depends on. Its boundary: this
feature produces a runnable but empty dev server and a committed `.env.example`; it owns
no MVola logic, no stores, and no UI beyond the placeholder `page.tsx` that
[demo-ui](../demo-ui/index.md) and later [tabbed-ui](../tabbed-ui/index.md) replace.

## Components

### Project scaffold

- **Type:** build/tooling configuration
- **Purpose:** Provide a working Next.js App Router project with TypeScript and Tailwind
- **Responsibilities:**
  - `next.config.ts`, `tsconfig.json` (strict mode on), `tailwind.config.ts`, `postcss.config.js`
  - `package.json` with the `uuid` / `@types/uuid` dependency
  - Placeholder `src/lib/mvola/` and `src/components/` directories tracked by git
  - Stub `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- **Depends on:** nothing

### Environment configuration

- **Type:** configuration
- **Purpose:** Let a developer onboard without leaking credentials
- **Responsibilities:**
  - `.env.example` listing every required variable name (values blank)
  - `.gitignore` entry keeping `.env.local` untracked
- **Depends on:** the scaffold existing

## API

None. This feature exposes no routes.

## Data

None. This feature owns no stores or entities.

## Flows

None beyond `npm run dev` / `npm run build`. See
[dev-guide.md](../../dev-guide.md) for setup and run instructions.

## Shared dependencies

- [Conventions](../../_shared.md#conventions)
- [folder-structure.md](../../folder-structure.md) — the canonical directory tree
- [tech-stack.md](../../tech-stack.md) — language and library versions
- [configuration.md](../../configuration.md) — the full environment-variable table
