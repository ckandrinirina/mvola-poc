# Story 01-01: Scaffold Next.js 14+ Project with TypeScript & Tailwind

> **Epic:** 01 — Project Foundation
> **Size:** S
> **Status:** DONE

## Description

Initialize the Next.js 14+ App Router project with TypeScript and Tailwind CSS. Create the base folder structure (`src/app/`, `src/lib/mvola/`, `src/components/`) and install the `uuid` dependency. The result is a running dev server with the correct project layout ready to receive MVola code.

## Acceptance Criteria

- [x] `npm run dev` starts on `localhost:3000` without errors
- [x] `npm run build` succeeds with zero TypeScript errors
- [x] App Router is enabled (`src/app/` directory exists)
- [x] TypeScript strict mode is on in `tsconfig.json`
- [x] Tailwind CSS is installed and configured
- [x] `uuid` and `@types/uuid` are in `package.json`
- [x] Empty placeholder directories exist: `src/lib/mvola/`, `src/components/`

## Technical Notes

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"
npm install uuid
npm install -D @types/uuid
```

After scaffolding, create empty placeholder files (`.gitkeep` or stub index files) inside `src/lib/mvola/` and `src/components/` so git tracks the directories.

Delete the boilerplate content of `src/app/page.tsx` and `src/app/globals.css` — they will be filled in Epic 04.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `next.config.ts` | Default Next.js config |
| CREATE | `tsconfig.json` | TypeScript config (strict mode on) |
| CREATE | `tailwind.config.ts` | Tailwind configuration |
| CREATE | `postcss.config.js` | PostCSS for Tailwind |
| CREATE | `package.json` | Dependencies including `uuid` |
| CREATE | `src/app/layout.tsx` | Root HTML shell (stub) |
| CREATE | `src/app/page.tsx` | Entry page (stub — implemented in Epic 04) |
| CREATE | `src/app/globals.css` | Tailwind base styles |
| CREATE | `src/lib/mvola/.gitkeep` | Ensure directory is tracked |
| CREATE | `src/components/.gitkeep` | Ensure directory is tracked |

## Dependencies

- **Blocked by:** None
- **Blocks:** Story 01-02, Epic 02

## Related

- **Epic:** 01_foundation
- **Spec reference:** `docs/architecture/folder-structure.md`, `docs/architecture/tech-stack.md`

---

## Implementation Summary

**Completed:** 2026-04-17
**QA Iterations:** 1
**Files created:** 10

### What Was Implemented
- Scaffolded via `create-next-app@latest` (Next.js 16.2.4, Tailwind v4, TypeScript strict)
- Installed `uuid@^13.0.0` and `@types/uuid@^10.0.0`
- Stubbed `src/app/page.tsx` and `src/app/globals.css` (boilerplate removed)
- Created placeholder directories with `.gitkeep`

### Files Touched

```
CREATED  package.json
CREATED  next.config.ts
CREATED  tsconfig.json
CREATED  postcss.config.mjs
CREATED  next-env.d.ts
CREATED  src/app/layout.tsx
CREATED  src/app/page.tsx
CREATED  src/app/globals.css
CREATED  src/lib/mvola/.gitkeep
CREATED  src/components/.gitkeep
```

### Notes
- Tailwind v4 uses `postcss.config.mjs` + `@tailwindcss/postcss` instead of a `tailwind.config.ts` file
- `NODE_ENV` warning is a system shell variable issue, not a project issue
