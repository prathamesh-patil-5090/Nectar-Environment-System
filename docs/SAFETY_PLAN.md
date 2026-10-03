# Safety Section — Implementation Plan

Source: handwritten requirement notes (4 pages, refined 27/09/2026).  
Merged plan (Aniket + Prathamesh), checked against the code after merge `e24c79d` (03/10/2026). Fits the **current** employee + leave + OT + shift stack (client localStorage engines + Nest/Mongoose sync). `safety_incharge` already exists in `client/lib/auth.ts`, `client/lib/rbac.ts` and `server/db/seeds/users.seed.ts`.

## Implementation status (03/10/2026)

All phases 0–7 are built and tested. Where the build differs from the plan below, **this section wins**.

| Phase | Status |
|---|---|
| 0 Types, RBAC, nav, seed | Done. Seed has protocols + Safety In-Charge person only — **no fake incidents** (log holds real reports). `npm run seed:safety` is upsert-only, never deletes |
| 1 Report, history, detail, transitions | Done (client + server) |
| 2 Notifications, emergency banner, reminders | Done |
| 3 Leave / OT / cover gates | Done |
| 4 Media, call, PDF | Done |
| 5 Breakdowns + OT decision link | Done |
| 6 Protocols + training filter | Done |
| 7 Dashboard + Sites widgets | Done (Sites **list** column — there is no `/sites/[id]` page) |

**Deviations from the plan (and why):**

- **Notification schema unchanged.** Server notifications already address non-employees as `user:<login email>` (same as training). Director / Safety In-charge are resolved from the `leaders` collection; HR / site leads from `employees.employeeCategory`. No `recipientRole` field needed.
- **Safety In-charge person record** added to `leaders` (`user:safety@nectarenviro.com`) — it did not exist in the DB.
- **No new dependencies.** Reminders run in-process (`SafetyScheduler`, like training `EventsScheduler`, every 5 min; disable with `SAFETY_SCHEDULER=off`). Uploads use Nest's built-in multer interceptor; files in `server/uploads/safety/` (git-ignored), served by `GET /api/safety/media/:eventId/:file`.
- **Store is API-first**, not localStorage-first: writes go to the API, the cache is refreshed from the response. The cache exists only so the leave / OT gates can read it synchronously.
- **Shared rules file**: `client/lib/safety/rules.ts` and `server/src/modules/safety/safety-rules.ts` are identical (test enforces it) — role table, status machine, clearance and reminder rules cannot drift.
- **Director can also acknowledge / investigate** (plan table listed only safety / manager / site in-charge).
- **OT / cover "soft-block"**: people in an open high/critical incident are left out of automatic cover candidates and OT proposals; manual Assign OT shows a warning and needs confirmation (override is noted on the assignment).
- **Emergency recipients** = everyone active at the site (superset of "rostered today", safer for emergencies).
- **Breakdown OT** creates its own OT decision (`createBreakdownOtDecision`) instead of `ensurePendingOtDecision`, which would merge with an unrelated leave-cover decision on the same date.
- **Auth caveat (pre-existing):** the API has no authentication; the server checks the `actor` role + site sent by the client. Real auth is needed before production.

**Tests:** `client/lib/safety/safety.test.ts` (17 — rules parity, status machine, every demo login × every action, site scoping, leave-return gate, cover exclusion, reminders, KPIs); existing 61 client tests unchanged (RBAC snapshot only gained the new Safety checks). Browser flow `client/e2e/safety-flow.mjs` runs every role end to end against the **test DB** (`nectar_enviro_test`) — see its header for the commands.

## Table of contents

1. [Requirements from the notes](#1-requirements-from-the-notes)
2. [Fit with the current system](#2-fit-with-the-current-system)
3. [Data model](#3-data-model)
4. [Leave ↔ Safety integration](#4-leave--safety-integration)
5. [Integration rules — nothing breaks](#5-integration-rules--nothing-breaks)
6. [Files to add or change](#6-files-to-add-or-change)
7. [Permissions](#7-permissions)
8. [Notifications and "notify until solved"](#8-notifications-and-notify-until-solved)
9. [Media, meet calls, reports](#9-media-meet-calls-reports)
10. [Delivery phases](#10-delivery-phases)
11. [Related items from the same notes](#11-related-items-from-the-same-notes-separate-track)
12. [Open questions for the client](#12-open-questions-for-the-client)

---

## 1. Requirements from the notes

| Notes | Requirement |
|---|---|
| p3 | **Incidents (on-site safety).** A Manager raises the incident. It records who informed, who it happened to, the site in-charge, HR, Manager, Safety In-charge and Director. Categories include first aid, fatal, death and plant problem. **The complaint stays open and keeps notifying people until it is solved.** |
| p3 | **Near-misses.** Reported by someone other than the person at risk (e.g. Emp 2 stops Emp 1 walking towards an open plant cap with no sign board). |
| p2 | Photo/video upload, meet calling, **emergency alert to every assigned person**, detailed report making. |
| p2 | Sections: incident & near-miss history, emergency protocols, and **breakdowns** — why the plant isn't working, when it broke, what broke, how, how many people worked OT to fix it, how many days it took. |
| p4 | A safety protocol page, safety training module, every incident (big or small) stored and **visible to all**. |
| p1, p2, p4 | Not safety, but on the same pages: shift attendance automation, 6‑month certificates, assessment delegation. See §11. |

---

## 2. Fit with the current system

Safety is a **sibling module** to leave (same architecture), not a rewrite of leave. Leave today is an **ops coverage pipeline**; return is ops close only. This plan reuses those patterns and adds explicit hooks so Safety and leave do not drift apart.

### What we reuse as-is

| Current piece | Path / behaviour | Safety use |
|---|---|---|
| Emp identity + hierarchy | `employee.schema` / `employee.types` — `id`, `siteId`, `managerId`, `shiftInChargeId`, `supervisorId`, `trainingStatus` | People pickers, stakeholders, soft training flags |
| Sites | `s-etp` / `s-ro` / `s-mee`, plant managers | Scope lists; auto-fill site manager |
| Leave state machine | `client/lib/leave/store.ts` + `server/src/modules/leaves/leave-transitions.ts` | Copy pattern for Safety transitions |
| Leave store + API sync | localStorage cache + fire-and-forget Nest | Same for `client/lib/safety/store.ts` |
| Leave return | `confirmReturn()` in `client/lib/leave/store.ts`; wrapped by `confirmReturnLifecycle()` in `client/lib/leave-lifecycle/engine.ts` | Clearance gate goes in `confirmReturn()` so **both** paths are covered (§5) |
| Leave lifecycle | `client/lib/leave-lifecycle/` — due / early / late return, cover disruption | Show "clearance pending" on due-return cases |
| Cover candidates | `client/lib/shift-impact/candidates.ts` → `rankCoverCandidates()` | Flag / push down people involved in an open critical incident |
| OT acceptance gate | `client/lib/ot-decision/gates.ts` → `assertCanAcceptOt()` | Soft-block OT for people in an open critical incident |
| Manpower gates | `client/lib/manpower-conflict/gates.ts` — site-approve leave + publish rotation only | No change needed for Safety |
| OT decision | `client/lib/ot-decision/` — `OtDecisionTrigger` = `leave_cover \| roster_vacancy \| rotation_publish \| manual_assign` | Add `breakdown_repair`; breakdown `otEntries[]` link to decisions |
| Shift roster | `client/lib/shift/store.ts` | Emergency recipients = rostered at site today |
| Reliever release on return | `confirmReturnLifecycle` → `clearCoverDisruptions` when `CLOSED` | Clearance gate runs **before** this, so cover is never released early |
| Notifications (server) | `server/src/modules/notifications/` — `NotificationsService.notify / notifyMany`, exported | Reuse for every safety alert; schema needs the recipient fix in §8 |
| Training | `/training`, courses, certs | `/safety/training` = filter to Safety track (no new engine) |
| RBAC | `client/lib/rbac.ts` — `canViewAllSites` already includes `safety_incharge` | New `// ── Safety` block |
| Safety In-charge login | Already in `DEMO_USERS` (`safety@nectarenviro.com`) and `users.seed.ts`, **hidden from the login UI** | Unhide it for QA — no new user |
| PDF export | `jspdf` + `jspdf-autotable` already in client (OT reports) | Same for incident report |
| Final sign-off pattern | Leave finalize = **Director only** | Safety **Close** = Safety In-charge *or* Director |

### What leave does **not** do today (gaps this plan closes only where we wire §4)

- No fit-to-work / medical / safety clearance on return.
- No Safety In-charge step on any leave transition.
- `trainingStatus` is unused by leave create/return.
- Sick leave is a balance type only — not linked to incidents.
- Notifications are `employeeId`-keyed (client `AppNotification` **and** server `notification.schema.ts`, where it is `required`). Director / HR / Safety In-charge have **no** `employeeId`.

### Architecture rule

| Layer | Responsibility |
|---|---|
| Client engines + stores | UX, transitions, soft-blocks. localStorage is an **offline cache of API data only** |
| Nest schemas + CRUD | Persist `SafetyEvent` / `SafetyProtocol`; reject illegal transitions; backstop the leave clearance gate |
| Nest scheduler | Repeat "notify until solved" (new; leave has no cron today) |
| Data source | **DB only.** Demo data lives in `server/db/seeds/` — no hard-coded safety data in the client, no `mock-data.ts` imports in safety code |

Keep parity: don't put Safety business rules only on the server while leave stays client-led.

---

## 3. Data model

Shared between client (`client/lib/safety/types.ts`) and server (`server/db/schemas/`).

### `SafetyEvent`

One collection, discriminated by `type: "incident" | "near_miss" | "breakdown"`.

- `id, siteId, title, description, location, occurredAt, reportedAt`
- `category`: `first_aid | medical | lost_time | fatal | plant_problem | fire | chemical | electrical | other`
- `severity`: `low | medium | high | critical` (fatal is always critical)
- `reportedBy {id, name, role}` — `id` is the employee id, or the user email for roles with no `employeeId` (director / HR / safety)
- `informedBy[]` — employee ids
- `involved[]` — employee ids
- `stakeholders[]` — auto-filled from site hierarchy + org roles (site in-charge, manager, HR, safety in-charge, director); editable
- `media[] {id, url, kind: "image" | "video", uploadedBy, at}` — URLs only, never file data
- `status`: `REPORTED → ACKNOWLEDGED → INVESTIGATING → ACTION_PENDING → RESOLVED → CLOSED`, plus `REOPENED`
- `rootCause`, `correctiveActions[] {text, ownerId, dueDate, done}`
- `timeline[]` — audit trail (status, comment, call, notification)
- `isEmergency`, `meetLink`, `lastNotifiedAt`, `notifyCount`
- `promotedFrom?` — near-miss escalated to incident

**Cross-links to current modules:**

- `linkedLeaveIds[]` — leave requests opened/linked for involved people (esp. sick / lost_time)
- `requiresReturnClearance` — default `true` when `category` ∈ `medical | lost_time | fatal` or severity ≥ `high`
- `clearance[] { employeeId, status: "pending" | "cleared" | "waived", clearedBy, at, remark }`
- `otDecisionIds[]` — OT decision records created for repair work

**Breakdown extension:**

- `equipment, whatFailed, why, how`
- `failedAt, restoredAt` → computed `downtimeDays`
- `otEntries[] {employeeId, hours, otDecisionId?}` → headcount + OT man-hours

### `SafetyProtocol`

- `id, title, category, steps[], emergencyContacts[]`
- `siteIds[]` or all sites
- `version, updatedBy, updatedAt`

### Employee / leave field additions (minimal, all optional)

| Where | Field | Why |
|---|---|---|
| Leave request | `safetyClearance?: { eventId?, status, clearedBy?, at? }` | Gate `CLOSED` when required |
| Leave request | `linkedSafetyEventIds?: string[]` | Trace sick/LTA ↔ incident |
| Employee | keep using existing `trainingStatus` | Soft-warn on clearance if `overdue` |

All new leave fields are **optional** so existing leave documents and seeds stay valid without migration. Do **not** invent a parallel employee roster — always resolve people via existing employee ids (`emp0123`… seeded).

---

## 4. Leave ↔ Safety integration

Keep leave's approval chain unchanged. Add **soft then hard** gates only at return / re-entry — same style as the existing extension soft-block in `confirmReturn` (Manager remark / ack).

### Triggers

| Event | Behaviour |
|---|---|
| Safety incident created with `involved[]` + `medical` / `lost_time` / `fatal` | Prompt Manager to open/link **sick** (or appropriate) leave if none covers today; set `requiresReturnClearance` |
| `confirmReturn` (direct or via lifecycle) | If clearance pending for that `employeeId` on a linked event → **throw** before status becomes `CLOSED`, until Safety In-charge / Manager clears (or Director waives with remark) |
| Clearance granted | Existing `confirmReturn` path runs unchanged; then `clearCoverDisruptions` releases cover as today |
| Open `critical` incident involving employee | `assertCanAcceptOt` soft-block + `rankCoverCandidates` flag: don't assign that person OT or cover until incident `RESOLVED` (ack + remark to override) |
| Breakdown OT | Create OT via `ot-decision` with trigger `breakdown_repair`; store `otDecisionId` on `otEntries[]` |

### Who clears return

| Role | Can clear? |
|---|---|
| safety_incharge | Yes (primary) |
| manager (site) | Yes for non-fatal / non-critical |
| director | Yes + waive |
| supervisor / shift / site in-charge | Confirm return ops only — **cannot** clear medical/lost_time without Safety / Manager |

Ops roles confirm presence; Safety owns fitness for duty when `requiresReturnClearance`.

### Lifecycle UI

- `/leave/lifecycle` and leave detail: banner "Safety clearance pending" with link to `/safety/incidents/[id]`.
- `/safety/incidents/[id]`: "Linked leave" chips → `/leave/requests/[id]`.

---

## 5. Integration rules — nothing breaks

These rules keep existing leave / OT / shift behaviour and tests unchanged while Safety is wired in.

1. **One gate, in the right place.** Put the clearance check inside `confirmReturn()` in `client/lib/leave/store.ts`. `confirmReturnLifecycle()` calls it, so both paths are covered. Throw a plain `Error` with a readable message, the same way the extension soft-block does; check every `confirmReturn` / `confirmReturnLifecycle` call site surfaces the message (toast) rather than crashing.
2. **No-op by default.** The gate only fires when a safety event is **linked** to that employee and has `requiresReturnClearance` with a `pending` entry. With no safety data, every existing leave flow behaves exactly as now — `logic-baseline.test.ts` snapshots, `leave-lifecycle.test.ts`, `ot-decision.test.ts` and `shift-impact.test.ts` must pass unchanged.
3. **No circular imports.** `client/lib/safety/gates.ts` is pure: it reads only the safety store and takes ids as input. Leave / OT / shift-impact import from safety — **safety never imports `leave/store`**. Linking leave ↔ event stores ids only.
4. **Extending `OtDecisionTrigger` is safe.** It is only used as string values today (`leave/store.ts`, `ot-decision/engine.ts`, `ot-decision/store.ts`, leave detail page, tests) — no exhaustive `Record`/`switch`. Add `breakdown_repair` to the union and to any UI label map; run `tsc` to confirm.
5. **Notification schema change is additive.** `employeeId` becomes optional and `recipientUserId?` / `recipientRole?` are added, with a validator requiring **at least one**. Existing `findForEmployee` / `markAllRead(employeeId)` keep working; add `findForUser` / `findForRole`. On the client, every `n.employeeId` read must handle `undefined`.
6. **Server backstop for leave close.** In `leaves.service.ts` status update, when target is `CLOSED`, check for pending clearance and return `409` with the same message. Because leave sync is fire-and-forget, on a rejected sync the client must **re-hydrate leaves** (`syncLeavesWithApi`) so local state doesn't drift from the DB.
7. **Hydration isolation.** Add `syncSafetyWithApi()` to the `Promise.allSettled` list in `client/lib/sync.ts`; a safety API failure must not block leave / training / reliever hydration.
8. **Module wiring.** `SafetyModule` imports `NotificationsModule` (already exports `NotificationsService`) and the Mongoose models it reads (leave requests, employees, shift roster). `ScheduleModule.forRoot()` goes in `app.module.ts` once.
9. **New dependencies.** Server: `@nestjs/schedule`; `@types/multer` (dev) — multer itself ships with `@nestjs/platform-express`. Client: none (`jspdf`, `jspdf-autotable` already present).
10. **Storage limits.** Media never goes to localStorage — only URLs. Use `persistJson` (quota-safe) from `client/lib/storage.ts` for the safety cache.

---

## 6. Files to add or change

### Client

| File | Change |
|---|---|
| `client/lib/safety/types.ts` | Types from §3 |
| `client/lib/safety/store.ts` | API-backed store, localStorage cache via `persistJson`, `syncSafetyWithApi()` (leave store pattern) |
| `client/lib/safety/transitions.ts` | Status map; reject illegal jumps |
| `client/lib/safety/recipients.ts` | Resolve notify list (§8); site hierarchy + roster |
| `client/lib/safety/gates.ts` | Pure: `pendingClearanceFor(employeeId)`, `assertSafetyClearance(leave)`, `isInOpenCriticalIncident(employeeId)` |
| `client/lib/api/safety.ts` | API calls |
| `client/lib/leave/store.ts` | `confirmReturn` calls `assertSafetyClearance`; link helpers; optional new fields |
| `client/lib/leave-lifecycle/*` | Surface "clearance pending" on due-return cases |
| `client/lib/ot-decision/types.ts` | Add `breakdown_repair` to `OtDecisionTrigger` |
| `client/lib/ot-decision/gates.ts` | `assertCanAcceptOt` soft-block for open critical incident |
| `client/lib/shift-impact/candidates.ts` | `rankCoverCandidates` flags / pushes down people in open critical incident |
| `client/lib/sync.ts` | Add `syncSafetyWithApi` to hydration |
| `client/lib/rbac.ts` | `// ── Safety` block (§7) |
| `client/lib/notifications.ts` | Safety kinds; `employeeId` optional; `recipientRole?` / `recipientUserId?` |
| `client/app/login/page.tsx` (or wherever the demo list is filtered) | Unhide the existing Safety In-charge login |
| `client/components/AppShell.tsx` | **Safety** submenu (all roles can view) |
| `client/components/safety/*` | ReportWizard, EventTimeline, PeoplePicker (site-scoped, searchable — sites have 2–60 people), MediaUploader, SeverityTag, BreakdownPanel, ClearancePanel |

### Routes — `client/app/(app)/safety/…`

| Route | Purpose |
|---|---|
| `/safety` | Overview: open items, days since last LTI per site, near-miss trend, active breakdowns, pending clearances |
| `/safety/report` | Wizard: type → details → people → media → emergency → submit |
| `/safety/incidents` | History; filters site / type / severity / status / date |
| `/safety/incidents/[id]` | Detail + timeline + clearance + linked leave + call + PDF |
| `/safety/breakdowns` | Downtime + OT man-hours |
| `/safety/breakdowns/[id]` | Breakdown detail |
| `/safety/protocols` | Readable by all; edit Safety In-charge + Director |
| `/safety/training` | Link `/training` filtered to Safety track |

### Server

| File | Change |
|---|---|
| `server/db/schemas/safety-event.schema.ts` | `SafetyEvent` |
| `server/db/schemas/safety-protocol.schema.ts` | `SafetyProtocol` |
| `server/db/schemas/leave-request.schema.ts` | Optional `safetyClearance`, `linkedSafetyEventIds` |
| `server/db/schemas/notification.schema.ts` | `employeeId` optional; `recipientUserId?`, `recipientRole?`; at-least-one validator; indexes |
| `server/db/seeds/safety.seed.ts` | Incidents / near-misses / breakdowns / protocols **linked to seeded emp + leave ids**; register in `seeds/index.ts` |
| `server/src/modules/safety/*` | Module, controller, service, `safety-transitions.ts`, `safety-reminder.scheduler.ts`, media upload |
| `server/src/modules/leaves/leaves.service.ts` | `CLOSED` backstop → 409 when clearance pending |
| `server/src/modules/notifications/*` | `findForUser` / `findForRole`; controller routes |
| `server/src/app.module.ts` | Register `SafetyModule` + `ScheduleModule.forRoot()` |
| `server/package.json` | `@nestjs/schedule`, `@types/multer` (dev) |

---

## 7. Permissions

Updated 03/10/2026 per the client: **only the plant manager raises safety concerns**, and **only the Director closes a case**.
Plant roles are site-scoped; director / hr / safety_incharge are org-wide.

| Action | Roles |
|---|---|
| View safety section, history, protocols | **All** |
| Raise a safety concern — near miss, first aid, medical, lost-time, fatal injury, death | **Plant manager only**, for their own site |
| Log a plant breakdown (operations / OT) | manager, director, safety_incharge, site_incharge, shift_incharge |
| Acknowledge / investigate / corrective actions | everyone responsible: manager, supervisor, shift_incharge, hr, safety_incharge, director (site_incharge too) |
| Mark solved | safety_incharge, manager, director — the case **stays open** |
| Close / reopen | **Director only** — a case is finished only when the Director closes it |
| Grant return clearance (non-critical) | safety_incharge, manager, director |
| Grant / waive clearance (critical / fatal) | safety_incharge, director (waive: director) |
| Edit protocols | safety_incharge, director |
| Call a safety meeting | manager, director, safety_incharge, site_incharge, shift_incharge |
| Emergency broadcast | The manager, when raising with `isEmergency` |

**People on a concern**

- **Employee 1** — it happened (or nearly happened) to them → `involved` (exactly one)
- **Employee 2** — saw it / prevented it → `informedBy` (optional, someone else)
- **Manager** — raises it → `reportedBy`
- **Responsible** — the site supervisor and shift in-charge, HR, the Director and the Safety In-charge → `stakeholders`

**Meeting no-shows:** everyone called to the case's safety meeting who has not joined is reminded every 4 hours
(`MEETING_NUDGE_MS`) until they join or the Director closes the case — in-app now; email and WhatsApp are coming soon.

---

## 8. Notifications and "notify until solved"

- **Recipients** (`recipients.ts`): involved, informedBy, site manager + site/shift in-charge from employee/site graph, safety_incharge, HR, Director. Emergency: union with **today's roster** at `siteId` from shift store.
- **Must fix first (current gap):** Director / HR / Safety In-charge have no `employeeId`, and the server schema has `employeeId` as `required` — a safety alert to them would fail validation. Apply the additive schema change in §5 rule 5 before sending any role-targeted alert.
- **Send server-side** through `NotificationsService.notifyMany()` so alerts land in the DB, not just one browser.
- **Repeat reminders** (`@nestjs/schedule` — new infra): while status ∉ `RESOLVED | CLOSED`:

  | Severity | Re-notify every |
  |---|---|
  | critical | 1 h |
  | high | 4 h |
  | medium / low | 24 h |

  Increment `notifyCount`; after N reminders escalate to Director. Client offline fallback: compute overdue on hydrate (same spirit as leave lifecycle due-return).
- **Emergency:** pinned AppShell banner until each recipient acknowledges.
- **Clearance pending:** notify safety_incharge + site manager when leave return is attempted or lifecycle marks due-return.

---

## 9. Media, meet calls, reports

- **Upload:** images ~10 MB (client compress), video ~50 MB. Disk behind a storage interface (S3/GridFS later). No localStorage media.
- **Meet:** phase 1 Jitsi `meet.jit.si/neipl-safety-<id>`; log on timeline. Later: meetings module / Google Meet.
- **Report PDF:** `jspdf` + `jspdf-autotable`, same approach as OT report export.

---

## 10. Delivery phases

| # | Phase | Done when |
|---|---|---|
| 0 | Types, RBAC, nav, DB seed (2–3 events per site, **real emp ids**; optional linked leave); unhide Safety login | Safety menu + seeded data render from API |
| 1 | Report wizard, history, detail, transitions (client + server) | Near-miss → incident; illegal transitions rejected on both sides |
| 2 | Notification schema fix, recipients, role-targeted alerts, emergency banner, reminder cron | Director/HR/Safety receive alerts; critical re-notifies; banner clears on ack |
| 3 | **Leave/lifecycle gates** — clearance in `confirmReturn`, server backstop, linked leave, lifecycle banners, OT/cover soft-blocks | Cannot `CLOSED` sick/LTA return while clearance pending; existing tests unchanged |
| 4 | Media, meet link, PDF | Attach + play + download |
| 5 | Breakdowns + OT decision cross-link (`breakdown_repair`) | Downtime + OT hours on breakdown and site OT |
| 6 | Protocols + Safety training track filter | Editable protocols; filtered courses |
| 7 | Dashboard / Sites widgets (days since LTI, open items, pending clearances); update `PAGES_AND_FEATURES.md` | KPIs on `/dashboard` and `/sites/[id]` |

Phases 0–1 need no new infra. Phase 2 needs the scheduler + notification schema fix. Phase 3 is the **emp/leave alignment** slice — ship before treating Safety as "done" for plant ops.

**Tests:**

- Unit: safety transitions; recipient resolver; reminder intervals; clearance gate (blocks when linked + pending, **no-op when nothing linked**); OT soft-block.
- Regression: `logic-baseline.test.ts`, `leave-lifecycle.test.ts`, `ot-decision.test.ts`, `manpower-conflict.test.ts`, `shift-impact.test.ts` pass with no snapshot changes.
- e2e: near-miss → promote → link leave → clear → close leave → close incident.

---

## 11. Related items from the same notes (separate track)

- **Shift attendance automation** (p1, p2): planned roster (1–2 months ahead, by Manager / Shift In-charge) vs actual; daily auto-fill from schedule when manual input is empty, marked `source: "auto"`; edit windows 12 h manual / 18 h auto, then lock. Touches `client/lib/shift/store.ts` + deviations. Coordinate with Safety emergency roster lookups so "who was on shift" stays accurate.
- **Certificates:** `validityMonths: 12 | 6` on courses (today hard-coded ~1 year). 6‑month → "Renew via quick test". Clearance may soft-warn if Safety cert `overdue`.
- **Assessment delegation:** Director → Manager assessors; Manager delegates to HR / Site In-charge (`delegatedFrom` chain).

---

## 12. Open questions for the client

1. **"Visible to all" vs sensitive cases** — redact names on fatal/death for employees, or full visibility?
2. **Reminder intervals / escalation N** — are §8 numbers OK?
3. **Meet calling** — Jitsi OK, or Google Meet / Teams required?
4. **Video storage** — on-prem vs cloud; retention?
5. **Clearance strictness** — hard-block return for all `sick` leaves, or only when a linked Safety event sets `requiresReturnClearance`? *(Recommendation: only when linked / category requires it — avoid blocking every casual sick day.)*
6. **Waive policy** — Director-only waive with mandatory remark (recommended; mirrors leave extension remark)?

**Resolved from current system (no longer blocking):**

- Who raises incidents on night shift → **include shift/site in-charge** (§7).
- Final Safety close → **safety_incharge or director** (leave finalize stays director-only; Safety close is broader).
- People model → **existing employee ids + site hierarchy**, not a new staff directory.
- OT on breakdowns → **ot-decision module**, not a parallel OT ledger.
- Safety In-charge login → **already exists**; only needs unhiding on the login page.
