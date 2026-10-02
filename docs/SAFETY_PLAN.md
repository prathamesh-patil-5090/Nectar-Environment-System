# Safety Section — Implementation Plan

Source: handwritten requirement notes (4 pages, refined 27/09/2026). Fits the existing architecture: Next client with localStorage stores + fire-and-forget API sync, NestJS + Mongoose server, `safety_incharge` role already in `client/lib/auth.ts`, placeholder meetings module.

## Table of contents

1. [Requirements from the notes](#1-requirements-from-the-notes)
2. [Data model](#2-data-model)
3. [Files to add or change](#3-files-to-add-or-change)
4. [Permissions](#4-permissions)
5. [Notifications and "notify until solved"](#5-notifications-and-notify-until-solved)
6. [Media, meet calls, reports](#6-media-meet-calls-reports)
7. [Delivery phases](#7-delivery-phases)
8. [Related items from the same notes](#8-related-items-from-the-same-notes-separate-track)
9. [Open questions for the client](#9-open-questions-for-the-client)

---

## 1. Requirements from the notes

| Notes | Requirement |
|---|---|
| p3 | **Incidents (on-site safety).** A Manager raises the incident. It records who informed, who it happened to, the site in-charge, HR, Manager, Safety In-charge and Director. Categories include first aid, fatal, death and plant problem. **The complaint stays open and keeps notifying people until it is solved.** |
| p3 | **Near-misses.** Reported by someone other than the person at risk (e.g. Emp 2 stops Emp 1 walking towards an open plant cap with no sign board). |
| p2 | Photo/video upload, meet calling, **emergency alert to every assigned person**, detailed report making. |
| p2 | Sections: incident & near-miss history, emergency protocols, and **breakdowns** — why the plant isn't working, when it broke, what broke, how, how many people worked OT to fix it, how many days it took. |
| p4 | A safety protocol page, safety training module, every incident (big or small) stored and **visible to all**. |
| p1, p2, p4 | Not safety, but on the same pages: shift attendance automation, 6‑month certificates, assessment delegation. See §8. |

## 2. Data model

Shared between client (`client/lib/safety/types.ts`) and server (`server/db/schemas/`).

### `SafetyEvent`

One collection, discriminated by `type: "incident" | "near_miss" | "breakdown"`.

- `id, siteId, title, description, location, occurredAt, reportedAt`
- `category`: `first_aid | medical | lost_time | fatal | plant_problem | fire | chemical | electrical | other`
- `severity`: `low | medium | high | critical` (fatal is always critical)
- `reportedBy {id, name, role}`
- `informedBy[]` — employee ids of the people who informed
- `involved[]` — employee ids of the people it happened to
- `stakeholders[]` — auto-filled from the site (site in-charge, manager, HR, safety in-charge, director); editable
- `media[] {id, url, kind: "image" | "video", uploadedBy, at}`
- `status`: `REPORTED → ACKNOWLEDGED → INVESTIGATING → ACTION_PENDING → RESOLVED → CLOSED`, plus `REOPENED`
- `rootCause`, `correctiveActions[] {text, ownerId, dueDate, done}`
- `timeline[]` — audit trail of every status change, comment, call and notification
- `isEmergency`, `meetLink`, `lastNotifiedAt`, `notifyCount`
- `promotedFrom?` — set when a near-miss is escalated into an incident

**Breakdown extension:**

- `equipment, whatFailed, why, how`
- `failedAt, restoredAt` → computed `downtimeDays`
- `otEntries[] {employeeId, hours}` → computed headcount and OT man-hours

### `SafetyProtocol`

- `id, title, category, steps[], emergencyContacts[]`
- `siteIds[]` or all sites
- `version, updatedBy, updatedAt`

## 3. Files to add or change

### Client

| File | Change |
|---|---|
| `client/lib/safety/types.ts` | Types from §2 |
| `client/lib/safety/store.ts` | localStorage store + `syncSafetyWithApi()`, same pattern as the leave store |
| `client/lib/safety/transitions.ts` | Status transition map, mirrors the leave state machine |
| `client/lib/safety/recipients.ts` | Resolves who gets notified (§5) |
| `client/lib/api/safety.ts` | API calls |
| `client/lib/sync.ts` | Add `syncSafetyWithApi` to `hydrateAllStoresFromApi` |
| `client/lib/rbac.ts` | New `// ── Safety` block (§4) |
| `client/lib/notifications.ts` | New kinds: `safety_incident`, `safety_emergency`, `safety_reminder` |
| `client/components/AppShell.tsx` | **Safety** submenu, visible to every role |
| `client/components/safety/*` | `ReportWizard`, `EventTimeline`, `PeoplePicker` (searchable, site-scoped — sites have 2–60 people), `MediaUploader`, `SeverityTag`, `BreakdownPanel` |

### Routes — `client/app/(app)/safety/…`

| Route | Purpose |
|---|---|
| `/safety` | Overview: open items, days since last lost‑time incident per site, near‑miss trend, active breakdowns |
| `/safety/report` | Wizard: type → details → people → media → emergency toggle → submit |
| `/safety/incidents` | Incident & near‑miss history; filters for site, type, severity, status, date |
| `/safety/incidents/[id]` | Detail: timeline, people, media, corrective actions, status actions, "Start call", "Download report" |
| `/safety/breakdowns` | Breakdown log with downtime and OT man-hours |
| `/safety/breakdowns/[id]` | Breakdown detail |
| `/safety/protocols` | Emergency protocols — readable by all, editable by Safety In-charge and Director |
| `/safety/training` | Link into `/training` filtered to a new **Safety** track (no new training engine) |

### Server

| File | Change |
|---|---|
| `server/db/schemas/safety-event.schema.ts` | `SafetyEvent` schema |
| `server/db/schemas/safety-protocol.schema.ts` | `SafetyProtocol` schema |
| `server/db/seeds/safety.seed.ts` | Demo data, registered in `seeds/index.ts` |
| `server/src/modules/safety/safety.{module,controller,service}.ts` | CRUD + transitions |
| `server/src/modules/safety/safety-transitions.ts` | Rejects illegal status jumps, like `leave-transitions.ts` |
| `server/src/modules/safety/safety-reminder.scheduler.ts` | Repeat-notification cron (§5) |
| `server/src/app.module.ts` | Register `SafetyModule` |
| Media endpoint (`multer`) | **No upload infrastructure exists yet.** Media is server-only — never localStorage data URLs (~5 MB quota). |

## 4. Permissions

| Action | Roles |
|---|---|
| View safety section, history, protocols | **All** ("visible to all") |
| Report a near-miss | **All**, including employees |
| Raise an incident or breakdown | manager, director, safety_incharge, site_incharge, shift_incharge |
| Acknowledge / investigate / add corrective actions | safety_incharge, manager, site_incharge |
| Resolve | safety_incharge, manager, director |
| Close / reopen | safety_incharge, director |
| Edit protocols | safety_incharge, director |
| Trigger emergency broadcast | Anyone, when reporting with `isEmergency` |

## 5. Notifications and "notify until solved"

- **Recipients** (`recipients.ts`): involved people, people who informed, the site's in-charge, manager and safety in-charge, plus HR and Director. For an emergency, add everyone rostered at that site today (from the shift store).
- **Gap to fix:** `AppNotification` targets `employeeId`, but Director and HR logins have none. Add `recipientRole?` (or a user key) so role-targeted alerts reach them.
- **Repeat reminders** (server-side, `@nestjs/schedule`): re-notify every event not yet `RESOLVED`, interval by severity:

  | Severity | Re-notify every |
  |---|---|
  | critical | 1 h |
  | high | 4 h |
  | medium / low | 24 h |

  Each reminder increments `notifyCount`; after N reminders, escalate to the Director. Offline fallback: the client computes overdue reminders on load.
- **Emergency:** pinned red banner in AppShell until each recipient acknowledges.

## 6. Media, meet calls, reports

- **Upload:** images up to ~10 MB (compressed on the client), video up to ~50 MB. Local disk first, behind a storage interface so S3/GridFS can replace it later.
- **Meet calling:** phase 1 generates a Jitsi room link (`meet.jit.si/neipl-safety-<id>`) — no infrastructure needed — and logs it on the timeline. Later: wire into the meetings module / Google Meet.
- **Detailed report:** print-optimised detail view, exported to PDF the same way as the OT reports.

## 7. Delivery phases

| # | Phase | Done when |
|---|---|---|
| 0 | Types, RBAC, nav, seed data (2–3 incidents, near-misses, breakdowns per demo site) | Safety menu visible; pages render seed data |
| 1 | Report wizard, history list, detail page, state machine (client store + server CRUD) | Near-miss → incident promotion works; illegal transitions rejected on client and server |
| 2 | Recipients, role-targeted notifications, emergency broadcast, reminder cron | Open critical incidents re-notify on schedule; emergency banner clears on acknowledgement |
| 3 | Media upload, meet link, PDF report | Photos/video attach and play; report downloads |
| 4 | Breakdowns, OT entries cross-linked to the OT module | Downtime days and OT man-hours show on the breakdown and on site OT |
| 5 | Protocols page, Safety training track | Protocols editable by Safety In-charge; safety courses filtered |
| 6 | Dashboard and Sites widgets (days since LTI, open items); `PAGES_AND_FEATURES.md` section | KPIs on `/dashboard` and `/sites/[id]` |

Phases 0–1 need no new infrastructure. Phases 2–3 need the scheduler and media upload — settle §9 before starting them.

**Tests:** unit tests for transitions (like `leave-policy.engine.spec.ts`), recipient resolver and reminder intervals; one e2e: report near-miss → promote → close.

## 8. Related items from the same notes (separate track)

- **Shift attendance automation** (p1, p2): schedules are planned 1–2 months ahead by the Manager / Shift In-charge. A daily job compares `actualCode` with the plan; if manual input is empty it **auto-fills from the schedule** with `source: "auto"`. Manual entries are editable for **12 h**, auto-filled entries correctable for **18 h**, then locked. Touches `client/lib/shift/store.ts` and the deviations page.
- **Certificates:** add `validityMonths: 12 | 6` per course, replacing the hard-coded 1 year in `client/lib/training/store.ts`. 6‑month certificates get a "Renew via quick test" flow.
- **Assessment delegation:** Director assigns Manager assessors; a Manager can delegate to HR or Site In-charge. Extend `assignedBy*` with a `delegatedFrom` chain.

## 9. Open questions for the client

1. **"Visible to all" vs. sensitive cases** — should employees see names on fatal/death incidents, or a redacted version?
2. **Who raises incidents** — notes say Manager. Should Shift / Site In-charge also be able to, e.g. on night shifts with no Manager present?
3. **Reminder intervals and escalation ceiling** — are the §5 numbers acceptable?
4. **Meet calling** — is a Jitsi link fine, or Google Meet / Teams required?
5. **Video storage** — on-prem or cloud preference? Retention period?
6. **Final close** — Safety In-charge or Director (like the leave final sign-off)?
