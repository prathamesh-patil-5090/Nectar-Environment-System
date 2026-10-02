# Nectar Enviro Ops Console — Pages & Features

**Product:** Nectar Enviro workforce & site operations dashboard  
**Stack:** Next.js (App Router) · React · Ant Design · mock domain data  
**Purpose:** Help ops, HR, site leads, and management reduce unnecessary overtime by connecting **employees, shifts, leave, reliever manpower, and OT intelligence** in one console.

---

## Table of contents

1. [How the app is organized](#1-how-the-app-is-organized)
2. [Access & roles](#2-access--roles)
3. [Shell & navigation](#3-shell--navigation)
4. [Core pages](#4-core-pages)
5. [Shifts module](#5-shifts-module)
6. [Reliever Pool](#6-reliever-pool)
7. [Leave module](#7-leave-module)
8. [OverTime (OT) module](#8-overtime-ot-module)
9. [Cross-module flows](#9-cross-module-flows)
10. [Route map (quick reference)](#10-route-map-quick-reference)

---

## 1. How the app is organized

The console is built around a single operating idea:

```text
Employee Master
      ↓
Shift Planning & Rotation
      ↓
Leave / Absence  ←→  Manpower Gap
      ↓                    ↓
      └──── Reliever Pool ─┘
                ↓
         Covered / Not covered
                ↓
            OT (last resort)
                ↓
         OT Analysis & Reports
```

Pages are grouped in the sidebar so each role can work in its layer without bouncing between disconnected tools.

---

## 2. Access & roles

### Login — `/login`

| Feature | Description |
|--------|-------------|
| Branded sign-in | Nectar Enviro identity, soft green atmosphere |
| Demo accounts | Five active roles across Admin + ETP / RO / MEE plants |
| Session | Stored in browser `localStorage` |
| Redirect | Authenticated users go to `/dashboard`; guests hitting app routes go to `/login` |
| Nav gating | Sidebar items change by role; Mgr / SIC / Supervisor also get a **My Employee** section |

**Active demo credentials** (password for all: `nectar2026`):

| Email pattern | Role | Visibility |
|-------|------|--------------------|
| `admin@nectarenviro.com` | Admin | Org-wide — all plants, leave, OT |
| `etp.manager@` / `ro.manager@` / `mee.manager@` | Manager | Plant-scoped roster, leave final approve, OT assign |
| `etp.shift@` / `ro.shift@` / `mee.shift@` | Shift In-Charge | Plant shift coordination + own employee profile |
| `etp.supervisor@` / `ro.supervisor@` / `mee.supervisor@` | Supervisor | Team leave (on-behalf → employee consent) + own profile |
| Staff emails (e.g. `asha.patil@…`) | Employee | Own profile, leave, OT notifications, training |

**Hidden from login UI** (still in code for later demos): HR, Site In-Charge, Safety In-Charge.

**Demo plants:** ETP, RO, MEE — each with 1 Manager + 1 Shift In-Charge + 1 Supervisor + 4 Shift + 1 General employee.

**Leave chain (demo):** Employee self-request → Manager approve/reject. Supervisor on-behalf → `PENDING_EMPLOYEE_CONSENT` → employee Approve/Reject → if approved, Manager decide. HR validation is inactive.

**RBAC helpers** live in `client/lib/rbac.ts` (plant scoping — managers are site-scoped, not org-wide; dual-dashboard helpers; leave/OT gates). Legacy `management` sessions migrate to `manager`.

### Home — `/`

Redirects to `/dashboard` if logged in, otherwise `/login`.

---

## 3. Shell & navigation

All authenticated pages share **AppShell**:

| Feature | Description |
|--------|-------------|
| Collapsible sidebar | Expand/collapse; state persisted in localStorage; auto-collapses on smaller breakpoints |
| Nested menus | Shifts, Leave, OverTime expand to sub-pages |
| Hover submenus | When collapsed, hover opens quick switch to child routes |
| Sticky header | Page title + bell (Notifications) + user menu (My Profile, role, logout) |
| Branding | Nectar Enviro mark + “Ops Console” |

**Sidebar structure (conceptual — filtered by role):**

```text
Dashboard
Employees
Sites                    ← Manager, SIC, Admin (not Supervisor)
Training
Certifications
Shifts                   ← Manager, SIC, Admin (not Supervisor)
  ├── Dashboard
  ├── Shift Master
  ├── Schedule
  ├── Rotation
  ├── Change Requests
  ├── Reliever Allocation
  └── Deviations
Reliever Pool            ← Supervisor, SIC, Manager, Admin
Leave
  ├── Overview
  ├── Requests
  └── Management         ← Manager / Admin only
OverTime
  ├── Overview
  ├── Employees
  ├── Sites
  ├── Analysis & reports
  └── Assign / notify    ← Manager / Admin only
```

**Navbar:** Bell icon opens Notifications (unread badge when present). User menu has My Profile, role label, and Log out.


---

## 4. Core pages

### 4.1 Dashboard — `/dashboard`

**Audience:** All roles (ops snapshot)

| Feature | Description |
|--------|-------------|
| KPI strip | Total employees, active sites, skill coverage %, urgent training count, compliance-ready sites |
| Skill mapping heatmap | Roles × critical skills (ETP, RO, safety, sampling, maintenance, compliance) |
| Urgent training list | Overdue / due-soon items; names link to employee detail |
| Site readiness | Progress by plant (ETP/STP/WTP/RO) with headcount |

---

### 4.2 Employees — `/employees`

| Feature | Description |
|--------|-------------|
| Employee table | Name, role, site, skill score, training status |
| Search / sort / filter | Role and training filters; sortable columns |
| Row / name click | Opens employee detail |
| Links from other modules | Training urgency, OT, leave use the same employee master |

### 4.3 Employee detail — `/employees/[id]`

| Feature | Description |
|--------|-------------|
| Profile | Email, phone, joined date, experience, site, plant type, readiness |
| Skill map | Personal competency bars vs role-critical skills |
| Training | Courses, due dates, scores and status (database), open weak-area flags, and **Flag / assign training** for the Director or the employee's manager |
| Empty / not found | Safe fallback with back navigation |

---

### 4.4 Sites — `/sites`

| Feature | Description |
|--------|-------------|
| Site table | Name, plant type, location, headcount, readiness % |
| Filters / sort | By plant type and readiness |
| Shared master | Used by OT, leave, shifts, and reliever clusters |

---

### 4.5 Training — `/training` (Coursera + Meetup style)

All data comes from the database. The full design is in `docs/TRAINING_REDESIGN_PLAN.md`.

| Route | Who | Feature |
|---|---|---|
| `/training` | Academy roles | **Home**: stats, then shelves of 4 cards plus "Show more": Your manager suggests, Assigned to you, Continue learning, Recommended for you (with the reason), Required for your role, Upcoming events, Popular at your site |
| `/training` | HR / Manager / Director | **Academic Records**: Team progress, Assign & flag (Director and managers), Evaluations, Assessment schedule, LNI matrix, Reports, Mentors & communities (HR and Director) |
| `/training/home` | HR / Manager / Director | Their own learning Home |
| `/training/explore` | Everyone | Catalog search, filters (domain, plant, level, not started) and sort, all kept in the URL |
| `/training/course/[id]` | Everyone | Course page: About, Syllabus, Assessment (4 gates), Events, and Enroll / Resume |
| `/training/learn/[id]` | Learner | Course player: abilities, quizzes, skill map, written test, and on-site practical / oral by the manager |
| `/training/my-learning` | Everyone | In progress, Assigned, Suggested by manager, Completed, Assessment schedule |
| `/training/events`, `/training/events/[id]` | Everyone | Meetup-style events: list or calendar view, RSVP with a waitlist, attendee list (registered people only), discussion, add to calendar |
| `/training/communities/[slug]` | Everyone | Community page: members, events, join / leave |
| `/training/mentor`, `/training/mentor/events/[id]` | Mentors | Mentor Studio: create, edit, repeat, publish, cancel and duplicate events; manage attendees and the waitlist; attendance; announcements; CSV |
| `/training/team` | Supervisor / Shift / Site In-Charge | Their team's progress (view only) |
| `/training/track/[id]` | Everyone | Specialization (client-side mock content, agreed exception) |

---

## 5. Shifts module

**Goal:** Plan shifts **forward** (not only record after attendance), so gaps can be filled before they become OT.

### 5.1 Shift Rotation dashboard — `/shifts`

| Feature | Description |
|--------|-------------|
| Today snapshot | Employees today; counts for A / B / C / General |
| Operational flags | Pending change requests, shift conflicts, uncovered positions |
| Site filter | Scope to one site (auto-locked for site/supervisor roles) |
| Upcoming rotation | Draft/pending rotations (e.g. A → B) with **Activate** after review |
| Conflicts panel | Rest-period and weekly-off conflicts from configurable rules |
| OT by cause | Absence, shift gap, shift deviation, weekly-off coverage, emergency, other |
| Insights | Frequent movers, site deviation hotspots, OT after unplanned changes |

---

### 5.2 Shift Master — `/shifts/master`

**What it’s for:** the **configuration catalog** for how shifts work at Nectar — not day-to-day scheduling. Ops / compliance set the definitions here; Rotation and Schedule consume them.

| Feature | Description |
|--------|-------------|
| Shift definitions | A (Morning), B (Afternoon), C (Night), General — times, hours, breaks |
| Rotation patterns | e.g. Weekly A→B→C; Paired AA BB CC |
| Rest rules | **Configurable** minimum rest hours between shifts (not hard-coded legal advice) |
| Weekly-off config | Day + whether weekly-off OT is enabled |

---

### 5.3 Shift Schedule — `/shifts/schedule`

| Feature | Description |
|--------|-------------|
| Date range filter | Inspect forward and recent planned days |
| Site / employee filters | Narrow the schedule grid |
| Planned vs actual | Shows planned code, actual (when recorded), deviation flag |
| Weekly off | Marked explicitly when a day is configured weekly-off |
| Status | Planned / active / completed |

---

### 5.4 Shift Rotation — `/shifts/rotation`

| Feature | Description |
|--------|-------------|
| Employee rotation table | Demo roster: 4 per plant (A, B, C, Reliever) — current / next shift, effective date, site |
| Active pattern display | Shows which rotation rule is driving next shifts |
| Build monthly schedule | Multi-step drawer: site + month → pattern + roles → editable week grid → conflict check → submit draft |
| Same-month lock | After a month is **active** (published), Shift In-Charge cannot submit another draft for that site + month |
| Drafts pending publish | List of monthly drafts (`pending_manager` → `pending_admin` → `active` / `rejected`) |
| View → decide | Manager and Admin must **View schedule** before Approve / Reject; remark is required |
| Two-step approval | Manager approves (sends to Admin) → Admin approves and publishes onto the live roster |

**Who does what:** Shift In-Charge builds the month. Manager views and approves or rejects with a remark. Admin views and gives final approval (publishes) or rejects. Employees only request one-day changes. Supervisors do not publish the month. Day-by-day result is on **Shifts → Schedule**.

**Conflict check:** Rest-hour and leave-cover issues block submit (`attention`). Weekly-off mismatches are shown as `watch`.

---

### 5.5 Shift Change Requests — `/shifts/change-requests`

| Feature | Description |
|--------|-------------|
| Request list | Employee, date, from→to shift, reason, requester |
| Manpower flag | “No shortage” vs shortage |
| Potential OT | Hours risk if change proceeds without cover |
| Approve / Reject | Site-level decision updates planned schedule when approved (persists in demo browser storage) |

**Workflow:** Supervisor requests → reason + impact → Site / Shift In-Charge decide.

---

### 5.6 Reliever Allocation — `/shifts/reliever-allocation`

**What it’s for:** a **forecasting / planning** view of tomorrow’s (and today’s) manpower gaps **before** someone is already on leave. It answers: “If this rotation runs, where are we short, and who in the pool could cover?” — without running the live assignment flow.

| Feature | Description |
|--------|-------------|
| Gap detection | Per site/shift: required vs available vs absent |
| Pool suggestions | Qualified available relievers from the cluster pool |
| OT risk callout | When no pool match exists |
| Link to Reliever Pool | Live assign / availability management happens on `/reliever-pool` |

**Flow:** Rotation → forecast → gap → suggest reliever → avoid OT.  
**Vs Reliever Pool:** Allocation = plan & suggest; Pool = execute assignment when an absence is open.

---

### 5.7 Shift Deviations — `/shifts/deviations`

| Feature | Description |
|--------|-------------|
| Site aggregates | Deviation count, employees affected, OT hours associated |
| Detail table | Planned vs actual per employee/day |
| OT after changes | Observation metric for unplanned moves |
| Highest OT by shift | A / B / C / General comparison |

---

## 6. Reliever Pool

### Reliever Pool — `/reliever-pool`

**Goal:** Shared backup manpower by **cluster of sites**, not a permanent one-site reliever only.

| Feature | Description |
|--------|-------------|
| Operating model | 3 regular + 1 general + shared reliever slots (per cluster) |
| Flow strip | Absence → local → cluster pool → assign/notify → OT last resort |
| KPIs | Clusters, pool size, available, on assignment, open absences, OT avoided % |
| Cluster filter | Navi Mumbai, Pune–Nashik, Aurangabad, etc. |
| Open absences | Detect gaps; **Find replacement** runs the engine |
| Reliever availability | Available / Assigned / Not available — supervisor toggles |
| Supervisor activity | Timeline of local check → pool check → assign → WhatsApp/SMS log |
| Site manpower table | Headcount, local relievers, open gaps |
| Cluster cards | Sites belonging to each shared pool |

**Replacement engine order:**

1. Local home-site reliever  
2. Cluster pool (skill + plant-type match)  
3. OT as last resort (explicit outcome)

---

## 7. Leave module

**Design principle:**  
Employee requests (or consents) → Supervisor verifies → Shift In-Charge covers the shift → Manager approves → Admin finalizes. Admin may also perform earlier hops. HR validation is not part of this chain.

### 7.1 Leave Overview — `/leave`

| Feature | Description |
|--------|-------------|
| Role-aware KPIs | Management / HR / Site see different metric sets |
| Management view | On leave, unexplained absence, critical shortages, leave→OT risk, long leave |
| HR view | Pending requests, unverified absences, leave without information, overdue closures |
| Site/Supervisor view | Pending at site, on leave today, OT risk, return confirmations needed |
| Recent activity | Latest leave/absence items with entry source (employee vs supervisor-on-behalf) |
| Hierarchy reminder | Short operating model explanation |
| Quick links | New leave, all requests, pending justifications, management |

---

### 7.2 Leave Requests — `/leave/requests`

| Feature | Description |
|--------|-------------|
| Requests table | Employee, site, mode (planned/emergency), dates, entry source, OT risk, status |
| Record leave / absence drawer | Create planned leave or emergency absence |
| Entry source | **Requested by employee** vs **Entered by supervisor on behalf** |
| Emergency path | Supports verbal / low-literacy reporting via supervisor |
| Site scoping | Site/supervisor roles see their site’s employees |

---

### 7.3 Leave detail — `/leave/requests/[id]`

| Feature | Description |
|--------|-------------|
| Full leave profile | Type, dates, balance, supervisor, shift in-charge, reason, communications |
| Leave → shift impact | Day-by-day planned shifts affected (from Shift Rotation) |
| Manpower / OT panel | Current vs required manpower, relievers, nearby workers, potential OT hours & cost |
| Role actions | Employee consent; Supervisor verify; Shift In-Charge arranges replacement; Manager approves; Admin finalizes |
| Return to duty | After Admin approval. On-time return closes the leave and releases the reliever. A late return stays `EXTENSION_REQUIRED` and keeps the reliever until the extension is closed |
| Workflow timeline | Full audit of who did what |

**Planned leave:**  
Employee file → `REQUESTED` → Supervisor verifies → Shift In-Charge covers (`SITE_APPROVED`) → Manager (`MANAGER_APPROVED`) → Admin → `APPROVED` → return `CLOSED`.  
Supervisor on behalf → `PENDING_EMPLOYEE_CONSENT` → employee consent (`REQUESTED`) or reject (`REJECTED`).

**Emergency:**  
`ABSENT` or `SUPERVISOR_RECORDED` → Shift In-Charge covers (`SITE_VERIFIED`) → Manager (`MANAGER_APPROVED`) → Admin → `APPROVED` → `CLOSED`.

Illegal status jumps are rejected. Reject, cancel, and a confirmed return release any reliever reserved for that leave.

---

### 7.4 Pending justifications — `/leave/pending`

| Feature | Description |
|--------|-------------|
| HR follow-up queue | Pending info, unexplained absence, extension required |
| Context columns | Absent since, days, supervisor, site in-charge, last communication |
| Follow up | Opens leave detail for action |

---

### 7.5 Leave · Management — `/leave/management`

| Feature | Description |
|--------|-------------|
| Exception KPIs | Workforce-level leave & shortage signals |
| Site → impact table | On leave / OT risk / unexplained by site |
| Exception drill-down | Employee → site → supervisor → status → OT impact |

Managers approve after the shift is covered; Admin gives the final sign-off. This page is the plant-level view of impact.

---

## 8. OverTime (OT) module

**Goal:** Answer — how much OT, where, who, cost, trend — and export for management.

Shared **filters** across OT pages: date range, year, month, site, department, employee, shift, employee type, OT status (with quick-switch chips).

### 8.1 OT Overview — `/overtime` → `/overtime/overview`

| Feature | Description |
|--------|-------------|
| KPI strip | Total OT hours, OT days (employee-days), unique OT employees, OT cost, avg OT/employee, avg OT/site |
| Highest OT site / employee | Drill links into site/employee OT |
| Monthly OT hours chart | Trend line |
| Site-wise OT chart | Ranking bars |
| OT intelligence | Computed insights (high OT, repeated OT, concentration, increasing OT, shift patterns, absenteeism correlation language) |

---

### 8.2 Employee OT — `/overtime/employees`

| Feature | Description |
|--------|-------------|
| Aggregated table | OT days, hours, cost, avg OT/day, last OT date, status mix |
| Search / sort / filter / export | Excel export of filtered employee OT |
| Detail navigation | Opens employee OT profile |

### 8.3 Employee OT detail — `/overtime/employees/[id]`

| Feature | Description |
|--------|-------------|
| Profile + employment | Site, department, designation, shift, joining, status |
| Period summaries | Current/previous month & year hours, days, cost |
| Trend chart | Monthly / weekly / daily |
| Computed insights | High / repeated / concentration / increasing (from data) |
| OT records table | Individual OT rows with status & reason |

---

### 8.4 Site OT — `/overtime/sites`

| Feature | Description |
|--------|-------------|
| Site roll-up | OT employees, days, hours, cost, avg OT/employee |
| Sort & export | Highest hours/cost/etc. |
| Drill-down | Site OT detail |

### 8.5 Site OT detail — `/overtime/sites/[id]`

| Feature | Description |
|--------|-------------|
| Site summary | Headcount, OT employees, hours, days, cost, averages |
| Department / shift breakdown | Where OT concentrates |
| Monthly trend | Hours + cost |
| Employee breakdown | Who generated OT at the site |

---

### 8.6 OT Analysis — `/overtime/analysis`

| Feature | Description |
|--------|-------------|
| Monthly hours & cost charts | Dual view of volume vs spend |
| Site-wise OT | Comparative bars |
| Status mix | Approved / pending / rejected / paid pie |
| Employee concentration | Top OT contributors |
| By department / shift / reason | Operational cut tables |
| Yearly OT | Cross-year view from available data |
| Heatmap | Month × Site intensity |
| High OT detection | Neutral labels: high, repeated, concentration, site dependency, etc. |

---

### 8.7 OT Reports — `/overtime/reports`

| Feature | Description |
|--------|-------------|
| Filter-respecting exports | Same OT filters drive downloads |
| Formats | Excel, CSV, PDF |
| Report types | Employee OT, Site OT, Monthly, Yearly, Management analysis |
| Filenames | Include period/site when set (e.g. `OT_Employee_Report_September_2026.xlsx`) |
| RBAC | Admin / manager / HR can download OT packs; site & shift roles view OT without download |

**Calculation note:** OT hours/cost come from a **central calculation engine** (shift + attendance rules + rate multipliers + minimum/rounding config), not ad-hoc UI math.

---

## 9. Cross-module flows

### Leave + Shift Rotation

When leave is opened for a date range, the system shows **which planned shifts** are hit (e.g. 26 Sep A, 27 Sep B) and estimates replacement / OT risk. A shift-change approval is refused when that date sits inside an approved or in-flight leave, or when the new shift breaks the configured minimum rest hours.

### Leave / Absence + Reliever Pool

Shift In-Charge opens the leave and chooses who covers it. The list shows available people at the home site first, then the cluster. They can also accept overtime when nobody fits.

A chosen person is marked `assigned` and tied to the leave. Reject, cancel, and an on-time return set them back to `available`. A late return keeps them assigned until the extension is closed.

### Shift gap + Reliever Pool

Uncovered positions on today’s rotation suggest named pool candidates.

### Shift deviation + OT

Deviation reports quantify OT hours associated with unplanned shift changes and feed “OT by cause”.

### Training + Employees

Urgent training on the main dashboard links into the employee master for follow-up.

---

## 10. Route map (quick reference)

| Route | Page |
|-------|------|
| `/login` | Login |
| `/` | Auth redirect |
| `/dashboard` | Ops KPI dashboard |
| `/employees` | Employee list |
| `/employees/[id]` | Employee detail |
| `/sites` | Sites list |
| `/training` | Training / certifications |
| `/shifts` | Shift rotation dashboard |
| `/shifts/master` | Shift & rule master |
| `/shifts/schedule` | Planned schedule |
| `/shifts/rotation` | Rotation board |
| `/shifts/change-requests` | Shift change approvals |
| `/shifts/reliever-allocation` | Gap → reliever suggestions |
| `/shifts/deviations` | Planned vs actual |
| `/reliever-pool` | Dynamic manpower bank |
| `/leave` | Leave overview |
| `/leave/requests` | Leave / absence list + create |
| `/leave/requests/[id]` | Leave detail & actions |
| `/leave/pending` | Pending justifications |
| `/leave/management` | Management exceptions |
| `/overtime/overview` | OT management overview |
| `/overtime/employees` | Employee OT |
| `/overtime/employees/[id]` | Employee OT detail |
| `/overtime/sites` | Site OT |
| `/overtime/sites/[id]` | Site OT detail |
| `/overtime/analysis` | OT analysis & heatmap |
| `/overtime/reports` | Downloadable OT reports |
| `/overtime/assign` | Manager OT assign / notify |
| `/notifications` | Employee inbox (leave consent, OT) |

---

## Notes for stakeholders

- **Data today** is rich **mock / demo** data shaped for Nectar Enviro O&M (**ETP / RO / MEE** demo plants), ready to swap for live attendance, payroll, and HR APIs.
- **OT is last resort** in the product story: plan shifts → detect gaps → use relievers → only then OT.
- **Literacy-friendly leave:** supervisors can enter absences on behalf of workers; the employee must consent before a supervisor verifies the request. Shift In-Charge covers the shift, the plant Manager approves, then Admin finalizes.
- **Configurable rules** (rest hours, OT minimums/rounding, leave policy gates) are designed so compliance can own thresholds without hard-coding one legal interpretation into the UI.

---

*Document version: aligned with the current Nectar Dashboard client app structure.*  
*Brand reference: [nectarenviro.com](https://www.nectarenviro.com/)*
