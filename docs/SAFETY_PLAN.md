# Safety Section — Implementation Plan

Source: handwritten requirement notes (4 pages, refined 27/09/2026).  
Updated to fit the **current** employee + leave + OT + shift stack (client localStorage engines + Nest/Mongoose sync). `safety_incharge` already exists in `client/lib/auth.ts` / RBAC.

## Table of contents

1. [Requirements from the notes](#1-requirements-from-the-notes)
2. [Fit with the current system](#2-fit-with-the-current-system)
3. [Data model](#3-data-model)
4. [Leave ↔ Safety integration](#4-leave--safety-integration)
5. [Files to add or change](#5-files-to-add-or-change)
6. [Permissions](#6-permissions)
7. [Notifications and "notify until solved"](#7-notifications-and-notify-until-solved)
8. [Media, meet calls, reports](#8-media-meet-calls-reports)
9. [Delivery phases](#9-delivery-phases)
10. [Related items from the same notes](#10-related-items-from-the-same-notes-separate-track)
11. [Open questions for the client](#11-open-questions-for-the-client)

---

## 1. Requirements from the notes

| Notes | Requirement |
|---|---|
| p3 | **Incidents (on-site safety).** A Manager raises the incident. It records who informed, who it happened to, the site in-charge, HR, Manager, Safety In-charge and Director. Categories include first aid, fatal, death and plant problem. **The complaint stays open and keeps notifying people until it is solved.** |
| p3 | **Near-misses.** Reported by someone other than the person at risk (e.g. Emp 2 stops Emp 1 walking towards an open plant cap with no sign board). |
| p2 | Photo/video upload, meet calling, **emergency alert to every assigned person**, detailed report making. |
| p2 | Sections: incident & near-miss history, emergency protocols, and **breakdowns** — why the plant isn't working, when it broke, what broke, how, how many people worked OT to fix it, how many days it took. |
| p4 | A safety protocol page, safety training module, every incident (big or small) stored and **visible to all**. |
| p1, p2, p4 | Not safety, but on the same pages: shift attendance automation, 6‑month certificates, assessment delegation. See §10. |

---

## 2. Fit with the current system

Safety is a **sibling module** to leave (same architecture), not a rewrite of leave. Leave today is an **ops coverage pipeline**; return is ops close only. This plan reuses those patterns and adds explicit hooks so Safety and leave do not drift apart.

### What we reuse as-is

| Current piece | Path / behaviour | Safety use |
|---|---|---|
| Emp identity + hierarchy | `employee.schema` / `employee.types` — `id`, `siteId`, `managerId`, `shiftInChargeId`, `supervisorId`, `trainingStatus` | People pickers, stakeholders, soft training flags |
| Sites | `s-etp` / `s-ro` / `s-mee`, plant managers | Scope lists; auto-fill site manager |
| Leave state machine | `client/lib/leave/store.ts` + `server/.../leave-transitions.ts` | Copy pattern for Safety transitions |
| Leave store + API sync | localStorage + fire-and-forget Nest | Same for `client/lib/safety/store.ts` |
| Leave lifecycle | `client/lib/leave-lifecycle/` — due / early / late return, cover disruption | Soft-block return when clearance required |
| Manpower / cover gates | `client/lib/manpower-conflict/` | Soft-block OT / re-roster if open critical incident involves the person |
| OT decision | `client/lib/ot-decision/` — triggers include `leave_cover` | Breakdown `otEntries[]` + optional trigger `breakdown_repair` |
| Shift roster | `client/lib/shift/store.ts` | Emergency recipients = rostered at site today |
| Reliever release on return | `confirmReturn` releases cover | Clearance gate **before** cover release when required |
| Training | `/training`, courses, certs | `/safety/training` = filter to Safety track (no new engine) |
| RBAC | `client/lib/rbac.ts` — org-wide for director / hr / **safety_incharge** | New `// ── Safety` block |
| Demo users | `DEMO_USERS` + Mongo `users` (`nectar2026`) | Seed a visible Safety In-charge login if not already on login UI |
| Final sign-off pattern | Leave finalize = **Director only** | Safety **Close** = Safety In-charge *or* Director (mirror leave Q) |

### What leave does **not** do today (gaps this plan closes only where we wire §4)

- No fit-to-work / medical / safety clearance on return.
- No Safety In-charge step on any leave transition.
- `trainingStatus` is unused by leave create/return.
- Sick leave is a balance type only — not linked to incidents.
- `AppNotification` is `employeeId`-keyed; Director / HR / Safety In-charge often have **no** `employeeId`.

### Architecture rule

| Layer | Responsibility |
|---|---|
| Client engines + stores | UX, transitions, soft-blocks, seed demos (same as leave / OT / lifecycle) |
| Nest schemas + CRUD | Persist `SafetyEvent` / `SafetyProtocol`; reject illegal transitions |
| Nest scheduler | Repeat “notify until solved” (new; leave has no cron today) |
| Do **not** put Safety business rules only on the server while leave stays client-led — keep parity |

---

## 3. Data model

Shared between client (`client/lib/safety/types.ts`) and server (`server/db/schemas/`).

### `SafetyEvent`

One collection, discriminated by `type: "incident" | "near_miss" | "breakdown"`.

- `id, siteId, title, description, location, occurredAt, reportedAt`
- `category`: `first_aid | medical | lost_time | fatal | plant_problem | fire | chemical | electrical | other`
- `severity`: `low | medium | high | critical` (fatal is always critical)
- `reportedBy {id, name, role}` — `id` is demo user / employee id when available
- `informedBy[]` — employee ids
- `involved[]` — employee ids
- `stakeholders[]` — auto-filled from site hierarchy + org roles (site in-charge, manager, HR, safety in-charge, director); editable
- `media[] {id, url, kind: "image" | "video", uploadedBy, at}`
- `status`: `REPORTED → ACKNOWLEDGED → INVESTIGATING → ACTION_PENDING → RESOLVED → CLOSED`, plus `REOPENED`
- `rootCause`, `correctiveActions[] {text, ownerId, dueDate, done}`
- `timeline[]` — audit trail (status, comment, call, notification)
- `isEmergency`, `meetLink`, `lastNotifiedAt`, `notifyCount`
- `promotedFrom?` — near-miss escalated to incident

**Cross-links to current modules (new vs original notes):**

- `linkedLeaveIds[]` — leave requests opened/linked for involved people (esp. sick / lost_time)
- `requiresReturnClearance` — default `true` when `category` ∈ `medical | lost_time | fatal` or severity ≥ `high`
- `clearance[] { employeeId, status: "pending" \| "cleared" \| "waived", clearedBy, at, remark }`
- `otDecisionIds[]` / breakdown `otEntries[]` — link to OT decision records when repair OT is assigned

**Breakdown extension:**

- `equipment, whatFailed, why, how`
- `failedAt, restoredAt` → computed `downtimeDays`
- `otEntries[] {employeeId, hours, otDecisionId?}` → headcount + OT man-hours

### `SafetyProtocol`

- `id, title, category, steps[], emergencyContacts[]`
- `siteIds[]` or all sites
- `version, updatedBy, updatedAt`

### Employee / leave field additions (minimal)

| Where | Field | Why |
|---|---|---|
| Leave request | `safetyClearance?: { eventId?, status, clearedBy?, at? }` | Gate `CLOSED` when required |
| Leave request | `linkedSafetyEventIds?: string[]` | Trace sick/LTA ↔ incident |
| Employee (optional later) | keep using existing `trainingStatus` | Soft-warn on clearance if `overdue` |

Do **not** invent a parallel employee roster — always resolve people via existing employee ids (`emp0123`… seeded).

---

## 4. Leave ↔ Safety integration

Keep leave’s approval chain unchanged. Add **soft then hard** gates only at return / re-entry — same soft-block style as manpower / OT (Manager remark / ack where appropriate).

### Triggers

| Event | Behaviour |
|---|---|
| Safety incident created with `involved[]` + `medical` / `lost_time` / `fatal` | Prompt Manager to open/link **sick** (or appropriate) leave if none covers today; set `requiresReturnClearance` |
| Leave `confirmReturn` / lifecycle due-return | If open clearance pending for that `employeeId` → **block** `CLOSED` until Safety In-charge / Manager clears (or Director waives with remark) |
| Clearance granted | Allow existing `confirmReturn` path; then release reliever / cover as today |
| Open `critical` incident involving employee | Manpower / OT soft-block: prefer not to assign that person OT or cover until incident `RESOLVED` (ack + remark to override — same as OT soft-block pattern) |
| Breakdown OT | Prefer creating OT via `ot-decision` with trigger `breakdown_repair`; store `otDecisionId` on `otEntries[]` |

### Who clears return

| Role | Can clear? |
|---|---|
| safety_incharge | Yes (primary) |
| manager (site) | Yes for non-fatal / non-critical |
| director | Yes + waive |
| supervisor / shift / site in-charge | Confirm return ops only — **cannot** clear medical/lost_time without Safety / Manager |

Mirror leave: ops roles confirm presence; Safety owns fitness for duty when `requiresReturnClearance`.

### Lifecycle UI

- `/leave/lifecycle` and leave detail: show banner “Safety clearance pending” with link to `/safety/incidents/[id]`.
- `/safety/incidents/[id]`: “Linked leave” chips → `/leave/requests/[id]`.

---

## 5. Files to add or change

### Client

| File | Change |
|---|---|
| `client/lib/safety/types.ts` | Types from §3 |
| `client/lib/safety/store.ts` | localStorage + `syncSafetyWithApi()` (leave store pattern) |
| `client/lib/safety/transitions.ts` | Status map; reject illegal jumps |
| `client/lib/safety/recipients.ts` | Resolve notify list (§7); use site hierarchy + roster |
| `client/lib/safety/gates.ts` | `employeeNeedsSafetyClearance`, `canCloseLeave` — used by leave store / lifecycle |
| `client/lib/api/safety.ts` | API calls |
| `client/lib/leave/store.ts` | `confirmReturn` checks safety gate; link helpers |
| `client/lib/leave-lifecycle/*` | Surface clearance soft-blocks on due-return cases |
| `client/lib/manpower-conflict/gates.ts` | Soft-block assign when critical open incident |
| `client/lib/ot-decision/*` | Optional trigger `breakdown_repair`; respect safety soft-block |
| `client/lib/sync.ts` | Hydrate safety store |
| `client/lib/rbac.ts` | `// ── Safety` block (§6) |
| `client/lib/notifications.ts` | Kinds + **`recipientRole?` / `recipientUserId?`** (Director/HR/Safety) |
| `client/lib/auth.ts` | Ensure Safety In-charge is on demo login if required for QA |
| `client/components/AppShell.tsx` | **Safety** submenu (all roles can view) |
| `client/components/safety/*` | ReportWizard, EventTimeline, PeoplePicker (site-scoped), MediaUploader, SeverityTag, BreakdownPanel, ClearancePanel |

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
| `server/db/seeds/safety.seed.ts` | Demo incidents / near-misses / breakdowns **linked to seeded emp + leave ids** |
| `server/src/modules/safety/*` | CRUD + transitions + reminder scheduler |
| `server/src/app.module.ts` | Register `SafetyModule` |
| Media (`multer`) | Server-only storage; never localStorage data URLs |

---

## 6. Permissions

Align with existing leave RBAC tone (site-scoped plant roles; org-wide director / hr / safety_incharge).

| Action | Roles |
|---|---|
| View safety section, history, protocols | **All** |
| Report near-miss | **All** (including employee) |
| Raise incident or breakdown | manager, director, safety_incharge, site_incharge, shift_incharge |
| Acknowledge / investigate / corrective actions | safety_incharge, manager, site_incharge |
| Resolve | safety_incharge, manager, director |
| Close / reopen | safety_incharge, director |
| Grant return clearance (non-critical) | safety_incharge, manager |
| Grant / waive clearance (critical / fatal) | safety_incharge, director |
| Edit protocols | safety_incharge, director |
| Emergency broadcast | Anyone reporting with `isEmergency` |

**Default for open Q2:** Shift / Site In-charge **can** raise incidents (night coverage) — matches leave `entrySource` flexibility for supervisors on emergency absence.

---

## 7. Notifications and "notify until solved"

- **Recipients** (`recipients.ts`): involved, informedBy, site manager + site/shift in-charge from employee/site graph, safety_incharge, HR, Director. Emergency: union with **today’s roster** at `siteId` from shift store.
- **Must fix (current gap):** extend `AppNotification` with `recipientRole?` and/or `recipientUserId?` so Director / HR / Safety In-charge get alerts without `employeeId`.
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

## 8. Media, meet calls, reports

- **Upload:** images ~10 MB (client compress), video ~50 MB. Disk behind a storage interface (S3/GridFS later). No localStorage media.
- **Meet:** phase 1 Jitsi `meet.jit.si/neipl-safety-<id>`; log on timeline. Later: meetings module / Google Meet.
- **Report PDF:** same approach as OT report export.

---

## 9. Delivery phases

| # | Phase | Done when |
|---|---|---|
| 0 | Types, RBAC, nav, seed (2–3 events per site, **use real emp ids**; optional linked leave) | Safety menu + seed render |
| 1 | Report wizard, history, detail, transitions (client + server) | Near-miss → incident; illegal transitions rejected |
| 2 | Recipients, role-targeted notifications, emergency banner, reminder cron | Critical re-notify; banner clears on ack |
| 3 | **Leave/lifecycle gates** — clearance on return, linked leave, lifecycle banners, manpower/OT soft-blocks | Cannot `CLOSED` sick/LTA return while clearance pending; soft-block OT/cover |
| 4 | Media, meet link, PDF | Attach + play + download |
| 5 | Breakdowns + OT decision cross-link (`breakdown_repair`) | Downtime + OT hours on breakdown and site OT |
| 6 | Protocols + Safety training track filter | Editable protocols; filtered courses |
| 7 | Dashboard / Sites widgets (days since LTI, open items, pending clearances); update `PAGES_AND_FEATURES.md` | KPIs on `/dashboard` and `/sites/[id]` |

Phases 0–1 need no new infra. Phase 2 needs scheduler + notification model fix. Phase 3 is the **emp/leave alignment** slice — ship before treating Safety as “done” for plant ops.

**Tests:** transitions (like leave-policy / leave-lifecycle tests); recipient resolver; clearance gate on `confirmReturn`; reminder intervals; e2e: near-miss → promote → link leave → clear → close leave → close incident.

---

## 10. Related items from the same notes (separate track)

- **Shift attendance automation** (p1, p2): planned roster vs actual; auto-fill `source: "auto"`; edit windows 12 h manual / 18 h auto then lock. Touches `client/lib/shift/store.ts` + deviations. Coordinate with Safety emergency roster lookups so “who was on shift” stays accurate.
- **Certificates:** `validityMonths: 12 | 6` on courses (today hard-coded ~1 year). 6‑month → “Renew via quick test”. Clearance may soft-warn if Safety cert `overdue`.
- **Assessment delegation:** Director → Manager assessors; Manager delegates to HR / Site In-charge (`delegatedFrom` chain).

---

## 11. Open questions for the client

1. **"Visible to all" vs sensitive cases** — redact names on fatal/death for employees, or full visibility?
2. **Reminder intervals / escalation N** — are §7 numbers OK?
3. **Meet calling** — Jitsi OK, or Google Meet / Teams required?
4. **Video storage** — on-prem vs cloud; retention?
5. **Clearance strictness** — hard-block return for all `sick` leaves, or only when a linked Safety event sets `requiresReturnClearance`? *(Recommendation: only when linked / category requires it — avoid blocking every casual sick day.)*
6. **Waive policy** — Director-only waive with mandatory remark (recommended; mirrors leave extension remark)?

**Resolved from current system (no longer blocking):**

- Who raises incidents on night shift → **include shift/site in-charge** (§6).
- Final Safety close → **safety_incharge or director** (leave finalize stays director-only; Safety close is broader).
- People model → **existing employee ids + site hierarchy**, not a new staff directory.
- OT on breakdowns → **ot-decision module**, not a parallel OT ledger.
