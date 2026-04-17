# Epic 01: Project Foundation

## Description

Set up the Next.js 14+ project scaffold with TypeScript and Tailwind CSS, and configure all environment variables needed for MVola sandbox integration. This epic produces a runnable (though empty) Next.js dev server and ensures credentials can be safely loaded from `.env.local` without ever being committed to git.

## Goals

- Initialize a working Next.js 14+ App Router project with TypeScript and Tailwind CSS
- Establish the folder structure matching the architecture docs
- Provide a committed `.env.example` template so any developer can onboard quickly
- Ensure secrets are protected via `.gitignore`

## Scope

### In Scope
- `npx create-next-app` scaffold (or manual equivalent)
- `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`
- `.env.example` with all required variable names
- `.gitignore` entry for `.env.local`
- `package.json` with `uuid` dependency added

### Out of Scope
- Any MVola API logic (Epic 02)
- Any UI components (Epic 04)

## Dependencies

- **Depends on:** None
- **Blocks:** Epic 02, Epic 03, Epic 04

## Stories

| # | Story | Size | Status |
|---|-------|------|--------|
| 01 | Scaffold Next.js 14+ project with TypeScript & Tailwind | S | DONE |
| 02 | Environment config — `.env.example` and `.gitignore` | S | TODO |

## Acceptance Criteria

- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes successfully
- [ ] `.env.local` is not tracked by git
- [ ] `.env.example` is committed and contains all required variable names
- [ ] Folder structure matches `docs/architecture/folder-structure.md`

## Technical Notes

Use `npx create-next-app@latest` with App Router, TypeScript, and Tailwind options. Add `uuid` to dependencies manually after scaffolding (`npm install uuid` + `npm install -D @types/uuid`).
