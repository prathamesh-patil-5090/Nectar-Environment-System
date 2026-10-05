# Nectar Enviro Ops Console — Comprehensive Codebase Map

> **Location:** `.agents/planning/CODEBASE_MAP.md`  
> **Last Synchronized:** 2026-09-28 (`/update-agents`)  
> **Purpose:** High-precision codebase index. Any AI assistant (Antigravity, Cursor, Claude Code) or developer should read this file first to directly locate routes, components, state stores, and business logic without full-repo searches or unnecessary token consumption.

---

## 1. System Overview & Technology Stack

| Layer | Technologies & Libraries | Notes / Patterns |
| :--- | :--- | :--- |
| **Client Framework** | Next.js 16.3.5 (App Router), React 19.2.8, TypeScript 5 | App router with route groups `(app)` for shell-wrapped pages. Port 3000. |
| **Backend Framework** | NestJS 10, Mongoose 8, Swagger / OpenAPI 7 | Modular REST API in `server/src/modules/` on port 3001 (`/api/docs`). |
| **Database** | MongoDB Atlas (`nectar_enviro` cluster) | 9 canonical domain collections: `employees`, `sites`, `leave_requests`, `shift_rosters`, `reliever_pool`, `courses`, `training_records`, `certificates`, `training_sessions`. |
| **UI Components** | Ant Design (`antd`) 6.6.5, `@ant-design/icons` 6.3.4 | Custom green palette (#16a34a) via `Providers.tsx` & `lib/theme.ts`. |
| **CSS & Styling** | Tailwind CSS v4 (`@tailwindcss/postcss`), CSS-in-JS | `@ant-design/nextjs-registry` for zero-FOUC AntD hydration. |
| **State & DAL** | `client/lib/api/` (NestJS fetch DAL) + `client/lib/*/store.ts` | Dual-mode: Direct MongoDB REST API + localStorage hydration fallback with live auto-sync. |
| **Charts & Visuals** | Recharts 3.10.1, GSAP 3.15, HTML5 Canvas | Dynamic plant water treatment visualizer & analytics charts. |
| **Export Engines** | jsPDF 4.2.1, jsPDF-AutoTable 5.0.8, SheetJS (`xlsx` 0.18.5) | PDF report generator with tabular styling; Excel export. |
| **Testing** | Vitest 3.2.4 (`client/vitest.config.ts`) | Unit and ops flow validation in `client/lib/ops-flow.test.ts` (22/22 passing). |
| **Dev Runner** | Root `concurrently` runner (`npm run dev`) | Starts client (3000) & server (3001) simultaneously with formatted console logs. |

### Core Operating Flow
```text
Employee Master (lib/mock-data.ts)
       ↓
Shift Scheduling & Rotation (lib/shift/)
       ↓
Leave / Absence (lib/leave/)  ←→  Manpower Gap Identified
       ↓                                    ↓
       └──────── Reliever Pool (lib/reliever/) ─┘
                         ↓
             Covered / Not covered
                         ↓
            Overtime - Last Resort (lib/overtime/)
                         ↓
             OT Analysis & Compliance Reports
                         ↓
      Training, Competency & LNI Matrix (lib/training/)
```

---

## 2. Fast-Lookup Decision Matrix ("Where to Go")

Use this quick-routing table to identify the exact files needed for any task:

| Functional Area | User URL / Route | Primary Page File | Key Components (`client/components/`) | Core Logic / Store (`client/lib/`) |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & Demo Accounts** | `/login` | [`client/app/login/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/login/page.tsx) | — | [`client/lib/auth.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/auth.ts) |
| **Global Shell & Navigation** | `/*` | [`client/app/(app)/layout.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/layout.tsx) | [`AppShell.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/AppShell.tsx), [`Providers.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/Providers.tsx) | [`client/lib/rbac.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/rbac.ts), [`client/lib/theme.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/theme.ts) |
| **Executive & Employee Dashboard** | `/dashboard` | [`client/app/(app)/dashboard/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/dashboard/page.tsx) | [`dashboard/EmployeeDashboardView.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/dashboard/EmployeeDashboardView.tsx), [`SiteReadiness.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/SiteReadiness.tsx), [`KpiStat.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/KpiStat.tsx) | [`client/lib/workforce-metrics.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/workforce-metrics.ts), [`client/lib/mock-data.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/mock-data.ts) |
| **Employee Directory & Profiles** | `/employees`, `/employees/[id]` | [`client/app/(app)/employees/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/employees/page.tsx), [`[id]/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/employees/[id]/page.tsx) | [`SkillHeatmap.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/SkillHeatmap.tsx) | [`client/lib/mock-data.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/mock-data.ts) |
| **Plant / Site Operations** | `/sites` | [`client/app/(app)/sites/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/sites/page.tsx) | [`SiteReadiness.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/SiteReadiness.tsx), [`InteractiveEnvironmentalCanvas.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/InteractiveEnvironmentalCanvas.tsx) | [`client/lib/workforce-metrics.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/workforce-metrics.ts) |
| **Shift Master Configuration** | `/shifts/master` | [`client/app/(app)/shifts/master/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/master/page.tsx) | Roster tables, timing badges | [`client/lib/shift/types.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/shift/types.ts), [`client/lib/shift/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/shift/store.ts) |
| **Shift Roster & Schedule** | `/shifts/schedule` | [`client/app/(app)/shifts/schedule/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/schedule/page.tsx) | Shift assignment grid, date selector | [`client/lib/shift/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/shift/store.ts) |
| **Shift 21-Day Rotations** | `/shifts/rotation` | [`client/app/(app)/shifts/rotation/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/rotation/page.tsx) | Rotation pattern visualizer | [`client/lib/shift/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/shift/store.ts) |
| **Shift Deviations & Swaps** | `/shifts/deviations`, `/shifts/change-requests` | [`client/app/(app)/shifts/deviations/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/deviations/page.tsx), [`change-requests/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/change-requests/page.tsx) | Deviation resolution drawer, swap request list | [`client/lib/shift/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/shift/store.ts) |
| **Reliever Pool Standby & Dispatch** | `/reliever-pool`, `/shifts/reliever-allocation` | [`client/app/(app)/reliever-pool/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/reliever-pool/page.tsx), [`reliever-allocation/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/reliever-allocation/page.tsx) | Standby status cards, dispatch modals | [`client/lib/reliever/pool.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/reliever/pool.ts), [`client/lib/shift/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/shift/store.ts) |
| **Leave Apply & Requests History** | `/leave/requests`, `/leave/requests/[id]` | [`client/app/(app)/leave/requests/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/leave/requests/page.tsx), [`[id]/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/leave/requests/[id]/page.tsx) | [`leave/requests/LeaveRequestsContent.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/leave/requests/LeaveRequestsContent.tsx) | [`client/lib/leave/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/leave/store.ts) |
| **Leave Approval & Shift Deficit Check** | `/leave/management` | [`client/app/(app)/leave/management/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/leave/management/page.tsx) | [`leave/LeaveImpactPanel.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/leave/LeaveImpactPanel.tsx) | [`client/lib/leave/coverage.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/leave/coverage.ts), [`client/lib/leave/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/leave/store.ts) |
| **Supervisor On-Behalf Consent** | `/leave/pending` | [`client/app/(app)/leave/pending/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/leave/pending/page.tsx) | Consent action buttons | [`client/lib/leave/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/leave/store.ts) |
| **Overtime Hub & Overview** | `/overtime`, `/overtime/overview` | [`client/app/(app)/overtime/overview/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/overview/page.tsx) | [`overtime/OtStatusStrip.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/overtime/OtStatusStrip.tsx), [`overtime/OtFiltersBar.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/overtime/OtFiltersBar.tsx) | [`client/lib/overtime/engine.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/engine.ts), [`client/lib/overtime/aggregations.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/aggregations.ts) |
| **Overtime Assignment & Caps** | `/overtime/assign` | [`client/app/(app)/overtime/assign/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/assign/page.tsx) | Assignment form, 50h cap validator | [`client/lib/overtime/assignments.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/assignments.ts), [`client/lib/overtime/rules.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/rules.ts) |
| **Overtime Root-Cause Analytics** | `/overtime/analysis` | [`client/app/(app)/overtime/analysis/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/analysis/page.tsx) | Root-cause breakdown charts | [`client/lib/overtime/aggregations.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/aggregations.ts) |
| **Overtime Reports (PDF / Excel)** | `/overtime/reports` | [`client/app/(app)/overtime/reports/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/reports/page.tsx) | [`overtime/OtReportsPanel.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/overtime/OtReportsPanel.tsx) | [`client/lib/overtime/reports.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/reports.ts) |
| **Overtime by Employee / Site** | `/overtime/employees`, `/overtime/sites` | [`client/app/(app)/overtime/employees/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/employees/page.tsx), [`sites/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/sites/page.tsx) | Employee OT cards, Site drilldowns | [`client/lib/overtime/aggregations.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/aggregations.ts) |
| **Training & LMS Portal** | `/training` | [`client/app/(app)/training/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/training/page.tsx) | [`training/EmployeeTrainingPortal.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/EmployeeTrainingPortal.tsx), [`training/CourseraRecommendationsGrid.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/CourseraRecommendationsGrid.tsx) | [`client/lib/training/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/training/store.ts) |
| **Meetup Event & Masterclass Details** | `/training/events/[eventId]` | [`client/app/(app)/training/events/[eventId]/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/training/events/[eventId]/page.tsx) | [`training/events/EventHeroBanner.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/events/EventHeroBanner.tsx), [`EventLogisticsCard.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/events/EventLogisticsCard.tsx), [`EventChatSection.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/events/EventChatSection.tsx) | [`client/lib/api/training.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/api/training.ts), [`client/lib/training/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/training/store.ts) |
| **Course Video Learning & Quizzes** | `/training/learn/[courseId]` | [`client/app/(app)/training/learn/[courseId]/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/training/learn/[courseId]/page.tsx) | [`training/CoursePlayerModal.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/CoursePlayerModal.tsx) | [`client/lib/training/VideoPlayerEngine.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/training/VideoPlayerEngine.ts) |
| **LNI Competency Matrix & Tests** | `/training` | [`client/app/(app)/training/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/training/page.tsx) | [`training/LniMatrixView.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/LniMatrixView.tsx), [`training/EvaluatorScoringModal.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/EvaluatorScoringModal.tsx) | [`client/lib/training/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/training/store.ts) |
| **Compliance Deadlines & Alerts** | `/dashboard`, `/training` | [`dashboard/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/dashboard/page.tsx) | [`UrgentTrainingList.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/UrgentTrainingList.tsx) | [`client/lib/training/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/training/store.ts) |
| **Role & Specialization Tracks** | `/training/track/[trackId]` | [`client/app/(app)/training/track/[trackId]/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/training/track/[trackId]/page.tsx) | Milestones timeline, module checklist | [`client/lib/training/data.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/training/data.ts) |
| **Certifications & Verifications** | `/certifications` | [`client/app/(app)/certifications/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/certifications/page.tsx) | [`training/CertificateModal.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/CertificateModal.tsx) | [`client/lib/training/store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/training/store.ts) |
| **Salary & Overtime Multipliers** | `/salary` | [`client/app/(app)/salary/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/salary/page.tsx) | Payroll summary table | [`client/lib/salary.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/salary.ts) |
| **Notifications & Approval Alerts** | `/notifications` | [`client/app/(app)/notifications/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/notifications/page.tsx) | Alert card list, action triggers | [`client/lib/notifications.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/notifications.ts) |

---

## 3. Directory & File Inventory

### 3.1. Routes & Pages (`client/app/`)

- [`client/app/layout.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/layout.tsx): Root layout declaring Geist fonts, global HTML, Ant Design registry wrapping, and metadata.
- [`client/app/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/page.tsx): Root gatekeeper; reads `localStorage` session and redirects to `/dashboard` or `/login`.
- [`client/app/globals.css`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/globals.css): Tailwind v4 setup, Ant Design color mappings, scrollbar styling, glassmorphism utilities.
- [`client/app/icon.png`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/icon.png): Browser favicon.
- [`client/app/login/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/login/page.tsx): Sign-in form with quick role selectors (`admin@`, `*.manager@`, `*.shift@`, `*.supervisor@`, employee emails).
- [`client/app/(app)/layout.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/layout.tsx): Wraps authenticated child pages inside `AppShell`.

#### App Pages under `client/app/(app)/`
- **Dashboard**:
  - [`dashboard/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/dashboard/page.tsx): Dual dashboard logic. Displays `EmployeeDashboardView` for employee role; executive overview for Admin/Manager/SIC/Supervisor.
- **Employees**:
  - [`employees/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/employees/page.tsx): Filterable table of 30+ employees across plants (ETP, RO, MEE).
  - [`employees/[id]/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/employees/[id]/page.tsx): Comprehensive 360-degree employee profile tabbed with shifts, leaves, overtime, and skill competencies.
- **Sites**:
  - [`sites/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/sites/page.tsx): Plant operational status, water treatment output, compliance scores, readiness gauges.
- **Shifts**:
  - [`shifts/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/page.tsx): Redirects to `/shifts/schedule`.
  - [`shifts/layout.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/layout.tsx): Shifts navigation wrapper.
  - [`shifts/master/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/master/page.tsx): Configures standard shifts (General: 9 AM-6 PM, A: 6 AM-2 PM, B: 2 PM-10 PM, C: 10 PM-6 AM).
  - [`shifts/schedule/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/schedule/page.tsx): Full month / week roster matrix, drag/assign shifts, plant filtering.
  - [`shifts/rotation/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/rotation/page.tsx): 21-day rotation rules planner and automated pattern generator.
  - [`shifts/reliever-allocation/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/reliever-allocation/page.tsx): Allocate reliever manpower directly into roster gaps.
  - [`shifts/deviations/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/deviations/page.tsx): Logs and resolves unplanned absences, tardiness, and emergency replacements.
  - [`shifts/change-requests/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/shifts/change-requests/page.tsx): Employee shift swap and trade approvals.
- **Reliever Pool**:
  - [`reliever-pool/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/reliever-pool/page.tsx): Reliever availability tracking, multi-plant dispatch, skill matching.
- **Leave**:
  - [`leave/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/leave/page.tsx): Redirects to `/leave/requests`.
  - [`leave/requests/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/leave/requests/page.tsx): Employee leave request submission & history table.
  - [`leave/requests/LeaveRequestsContent.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/leave/requests/LeaveRequestsContent.tsx): Filters and status tabs for leave requests.
  - [`leave/requests/[id]/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/leave/requests/[id]/page.tsx): Detailed leave inquiry modal/view.
  - [`leave/management/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/leave/management/page.tsx): Manager queue with real-time shift impact checks (`LeaveImpactPanel`).
  - [`leave/pending/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/leave/pending/page.tsx): Supervisor on-behalf applications waiting for employee approval.
- **Overtime**:
  - [`overtime/layout.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/layout.tsx): Tab header linking Overview, Assign, Analysis, Reports, Employees, Sites.
  - [`overtime/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/page.tsx) & [`overtime/overview/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/overview/page.tsx): Overtime burn rate, total hours, budget impact, compliance threshold ribbons.
  - [`overtime/assign/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/assign/page.tsx): Assign OT hours to employees with reliever-first warning & 50h statutory limit warnings.
  - [`overtime/analysis/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/analysis/page.tsx): Root-cause breakdown (manpower vacancy, equipment breakdowns, sudden sick leave).
  - [`overtime/reports/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/reports/page.tsx): PDF and Excel export engine for audits.
  - [`overtime/employees/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/employees/page.tsx) & [`[id]/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/employees/[id]/page.tsx): Individual worker OT breakdown and historical trend.
  - [`overtime/sites/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/sites/page.tsx) & [`[id]/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/overtime/sites/[id]/page.tsx): Site-by-site overtime comparison.
- **Training & Certifications**:
  - [`training/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/training/page.tsx): Unified training hub: Employee courses portal or Manager/Admin LNI Matrix & evaluations.
  - [`training/learn/[courseId]/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/training/learn/[courseId]/page.tsx): Full-screen video LMS player with simulated chapters, note taking, and quiz.
  - [`training/track/[trackId]/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/training/track/[trackId]/page.tsx): Career progression path (e.g. RO Plant Specialist track).
  - [`certifications/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/certifications/page.tsx): Digital badges, certificate numbers, and PDF certificate export.
- **Salary & Notifications**:
  - [`salary/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/salary/page.tsx): Monthly payroll preview, base wage + overtime wage calculator.
  - [`notifications/page.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/app/(app)/notifications/page.tsx): Audit notification feed (approvals, shifts, alerts, training due).

---

### 3.2. Shared UI Components (`client/components/`)

- [`AppShell.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/AppShell.tsx):
  - Collapsible sidebar with role-aware navigation menus.
  - Plant switcher badge for multi-plant management.
  - Notifications drawer & bell indicator.
  - Profile dropdown with active role badge and logout action.
- [`Providers.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/Providers.tsx): Ant Design `ConfigProvider` configuring the primary color `#16a34a` (green) and font hierarchy.
- [`SiteReadiness.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/SiteReadiness.tsx): Radial/gauge visualization showing operational readiness percentage per plant.
- [`SkillHeatmap.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/SkillHeatmap.tsx): Matrix mapping technical capabilities (ETP Operations, RO Maintenance, Chemical Handling) across staff.
- [`InteractiveEnvironmentalCanvas.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/InteractiveEnvironmentalCanvas.tsx): Fluid canvas animation simulating industrial water and environmental flows.
- [`KpiStat.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/KpiStat.tsx): Reusable card for operational numbers with upward/downward delta badges.
- [`UrgentTrainingList.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/UrgentTrainingList.tsx): Compact alert card highlighting mandatory compliance training deadlines.

#### Domain Sub-components
- **Dashboard**:
  - [`components/dashboard/EmployeeDashboardView.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/dashboard/EmployeeDashboardView.tsx): Personal staff portal view (my shift today, upcoming roster, leave balance, assigned training).
- **Leave**:
  - [`components/leave/LeaveImpactPanel.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/leave/LeaveImpactPanel.tsx): Evaluates whether approving a leave request creates an unassigned shift vacancy or if a reliever is available.
- **Overtime**:
  - [`components/overtime/OtFilterContext.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/overtime/OtFilterContext.tsx): Context providing synchronized plant, month, and search state across OT tabs.
  - [`components/overtime/OtFiltersBar.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/overtime/OtFiltersBar.tsx): Ant Design filter strip with plant dropdown, month picker, and search input.
  - [`components/overtime/OtStatusStrip.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/overtime/OtStatusStrip.tsx): Top header strip displaying budget limits and 50h compliance alerts.
  - [`components/overtime/OtReportsPanel.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/overtime/OtReportsPanel.tsx): Modal / panel triggering PDF generation or Excel spreadsheet downloads.
- **Training**:
  - [`components/training/EmployeeTrainingPortal.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/EmployeeTrainingPortal.tsx): Employee course dashboard (in-progress courses, completed certificates, recommendations).
  - [`components/training/CoursePlayerModal.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/CoursePlayerModal.tsx): Video LMS player popup.
  - [`components/training/CourseraRecommendationsGrid.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/CourseraRecommendationsGrid.tsx): Cards displaying external industry courses.
  - [`components/training/CertificateModal.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/CertificateModal.tsx): Certificate preview and download dialog.
  - [`components/training/EvaluatorScoringModal.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/EvaluatorScoringModal.tsx): Allows supervisors/managers to submit written, practical, and oral test scores.
  - [`components/training/LniMatrixView.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/LniMatrixView.tsx): Learning Need Identification (LNI) table showing employee ability scores vs target benchmarks.
  - [`components/training/PendingEvaluationsQueue.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/PendingEvaluationsQueue.tsx): Queue of completed training sessions awaiting manager grading.
  - [`components/training/TrainingScheduleView.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/TrainingScheduleView.tsx): Scheduled classroom and on-site sessions.
  - **Meetup-Grade Event Experience** (`components/training/events/`):
    - [`EventHeroBanner.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/events/EventHeroBanner.tsx): Breadcrumbs, H1 title, co-branded host/group row, and 16:9 featured cover image with format badges.
    - [`EventHighlightsBar.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/events/EventHighlightsBar.tsx): 4-item visual metrics strip (Format, Admission, Capacity, Target Audience).
    - [`EventAgendaTimeline.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/events/EventAgendaTimeline.tsx): Session milestone timeline with time chips and bullet nodes.
    - [`EventAttendeesSection.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/events/EventAttendeesSection.tsx): Social proof header, avatar cluster, and attendee cards with plant badges.
    - [`EventHostCard.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/events/EventHostCard.tsx): Certified mentor spotlight with bio, credentials, and host session links.
    - [`EventChatSection.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/events/EventChatSection.tsx): Interactive discussion feed with question/comment/announcement tabs, pin support, and RSVP gate.
    - [`EventLogisticsCard.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/events/EventLogisticsCard.tsx): Right sticky action card with calendar date tile, Google/Apple/Outlook calendar dropdown, venue join link, capacity bar, and primary CTA.
    - [`EventStickyBottomBar.tsx`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/components/training/events/EventStickyBottomBar.tsx): Persistent floating dock for one-tap RSVP during scrolling.

---

### 3.3. State Stores, Business Logic & Utilities (`client/lib/`)

#### Core Utilities
- [`auth.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/auth.ts): Session state in `localStorage`, role resolution, demo credentials list.
- [`rbac.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/rbac.ts): Access rules:
  - `Admin`: Org-wide access across all plants.
  - `Manager`: Site-scoped to `user.plantId`; approves leaves, assigns OT, configures shifts.
  - `Shift In-Charge (SIC)`: Plant shift coordination + personal employee profile.
  - `Supervisor`: Team leave on-behalf creation + personal employee profile.
  - `Employee`: Personal profile, leave submission, OT notifications, training LMS.
- [`mock-data.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/mock-data.ts): Seed data for 30+ employees, plant metadata (ETP, RO, MEE), departments, and skills.
- [`workforce-metrics.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/workforce-metrics.ts): Calculates headcount health, vacancy rates, shift coverage percentages.
- [`training.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/training.ts): Compliance deadline state overrides (`overdue`, `due-soon`, `completed`) used by `UrgentTrainingList.tsx`.
- [`notifications.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/notifications.ts): In-app notification dispatcher (`notifyLeaveStatus`, `notifyOtAssigned`, etc.) persisted in `localStorage`.
- [`certificates.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/certificates.ts): Generates branded PDF certificates using `jspdf`.
- [`salary.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/salary.ts): Overtime compensation calculator (standard 1.5x / 2.0x hourly multiplier).
- [`theme.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/theme.ts): Ant Design theme configuration tokens.
- [`demo-reset.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/demo-reset.ts): Purges all `neipl_*` keys from `localStorage` to restore fresh demo state.
- [`ops-flow.test.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/ops-flow.test.ts): End-to-end integration tests for shift coverage, leave approvals, and reliever assignment.

#### Domain Sub-Modules
- **Shift (`client/lib/shift/`)**:
  - [`types.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/shift/types.ts): Type contracts for shifts, master shifts, rosters, deviations, and swap requests.
  - [`store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/shift/store.ts): `localStorage` store for rosters, 21-day rotations, shift swap submissions, and reliever assignments.
  - [`index.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/shift/index.ts): Barrel export.
- **Leave (`client/lib/leave/`)**:
  - [`types.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/leave/types.ts): Leave request models, status enums (`APPROVED`, `REJECTED`, `PENDING_MANAGER_APPROVAL`, `PENDING_EMPLOYEE_CONSENT`).
  - [`store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/leave/store.ts): State machine for leave applications, manager approvals, supervisor on-behalf requests, and balance decrements.
  - [`coverage.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/leave/coverage.ts): Assesses shift deficit during requested leave dates and suggests available relievers.
  - [`index.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/leave/index.ts): Barrel export.
- **Reliever (`client/lib/reliever/`)**:
  - [`pool.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/reliever/pool.ts): Reliever pool query functions, competency matching, and standby availability checks.
- **Overtime (`client/lib/overtime/`)**:
  - [`types.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/types.ts): Interfaces for overtime logs, allocations, caps, and analytics.
  - [`engine.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/engine.ts): Overtime compliance engine (50h statutory limit, monthly hour rollups).
  - [`assignments.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/assignments.ts): Assigns OT shifts to staff; checks reliever availability first to avoid unnecessary OT.
  - [`rules.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/rules.ts): Business policies (reliever-first rule, consecutive hours warning).
  - [`aggregations.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/aggregations.ts): Rollup calculations for charts (by plant, department, reason, date).
  - [`reports.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/reports.ts): Generates downloadable PDF and Excel reports.
  - [`format.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/format.ts): Formats hours and currency (`₹`).
  - [`rbac.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/rbac.ts): Permissions for viewing and assigning overtime.
  - [`mock-data.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/mock-data.ts): Seed historical overtime logs.
  - [`index.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/overtime/index.ts): Barrel export.
- **Training (`client/lib/training/`)**:
  - [`types.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/training/types.ts): Courses, LNI matrices, test evaluations (written, practical, oral), certificates, mentors.
  - [`store.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/training/store.ts): `localStorage` state store for course enrollment, progress timestamps, evaluator scoring, certificate issuance.
  - [`mock-data.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/training/mock-data.ts): Course catalog, competency benchmarks, mentors, and test records.
  - [`VideoPlayerEngine.ts`](file:///h:/UniCord/Client%20Projects/Software/neipl/client/lib/training/VideoPlayerEngine.ts): State machine simulating video playback, playback rates, completion markers, and quiz gating.

---

## 4. Documentation & Agent Tool Configurations

| Location | Tool / Target | Role & Content |
| :--- | :--- | :--- |
| [`.agents/AGENTS.md`](file:///h:/UniCord/Client%20Projects/Software/neipl/.agents/AGENTS.md) | Universal Agent Standard | Master rules, `/update-agents` command, stack overview. |
| [`.agents/CLAUDE.md`](file:///h:/UniCord/Client%20Projects/Software/neipl/.agents/CLAUDE.md) | Claude Code Master | Claude Code instructions pointing to `CODEBASE_MAP.md`. |
| [`.agents/.cursorrules`](file:///h:/UniCord/Client%20Projects/Software/neipl/.agents/.cursorrules) | Cursor IDE Master | Cursor prompt rules. |
| [`.cursor/rules/agents.mdc`](file:///h:/UniCord/Client%20Projects/Software/neipl/.cursor/rules/agents.mdc) | Cursor Rules Bridge | Global rule (`alwaysApply: true`) linking Cursor to `.agents/`. |
| [`.claude/CLAUDE.md`](file:///h:/UniCord/Client%20Projects/Software/neipl/.claude/CLAUDE.md) | Claude Code Bridge | Official Claude Code directory import pointing to `.agents/CLAUDE.md`. |
| [`.agents/rules/codebase-navigation.md`](file:///h:/UniCord/Client%20Projects/Software/neipl/.agents/rules/codebase-navigation.md) | Antigravity IDE | Workspace customization rule for zero-search navigation and `/update-agents`. |
| [`docs/PAGES_AND_FEATURES.md`](file:///h:/UniCord/Client%20Projects/Software/neipl/docs/PAGES_AND_FEATURES.md) | Product Reference | Functional specification, demo account credentials, and feature checklist. |
| [`.agents/skills/frontend-design`](file:///h:/UniCord/Client%20Projects/Software/neipl/.agents/skills/frontend-design) | Design Skill | Non-generic visual guidelines. |
| [`.agents/skills/high-end-visual-design`](file:///h:/UniCord/Client%20Projects/Software/neipl/.agents/skills/high-end-visual-design) | Visual Agency Skill | Agency-tier design rules. |
| [`.agents/skills/nestjs-best-practices`](file:///h:/UniCord/Client%20Projects/Software/neipl/.agents/skills/nestjs-best-practices) | Backend Skill | NestJS architectural patterns. |

---

## 5. Storage Keys Reference (`localStorage`)

All client state is saved under distinct versioned keys to avoid collisions:

| Key Name | Storage Key String | Module / Purpose |
| :--- | :--- | :--- |
| Auth Session | `neipl_user_session` | Stores logged-in user, role, and plant scoping |
| Shift Rosters | `neipl_shift_rosters_v1` | Custom schedule overrides and assignments |
| Shift Deviations | `neipl_shift_deviations_v1` | Absence and deviation records |
| Shift Swaps | `neipl_shift_swaps_v1` | Shift change & trade requests |
| Leave Requests | `neipl_leave_requests_v1` | Submitted leave requests & approval states |
| Leave Balances | `neipl_leave_balances_v1` | Remaining vacation/casual/sick balances |
| Overtime Records | `neipl_overtime_records_v1` | Logged and assigned overtime entries |
| Training Enrollments | `neipl_training_enrollments_v1` | User course progress and completion |
| Skill Mapping / LNI | `neipl_training_skill_mapping_v1`| Evaluator test results & competency levels |
| Issued Certificates | `neipl_training_certificates_v1`| Issued certificates with serial numbers |
| Urgent Training | `nectar-enviro-training-status-v1`| Compliance training deadline overrides |
| Notifications | `neipl_notifications_v1` | In-app alerts, read status, and links |
