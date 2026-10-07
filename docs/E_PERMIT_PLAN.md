# E-Permit (Permit to Work) — Implementation Plan

**Product:** Nectar Enviro Ops Console  
**Source:** Handwritten plant notes (E-Permit issuer / lifetime / visibility) + design pillars (scalar hierarchy, authorization levels, policies)  
**Date:** 7 Oct 2026  
**Status:** Planning only — not built yet  
**Companion docs:** [SAFETY_PLAN.md](./SAFETY_PLAN.md), [PAGES_AND_FEATURES.md](./PAGES_AND_FEATURES.md), [FEATURE_INVENTORY_AND_COSTING.md](./FEATURE_INVENTORY_AND_COSTING.md)

---

## Table of contents

1. [What E-Permit is](#1-what-e-permit-is)
2. [Design pillars](#2-design-pillars)
3. [Fit with the current system](#3-fit-with-the-current-system)
4. [Scalar hierarchy chain](#4-scalar-hierarchy-chain)
5. [Level implement (authorization)](#5-level-implement-authorization)
6. [Policies](#6-policies)
7. [Permit types & issuer form](#7-permit-types--issuer-form)
8. [Lifetime, handover, OT link](#8-lifetime-handover-ot-link)
9. [Visibility & audit trail](#9-visibility--audit-trail)
10. [Data model (proposed)](#10-data-model-proposed)
11. [Routes & UI](#11-routes--ui)
12. [Cross-module hooks](#12-cross-module-hooks)
13. [Delivery phases](#13-delivery-phases)
14. [Decided answers](#14-decided-answers)

---

## 1. What E-Permit is

An **E-Permit** is formal permission to do **work at a location** for a bounded time, only after **concerned departments** clear it.

| Notes | Meaning |
|---|---|
| Who can **issue** | Supervisor (main), Shift In-Charge, Manager |
| Who are **holders** | Departments — Electrical, Mechanical, Chemical, Operator, … |
| Example | Welding near MEE → only **concerned** department head(s) must approve; not every department |
| Categories | **Hot Work** / **Cold Work** (each with sub-categories by work type) |
| Gate | Until concerned departments approve → **no permit is generated / activated** |
| Lifetime | Max **8 hours**; handover / re-issue to extend; **no auto-close**; warn **1 hour** before end; overtime display turns **red** |
| Visibility | Only concerned people: included workers, concerned departments, issuers, Managers & Directors |

**In short:** E-Permit is the **audit trail for permissioned work** — who did what, where, under whose approval, for how long, and whether it ran over.

It is **not** the same as Leave (person absent) or Safety Incident (something already went wrong). It sits **before / beside** risky or multi-department work, and can feed OT when work overruns.

---

## 2. Design pillars

These three pillars structure the whole module (your suggestions).

### 2.1 Scalar hierarchy chain

A fixed seniority ladder for **who may issue, approve, hand over, and close** — same idea as leave’s Supervisor → SIC → Manager → Director chain and RBAC `ROLE_RANK` in `client/lib/rbac.ts`.

```text
Employee (holder / worker on permit)
        ↑
Supervisor          ← primary issuer (notes)
        ↑
Shift In-Charge     ← can issue; shift handover partner
        ↑
Head of Department  ← Senior Manager; clearance for own dept only (v1: separate login per dept)
        ↑
Plant Manager       ← Assistant Manager; can issue; plant oversight (not a stand-in for all HoDs)
        ↑
Safety In-charge    ← only when policy `requireSafetyFor` matches (not every Hot Work)
        ↑
Director            ← org visibility + override / waive (rare)
```

**Scalar rule:** a higher level can see and act on lower-level permits in their scope; a lower level cannot skip a required higher clearance.

### 2.2 Level implement (authorization)

Authorization is **level × concern**, not “any manager can approve anything.”

| Level | Can do |
|---|---|
| **L0 — Worker** | View own permits; sign acknowledgement / handover |
| **L1 — Issuer** | Create draft issuer form; request dept clearances; re-issue / hand over (with co-sign) |
| **L2 — Head of Department** (Senior Manager) | Approve / reject **only** permits that list their department (separate login per dept in v1) |
| **L3 — Plant Manager** (Assistant Manager) | Issue; plant oversight; override soft blocks; close with remark; OT hour approval link |
| **L4 — Safety In-charge** | Approve only when policy `requireSafetyFor` matches for that work type |
| **L5 — Director** | Org-wide view; waive / escalate; never required for normal cold work |

Same pattern as leave: illegal status jumps rejected; soft-blocks for contested / policy fails; OT path separate when work needs overtime hours.

### 2.3 Policies

Configurable rules (like leave policy + OT thresholds), **not** hard-coded one-off UI:

| Policy area | Default from notes |
|---|---|
| Max active duration | **8 hours** per permit instance |
| Pre-expiry notice | **1 hour** before end |
| Auto-close | **Off** — issuer/manager must close or hand over |
| Overrun UI | Elapsed time **turns red** after limit / approved extension |
| Category → sub-category | Hot / Cold → work-type checklist (gears, tank checks, …) |
| Required clearances | Derived from **location + category + plant impact** (e.g. welding @ MEE → MEE / Electrical heads) |
| Handover | Outgoing issuer + incoming issuer + worker acknowledgement |
| OT link | If work needs hours beyond permit window → OT Decision / Assign with permit id |

---

## 3. Fit with the current system

E-Permit should be a **sibling module** to Leave and Safety — same architecture patterns, not a rewrite.

### Reuse as-is

| Current piece | Path / behaviour | E-Permit use |
|---|---|---|
| Roles + `ROLE_RANK` | `client/lib/rbac.ts`, `auth.ts` | Scalar hierarchy; new `// ── E-Permit` checks |
| Site scoping | Manager / SIC / Supervisor plant-locked | Permits scoped by `siteId` |
| Leave state machine | `leave-transitions` + client store | Copy pattern for permit statuses |
| Safety rules parity | `client/lib/safety/rules.ts` ↔ server | Shared `e-permit/rules.ts` client + server |
| OT Decision | `client/lib/ot-decision/` | Trigger `e_permit_overrun` / `e_permit_work` |
| Notifications | Nest `NotificationsService` | Clearance requests, 1h warning, handover, overrun |
| Safety In-charge | Already in demo users | Hot-work / tank / confined-space gates |
| Media upload | Safety uploads pattern | Optional photos of isolation / gear checks |
| Employee master | department, plant graph | Workers on permit; dept head resolution |
| Reliever / leave cover | Separate | Do **not** mix: being on leave ≠ holding a work permit |

### What we do **not** have today (gaps this module adds)

- No **Department** entity with a **Department Head** (notes: “Introduce Departments & Department Heads”)
- No permit categories / checklists
- No time-boxed work authorization with handover
- OT records “what work / who approved hours” exist partly via OT Assign — not linked to a permit id

### Mental model next to existing modules

```text
Leave          = person is ABSENT → cover / OT
Safety         = something went WRONG (or near-miss) → investigate / clear
E-Permit       = person will WORK (risky / multi-dept) → clear depts → time box → audit
Breakdown OT   = plant broken → repair people + hours
E-Permit OT    = permitted work needs more hours than the permit window
```

---

## 4. Scalar hierarchy chain

### Issuers (may start a permit)

From notes — **Supervisor (main)**, **Shift In-Charge**, **Manager**.  
Map to existing logins:

| Issuer role | Demo login pattern | Scope |
|---|---|---|
| Supervisor | `etp.supervisor@…` | Own plant team work |
| Shift In-Charge | `etp.shift@…` | Plant shift work + handovers |
| Manager | `etp.manager@…` | Plant-wide issue + oversight |

Director / Safety In-charge are **not** primary issuers for routine work; they approve policy gates or view org-wide.

### Holders = Departments

Introduce (seed + schema):

| Field | Example |
|---|---|
| `departmentId` | `dept-electrical`, `dept-mechanical`, `dept-chemical`, `dept-operator`, `dept-safety` |
| `name` | Electrical |
| `headEmployeeId` / `headUserId` | **Head of Department** login (Senior Manager) — one per dept in v1 |
| `siteIds[]` | Which plants this dept serves (ETP / RO / MEE) |

**v1 managers:** **Plant Manager** = Assistant Manager (issuer / plant oversight). **Head of Department** = Senior Manager (dept clearance). Plant Manager does **not** act as HoD for multiple depts.

**Concerned department** selection:

1. Issuer picks **one seeded location** (site + area — e.g. MEE bay, RO skid; free text later only if product asks)
2. Issuer picks **category** (Hot / Cold) + sub-category (welding, tank entry, …)
3. Policy engine returns **required department clearances** (e.g. welding near MEE → Mechanical + Electrical)
4. Only those HoDs must approve — not every department
5. **One permit = one location only** (no multi-site / multi-area span)

### Chain for one permit

```text
Issuer drafts
    → Concerned dept heads approve (all required)
    → [Policy] Safety In-charge if Hot / confined / tank
    → Permit ACTIVE (generated)
    → Workers acknowledge
    → Work runs ≤ 8h
    → Close | Hand over / Re-issue | OT extension path
```

Until **all required dept approvals** are in → status stays `PENDING_CLEARANCE` — **permit not generated** (notes).

---

## 5. Level implement (authorization)

### Status machine (proposed)

| Status | Meaning |
|---|---|
| `DRAFT` | Issuer filling form |
| `PENDING_CLEARANCE` | Waiting on concerned departments (± Safety) |
| `REJECTED` | Any required approver rejected (with remark) |
| `ACTIVE` | All clearances done; work window running |
| `HANDOVER_PENDING` | Shift change — dual issuer + worker sign |
| `EXTENDED` | Re-issued / renewed after handover or approved extension |
| `OVERDUE` | Past end time; still open (UI red; notify); **not** auto-closed |
| `CLOSED` | Issuer / Manager closed with completion note |
| `CANCELLED` | Issuer / Manager cancelled before or during work |

Illegal jumps rejected (same spirit as leave transitions).

### Who may act

| Action | L1 Issuer | L2 Dept head | L3 Manager | L4 Safety | L5 Director | Worker |
|---|---|---|---|---|---|---|
| Create draft | ✓ | | ✓ | | | |
| Submit for clearance | ✓ | | ✓ | | | |
| Approve / reject own dept | | ✓ (own dept only) | ✓ if they **are** that head | | | |
| Safety gate approve | | | | ✓ Hot/confined | ✓ waive | |
| Activate (system) | after clearances | | | | | |
| Acknowledge as worker | | | | | | ✓ |
| Hand over / re-issue | ✓ (+ incoming) | | ✓ | | | ✓ ack |
| Close | ✓ | | ✓ | | ✓ | |
| Link / approve OT hours | | | ✓ | | ✓ | |
| View | own / concerned | own dept | plant | policy set | all | own |

### Soft blocks (like leave competition / OT gates)

| Situation | Behaviour |
|---|---|
| Missing dept approval | Cannot activate |
| Work type in `requireSafetyFor` without Safety clearance | Soft-block activate (not all Hot Work automatically) |
| Assign worker who is on approved leave that day | Soft-block (reuse leave coverage check) |
| Assign worker with pending safety return clearance | Soft-block (reuse Safety gate) |
| Work past end with no extension | Stay open as `OVERDUE`; red clock; push OT Decision prompt — **do not auto-close** |

---

## 6. Policies

Store as versioned config (seedable), similar to leave policy:

```ts
EPermitPolicy {
  maxDurationHours: 8;
  warnBeforeEndMinutes: 60;
  autoClose: false;
  requireSafetyFor: ["hot_work", "confined_space", "tank_entry"];
  categoryRules: [
    { category: "hot_work", subCategory: "welding", requiredDepts: ["mechanical", "electrical"], locationHints: ["mee", "near-mee"] },
    { category: "cold_work", subCategory: "general_maintenance", requiredDepts: ["mechanical"] },
    // …
  ];
  handoverRequires: ["outgoing_issuer", "incoming_issuer", "worker_ack"];
  otLinkWhenOverdue: true;
}
```

**Engine API (client + server parity, like Safety rules):**

- `requiredClearances(location, category, subCategory) → departmentId[]`
- `assertCanActivate(permit, actor)`
- `assertCanHandOver(permit, outgoing, incoming)`
- `isOverdue(permit, now)`
- `shouldWarn(permit, now)`

HR / Safety In-charge / Director own changing thresholds later without rewriting UI.

---

## 7. Permit types & issuer form

### Categories (notes)

| Category | Examples of sub-categories |
|---|---|
| **Hot Work** | Welding, cutting, grinding, open flame |
| **Cold Work** | General maintenance, isolation checks, non-spark work |

Every category has **sub-categories**; checklist fields depend on type of work.

### Issuer form (notes → fields)

| UI / field | Purpose |
|---|---|
| **Issue permit** button | Start draft |
| **Select location** | **One** seeded area per permit (e.g. MEE bay, RO skid, ETP clarifier) |
| **Reason** | What work / why |
| **Needed gears / equipment / safety** | Free text + structured checklist |
| **Safety gear checks** | Pass/fail checklist (policy template by sub-category) |
| **Tank clearance / tank safety checks** | Confined-space style gates when applicable |
| **Workers needed / assigned** | Employee ids on the permit; they **acknowledge with signature** (issuer also signs) |
| **Concerned departments** | Auto-suggested from policy; issuer can add (not remove required) |

**Literacy path:** Issuer = Supervisor / Shift In-Charge / Manager creates the permit; workers do not draft it — they only **sign acknowledgement** (same spirit as leave on-behalf). Issuer signature is required too.

---

## 8. Lifetime, handover, OT link

### Lifetime (notes)

1. Max **8 hours** from `activatedAt` (or from approved `startAt`–`endAt` window).
2. **No auto-close.**
3. Notification **1 hour before** end → issuers + workers + plant manager.
4. After end, if still open → `OVERDUE`; timer UI **red**.
5. **Re-issue = extend** via handover or Manager-approved extension.

### Handover / re-issue

When Supervisor 1 ends shift and Supervisor 2 continues:

| Step | Who |
|---|---|
| Request handover | Outgoing issuer |
| Accept as incoming issuer | Incoming issuer (SIC / Supervisor) |
| Acknowledge continued work | Assigned worker(s) |
| System | New end time (+ up to policy max); status `EXTENDED`; audit both signatures |

### OT integration

When work needs more hours than the permit allows:

| Record | Source |
|---|---|
| What work OT was for | `permitId` + reason snapshot |
| Who approved permit | Clearance audit |
| Who approved OT hours | Manager via existing OT Decision / Assign |
| Hours approved vs actual | OT assignment fields + permit `actualEndAt` |
| Completed in limit? | `actualEndAt ≤ endAt` vs overdue |

Add OT trigger: `e_permit_overrun` (alongside `leave_cover`, `breakdown_repair`).

---

## 9. Visibility & audit trail

### Visibility (notes: “only to concerned people”)

| Audience | Sees |
|---|---|
| Included workers | Own permits |
| Concerned departments | Permits listing their dept |
| Issuers | Permits they issued or handed over |
| Managers | All permits at their plant |
| Directors / Safety In-charge | Org / policy-scoped as RBAC allows |

Do **not** show every plant’s permits to every supervisor (same plant-scoping as leave).

### Audit trail (must answer later)

For every permit, immutable event log:

| Event | Fields |
|---|---|
| Created / submitted | actor, at, draft snapshot |
| Dept approved / rejected | deptId, actor, remark |
| Safety cleared / waived | actor, remark |
| Activated | at, endAt |
| Worker ack | employeeId, at |
| Handover | outgoing, incoming, worker acks |
| Warning sent | at |
| Marked overdue | at |
| OT linked | otDecisionId / assignmentId |
| Closed / cancelled | actor, remark, actual hours |

The log must answer later: who did what, for which task, under whose approval, and how much time was spent.

---

## 10. Data model (proposed)

```text
departments          — id, name, headUserId, siteIds[]
e_permit_policies    — versioned rules (see §6)
e_permits            — header: siteId, location, category, subCategory,
                       status, issuerId, startAt, endAt, activatedAt,
                       actualEndAt, reason, gearNotes, workerIds[],
                       requiredDeptIds[], safetyRequired
e_permit_clearances  — permitId, departmentId, status, actorId, remark, at
e_permit_checklists  — permitId, templateKey, items[{ key, ok, note }]
e_permit_events      — append-only audit
e_permit_handovers   — permitId, fromIssuerId, toIssuerId, workerAcks[], at
```

**Nest:** `server/src/modules/e-permits/` + Mongoose schemas.  
**Client:** `client/lib/e-permit/` — `types`, `rules`, `store`, `transitions`, tests.  
**Parity:** client `rules.ts` === server `e-permit-rules.ts` (Safety pattern).

EBS/S3: checklist photos optional under existing media pattern (Safety or shared uploads).

---

## 11. Routes & UI

| Route | Purpose |
|---|---|
| `/e-permits` | Inbox / KPIs — pending clearance, active, overdue |
| `/e-permits/new` | Issuer form (Issue button → wizard) |
| `/e-permits/[id]` | Detail: clearances, checklist, workers, timer, audit, OT link |
| `/e-permits/handover` | Active handovers needing dual sign |
| `/e-permits/policies` | Director / Safety / Admin view of policy (read; edit later) |

**Nav:** under Safety or new top-level **E-Permits** (prefer under / next to Safety — both are authorization-to-work / risk). RBAC-filter like other modules.

**Demo roles to unhide / seed:** department heads (can map plant Manager as head of Operator + Mechanical initially; Electrical head as separate seed user if needed).

---

## 12. Cross-module hooks

| Module | Hook |
|---|---|
| **Leave** | Soft-block assigning a worker who has covering leave that day (`employeeHasCoveringLeave`) |
| **Safety** | Safety In-charge clearance **only if** `requireSafetyFor` matches; pending return clearance blocks worker on permit; **breakdown repair also needs an E-Permit** before / with repair OT |
| **OT** | Overdue / extension → `e_permit_overrun` decision; Assign OT prefills permit id + hours; breakdown OT stays linked but **requires E-Permit** |
| **Shifts** | Handover prefers issuers on duty that shift; optional “active permits at site” on shift hub |
| **Notifications** | Clearance request, 1h warning, overdue, handover pending, closed |
| **Employees** | Department field → holder / head resolution |
| **Reliever** | No direct link (reliever covers absence; E-Permit authorizes work) |

**Nothing breaks:** default off until feature flag / nav enabled; existing leave/OT/safety tests unchanged when no permits exist (same “no-op by default” rule as Safety plan §5).

---

## 13. Delivery phases

| Phase | Deliverable |
|---|---|
| **0** | Departments seed + types + RBAC block + nav stub |
| **1** | Policy engine + status machine + unit tests (parity client/server) |
| **2** | Issuer form + list + detail (draft → pending clearance) |
| **3** | Dept + Safety clearances → ACTIVE; visibility scoping |
| **4** | Timer, 1h warning scheduler, OVERDUE red UI, no auto-close |
| **5** | Handover / re-issue with triple ack |
| **6** | OT Decision trigger + Assign prefill + actual vs approved hours |
| **7** | Checklists by sub-category (gear, tank); optional media |
| **8** | Audit export / PDF of closed permit (reuse jspdf pattern) |

Costing note: all of this stays on the shared EC2 + DocumentDB + S3 stack in [FEATURE_INVENTORY_AND_COSTING.md](./FEATURE_INVENTORY_AND_COSTING.md) — **Included in platform** except SES/SMS if you notify by email/SMS.

---

## 14. Decided answers

Decisions captured 7 Oct 2026 (product alignment).

| # | Question | Decision |
|---|---|---|
| 1 | Department heads — separate logins vs Plant Manager as multi-dept head? | **Two manager types in v1:** **Plant Manager** = Assistant Manager; **Head of Department** = Senior Manager. **Separate HoD login per department** — Plant Manager does **not** act as head for multiple depts. |
| 2 | Location master — free text vs seeded areas? | **Seeded locations for now** (e.g. MEE bay, RO skid, ETP clarifier). Free-text option only later if the product asks for it. |
| 3 | Safety In-charge on all Hot Work vs policy match? | Safety In-charge approves **only where needed** — when policy **`requireSafetyFor` matches** that work type. Not every Hot Work automatically. |
| 4 | Can one permit span two sites? | **No.** **1 E-Permit = 1 specific location only.** |
| 5 | Worker literacy — who issues / who signs? | **Issuer** (Supervisor / Shift In-Charge / Manager) creates the permit. **Workers acknowledge with their signature.** **Issuer signature is required too.** |
| 6 | Nav: under Safety vs own top-level menu? | **Still open** — not decided in the alignment chat. Default recommendation until decided: own **E-Permits** top-level menu next to Safety (or under Safety as a child). |
| 7 | Breakdown repair — E-Permit before OT? | **Yes.** Even breakdown repair **requires an E-Permit** (not Safety Breakdown path alone). |

### Still open

- **§14 #6 only** — place E-Permits under Safety nav vs its own top-level menu (and whether a feature flag gates the nav).

---

## One-line stakeholder view

> **E-Permit** = time-boxed, **one-location** permission to work, cleared by **Heads of Department** (and Safety only when policy says so), issued by Supervisor / SIC / Manager with worker + issuer signatures — including for **breakdown repair** — wired into Leave / Safety / OT so overrun hours stay one audited story.
