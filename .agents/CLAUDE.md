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
- **LocalStorage State Stores**: Located in `client/lib/*/store.ts` (`shift`, `leave`, `overtime`, `training`).
- **RBAC**: Plant-scoped access control defined in `client/lib/rbac.ts`.
