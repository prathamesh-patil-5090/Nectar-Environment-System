# Nectar Enviro Ops Console — Page Features (Presentation Notes)

**Audience:** Anyone (ops, HR, management, non-technical)  
**Purpose:** Short feature bullets per page for PPT slides  
**Note:** This is a **demo** system — sample plants ETP, RO, MEE

---

## Login

- Sign in with role-based demo accounts (Manager, Supervisor, Shift In-Charge, Employee, etc.)
- Each role sees only the menus they need
- Secure session kept in the browser until logout

---

## Dashboard

- Snapshot of workforce health across plants
- Key numbers: people, sites, skills, urgent training
- Skill coverage view — where the team is strong or weak
- Site readiness — which plants are prepared to run

---

## Employees

- Full list of people across plants
- Search and filter by role or training status
- Click anyone to open their profile

### Employee profile

- Personal and plant details
- Skill map vs what their role needs
- Training progress, due dates, and weak areas
- Managers / Admin can assign or flag training

---

## Sites

- List of plants (ETP, RO, MEE, etc.)
- Headcount and readiness per site
- Shared reference used by shifts, leave, OT, and relievers

---

## Notifications

- In-app inbox for leave consent, OT, and other alerts
- Unread count on the bell icon
- Open an item and act from here

---

## Training / Academy

### Training home

- Personal learning shelves: assigned, recommended, continue, role-required
- Managers / HR see team progress and academic records instead

### Explore

- Browse the full course catalog
- Search and filter by domain, plant, level

### Course page

- About the course, syllabus, and assessment steps
- Enroll or resume learning

### Learn (course player)

- Lessons, quizzes, and skill checks
- Written and practical / oral assessment path

### My learning

- In progress, assigned, suggested, and completed courses
- Assessment schedule in one place

### Events

- Training events like meetups — list or calendar
- RSVP, waitlist, and discussion

### Communities

- Join learning communities by topic
- See members and related events

### Mentors

- Find mentors and their profiles
- Mentors can create and manage training events

### Team training

- Supervisors / Shift leads see their team’s progress (view only)

### Certifications

- Certificates and compliance credentials overview

---

## Shifts

### Shifts dashboard

- Who is on A / B / C / General today
- Flags: change requests, conflicts, uncovered seats
- OT causes and quick insights

### Shift Master

- Define shift timings (Morning, Afternoon, Night, General)
- Set rotation patterns and rest rules
- Configure weekly offs

### Schedule

- Day-by-day planned roster
- Planned vs actual when recorded
- Filter by date, site, or person

### Rotation

- Build the monthly shift plan for a plant
- Demo roster: 4 people per plant (A, B, C, Reliever)
- Manager reviews → Admin publishes
- Same month cannot be rebuilt once published

### Change requests

- Request a one-day shift swap
- Shows shortage and OT risk before approval
- Site / Shift In-Charge approve or reject

### Reliever allocation

- Forecast tomorrow’s manpower gaps
- Suggest qualified backups from the pool
- Warn when OT may be needed

### Manpower conflict

- Spot overlapping leave / cover / roster issues
- Links into leave and reliever actions

### Deviations

- Where planned shift differed from actual
- OT hours linked to unplanned moves

---

## Reliever Pool

### Pool home

- Shared backup manpower by plant cluster (not one site only)
- Mark relievers Available / Assigned / Not available
- Find replacement for open absences
- Flow: local backup → cluster pool → OT only if needed

### Competition

- When two absences need the **same** backup person
- Manager decides who gets them (Award) or allows one claim (Acknowledge)
- Losers must pick another cover or OT

---

## Leave

### Leave overview

- Role-based snapshot: who is on leave, shortages, OT risk
- Quick links to requests and follow-ups

### Leave requests

- File planned leave or record an emergency absence
- Supervisor can enter leave on behalf of a worker (worker must consent)
- Table of all requests with status and OT risk

### Leave detail

- Full leave story: dates, reason, approvals
- Which shifts are hit day by day
- Arrange cover: pool / employee / named OT person
- Approval chain: Supervisor → Shift In-Charge (cover) → Manager → Admin

### Leave lifecycle / coverage

- After cover is set: return due, late return, extension, cover broken
- Confirm return to duty
- Late return keeps the cover until Manager closes the extension

### Pending justifications

- HR follow-up: missing info, unexplained absence, extensions

### Leave management

- Plant-level exceptions and shortage impact
- Who is driving OT risk from leave

---

## OverTime (OT)

### OT overview

- Total OT hours, days, people, and cost
- Highest OT site and employee
- Trend charts and simple insights

### OT by employees

- Who is doing the most OT
- Drill into one person’s OT history

### OT by sites

- Which plants generate the most OT
- Department / shift breakdown on site detail

### OT analysis

- Heatmaps and comparisons across sites and people
- Patterns: repeated OT, concentration, rising trend

### OT decisions

- Manager reviews soft-blocked OT cases
- Approve or block with a remark before OT is accepted

### OT assign / notify

- Manager assigns OT to a person and notifies them
- Prefills from approved decisions when available

### OT reports

- Download Excel packs for management (employee, site, monthly, yearly)

---

## Safety

### Safety overview

- Open incidents, breakdowns, and urgency at a glance

### Report incident

- Log what happened, who was involved, severity
- Attach photos / video
- Keeps notifying until the case is closed

### Incidents history

- Past and open incidents / near-misses
- Detail page: timeline, gallery, PDF, follow-up actions

### Breakdowns

- Why a plant is down, how long, who worked OT to fix it
- Can request repair OT from here

### Protocols

- Safety protocols list — add, edit, soft-delete (Safety / Admin)

### Safety training

- Training courses filtered to safety topics (LOTO, confined space, etc.)

---

## Other pages

### Salary

- Placeholder / light view for salary-related info (demo)

### Meetings

- Placeholder for meeting / video call entry (demo)

---

## How the big pieces connect (one slide)

```text
Plan shifts → Someone on leave → Find reliever →
If contested, Manager decides → If no cover, OT (last resort) →
Safety clears injured people before return → Reports for management
```

**Core idea:** Plan ahead, cover with relievers first, use overtime only when needed — with a clear record of who approved what.

---

# Systems in detail (for deeper PPT slides)

---

## 1. Shifts & Reliever system

### What problem it solves

Plants need the right people on Morning (A), Afternoon (B), Night (C), and General duty — planned **ahead**, not only after someone fails to show up. When someone is missing, the system tries **backup manpower (relievers)** before overtime.

### How shifts work (simple flow)

1. **Shift Master** — company sets what A/B/C/General mean (timings, rest gap, weekly off).
2. **Rotation** — Shift In-Charge builds the **monthly plan** for a plant (demo: 4 people per plant).
3. **Manager views** the full month, then Approves or Rejects with a remark.
4. **Admin views** and gives final publish — plan goes live on the **Schedule**.
5. Once a month is published, that plant **cannot submit another draft** for the same month.
6. Day-to-day, anyone can see who is planned where on **Schedule**.
7. One-day swaps go through **Change requests** (shortage + OT risk shown before approve).

### Shift pages at a glance

| Page | In plain words |
|---|---|
| Dashboard | Today’s picture + problems (conflicts, uncovered seats) |
| Master | Rule book for shifts |
| Schedule | Calendar of who works which day |
| Rotation | Build and approve the month |
| Change requests | Swap one shift for one day |
| Reliever allocation | **Forecast** gaps before they hurt |
| Manpower conflict | Catch leave vs roster clashes |
| Deviations | Where reality differed from the plan |

### How relievers work

Relievers are a **shared backup pool** for a cluster of plants — not stuck to one site forever.

**Order of filling a gap:**

1. Local / home-site backup first  
2. Someone free in the **cluster pool** (right skills / plant type)  
3. Only then **OT** (last resort)

Supervisors mark each reliever: Available / Assigned / Not available.  
**Find replacement** runs that search when an absence is open.

### Reliever Competition

Sometimes two leaves need the **same** backup person.

- System flags a **contest**
- Shift In-Charge cannot silently assign that person
- **Manager** either:
  - **Awards** them to one leave (others must find someone else), or
  - **Acknowledges** that one leave may use them
- OT is never blocked by competition — only the contested person is

### How shifts + relievers connect to leave & OT

```text
Monthly rotation published
        ↓
Someone on leave / absent
        ↓
Which shifts are uncovered?
        ↓
Reliever Pool (local → cluster)
        ↓
Same person wanted twice? → Competition (Manager)
        ↓
Still no cover? → OT (last resort)
```

---

## 2. Leave system

### What problem it solves

Leave is not only “approve holiday.” It is: **who is away → which shifts break → who covers → when they return → release the cover.** That keeps plants running and avoids surprise OT.

### Two ways leave starts

| Type | How it starts |
|---|---|
| **Planned leave** | Employee applies, or Supervisor enters on their behalf |
| **Emergency / absence** | Supervisor records that someone did not come / left suddenly |

If Supervisor enters for someone, the **employee must consent** before the chain continues (literacy-friendly path).

### Approval chain (who does what)

```text
Employee (request or consent)
    → Supervisor verifies
    → Shift In-Charge arranges cover
    → Manager approves (after cover is set)
    → Admin / Director finalizes
    → Return to duty closes the leave
```

**Important:** Manager should not approve until the shift is covered. Cover can be:

- A **pool reliever**, or  
- Another **employee**, or  
- A **named OT person** (when no backup fits)

### Leave pages

| Page | Purpose |
|---|---|
| Overview | Role-based snapshot (who is out, OT risk) |
| Requests | Create / list all leave & absences |
| Leave detail | Story of one leave: impact, cover, approvals |
| Lifecycle / Coverage | After cover: return due, late, extension, cover broken |
| Pending | HR follow-ups (missing info, unexplained) |
| Management | Plant-level exceptions and shortage impact |

### Leave Lifecycle / Coverage (after approval)

This board tracks **cover until the person is truly back**:

| Situation | What happens |
|---|---|
| Active cover | Someone is filling their shifts |
| Return due | Expected back today / soon — confirm return |
| Early return | Can come back before end date |
| Late return | Came after expected date |
| Extension open | Late return → **cover stays** until Manager closes |
| Cover disrupted | Cover no-show / unavailable → re-cover or OT |
| Unexplained / emergency open | Still needs proper closure |

**On-time return** → leave closed, cover released.  
**Late return** → extension; cover **kept** until Manager finishes it.  
If Safety clearance is pending (injury case), return can be blocked until Safety clears them.

### Leave → OT link

On leave detail you see day-by-day shift impact and OT risk. If the pool cannot cover, the path goes to **OT Decisions / Assign** with a clear reason (leave cover shortage).

---

## 3. OverTime (OT) system

### What problem it solves

Answer management questions: **How much OT? Where? Who? Cost? Why?** — and make sure OT is **approved**, not automatic.

**Product rule:** OT is the **last resort** after planning and relievers.

### Where OT comes from

| Cause | Example |
|---|---|
| Leave / absence with no cover | Reliever pool empty for that skill |
| Shift gap / rotation hole | Seat left empty in the month plan |
| Shift deviation | Someone worked different from plan |
| Weekly-off coverage | Covering a weekly off day |
| Emergency | Sudden absence |
| Plant breakdown repair | Safety breakdown needs repair hours |
| Manager assign | Direct OT assignment |

### OT journey

```text
Gap detected (leave / rotation / breakdown)
    → Soft flags if a reliever still available or limits exceeded
    → Manager OT Decision: Approve or Block (+ remark)
    → OT Assign / Notify the person
    → Hours & cost appear in Overview, Analysis, Reports
```

Shift In-Charge may accept OT on a clean gap; contested / flagged cases need **Manager decision** first.

### OT pages

| Page | What you see |
|---|---|
| Overview | Totals: hours, days, people, cost; trends |
| Employees | Who does the most OT; drill into one person |
| Sites | Which plants burn OT; dept / shift split |
| Analysis | Heatmaps, concentration, rising patterns |
| Decisions | Approve / block pending OT cases |
| Assign | Name the person, notify them |
| Reports | Download Excel for management packs |

### What management gets from OT

- Cost and hour trends by month / site / person  
- “Repeated OT” and “concentration” style insights  
- Exportable reports for reviews  
- Link back to **why** (leave cover, breakdown, etc.) when the decision was created

---

## 4. Training system (Academy)

### What problem it solves

Turn training from a long static list into a **personal learning path** — like an internal Coursera + Meetup: courses you need, events you can attend, mentors who teach, and managers who can assign work.

### Two audiences

| Audience | Menu feel |
|---|---|
| Learners (Employee, Supervisor, Shift, Safety) | **Academy** — home, explore, my learning, events |
| HR / Manager / Director | **Academic Records** — team progress, assign, reports, mentors |

### Learner journey

1. **Home** — shelves: Assigned, Continue, Recommended (with reason), Required for role, Upcoming events, Popular at site  
2. **Explore** — search full catalog  
3. **Course page** — about, syllabus, assessment steps → Enroll  
4. **Learn (player)** — lessons, quizzes, skill map, written + practical / oral checks  
5. **My learning** — all in-progress / completed / assessment dates  
6. **Events** — RSVP to live sessions; waitlist if full  
7. **Communities / Mentors** — join groups; mentors run events  
8. **Certifications** — completed credentials  

### Manager / HR side

- See team progress  
- Assign or flag training when someone is weak in a skill  
- Track evaluations and assessment schedule  
- Mentors manage their own events (create, publish, attendance)

### How training connects elsewhere

- Employee profile shows skill gaps and due training  
- Dashboard highlights urgent training  
- **Safety training** page filters Academy courses to safety topics (LOTO, confined space, etc.)  
- Role paths (e.g. Shift In-Charge checklist) show what is still missing for that job

---

## 5. Safety system

### What problem it solves

Every incident, near-miss, and plant breakdown is **logged, visible, followed up, and not forgotten** — until it is truly closed. Injured people are not returned to duty until Safety says they are clear.

### What you can report

| Type | Meaning |
|---|---|
| Incident | Something happened (injury, plant problem, etc.) |
| Near-miss | Almost happened — someone stopped risk in time |
| Breakdown | Plant / equipment not working — downtime + repair OT |

Severity ranges from first aid / low up to critical / fatal. Multiple people involved and multiple witnesses can be listed. Photos and videos can be attached.

### Status flow (simple)

```text
Reported → Acknowledged → Investigating → Actions pending
    → Resolved → Closed
```

- **Resolve** needs corrective actions done  
- **Close** also needs every return-to-work clearance decided  
- Open cases **keep notifying** responsible people until solved  
- Emergencies alert everyone at the site; banner until acknowledged  

### Safety pages

| Page | Purpose |
|---|---|
| Overview | Open cases, emergencies, plants down, days since lost-time injury |
| Report | File incident / breakdown |
| Incidents | History + filters; detail has timeline, gallery, PDF, call, clearance |
| Breakdowns | Downtime story + request repair OT |
| Protocols | Written emergency / safety protocols (Safety / Admin edit) |
| Safety training | Safety-topic courses from Academy |

### Safety ↔ Leave ↔ OT

| Link | Rule |
|---|---|
| Return to work | If clearance pending after injury → leave **cannot** close to duty |
| Cover / OT proposals | People in open high/critical cases are kept out of auto suggestions |
| Assign OT | Warns and needs confirmation for those people |
| Breakdown repair | Can create an OT decision for repair hours |

### Who acts on Safety

| Role | Typical actions |
|---|---|
| Manager | Raise / follow plant cases; clear non-critical returns |
| Safety In-Charge | Investigate, protocols, critical clearance |
| Director | Org view; waive clearance with reason (rare) |
| Shift / Site leads | Report, acknowledge, support investigation |
| Everyone | Can see cases (visibility); act only within their role |

---

## One story across all five systems

```text
1. SHIFTS     Plan the month (A/B/C) and publish
2. LEAVE      Someone is away → show which shifts break
3. RELIEVER   Cover from local / cluster pool
              (Competition if two leaves want same person)
4. OT         Only if still short — Manager decides, then assign
5. SAFETY     If injury / breakdown — log, notify, clear return,
              repair OT if plant is down
6. TRAINING   Keep skills current so cover & safety stay strong
```

**For the PPT closing line:**  
Nectar connects **planning → absence → cover → overtime → safety → skills** so every plant decision has a clear owner and a clear record.

---

## Demo plants & roles (for the PPT footer)

| Role | What they mainly do |
|---|---|
| Employee | Own leave, training, OT alerts |
| Supervisor | Team leave, issue support |
| Shift In-Charge | Cover shifts, build monthly rotation |
| Manager | Approve leave / rotation / OT / competitions |
| Admin / Director | Final publish, org-wide view |
| Safety In-Charge | Incidents, protocols, return clearance |
| HR | Leave follow-ups, training records |
