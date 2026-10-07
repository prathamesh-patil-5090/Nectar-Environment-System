# Nectar Enviro Ops Console — Codebase Map

> **Location:** `.agents/planning/CODEBASE_MAP.md`
> **Last synchronized:** 2026-10-08 (`/update-agents`)
> **Purpose:** Read this first. It maps every task to the exact route, component, store and server module, so you can open files directly instead of searching the repo.
> All paths are relative to the repo root.

---

## 1. System Overview & Stack

| Layer | Technology | Notes |
| :--- | :--- | :--- |
| **Client** | Next.js 16.3.5 (App Router), React 19.2.8, TypeScript 5 | Route group `client/app/(app)/` = pages inside `AppShell`. Port 3000. |
| **Server** | NestJS 10, Mongoose 8, Swagger | Feature modules in `server/src/modules/`. Port 3001, prefix `/api`, docs at `/api/docs`. |
| **Database** | MongoDB Atlas, db `nectar_enviro` | Schemas in `server/db/schemas/`, seeds in `server/db/seeds/`. See §5. |
| **UI** | Ant Design 6.6.5, `@ant-design/icons` | Theme in `client/lib/theme.ts`: primary navy `#1C4463`, ink `#0B1A24`, sand `#F4F7FA`, alert `#C45C26`. |
| **Styling** | Tailwind CSS v4 + inline styles | Global classes in `client/app/globals.css` (sidebar, flyouts, dashboard grid). |
| **Data layer** | `client/lib/api/*` (fetch → NestJS) + `client/lib/*/store.ts` | Server first; `localStorage` caches as fallback (§6). |
| **i18n** | `client/lib/i18n/` | English / Hindi / Marathi. Keys in `locales/{en,hi,mr}.ts`; free-text phrases in `catalog/*.ts` via `tr()` / `trData()`. |
| **Charts / motion** | Recharts 3, GSAP 3, HTML canvas | `client/lib/motion/` hooks animate pages and tables. |
| **Export** | jsPDF + AutoTable, SheetJS | OT reports, safety case PDF, permit PDF, certificates. |
| **Tests** | Vitest 3.2.4 (`client/vitest.config.ts`) | Logic tests in `client/lib/**/*.test.ts`. `lib/logic-baseline.test.ts` snapshots the whole RBAC matrix. Safety and E-Permit rule files must stay identical on client and server (parity tests). |
| **Dev runner** | Root `npm run dev` (`concurrently`) | Starts client and server together. |

### Core operating flow
```text
Employee master ─► Shifts & rotation ─► Leave / absence ─► Manpower gap
                                                            │
                         Reliever pool / competition ◄──────┘
                                    │
                         Covered? ── no ──► OT decision ─► Overtime (last resort)
                                    │
Safety incidents & breakdowns ─► return-to-work clearance ─► blocks rostering
E-Permits (permit to work) ─► breakdown repair, OT link
Training / LNI / certifications ─► skill coverage for relievers
```

---

## 2. Fast-Lookup Matrix ("Where to go")

| Area | Route | Page | Components | Logic / API |
| :--- | :--- | :--- | :--- | :--- |
| **Login & demo accounts** | `/login` | `client/app/login/page.tsx` | — | `client/lib/auth.ts` (local demo users), `client/lib/api/auth.ts` (HoD accounts + login from DB) |
| **Shell, sidebar, RBAC** | `/*` | `client/app/(app)/layout.tsx` | `client/components/AppShell.tsx`, `Providers.tsx` | `client/lib/rbac.ts`, `client/lib/theme.ts` |
| **Dashboard** | `/dashboard` | `client/app/(app)/dashboard/page.tsx` | `dashboard/EmployeeDashboardView.tsx`, `SiteReadiness.tsx`, `SkillHeatmap.tsx`, `UrgentTrainingList.tsx`, `safety/SafetySummaryPanel.tsx` | `client/lib/workforce-metrics.ts` |
| **Employees** | `/employees`, `/employees/[id]` | `client/app/(app)/employees/` | `SkillHeatmap.tsx` | `client/lib/api/employees.ts`, `rbac.ts` (`isInChargeOf`) |
| **Sites** | `/sites` | `client/app/(app)/sites/page.tsx` | `SiteReadiness.tsx` | `client/lib/api/sites.ts` |
| **Shifts** | `/shifts`, `/shifts/{master,schedule,rotation,change-requests,reliever-allocation,manpower,deviations}` | `client/app/(app)/shifts/` | — | `client/lib/shift/`, `client/lib/manpower-conflict/`, `client/lib/shift-impact/` |
| **Reliever pool** | `/reliever-pool`, `/reliever-pool/competition` | `client/app/(app)/reliever-pool/` | — | `client/lib/reliever/pool.ts`, `client/lib/reliever-competition/` |
| **Leave** | `/leave`, `/leave/{requests,requests/[id],lifecycle,management,pending}` | `client/app/(app)/leave/` | `leave/LeaveImpactPanel.tsx`, `leave/ShiftImpactPanel.tsx` | `client/lib/leave/`, `client/lib/leave-lifecycle/` |
| **Overtime** | `/overtime/{overview,employees,sites,analysis,decisions,assign,reports}` | `client/app/(app)/overtime/` | `overtime/OtFiltersBar.tsx`, `OtStatusStrip.tsx`, `OtReportsPanel.tsx`, `OtFilterContext.tsx` | `client/lib/overtime/`, `client/lib/ot-decision/` |
| **Safety** | `/safety`, `/safety/{report,incidents,incidents/[id],breakdowns,breakdowns/[id],protocols,training}` | `client/app/(app)/safety/` | `client/components/safety/*` (EventDetail, EventsTable, EventTimeline, SafetyClearanceBanner, protocols/ProtocolEditor) | `client/lib/safety/` (rules ↔ `server/src/modules/safety/safety-rules.ts`) |
| **E-Permits** | `/e-permits`, `/e-permits/new`, `/e-permits/[id]`, `/e-permits/policies` | `client/app/(app)/e-permits/` | `e-permit/PermitDetail.tsx`, `PermitBits.tsx`, `ActivePermitsPanel.tsx` | `client/lib/e-permit/` (rules ↔ `server/src/modules/e-permits/e-permit-rules.ts`), `client/lib/api/e-permits.ts`. Plan: `docs/E_PERMIT_PLAN.md` |
| **Training / Academy** | `/training/{home,explore,my-learning,course/[id],learn/[id],track/[id],events,events/[id],communities/[slug],mentors,mentors/[id],mentor,team}` | `client/app/(app)/training/` | `client/components/training/*` (`records/` = Academic Records console, `events/`, `mentor/`, `ui/`) | `client/lib/training/`, `client/lib/api/training.ts` |
| **Certifications** | `/certifications` | `client/app/(app)/certifications/page.tsx` | `training/CertificateModal.tsx` | `client/lib/training/` |
| **Salary** | `/salary` | `client/app/(app)/salary/page.tsx` | — | `client/lib/salary.ts` |
| **Meetings** (soon) | `/meetings` | `client/app/(app)/meetings/page.tsx` | — | `client/lib/meetings/types.ts`, `client/lib/api/meetings.ts` |
| **Notifications** | `/notifications` | `client/app/(app)/notifications/page.tsx` | — | `client/lib/notifications.ts` |
| **Translations** | — | — | `i18n/LanguageSwitcher.tsx` | `client/lib/i18n/locales/*.ts`, `client/lib/i18n/catalog/*.ts` |

---

## 3. Roles, Sidebar & RBAC (`client/lib/rbac.ts`)

| Role | Scope | Notes |
| :--- | :--- | :--- |
| `director` | All plants | Final sign-offs (leave, rotation, safety close). |
| `hr` | All plants | Label is just "HR". Leave management, everyone below HR. |
| `safety_incharge` | All plants | Owns Safety; critical clearances. |
| `hod` | All plants | Head of Department = **Senior Manager**. Same access as Plant Manager everywhere, plus E-Permit Authoriser for their department. Accounts live **only in the DB** (`users` collection). |
| `manager` | Own plant | Plant Manager = **Assistant Manager**. Use `isManagerRole(role)` (true for `manager` and `hod`) instead of `role === "manager"`. |
| `site_incharge` / `shift_incharge` | Own plant | Shift planning, leave site approval, relievers. |
| `supervisor` | Own plant | Leave on behalf, reliever availability. |
| `employee` | Self | Self-service. |

**Sidebar** (`AppShell.tsx`, built with `sectioned()` group headings):
- *Management:* Dashboard · **People** (Employees, Academic Records, Medical records) · **Workforce planning** (Sites, Shifts, Reliever Pool) · **Time & pay** (Leave, OverTime) · **Safety & compliance** (Safety, E-Permits) · **Collaboration** (Meetings)
- *Employee:* Dashboard · **My work** (Leave, Salary, Academy) · **Safety & compliance** · **More** (Meetings, Medical records)
- Empty groups hide automatically; headings become dividers when collapsed.

---

## 4. Server (`server/`)

| Module (`server/src/modules/`) | Purpose |
| :--- | :--- |
| `auth` | `GET /api/auth/accounts?role=` (login-page accounts, no passwords) and `POST /api/auth/login` against the `users` collection. HoD rows include `departmentName` and `isDeputy`. |
| `employees`, `sites` | Directory data. |
| `leaves`, `shifts`, `relievers` | Leave, roster and reliever APIs. |
| `training` | Courses, enrollments, events, mentors, communities, assignments. |
| `safety` | Incidents, breakdowns, protocols, clearances (`safety-rules.ts` = shared rule table). |
| `e-permits` | Permits, masters (departments, locations, contacts), scheduler (`e-permit-rules.ts` = shared rule table). |
| `notifications`, `meetings`, `health` | Notifications feed, meetings stub, `/api/health`. |

**Seeds** (`server/db/seeds/`):
- `npm run seed` → `index.ts`. **Destructive**: wipes and refills the collections.
- `npm run seed:safety` / `npm run seed:e-permits` → upsert only, safe on a live DB. `e-permit.seed.ts` is the only source of HoD/deputy users, departments and permit locations.

---

## 5. MongoDB Collections

`users`, `employees`, `leaders`, `sites`, `leaves`, `leave_balances`, `leave_policies`, `shift_rosters`, `reliever_pool`, `notifications`,
`safety_events`, `safety_protocols`,
`e_permits`, `e_permit_sequences`, `departments`, `permit_locations`, `site_emergency_contacts`,
`courses`, `enrollments`, `training_records`, `training_sessions`, `training_events`, `training_assignments`, `certificates`, `communities`, `event_posts`, `event_rsvps`, `mentor_profiles`, `mentor_live_sessions`, `role_paths`.

---

## 6. `client/lib/` Inventory

- **Core:** `auth.ts` (session, local demo users), `rbac.ts`, `theme.ts`, `styles.ts`, `storage.ts`, `sync.ts`, `mock-data.ts`, `workforce-metrics.ts`, `notifications.ts`, `salary.ts`, `demo-reset.ts`
- **API (`api/`):** `client.ts` (base URL `NEXT_PUBLIC_API_URL`, default `http://localhost:3001/api`), `auth`, `employees`, `sites`, `leaves`, `shifts`, `relievers`, `training`, `safety`, `e-permits`, `meetings`
- **Domains:** `shift/`, `shift-impact/`, `manpower-conflict/`, `leave/`, `leave-lifecycle/`, `reliever/`, `reliever-competition/`, `overtime/`, `ot-decision/`, `safety/`, `e-permit/`, `training/`, `meetings/`
- **i18n (`i18n/`):** `I18nProvider.tsx`, `LanguageSwitcher.tsx`, `translate.ts`, `phrases.ts`, `data-labels.ts`, `localized.ts`, `locales/`, `catalog/`
- **Motion (`motion/`):** `use-dashboard-motion.ts`, `use-table-motion.ts`
- **Types (`types/`):** `employee.types.ts`, `site.types.ts`

### Shared UI (`client/components/`)
`AppShell.tsx`, `Providers.tsx`, `quiet.tsx` (Section, Panel, NumberRow, Quiet, Facts), `Panel.tsx`, `KpiStat.tsx`, `SiteReadiness.tsx`, `SkillHeatmap.tsx`, `UrgentTrainingList.tsx`, `InteractiveEnvironmentalCanvas.tsx` (login background), plus domain folders `dashboard/`, `leave/`, `overtime/`, `safety/`, `e-permit/`, `training/`.

### `localStorage` keys
| Key | Purpose |
| :--- | :--- |
| `nectar-enviro-session` | Signed-in user |
| `nectar-enviro-locale` | Language (en / hi / mr) |
| `nectar-enviro-sider-collapsed` | Sidebar collapsed state |
| `nectar-enviro-shift-store-v3` | Shift cache |
| `nectar-enviro-leave-store-v2` | Leave cache |
| `nectar-enviro-reliever-pool-v2` | Reliever pool cache |
| `nectar-enviro-ot-assignments` | OT assignments |
| `nectar-enviro-safety-cache-v1` | Safety cache |
| `nectar-enviro-e-permit-masters-v1` | E-Permit masters cache |
| `nectar-enviro-notifications` (+ `-seeded-v3`) | Notifications |
| `nectar-enviro-training-status-v2` | Urgent training overrides |
| `neipl_training_*_v3` | Training enrollments, sessions, tests, LNI, skill mapping, certificates |

---

## 7. Docs & Agent Config

| Location | Role |
| :--- | :--- |
| `.agents/AGENTS.md` | Master agent rules + `/update-agents` |
| `.agents/CLAUDE.md` (+ `.agents/.claude/CLAUDE.md` bridge) | Claude Code instructions |
| `.agents/.cursorrules`, `.agents/.cursor/rules/agents.mdc` | Cursor rules |
| `.agents/rules/codebase-navigation.md` | Antigravity navigation rule |
| `.agents/skills/` | `frontend-design`, `high-end-visual-design`, `nestjs-best-practices` |
| `docs/PAGES_AND_FEATURES.md`, `docs/PPT_PAGE_FEATURES.md` | Product / page reference |
| `docs/E_PERMIT_PLAN.md`, `docs/SAFETY_PLAN.md`, `docs/SAFETY_REPORTS_AND_PROTOCOLS_TODO.md`, `docs/TRAINING_REDESIGN_PLAN.md`, `docs/REFACTOR_PLAN.md` | Module plans |
| `docs/MANUAL_TEST_SUITE.md` | Manual QA checklist |
| `docs/demo-credentials.{md,csv,json}` | Demo logins (password `nectar2026`) |
| `docs/FEATURE_INVENTORY_AND_COSTING.md` | Feature list and costing |
