# Nectar Enviro Ops Console — Agent Guidelines

## 1. Project Map & Navigation (Token Efficiency)
- **Always read the codebase map first**: Before running repository searches, consult `.agents/planning/CODEBASE_MAP.md`.
- **Fast-Lookup Matrix**: Refer to Section 2 of `CODEBASE_MAP.md` to map user tasks directly to exact route paths (`client/app/`), components (`client/components/`), and state stores (`client/lib/`).

---

## 2. Command: `/update-agents`
When the user sends `/update-agents`:
1. Scan `client/app/`, `client/components/`, and `client/lib/` for any new routes, components, or stores.
2. Update `.agents/planning/CODEBASE_MAP.md` with the current files, descriptions, and the Fast-Lookup table.
3. Present a clear summary of additions, deletions, or structural modifications.

---

## 3. Technology Stack & Key Patterns
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript; NestJS 10 + MongoDB server in `server/`.
- **UI Library**: Ant Design 6, theme in `client/lib/theme.ts` (primary navy `#1C4463`, ink `#0B1A24`, sand `#F4F7FA`, alert `#C45C26`).
- **CSS**: Tailwind CSS v4.
- **Data**: `client/lib/api/*` calls the NestJS API; `client/lib/*/store.ts` caches in `localStorage` as a fallback.
- **i18n**: English / Hindi / Marathi via `client/lib/i18n/` — add every new UI string to `locales/` or `catalog/`.
- **RBAC**: Director, HR, Safety In-Charge, HoD (Senior Manager), Plant Manager (Assistant Manager), Shift/Site In-Charge, Supervisor, Employee — rules in `client/lib/rbac.ts`. HoD has Plant Manager access across all plants; use `isManagerRole()` rather than `role === "manager"`.
- **Shared rules**: `client/lib/safety/rules.ts` and `client/lib/e-permit/rules.ts` must stay identical to their server copies.
