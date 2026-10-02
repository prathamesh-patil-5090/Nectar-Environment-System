# Manual test suite — Leave / Reliever / Ops engines

Password for **all** accounts: `nectar2026`  
Roster / gap clock: **2026-09-23**  
App: `http://localhost:3000`  
Reset: App shell → **Reset demo data** (before each major scenario if state is dirty)

Credentials export:

```bash
npx tsx client/scripts/seed-demo-credentials.ts
```

See `docs/demo-credentials.md`.

---

## 0. Setup smoke

| ID | Steps | Expect |
| --- | --- | --- |
| S0 | Open login; sign in as `director@nectarenviro.com` | Dashboard loads; all nav modules visible |
| S1 | Sign out; login `etp.shift@nectarenviro.com` | Plant-scoped nav (ETP); Reliever Pool, Shifts, Leave, OT |
| S2 | Login `shilpa.hotkar@nectarenviro.com` | Employee leave/self-service only |
| S3 | Login `site@nectarenviro.com` (hidden role — type email manually) | Session starts as site_incharge |
| S4 | Reset demo data | Seed leaves/pool/OT decisions/lifecycle restore |

---

## 1. Leave basics + soft withdraw

| ID | Role | Steps | Expect |
| --- | --- | --- | --- |
| L1 | Employee Shilpa | New leave (future working days) → submit | Status `REQUESTED` |
| L2 | Supervisor ETP | Verify leave | `SUPERVISOR_VERIFIED` |
| L3 | Employee | Soft withdraw **before** site approve with reason | `CANCELLED`; kept visible |
| L4 | Employee | After SIC site-approves, try withdraw | Blocked |
| L5 | Supervisor MEE | File emergency on behalf → employee consent | Emergency path statuses |

---

## 2. Shift Impact

| ID | Role | Steps | Expect |
| --- | --- | --- | --- |
| SI1 | SIC ETP | Open leave with working days → Shift Impact panel | Vacancies per shift; risk / OT estimate |
| SI2 | SIC | Same plant second overlapping leave | “Competing plant overlaps” section |
| SI3 | Any ops | Impact shows candidates (employees + pool) when available | Ranked people listed |

---

## 3. Manpower + Conflict

| ID | Role | Steps | Expect |
| --- | --- | --- | --- |
| MC1 | SIC/Manager | `/shifts/manpower` date window around 2026-09-23 | Issues: open vacancy, overlaps, rest, etc. |
| MC2 | SIC | Leave at `SUPERVISOR_VERIFIED` → Site approve **without** cover | Hard block |
| MC3 | SIC | Same leave → Accept OT **or** assign cover → Site approve | Succeeds (OT may need OT Decision soft clear — see §6) |
| MC4 | Director | Rotation publish with uncovered gaps, no OT ack | Blocked |
| MC5 | Director | Check “Accept OT…” + remark | Publishes when only vacancy blockers remain |

---

## 4. Reliever Match (planned — UI may be partial)

| ID | Role | Steps | Expect |
| --- | --- | --- | --- |
| RM1 | SIC | Leave Replacement radios | Shows candidates (local/cluster emp + pool) |
| RM2 | SIC | Pick person → Cover this shift | Assigns; pool/employee marked |
| RM3 | — | Dedicated `/reliever-pool/match` workspace | **Not shipped yet** — skip or treat as follow-up |

---

## 5. Reliever Competition

| ID | Role | Steps | Expect |
| --- | --- | --- | --- |
| RC1 | Manager | Reliever Pool → **Competition** (or `/reliever-pool/competition`) | Contested people; claims table |
| RC2 | SIC | Leave Replacement → pick contested candidate → Cover | Soft-blocked until Manager Award/Ack |
| RC3 | Manager | Competition → **Acknowledge** with remark for leave A | SIC can then assign that person to A |
| RC4 | Manager | **Award** to one claim | Winner covered; losers need_alt |
| RC5 | Any | Manpower hub → Reliever contest issue | Links to Competition |
| RC6 | Manager | Already-assigned person (e.g. Rina) contended | `already_assigned` kind visible |

---

## 6. OT Decision

| ID | Role | Steps | Expect |
| --- | --- | --- | --- |
| OT1 | Manager | OverTime → **Decisions** | Pending seeded cases (ETP gap, MEE) |
| OT2 | SIC | Leave with candidates still listed → Accept OT | Soft block (reliever_available / over daily max) |
| OT3 | Manager | Decisions → Approve with remark (+ optional assignee) | Status approved; optional Assign prefill |
| OT4 | SIC | After approve, Accept OT on leave | Succeeds |
| OT5 | Manager | Block a decision | OT path blocked until cover/new decision |
| OT6 | SIC | Clean gap (no candidates, under thresholds) | SIC may accept OT without Manager |
| OT7 | Director | Rotation OT ack with soft flags | Remark clears / records decision |
| OT8 | Manager | `/overtime/assign` | Prefill from approved decisions |

---

## 7. Lifecycle / Coverage

| ID | Role | Steps | Expect |
| --- | --- | --- | --- |
| LC1 | Manager | Leave → **Lifecycle / Coverage** | Cases: extension, due return, emergency, cover… |
| LC2 | Manager | Seeded Mohee (`lv8`) extension → Close with remark | `CLOSED`; cover released |
| LC3 | Supervisor | Approved leave → Confirm return **after** expected date | `EXTENSION_REQUIRED`; cover **kept** |
| LC4 | Supervisor | Try close extension | Soft-blocked (Manager only) |
| LC5 | Supervisor | Confirm return **on/before** expected | `CLOSED`; cover released |
| LC6 | SIC/Manager | Active cover → Report no-show | Cover cleared; case `cover_disrupted` |
| LC7 | Any | Manpower → Leave extension / Cover disrupted | Links to Lifecycle |
| LC8 | Employee | Soft withdraw (pre-site) | Cover released if any; lifecycle notes cancelled |

---

## 8. End-to-end happy path (ETP)

| Step | Role | Action | Expect |
| --- | --- | --- | --- |
| 1 | Reset demo | — | Clean seeds |
| 2 | Shilpa | File planned leave (working days) | REQUESTED |
| 3 | Supervisor | Verify | SUPERVISOR_VERIFIED |
| 4 | SIC | Replacement → pick pool/employee (if contested → Manager Competition first) | Cover arranged |
| 5 | SIC | Site approve | SITE_APPROVED |
| 6 | Manager | Approve | MANAGER_APPROVED |
| 7 | Director | Finalize | APPROVED |
| 8 | Supervisor | On-time return | CLOSED + cover free |
| 9 | Manpower | Window includes leave dates | No attention vacancy for that leave |

---

## 9. End-to-end shortage path (OT)

| Step | Role | Action | Expect |
| --- | --- | --- | --- |
| 1 | Create/use leave with no usable cover | — | OT flags on Replacement |
| 2 | SIC | Accept OT | Soft-blocked if flags |
| 3 | Manager | OT Decisions → Approve + remark | Decision approved |
| 4 | SIC | Accept OT / site approve | `ot_fallback` |
| 5 | Assign | Prefill assignee if chosen | Notification queued |

---

## 10. Automated regression (optional)

```bash
cd client && npx vitest run \
  lib/ops-flow.test.ts \
  lib/manpower-conflict/manpower-conflict.test.ts \
  lib/reliever-competition/reliever-competition.test.ts \
  lib/ot-decision/ot-decision.test.ts \
  lib/leave-lifecycle/leave-lifecycle.test.ts \
  lib/shift-impact/shift-impact.test.ts
```

---

## Role cheat sheet (primary)

| Need | Login |
| --- | --- |
| Org-wide | `director@nectarenviro.com` |
| HR | `hr@nectarenviro.com` |
| ETP Manager | `etp.manager@nectarenviro.com` |
| ETP SIC | `etp.shift@nectarenviro.com` |
| ETP Supervisor | `etp.supervisor@nectarenviro.com` |
| ETP Employee | `shilpa.hotkar@nectarenviro.com` |
| RO Manager | `ro.manager@nectarenviro.com` |
| MEE Manager | `mee.manager@nectarenviro.com` |
