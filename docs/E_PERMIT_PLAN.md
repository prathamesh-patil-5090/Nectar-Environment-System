# E-Permit (Permit to Work) — Implementation Plan

**Product:** Nectar Enviro Ops Console  
**Source:** Handwritten plant notes (E-Permit issuer / lifetime / visibility) + design pillars (scalar hierarchy, authorization levels, policies) + a reference industrial Permit-to-Work form (layout only — Nectar’s system is standalone)  
**Date:** 7 Oct 2026 · **Revised:** 8 Oct 2026 (shift-based validity, Authoriser / Holder roles, permit form sections, return flow)  
**Status:** Implemented 8 Oct 2026 — Phases 0–8 built and tested (see §17)  
**Scope of this revision:** the **permit** itself. JSA (risk assessment), Tool Box Talk and full certificate documents are referenced by number only (§16).  
**Companion docs:** [SAFETY_PLAN.md](./SAFETY_PLAN.md), [PAGES_AND_FEATURES.md](./PAGES_AND_FEATURES.md), [FEATURE_INVENTORY_AND_COSTING.md](./FEATURE_INVENTORY_AND_COSTING.md)

---

## Table of contents

1. [What E-Permit is](#1-what-e-permit-is)
2. [Design pillars](#2-design-pillars)
3. [Fit with the current system](#3-fit-with-the-current-system)
4. [Roles & approval chain](#4-roles--approval-chain)
5. [Status machine & authorization](#5-status-machine--authorization)
6. [Policies](#6-policies)
7. [Permit form](#7-permit-form)
8. [Validity, renewal, return, OT link](#8-validity-renewal-return-ot-link)
9. [Emergency permits, deputies, suspension](#9-emergency-permits-deputies-suspension)
10. [Visibility & audit trail](#10-visibility--audit-trail)
11. [Data model (proposed)](#11-data-model-proposed)
12. [Routes & UI](#12-routes--ui)
13. [Cross-module hooks](#13-cross-module-hooks)
14. [Delivery phases](#14-delivery-phases)
15. [Decided answers](#15-decided-answers)
16. [Out of scope (for now)](#16-out-of-scope-for-now)
17. [Implementation notes](#17-implementation-notes)

---

## 1. What E-Permit is

An **E-Permit** is formal permission to do **work at one location** for **one shift**, only after the **location’s Authoriser** (and any other concerned departments) approve it.

| Notes | Meaning |
|---|---|
| Who can **issue** | Supervisor (main), Shift In-Charge, Plant Manager |
| Who **authorises** | Head of Department that **owns the location** (+ extra clearances only when policy requires) |
| Who **holds** | **Permit Holder** — the crew lead picked from the assigned workers |
| Example | Welding near MEE → Authoriser = MEE area owner HoD; Electrical clearance added by policy |
| Categories | **Hot Work** / **Cold Work** (each with sub-categories by work type) |
| Gate | Until required approvals are in → **no permit is generated / activated** |
| Validity | **One shift** (A 06–14, B 14–22, C 22–06, G 09–18). If not done → **renewal = re-approval**. Max **2 renewals**, **24 h** total; then a new permit |
| End of work | **Work Complete** / **Work Not Complete** / **Cancelled** — Holder → Issuer → Authoriser accepts; time, day and date recorded at each step |
| Auto-close | **Never.** Warn **1 hour** before shift end; overrun timer turns **red** |
| Signature | v1 = **Acknowledge button** |
| Visibility | Only concerned people: workers, holder, issuer, authoriser, concerned departments, Managers & Directors |

**In short:** E-Permit is the **audit trail for permissioned work** — who did what, where, under whose approval, for how long, and whether it ran over.

It is **not** the same as Leave (person absent) or Safety Incident (something already went wrong). It sits **before / beside** risky or multi-department work, and can feed OT when work overruns.

---

## 2. Design pillars

### 2.1 Scalar hierarchy chain

A fixed seniority ladder for **who may issue, authorise, renew, and accept return** — same idea as leave’s Supervisor → SIC → Manager → Director chain and RBAC `ROLE_RANK` in `client/lib/rbac.ts`.

```text
Employee (worker / Permit Holder)
        ↑
Supervisor          ← primary issuer (notes)
        ↑
Shift In-Charge     ← can issue; shift handover partner
        ↑
Head of Department  ← Senior Manager; Authoriser for locations their dept owns
        ↑
Plant Manager       ← Assistant Manager; can issue; plant oversight; emergency approver
        ↑
Director            ← org visibility + override / waive (rare)
```

**Safety In-charge is not a rank on this ladder.** It is a **policy gate** (§2.3): Safety approves a permit only when `requireSafetyFor` matches the work type.

**Scalar rule:** a higher level can see and act on lower-level permits in their scope; a lower level cannot skip a required higher approval.

### 2.2 Level implement (authorization)

| Level | Can do |
|---|---|
| **L0 — Worker** | View own permits; acknowledge issue / renewal |
| **L0+ — Permit Holder** | Accept permit for the crew; declare site safe on return |
| **L1 — Issuer** | Create draft; fill permit form; request approval / renewal; return permit |
| **L2 — Head of Department** (Senior Manager) | **Authoriser** for own dept’s locations; extra clearance for own dept when policy asks |
| **L3 — Plant Manager** (Assistant Manager) | Issue; plant oversight; override soft blocks; approve emergency permits; OT hour approval link |
| **L4 — Director** | Org-wide view; waive / escalate |
| **Gate — Safety In-charge** | Approve only when policy `requireSafetyFor` matches |

### 2.3 Policies

| Policy area | Default |
|---|---|
| Validity | **One shift** — until the end of the shift chosen at issue (current or next) |
| Renewal | Each renewal = **one more shift**, needs **Authoriser re-approval** |
| Renewal cap | **2 renewals**, **24 h** total; then a fresh permit with fresh approvals |
| Pre-expiry notice | **1 hour** before shift end |
| Auto-close | **Off** |
| Overrun UI | Elapsed time **turns red** after shift end |
| Clearance validity | Approvals lapse if the permit is not ACTIVE within **12 h** of the first approval |
| Authoriser | HoD of the location’s **owner department** |
| Extra clearances | From **location + category + sub-category** (e.g. welding near MEE → Electrical) |
| Safety gate | Only for work types in `requireSafetyFor` |
| Fire & gas checklist | **Required for Hot Work**; gas readings validated against limits |
| Conflicting work | Soft-block clashing active permits at the same location |
| Emergency permits | Breakdown repair only; Plant Manager approves; **4 h** max; Authoriser post-review within **24 h** |
| OT link | Overrun hours → OT Decision / Assign with permit id |

---

## 3. Fit with the current system

E-Permit is a **sibling module** to Leave and Safety — same architecture patterns, not a rewrite.

### Reuse as-is

| Current piece | Path / behaviour | E-Permit use |
|---|---|---|
| Roles + `ROLE_RANK` | `client/lib/rbac.ts`, `auth.ts` | Scalar hierarchy; new `// ── E-Permit` checks |
| Shift master | `client/lib/shift/store.ts` (`shiftMaster`: A/B/C/G) | **Permit validity = shift window** |
| Site scoping | Manager / SIC / Supervisor plant-locked | Permits scoped by `siteId` |
| Leave state machine | `leave-transitions` + client store | Copy pattern for permit statuses |
| Safety rules parity | `client/lib/safety/rules.ts` ↔ server | Shared `e-permit/rules.ts` client + server |
| OT Decision | `client/lib/ot-decision/` | Trigger `e_permit_overrun` |
| Notifications | Nest `NotificationsService` | Approval requests, 1h warning, renewal, overrun, suspension |
| Safety In-charge | Already in demo users | Policy-gated approvals |
| Employee master | department, plant graph | Workers / holder on permit; HoD resolution |
| Leave records | Approved leave | Soft-block workers on leave; route Authoriser approvals to deputy |

### Gaps this module adds

- **Department** entity with HoD + deputies
- **Seeded locations** with an owner department
- Permit number series, permit form checklists, renewal records
- Time-boxed, shift-based work authorization with re-approval
- OT records linked to a permit id

### Mental model next to existing modules

```text
Leave          = person is ABSENT → cover / OT
Safety         = something went WRONG (or near-miss) → investigate / clear
E-Permit       = person will WORK (risky / multi-dept) → authorise → one shift → audit
Breakdown OT   = plant broken → E-Permit (normal or emergency) → repair people + hours
E-Permit OT    = permitted work needs more hours than the permit allows
```

---

## 4. Roles & approval chain

### The four parties on every permit

| Role | Who | Does |
|---|---|---|
| **Issuer** (applicant) | Supervisor / Shift In-Charge / Plant Manager | Drafts and fills the permit, requests approval and renewals, returns the permit |
| **Permit Holder** | Crew lead picked from assigned workers | Accepts the permit for the crew; declares site & equipment safe on return |
| **Workers** | Assigned employees | Acknowledge on issue and on each renewal |
| **Authoriser** | HoD of the location’s owner department (or deputy) | Approves issue and each renewal; accepts the return |

Plus a **clearance from every other department concerned with the location** (they run equipment or people there), any extra clearance the policy adds for the type of work, and the **Safety In-charge gate** when required.

### Departments & locations

| Entity | Fields |
|---|---|
| `departments` | `id`, `name`, `headUserId` (Senior Manager — one per dept), `deputyUserIds[]`, `siteIds[]` |
| `locations` (seeded) | `id`, `siteId`, `name` (e.g. MEE bay, RO skid, ETP clarifier), **`ownerDepartmentId`** |

**Managers in v1:** **Plant Manager** = Assistant Manager (issuer / oversight). **Head of Department** = Senior Manager (Authoriser). The Plant Manager is **never** a stand-in HoD.

### Approval selection

1. Issuer picks **one seeded location** → Authoriser = HoD of `ownerDepartmentId`
2. Issuer picks **category** (Hot / Cold) + sub-category
3. Policy adds **extra clearances** if any (e.g. welding near MEE → Electrical)
4. Policy adds the **Safety gate** if the work type is in `requireSafetyFor`
5. **One permit = one location only**

### Chain for one permit

```text
Issuer drafts (form + checklists)
    → Authoriser approves  (+ extra dept clearances, + Safety gate if policy)
    → Holder accepts, workers acknowledge → ACTIVE (until shift end)
    → 1 h before shift end: warning
    → Return (Complete / Not Complete)  |  Renewal request → Authoriser re-approves → next shift
    → Holder declares site safe → Issuer returns → Authoriser accepts → closed
```

Until all required approvals are in → status stays `PENDING_APPROVAL` — **permit not generated**.

---

## 5. Status machine & authorization

### Statuses

| Status | Meaning |
|---|---|
| `DRAFT` | Issuer filling the form (also where a rejected permit returns for revision) |
| `PENDING_APPROVAL` | Waiting on Authoriser (± extra clearances, ± Safety gate) |
| `REJECTED` | An approver rejected (with remark). Issuer may **revise → DRAFT → resubmit**; approvals reset |
| `ACTIVE` | Approved; Holder accepted; work allowed until `validTo` (shift end) |
| `RENEWAL_PENDING` | Issuer requested the next shift; waiting on Authoriser re-approval. Work stays allowed only until current `validTo` |
| `SUSPENDED` | Site emergency or changed conditions — all work stops; resumes only after Authoriser re-validates |
| `RETURN_PENDING` | Holder declared site safe and Issuer returned the permit; waiting on Authoriser acceptance |
| `COMPLETED` | Return accepted — **Work Complete** |
| `RETURNED_INCOMPLETE` | Return accepted — **Work Not Complete** (follow-up needs a new permit) |
| `CANCELLED` | Issuer / Plant Manager cancelled before or during work |

**Overdue is derived, not stored:** an `ACTIVE` or `RENEWAL_PENDING` permit with `now > validTo` shows as **Overdue** (red timer) via `isOverdue(permit, now)`. The first crossing logs a `marked_overdue` event and sends notifications.

**Handover is part of renewal:** at shift change the renewal request may name a **new issuer** and/or **new holder**; the incoming people acknowledge as part of the renewal.

Illegal jumps rejected (same spirit as leave transitions).

### Who may act

| Action | Issuer | Holder | Workers | Authoriser (HoD / deputy) | Extra dept HoD | Safety | Plant Manager | Director |
|---|---|---|---|---|---|---|---|---|
| Create / edit draft | ✓ | | | | | | ✓ | |
| Submit for approval | ✓ | | | | | | ✓ | |
| Approve / reject issue | | | | ✓ | ✓ own dept | ✓ policy | | ✓ waive |
| Accept permit for crew | | ✓ | | | | | | |
| Acknowledge | ✓ | ✓ | ✓ | | | | | |
| Request renewal | ✓ | | | | | | ✓ | |
| Approve renewal | | | | ✓ | | | | ✓ |
| Suspend / resume | ✓ suspend | | | ✓ | | ✓ suspend | ✓ | ✓ |
| Declare site safe (return) | | ✓ | | | | | | |
| Return permit | ✓ | | | | | | ✓ | |
| Accept return | | | | ✓ | | | ✓ | ✓ |
| Cancel | ✓ | | | | | | ✓ | ✓ |
| Approve emergency permit | | | | | | | ✓ | ✓ |
| Link / approve OT hours | | | | | | | ✓ | ✓ |
| View | own / issued | own | own | own dept | own dept | policy set | plant | all |

### Soft blocks

| Situation | Behaviour |
|---|---|
| Missing Authoriser / extra clearance / Safety gate | Cannot activate |
| Hot Work without fire & gas checklist, or gas reading out of limit | Cannot submit |
| Clashing active permit at the same location (`conflictRules`) | Soft-block submit; Plant Manager may override with remark |
| Approvals older than `clearanceValidityHours`, not yet active | Approvals lapse → re-request |
| Worker on approved leave that day | Soft-block (reuse leave coverage check) |
| Worker with pending safety return clearance | Soft-block (reuse Safety gate) |
| Renewal cap reached (2 renewals / 24 h) | Cannot renew — new permit (linked via `parentPermitId`) |
| Past `validTo`, not renewed / returned | Shown **Overdue**; red clock; OT Decision prompt — **do not auto-close** |

---

## 6. Policies

Versioned config (seedable), like leave policy. **Every permit stores the `policyVersion` it was issued under.**

```ts
EPermitPolicy {
  version: number;
  validity: "shift";                 // validTo = end of chosen shift (shiftMaster)
  allowStartNextShift: true;         // issuer may choose current or next shift
  maxRenewals: 2;
  maxTotalHours: 24;
  renewalRequires: ["authoriser", "issuer_ack", "holder_ack", "worker_ack"];
  warnBeforeEndMinutes: 60;
  autoClose: false;
  clearanceValidityHours: 12;
  requireSafetyFor: ["confined_space", "tank_entry"]; // + specific hot-work sub-categories as needed
  requireFireGasFor: ["hot_work"];
  gasLimits: {
    oxygen:         { min: 19.5, max: 23.5, unit: "%vol" },
    carbonMonoxide: { max: 50,   unit: "ppm" },
    hydrogen:       { lelPct: 4.0 },
    lpg:            { max: 1000, unit: "ppm" },
    ammonia:        { max: 25,   unit: "ppm" },
    chlorine:       { max: 1,    unit: "ppm" },
  };
  extraClearanceRules: [
    { category: "hot_work", subCategory: "welding", locationHints: ["mee", "near-mee"], depts: ["electrical"] },
    // …
  ];
  conflictRules: [
    { a: "hot_work", b: "tank_entry" },
    { a: "hot_work", b: "confined_space" },
  ];
  emergency: { allowedFor: ["breakdown_repair"], maxHours: 4, postReviewWithinHours: 24 };
  otLinkWhenOverdue: true;
}
```

**Engine API (client + server parity, like Safety rules):**

- `resolveAuthoriser(location) → userId` (HoD or deputy)
- `extraClearances(location, category, subCategory) → departmentId[]`
- `computeValidity(issuedAt, shiftChoice) → { shiftCode, validFrom, validTo }`
- `validateGasReadings(readings) → violations[]`
- `findConflicts(permit, activePermits) → permitId[]`
- `assertCanActivate(permit, actor)`
- `assertCanRenew(permit, actor)` — cap + status + time checks
- `isOverdue(permit, now)` / `shouldWarn(permit, now)`

---

## 7. Permit form

Layout follows a standard industrial Permit-to-Work form, adapted for Nectar.

### Part A — Header

| Field | Notes |
|---|---|
| **Permit No.** | Auto: `{SITE}/FY{yy}/{seq}` — e.g. `ETP/FY27/00123`; renewals shown as `/R1`, `/R2` |
| Status | Live status (§5) |
| **Hot Work / Cold Work** | Category + sub-category |
| **Planned schedule** | From – To, inside the chosen shift (current or next) |
| Plant / Location | Site + **one** seeded location |
| Work description | What work / why |
| Emergency | Toggle — breakdown repair only (§9) |
| Workers + **Permit Holder** | Assigned employees; one marked as Holder |

### Part B1 — Safety measures taken (Yes / NA)

1. Equipment is free from flammable / hydrocarbon / toxic gases
2. Equipment properly drained, cleaned
3. Water seal has been made
4. Bleeders have been opened
5. Nitrogen purging has been done
6. Radioactive sources protected
7. Mechanical ventilation (blower)
8. Scaffold / ladder / grating / platform
9. Spill kit / containment
10. Cylinder / actuator resting position

### Part B2 — Potential hazards & special precautions

Free text (e.g. “fall hazard — use safety belt”, “sharp edges — gloves”). Also holds the **JSA reference number** (§16).

### Part B3A — PPE & others (Yes / NA)

Eye protection · Face protection · Ear protection · Leg protection / apron · Head protection · Body protection · Full body safety harness · BA set / ELBA · Dust mask · Safe means of access · Enclosures · Scaffolding · Roof ladder · Gas cutting set · Portable CO monitor · **+ 3 custom rows** (e.g. “Use goggle”)

### Part B3B — Fire precautions & gas tests (Yes / NA; required for Hot Work)

Competent fire watcher · Fire extinguishers · Pressurised fire hose · Fire tender · Screen off area · Explosive test · Carbon monoxide test · Oxygen test · Toxic gas test

Gas tests capture **numeric readings**, validated against `gasLimits`:

| Gas | Safe concentration (8 h) | Flammable limit (lower – upper) |
|---|---|---|
| Oxygen | 19.5 – 23.5 % vol | — / >23.5 % |
| Carbon monoxide | 50 ppm | 12.5 % – 74.2 % |
| Hydrogen | — | 4.0 % – 75 % |
| LPG | 1000 ppm | 2.2 % – 9.9 % |
| Ammonia | 25 ppm | 15 % – 23 % |
| Chlorine | 1 ppm | — |

### Part B3C — Associated certificates (tick + reference no.)

Tool Box Talk · Confined Space Entry · LOTO · Electrical · Road Closure · Scaffolding · Working at Height · Excavation · Heavy Lift · Radiography · Hydra / Farana

For now: **tick + reference number only** — no separate certificate documents (§16).

### Part C — Signatories

Issuer, Holder, Authoriser (+ extra clearances, Safety): name, contact, **Acknowledge** with timestamp, optional lat/long, permit validity from – to.

### Part D — Return

Three outcomes — **Work Complete**, **Work Not Complete**, **Cancellation** — each with three steps:

1. **Holder** — site & equipment left in safe condition (acknowledge)
2. **Issuer** — returns the permit (acknowledge + note)
3. **Authoriser** — accepts the return (acknowledge)

Each step records **time, day and date** — e.g. *14:32, Wednesday, 7 Oct 2026*.

### Part E — Re-validation (Renewal 1 / Renewal 2)

Per renewal: validity from – to (next shift), Issuer / Holder / Authoriser acknowledgements, certificates re-ticked, gas readings re-taken for Hot Work.

### Back panel — Rules & emergency contacts

Shown on the permit view and the PDF:

1. Permit is valid for one shift; it can be renewed for two more shifts (24 h max).
2. Permit is not valid if conditions at the location become hazardous, or in any emergency / fire.
3. Only authorised people issue permits.
4. All working instructions & protocols are strictly followed.
5. If not completed within the valid period, re-approval is required.
6. Permit is returned to the Authoriser after job completion.
7. Teams coordinate for safety when working together.
8. No job is attempted without a permit.
9. Workers are briefed about dangers before starting.
10. People working at height and in confined spaces must be medically fit.
11. Certificates are required for activities like excavation, working at height, scaffolding, etc.
12. Confined-space gas results are recorded periodically.
13. Risk assessment is mandatory for all permits.

**Emergency contacts** — configured per site (Emergency team, mobile, extension).

### Signature = Acknowledge button (v1)

- Every signatory presses **Acknowledge**; it records `userId`, role, timestamp, context (`issue` / `approval` / `renewal` / `return`) and optional lat/long.
- Workers acknowledge on **their own login** if they have one, otherwise on the **Holder’s / Issuer’s device** in person; the record notes which device (`via: self | holder | issuer`).
- Drawn signature / OTP can be added later without changing the data model.

**Literacy path:** the Issuer creates the permit; workers never draft it — they only **acknowledge**.

---

## 8. Validity, renewal, return, OT link

### Validity = one shift

Uses the existing shift master (`client/lib/shift/store.ts`):

| Shift | Window |
|---|---|
| A | 06:00 – 14:00 |
| B | 14:00 – 22:00 |
| C | 22:00 – 06:00 |
| G | 09:00 – 18:00 |

1. At issue, the Issuer picks **current shift** or **next shift**; `validTo` = end of that shift.
2. **No auto-close.**
3. Notification **1 hour before** `validTo` → issuer, holder, workers, Authoriser.
4. At `validTo` the Issuer must **return** the permit or have a **renewal approved**.
5. Otherwise it shows **Overdue** with a **red** timer until someone acts.

**Example:** issued 10:00 in A → valid to 14:00 → Renewal 1 = B (14:00–22:00) → Renewal 2 = C (22:00–06:00) → after that, a new permit.

### Renewal = re-approval

| Step | Who |
|---|---|
| Request renewal (may name new issuer / holder for the next shift) | Issuer |
| Re-tick certificates; re-take gas readings for Hot Work | Issuer |
| **Approve renewal** | **Authoriser** (HoD / deputy) |
| Acknowledge | Incoming issuer (if changed), Holder, workers |
| System | `validTo` = end of next shift; `renewalCount + 1`; renewal record `/R1` or `/R2` |

Cap: **2 renewals, 24 h total**. After that the work continues only under a **fresh permit** (`parentPermitId` links them).

### Return

See §7 Part D. Holder → Issuer → Authoriser, with **time, day and date** at each step.

Stored on the permit: `completedAt` (Authoriser acceptance), `actualHours`, return outcome, and **completed within validity?** (`completedAt ≤ validTo`).

### OT integration

| Record | Source |
|---|---|
| What work OT was for | `permitId` + description snapshot |
| Who approved permit | Approval audit |
| Who approved OT hours | Plant Manager via existing OT Decision / Assign |
| Hours approved vs actual | OT assignment fields + permit `actualHours` |
| Completed in limit? | `completedAt ≤ validTo` |

Add OT trigger: `e_permit_overrun` (alongside `leave_cover`, `breakdown_repair`).

---

## 9. Emergency permits, deputies, suspension

### Emergency permit (breakdown repair)

| Rule | Value |
|---|---|
| Allowed for | `breakdown_repair` sub-categories only |
| Approver | **Plant Manager** (or Director) instead of Authoriser / Safety |
| Window | **4 h** max; renewal → normal Authoriser path |
| Post-review | Authoriser (and Safety if policy matches) reviews within **24 h**; overdue reviews notify Director |
| UI | **Emergency** badge on list and detail |

### HoD deputies

- Each department has `deputyUserIds[]`.
- When the HoD is on approved leave (or marked unavailable), approvals route to the deputy.
- Audit records *“approved by <deputy> on behalf of <HoD>”*.

### Suspension

- Issuer, Authoriser, Safety, Plant Manager or Director can **suspend** a permit (emergency, alarm, changed conditions).
- A **site-wide emergency** suspends every active permit at that site.
- Resume needs **Authoriser re-validation** (gas readings re-taken for Hot Work). The validity clock does not extend.

---

## 10. Visibility & audit trail

### Visibility

| Audience | Sees |
|---|---|
| Workers / Holder | Own permits |
| Issuers | Permits they issued |
| Authorisers / extra-clearance HoDs (+ deputies) | Permits for their department |
| Plant Managers | All permits at their plant |
| Directors / Safety In-charge | Org / policy-scoped as RBAC allows |

Do **not** show every plant’s permits to every supervisor.

### Audit trail (append-only)

| Event | Fields |
|---|---|
| Created / submitted / resubmitted | actor, at, draft snapshot, policyVersion |
| Approved / rejected | role (authoriser / dept / safety), actor, on-behalf-of, remark |
| Approvals lapsed | at |
| Conflict override | actor, conflicting permitIds, remark |
| Holder accepted / acknowledged | userId, role, context, at, lat/long |
| Activated | at, validTo, shiftCode |
| Gas readings | readings, actor, at |
| Renewal requested / approved | actor, new validTo, renewalCount |
| Warning sent / marked overdue | at |
| Suspended / resumed | actor, reason, at |
| OT linked | otDecisionId / assignmentId |
| Emergency post-review | reviewer, remark, at |
| Return steps | holder / issuer / authoriser, outcome, at |
| Cancelled | actor, remark |

---

## 11. Data model (proposed)

```text
departments          — id, name, headUserId, deputyUserIds[], siteIds[]
locations            — id, siteId, name, ownerDepartmentId
site_emergency_contacts — siteId, team, mobile, extension
e_permit_policies    — versioned rules (§6)
e_permit_sequences   — siteId, fy, lastSeq
e_permits            — permitNo, siteId, locationId, category, subCategory,
                       status, emergency, policyVersion,
                       issuerId, holderId, workerIds[], authoriserId,
                       extraDeptIds[], safetyRequired,
                       shiftCode, plannedFrom, plannedTo, validFrom, validTo,
                       renewalCount, parentPermitId,
                       description, hazardsText, jsaRef,
                       returnOutcome, completedAt, actualHours
e_permit_approvals   — permitId, kind (authoriser|dept|safety|emergency),
                       departmentId, status, actorId, onBehalfOf, remark, at
e_permit_checklists  — permitId, block (safety_measures|ppe|fire_gas|certificates),
                       items[{ key, value: yes|na, refNo?, note? }]
e_permit_gas_readings — permitId, renewalNo, gas, value, unit, ok, actorId, at
e_permit_renewals    — permitId, renewalNo, validFrom, validTo,
                       issuerId, holderId, approvedBy, at
e_permit_acks        — permitId, userId, role, context, via (self|holder|issuer), at, lat?, lng?
e_permit_events      — append-only audit
```

**Nest:** `server/src/modules/e-permits/` + Mongoose schemas.  
**Client:** `client/lib/e-permit/` — `types`, `rules`, `store`, `transitions`, tests.  
**Parity:** client `rules.ts` === server `e-permit-rules.ts` (Safety pattern).

All timestamps stored in UTC; displayed in plant local time as time, day, date.

---

## 12. Routes & UI

| Route | Purpose |
|---|---|
| `/e-permits` | Inbox / KPIs — pending approval, active, renewal pending, overdue, suspended |
| `/e-permits/new` | Issuer wizard: Part A → B1 → B2 → B3 → workers & holder → submit |
| `/e-permits/[id]` | Permit view in form layout (Parts A–E + rules panel), timer, actions, audit, OT link |
| `/e-permits/policies` | Director / Safety / Admin view of policy (read; edit later) |

**Nav:** own top-level **E-Permits** menu next to Safety, behind a feature flag (§15 #6).

**Demo roles to seed:** one HoD login per department (Senior Manager) + one deputy each; locations with owner departments; Plant Manager stays a separate login and is not mapped as any HoD.

---

## 13. Cross-module hooks

| Module | Hook |
|---|---|
| **Shifts** | `shiftMaster` drives validity; renewal = next shift; issuer / holder change at shift change |
| **Leave** | Soft-block workers on covering leave; HoD on leave → deputy |
| **Safety** | Safety gate only if `requireSafetyFor` matches; pending return clearance blocks a worker; **breakdown repair needs an E-Permit** (emergency path allowed); site emergency → suspend permits |
| **OT** | Overdue → `e_permit_overrun` decision; Assign OT prefills permit id + hours |
| **Notifications** | Approval request, renewal request, 1h warning, overdue, suspended, return pending, emergency post-review due |
| **Employees** | Department field → worker / holder / HoD / deputy resolution |
| **Reliever** | No direct link |

**Nothing breaks:** default off until feature flag / nav enabled; existing leave/OT/safety tests unchanged when no permits exist.

---

## 14. Delivery phases

| Phase | Deliverable |
|---|---|
| **0** | Departments (HoD + deputies), seeded locations with owner dept, permit number series, site emergency contacts, RBAC block, nav stub behind flag |
| **1** | Policy engine (versioned): authoriser resolution, extra clearances, shift validity, gas limits, conflicts; status machine; unit tests (client/server parity) |
| **2** | Issuer wizard — Part A header, B1 safety measures, B2 hazards, B3A PPE, B3B fire & gas with readings, B3C certificate ticks; list + detail |
| **3** | Approvals (Authoriser / deputy, extra clearances, Safety gate) → Holder accept + worker acknowledge → ACTIVE; reject → revise → resubmit; approvals lapse; visibility scoping |
| **4** | Shift-based timer, 1h warning scheduler (server-side), derived Overdue red UI |
| **5** | Renewal = re-approval (R1 / R2, cap 24 h), issuer / holder change at shift change, fresh linked permit after cap |
| **6** | Return flow (Complete / Not Complete / Cancel) — Holder → Issuer → Authoriser, time-day-date at each step; suspend / resume |
| **7** | Emergency permit path + post-review; OT Decision trigger + Assign prefill + actual vs approved hours |
| **8** | Permit PDF in form layout (Parts A–E + rules panel), reuse jspdf pattern |

Costing note: all of this stays on the shared EC2 + DocumentDB + S3 stack in [FEATURE_INVENTORY_AND_COSTING.md](./FEATURE_INVENTORY_AND_COSTING.md) — **Included in platform** except SES/SMS if you notify by email/SMS.

---

## 15. Decided answers

| # | Question | Decision |
|---|---|---|
| 1 | Department heads | **Plant Manager** = Assistant Manager; **Head of Department** = Senior Manager. Separate HoD login per department; Plant Manager never acts as HoD. |
| 2 | Location master | **Seeded locations**, each with an **owner department**. Free text only later if asked. |
| 3 | Safety In-charge | Approves **only** when `requireSafetyFor` matches. Policy gate, not a rank. |
| 4 | Multi-site permits | **No.** 1 E-Permit = 1 location. |
| 5 | Who issues / signs | **Issuer** creates; Issuer, Holder, workers and Authoriser all **acknowledge**. |
| 6 | Nav placement | **Own top-level E-Permits menu** next to Safety, behind a feature flag. |
| 7 | Breakdown repair | **Requires an E-Permit**; emergency path (§9) covers off-hours. |
| 8 | Validity | **One shift** (from shift master). Not done → **re-approval** via renewal. **2 renewals, 24 h max**; then a new permit. No auto-close. |
| 9 | Signature | **v1 = Acknowledge button.** |
| 10 | Approval model | **Authoriser = HoD of the location’s owner department.** Every other **concerned department** at the location clears every permit there (8 Oct 2026); policy rules may add more for the type of work. |
| 11 | Permit Holder | **Yes** — crew lead picked from workers; accepts permit, declares site safe on return. |
| 12 | Return | **Work Complete / Work Not Complete / Cancelled**, Holder → Issuer → Authoriser; time, day, date at each step. |
| 13 | Permit form | Parts A–E + rules panel as in §7. Certificates as tick + reference number for now. |
| 14 | Review fixes | Emergency path, HoD deputies, conflict check, reject → resubmit, approval validity, derived Overdue, policy version on permit, suspension. |
| 15 | Issued near shift end | **Issuer picks** *current shift* or *next shift* at issue. |
| 16 | G shift (09–18, 9 h) | Counts as **one shift** — valid until 18:00. |
| 17 | Worker acknowledgement device | **Both allowed** — own login if the worker has one, otherwise on the Holder’s / Issuer’s device in person (recorded as such). |
| 18 | Handover | **Merged into renewal** — the renewal request may name a new issuer / holder; no separate handover status. |
| 19 | Suspension | **No extra time** — on resume the permit still ends at the original `validTo`; renew if more time is needed. |
| 20 | Defaults | Approval validity **12 h**, emergency window **4 h**, emergency post-review **24 h** — confirmed. |
| 21 | Concerned departments | **All, always** — each concerned department clears every permit at the location; the issuer cannot skip one. Lists are **seeded** and the **Director / that plant's Plant Manager** edit them (Policy & rules → Locations). |

### Still open

- Nothing for the permit section. JSA, Tool Box Talk and certificate documents remain out of scope (§16).

---

## 16. Out of scope (for now)

Referenced on the permit by number only; full documents later if needed:

- **JSA / Risk Assessment** — job steps, hazards, consequences, controls
- **Tool Box Talk** — briefing with attendance (re-done on renewal)
- **Certificates as documents** — Working at Height, Confined Space, LOTO, Electrical, Excavation, etc., each with its own checks and lifecycle
- **Road Closure** 7-day validity exception (belongs with the certificate engine)
- **Medical fitness** records for height / confined-space work

---

## 17. Implementation notes

Built 8 Oct 2026. Where the code differs from the wording above, the code is the reference.

### Where it lives

| Layer | Path |
|---|---|
| Shared rules (identical copies, parity-tested) | `client/lib/e-permit/rules.ts` ↔ `server/src/modules/e-permits/e-permit-rules.ts` |
| API (Nest) | `server/src/modules/e-permits/` — controller, service, scheduler (1-min tick; `EPERMIT_SCHEDULER=off` disables) |
| Schemas | `server/db/schemas/e-permit.schema.ts`, `e-permit-master.schema.ts` |
| Seeds | `server/db/seeds/e-permit.seed.ts`; non-destructive `npm run seed:e-permits` |
| Client data | `client/lib/api/e-permits.ts`, `client/lib/e-permit/{store,hooks,views,permit-pdf,feature}.ts` |
| Pages | `/e-permits`, `/e-permits/new`, `/e-permits/[id]`, `/e-permits/policies` |
| Components | `client/components/e-permit/` (`PermitDetail`, `PermitBits`, `ActivePermitsPanel`) |
| Translations | `client/lib/i18n/catalog/e-permit.ts` (Hindi / Marathi) |

### Differences from the plan text

- **One collection per permit.** Approvals, renewals, acknowledgements, gas readings and the audit timeline are embedded in each `e_permits` document (same pattern as Safety) instead of separate `e_permit_*` collections. Masters are separate: `departments`, `permit_locations`, `site_emergency_contacts`, `e_permit_sequences`.
- **Policy is versioned in code** (`EPERMIT_POLICY`, v1) and served read-only at `GET /e-permits/policy`; each permit stores `policyVersion`. Editing the policy in the app is still "later".
- **Shift choice:** the issuer picks any shift (A / B / C / G); the window is the occurrence running now, or the next one. If approvals finish after that shift ended, the permit activates on the shift running at that moment (audited).
- **Issuer acknowledges on submit** ("Acknowledge & submit"). Holder and every worker acknowledge before the permit goes ACTIVE; for a renewal, the holder, workers and any incoming issuer acknowledge before the Authoriser can approve it.
- **Cancelling:** the issuer cancels before work starts; once live, only the Plant Manager / Director cancels directly — everyone else uses the return flow with outcome "Cancelled".
- **Send back:** an Authoriser who sends a return back puts the permit where it was returned from (ACTIVE, or SUSPENDED). Returning a permit withdraws a pending renewal.
- **Deputies** may always approve on the HoD's behalf (recorded "on behalf of"); when the HoD marks themselves unavailable (Policy & rules page), approval requests also go to the deputies.
- **Safety emergency hook:** raising an emergency incident in Safety suspends every live permit at that site.
- **Breakdowns:** the Safety breakdown page lists linked permits, offers "Issue E-Permit for this repair" (emergency, prefilled) and disables "Request repair OT" until a permit exists.
- **OT:** new OT trigger `e_permit_overrun`; "Raise OT for extra hours" on a permit creates the OT decision and links it both ways.
- **Concerned departments** (`permit_locations.concernedDepartmentIds`): every listed department must clear each permit at the location, in parallel with the Authoriser; the policy's extra-clearance rules are added on top, without duplicates. Edited at `PATCH /e-permits/locations/:id/departments` (Director, or the plant's Plant Manager) and on Policy & rules → Locations; permits still **waiting for approval** are brought in line at once (clearances added and those HoDs asked; pending ones no longer needed dropped; audited as "Clearances added: …"), and again at every server start — which picks up a re-seed. Live and closed permits keep the clearances they went live with. `npm run seed:e-permits` fills only empty lists, so edits survive a re-run (a list cleared to empty is refilled). Audit entries name the department ("Department clearance — Mechanical approved").
- **HoD logins** are server accounts (role `hod`, person id `user:<email>`): 4 departments × head + deputy, password `nectar2026`. HoDs land on the E-Permits inbox.

### How it was tested

| Suite | Command | Result |
|---|---|---|
| Rules + RBAC unit tests (Vitest, incl. client/server parity and shift-master match) | `cd client && npx vitest run lib/e-permit` | 44 / 44 |
| API end-to-end (test DB) | `cd server && API=http://localhost:3011/api npx ts-node test/e-permits.e2e.ts` | 136 / 136 |
| Clock + soft blocks in the real Nest app (test DB) | `cd server && MONGODB_DB_NAME=nectar_enviro_test npx ts-node test/e-permits-clock.e2e.ts` | 20 / 20 |
| Browser flow (Playwright, test DB) | `cd client && node e2e/e-permit-flow.mjs` | 34 / 34 |
| i18n | `cd client && npm run i18n:check` | 0 missing |
| Production build | `cd client && npx next build` | passes |

The end-to-end suites run against `nectar_enviro_test` only (`npx ts-node db/scripts/copy-to-test-db.ts`, then `MONGODB_DB_NAME=nectar_enviro_test npm run seed:e-permits`); setup lines are at the top of each test file.

---

## One-line stakeholder view

> **E-Permit** = a **one-shift**, **one-location** permission to work, issued by Supervisor / SIC / Plant Manager, **authorised by the HoD who owns the location** (plus extra clearances and Safety only when policy says so), held by a named **Permit Holder** and **acknowledged** by the crew. If the work isn't done by shift end it needs **re-approval** (up to 2 renewals, 24 h max). It is closed by a **Holder → Issuer → Authoriser** return that records time, day and date, and is wired into Shifts / Leave / Safety / OT so every hour stays one audited story.
