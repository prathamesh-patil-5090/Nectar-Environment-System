# Nectar Enviro Ops Console — Agent Guidelines

## 1. Project Map & Navigation (Token Efficiency)
- **Always read the codebase map first**: Before running repository searches, consult [`.agents/planning/CODEBASE_MAP.md`](file:///h:/UniCord/Client%20Projects/Software/neipl/.agents/planning/CODEBASE_MAP.md).
- **Fast-Lookup Matrix**: Refer to Section 2 of `CODEBASE_MAP.md` to map user tasks directly to exact route paths (`client/app/`), components (`client/components/`), and state stores (`client/lib/`).

---

## 2. Command: `/update-agents`
When the user sends `/update-agents`:
1. Scan `client/app/`, `client/components/`, and `client/lib/` for any new routes, components, or stores.
2. Update [`.agents/planning/CODEBASE_MAP.md`](file:///h:/UniCord/Client%20Projects/Software/neipl/.agents/planning/CODEBASE_MAP.md) with the current files, descriptions, and the Fast-Lookup table.
3. Present a clear summary of additions, deletions, or structural modifications.

---

## 3. Technology Stack & Key Patterns
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript.
- **UI Library**: Ant Design 6 with customized green styling (`#16a34a`) wrapped by `Providers.tsx`.
- **CSS**: Tailwind CSS v4.
- **State Management**: Domain-specific stores in `client/lib/*/store.ts` persisted in browser `localStorage`.
- **RBAC**: Multi-role system (Admin, Plant Manager, Shift In-Charge, Supervisor, Employee). Managers are site-scoped via `user.plantId` (`client/lib/rbac.ts`).
