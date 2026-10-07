# Claude Code Configuration — Nectar Enviro Ops Console

## Codebase Navigation & Token Saving
- Consult `.agents/planning/CODEBASE_MAP.md` as the primary reference map before running searches across the codebase.
- Use Section 2 ("Fast-Lookup Decision Matrix") in `CODEBASE_MAP.md` to directly open target routes (`client/app/`), components (`client/components/`), and state stores (`client/lib/`).

## Command: /update-agents
When instructed with `/update-agents`:
1. Check `client/app/`, `client/components/`, and `client/lib/` for any changes, new files, or removed routes.
2. Update `.agents/planning/CODEBASE_MAP.md` to match the current structure.
3. Report the updated sections to the user.

## Tech Stack & Architecture
- **Next.js 16 (App Router)** + React 19 + TypeScript.
- **Ant Design 6** + Tailwind CSS v4.
- **Server**: NestJS 10 + MongoDB in `server/` (modules in `server/src/modules/`); client calls it via `client/lib/api/*`.
- **LocalStorage caches**: `client/lib/*/store.ts` (`shift`, `leave`, `ot-decision`, `safety`, `e-permit`, `training`, …).
- **i18n**: English / Hindi / Marathi via `client/lib/i18n/` — add new UI strings to `locales/` or `catalog/`.
- **RBAC**: `client/lib/rbac.ts`. HoD (Senior Manager) has Plant Manager (Assistant Manager) access across all plants — use `isManagerRole()`, not `role === "manager"`.
- **Shared rules**: `client/lib/safety/rules.ts` and `client/lib/e-permit/rules.ts` must stay identical to their server copies.
