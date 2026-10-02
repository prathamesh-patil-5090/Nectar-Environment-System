# Training Redesign — Implementation Plan

Goal: rebuild Training as a Coursera-style learning platform. Each employee gets their own feed, based on their role, their requirements and what their manager flags. Mentors run and manage their own live sessions, and they get a notification when someone registers.

This plan builds on what already exists:

- Next.js client, using localStorage stores plus fire-and-forget API sync (`client/lib/training/store.ts`, `client/lib/api/training.ts`).
- A NestJS + Mongoose server training module, with routes for courses, enrollments, records, certificates, sessions, mentor-sessions, recommendations and assignments.
- The course player at `/training/learn/[courseId]` and the specialization page at `/training/track/[trackId]`.
- The sidebar groups **Academy** (employee, supervisor, shift_incharge, safety_incharge) and **Academic Records** (hr, manager, director).

## Table of contents

1. [What's wrong today](#1-whats-wrong-today)
2. [Target structure (Coursera mapping)](#2-target-structure-coursera-mapping)
3. [Data model changes](#3-data-model-changes)
4. [Recommendation logic](#4-recommendation-logic)
5. [Permissions](#5-permissions)
6. [Phases and checklists](#6-phases-and-checklists)
7. [Open questions for the client](#7-open-questions-for-the-client)
8. [Conclusion — what I understood](#8-conclusion--what-i-understood)

---

## 1. What's wrong today

- **One very long page.** `EmployeeTrainingPortal.tsx` (2,609 lines) stacks 12+ blocks: hero, sessions, masterclasses, recommendations, a pillar console, 6 large section blocks and specializations. Card counts vary between 3, 4, 6 and "all".
- **No personal view.** There is no "Continue learning", "Assigned to me" or "My learning". Courses assigned by a manager are mixed in with recommendations.
- **Recommendations aren't personal.** `getRecommendedCourses()` returns the same list for everyone. Its "% Match" is a fixed 92 (or 99 if the course was assigned). Ratings, review counts and "Video Lessons" counts are invented defaults.
- **Mentors aren't linked to employees.** `MentorLiveSession` stores `mentorName` as plain text, with no employee id, so the system can't notify a mentor and a mentor can't log in to manage their sessions.
- **Slots don't really work.** The `slots`, `selectedSlotMap` and `selectedAgendaMap` fields exist, but there's no UI to pick a slot. Enrollment counts are per session, not per slot.
- **Notifications are browser-only.** They live in localStorage (`client/lib/notifications.ts`). A notification created in the employee's browser never reaches the mentor's login on another device. There are no training notification kinds.
- **Manager input is underused.** `TrainingAssignment` exists, but it can only be created from the LNI matrix. A manager can't simply say "this person is weak in X" without picking a full course.
- **Known bugs:**
  - The WTP filter matches "envi**ro**nmental".
  - A missing course falls back to `allCourses[0]`, so the wrong course opens.
  - The progress pip bar is wrong.
  - Certified courses still show "Resume".
  - Hardcoded "Shilpa Hotkar"/`emp0126` fallbacks.
  - The clinic modal and the course player modal can never open (dead code).

## 2. Target structure (Coursera mapping)

### 2.1 Learner side — "Academy"

| Coursera | Ours | Route |
|---|---|---|
| Home (Continue learning, Recommended, Because you…) | **Training Home** — personal feed | `/training` |
| Explore / search with filters | **Explore catalog** — search, filters and sort | `/training/explore` |
| Course landing page (About, Syllabus, Instructor, Skills, Enroll) | **Course page** — new, sits before the player | `/training/course/[courseId]` |
| Course player (weeks → videos, readings, quizzes) | **Player** — existing, keep and trim | `/training/learn/[courseId]` |
| Specializations / Professional Certificates | **Learning paths / Specializations** — existing | `/training/track/[trackId]` |
| My Learning (In progress / Completed) | **My Learning** — new | `/training/my-learning` |
| Live events | **Live sessions** — new, pulled out of the catalog | `/training/live` |
| Accomplishments | **Certifications** — existing | `/certifications` |

**Training Home layout.** Every shelf shows 4 cards, then "Show more" (+4 each time) and "View all".

1. A compact header: greeting, plus 3 stat chips (Assigned, In progress, Certified) that link into My Learning.
2. **Assigned to you**: mandatory items from a manager, sorted by due date, with overdue items in red.
3. **Continue learning**: in-progress courses, with a progress bar and "Resume".
4. **Recommended for you**: from the engine in §4. Each card shows a one-line reason, e.g. "Suggested by Anand D. — weak in polymer dosing".
5. **Required for your role**: the role path checklist (e.g. Shift In-Charge path: 3 of 7 done).
6. **Upcoming live sessions**: the next 4 sessions, with a "Registered" badge where it applies.
7. **Popular at your site**: courses most often completed by people with the same role at the same site.

The 6 large section blocks, the telemetry strip, division codes and the pillar console all go. Domain becomes a single filter on Explore.

**Card rules (one shared `CourseCard`):**

- Thumbnail, a provider/mentor line, a 2-line title and a 1-line "Skills you'll gain".
- A meta row: level, duration and type.
- At most one status badge: Assigned, Required, Due soon, In progress or Certified.
- A progress bar only if the learner is enrolled.
- The whole card is a link, with no duplicate button inside it.
- No fake ratings, review counts or match %. Ratings come back only once real reviews exist (Phase 8).

### 2.2 Mentor side — "Mentor Studio"

The route is `/training/mentor`, visible only to employees with a mentor profile. It has three parts:

- **My sessions**: create and edit sessions (topic, description, audience/roles, duration, Google Meet link).
- **Slots**: for each session, add, edit, cancel and close slots (date/time, capacity), and see seats taken.
- **Registrants**: for each slot, the name, designation, site, the question they submitted and when they registered. Includes attendance marking, plus a "Mark completed" action that writes training hours to each attendee's record.

### 2.3 Management side — "Academic Records" (hr, manager, director)

`/training` opens a management console that replaces the current `NonEmployeeTrainingView`. It has 5 tabs:

1. **Team progress**: allotted employees × assigned/required courses, with completion %, overdue items, and a link to each person's profile.
2. **Assign & flag**: assign a course, or flag a weak topic for one or more employees (see §3.3).
3. **Evaluations**: the existing pending practical/oral queue.
4. **LNI matrix**: the existing view, with the "assign" action routed through the new flag/assign flow.
5. **Reports**: completion by site, role and course, plus certificates expiring soon.

The "My learning" link keeps the current personal-portal toggle for managers who also learn.

Supervisor, shift_incharge and site_incharge stay in **Academy**. If they have allotted employees, they also get a **My team** shelf/tab with the same flag/assign actions, limited to their team.

## 3. Data model changes

Shared between `client/lib/training/types.ts` and `server/db/schemas/training/`.

### 3.1 Course targeting

Add to `Course`:

- `audience: { roles: UserRole[]; designations?: string[]; plantTypes?: ("ETP"|"STP"|"WTP"|"ZLD"|"O&M"|"Consulting")[] }`
- `skills: string[]`: used for "Skills you'll gain" and for matching manager flags.
- `prerequisites: string[]`: course ids.
- `type: "course" | "micro" | "live" | "specialization"`

### 3.2 Role paths

New `RolePath`:

- `{ id, role: UserRole, designation?, plantType?, title, steps: { courseId, mandatory: boolean, order }[], renewEveryMonths? }`
- Seeded per role. The content mapping comes from the client (see §7).

### 3.3 Manager assignment and flag (extends `TrainingAssignment`)

- `kind: "mandatory" | "suggested"`. A mandatory item lands on "Assigned to you" with a due date. A suggested item boosts Recommended and shows its reason.
- `courseId?` (now optional), `topic?`, `skills?: string[]`, `abilityIds?: string[]`. A manager can flag a weak *topic* without choosing a course, and the system finds matching courses through `skills`.
- `source: "manager" | "lni" | "evaluation" | "role_path"`
- `status: "open" | "in_progress" | "resolved" | "dismissed"`, plus `resolvedAt` and `resolvedBy`.
- When a matching course is certified, or the flagged ability is passed, the item resolves automatically and the flagger is notified.

### 3.4 Mentor and live sessions

- `MentorProfile` gets `employeeId` (required), `active`, `specialties[]` and `maxSessionsPerWeek?`. HR or a director creates the profile.
- `MentorLiveSession` gets `mentorEmployeeId` and keeps `mentorName` only for display. `selectedSlotMap` and `selectedAgendaMap` are dropped.
- New `SessionSlot`: `{ id, sessionId, startsAt (ISO), durationMinutes, capacity, meetLink, status: "open"|"closed"|"full"|"cancelled"|"completed" }`.
- New `SessionRegistration`: `{ id, slotId, employeeId, question?, registeredAt, status: "registered"|"cancelled"|"attended"|"no_show" }`.
- Capacity and "seats left" are counted per slot.

### 3.5 Notifications

- New `NotificationKind` values:
  - `training_session_registered` (to the mentor)
  - `training_session_cancelled` (to the mentor)
  - `training_session_question` (to the mentor)
  - `training_slot_changed` (to registrants)
  - `training_slot_cancelled` (to registrants)
  - `training_session_reminder` (to both sides)
  - `training_assigned` (to the employee)
  - `training_flagged` (to the employee)
  - `training_flag_resolved` (to the manager)
- **Server persistence is required.** Add a `notifications` collection and module (`GET /notifications?employeeId=`, `POST`, `PATCH /:id/read`, `PATCH /read-all`). The client keeps localStorage as a cache and syncs, like the rest of the app. Without this, a mentor never sees a registration made from another browser.

## 4. Recommendation logic

The engine is rule-based and explainable. It runs client-side first (`client/lib/training/recommend.ts`) and moves to the server (`GET /training/recommendations?employeeId=`) in Phase 5.

**Candidates** are all published courses, minus anything already certified and minus courses whose prerequisites aren't met. Unmet-prerequisite courses are shown as "Unlocks after X".

**Scoring.** Each signal adds points and stores a reason string. The card shows the highest-scoring reason.

| Signal | Weight | Example reason |
|---|---|---|
| Manager flag (`kind: suggested`) matches the course's skills | +100 | "Suggested by Anand D.: weak in polymer dosing" |
| Required by the role path, not done | +80 | "Required for Shift In-Charge" |
| LNI gap (`trainingRequired`, level LOW) | +60 | "Your LNI shows a gap in Clarifier Operation" |
| Low assessment score (< pass threshold) on a related ability | +50 | "Practical score 55% on Sludge Handling" |
| Certificate expiring in 60 days or less | +45 | "Your ETP-101 certificate expires on 12 Dec" |
| Matches the employee's site plant type | +25 | "Used at your plant (ETP)" |
| Next level after a completed course | +20 | "Next after ETP-101" |
| Popular with the same role at the same site | +10 | "Popular with operators at Site X" |

Mandatory assignments are **not** ranked here. They always appear in "Assigned to you".

## 5. Permissions

New helpers in `client/lib/rbac.ts`, mirrored on the server:

- **`canFlagTrainingNeed`**: director, manager, site_incharge, supervisor (Site Manager) and shift_incharge. Each can flag only employees in their scope (allotted team or site). Confirm this list (§7).
- **`canAssignMandatoryTraining`**: director, manager and hr. Whether supervisor can also assign mandatory training is to be confirmed.
- **`isMentor(session)`**: true when an active `MentorProfile.employeeId === session.employeeId`. Mentor is a capability on an employee, not a new role.
- **`canManageMentors`**: director and hr.
- **`canViewTeamTraining`**: anyone with allotted employees, limited to that scope.

## 6. Phases and checklists

Each phase can ship on its own. Phases 2 and 3 can overlap once Phase 1 is merged.

### Phase 0 — Decisions and quick fixes (1–2 days)

**0.1 Sign-off**
- [ ] Review this plan with the client. Answer the §7 questions.
- [ ] Freeze the routes in §2 and the data model in §3.

**0.2 Bug fixes on the current page** (cheap, and they stop users seeing wrong data now)
- [ ] Fix the WTP filter matching "environmental" (`REC_KEYWORD_GROUPS`).
- [ ] Remove the `allCourses[0]` fallback for missing courses.
- [ ] Fix the progress pip bar and the `pct` NaN when a course has 0 abilities.
- [ ] Show "Certified / Review" instead of "Resume" on certified courses.
- [ ] Remove the "Shilpa Hotkar"/`emp0126`/"Plant Operator" fallbacks. Show a neutral empty state instead.

### Phase 1 — Data model and backend (4–5 days)

**1.1 Types and schemas**
- [ ] Extend `Course` with `audience`, `skills`, `prerequisites` and `type` (client types and server schema).
- [ ] Add `RolePath` (type, schema and seed).
- [ ] Extend `TrainingAssignment` with `kind`, an optional `courseId`, `topic`, `skills`, `abilityIds`, `source`, the new status values and `resolved*` fields.
- [ ] Add `employeeId` and `active` to `MentorProfile`, and `mentorEmployeeId` to `MentorLiveSession`.
- [ ] Add the `SessionSlot` and `SessionRegistration` schemas.

**1.2 Server endpoints** (training module)
- [ ] `GET /training/role-paths?role=&designation=`
- [ ] `GET/POST/PATCH /training/assignments`, with filters for employee, flagger, kind and status. Add `PATCH /:id/resolve`.
- [ ] `GET/POST/PATCH /training/mentors` (HR/director).
- [ ] `GET /training/mentor-sessions?mentorEmployeeId=` and `POST/PATCH /training/mentor-sessions`.
- [ ] `POST/PATCH /training/mentor-sessions/:id/slots` and `POST /slots/:slotId/cancel`.
- [ ] `POST /slots/:slotId/register` and `POST /slots/:slotId/unregister`, which check capacity per slot.
- [ ] `PATCH /registrations/:id/attendance` and `POST /slots/:slotId/complete` (writes a training record and hours per attendee).

**1.3 Notifications module (server)**
- [ ] `notifications` schema and module: `GET ?employeeId=`, `POST`, `PATCH /:id/read`, `PATCH /read-all`.
- [ ] Client `notifications.ts`: add the training kinds. `pushNotification` also POSTs to the server, and the bell syncs from the server on load.

**1.4 Seed and migration**
- [ ] Link the existing 4 mentors (Sanjay, Rajesh, Vikram, Meera) to real employee ids.
- [ ] Convert each session's `slots` and `selectedSlotMap` into `SessionSlot` and `SessionRegistration` rows.
- [ ] Add `audience`, `skills` and `prerequisites` to the 56 seeded courses.
- [ ] Bump the storage keys and seed versions so old localStorage data resets cleanly (`demo-reset.ts`).

**1.5 Store and API layer**
- [ ] Add client functions in `store.ts` and `api/training.ts` for everything above.
- [ ] Update `logic-baseline.test.ts` with tests for slot capacity, registration, auto-resolving flags and role-path progress.

**Done when:** the APIs work from a REST client, the seed loads, and the baseline tests pass.

### Phase 2 — Learner shell and Training Home (4–5 days)

**2.1 Shared components** (`client/components/training/ui/`)
- [ ] `CourseCard`, `SessionCard` and `PathCard`, following the card rules in §2.1.
- [ ] `Shelf`: title, subtitle, items, `limit = 4`, "Show more" (+4), a "View all" link, and an empty state.
- [ ] `ReasonLine`: the "why you're seeing this" line.
- [ ] `TrainingSubNav`: Home · Explore · My Learning · Live · Certifications, plus Mentor Studio and My Team when allowed. It uses real tab/link semantics.
- [ ] Theme tokens only (no stray hex colours) and CSS hover instead of JS `onMouseEnter`.

**2.2 Training Home** (`/training` for the Academy group)
- [ ] Compact header with 3 stat chips.
- [ ] The 6 shelves from §2.1, each limited to 4 cards. Hide a shelf when it's empty, except "Assigned" (show "Nothing assigned 🎉").
- [ ] A loading skeleton while `syncTrainingWithApi` runs, to stop the content jumping.

**2.3 Remove the old page**
- [ ] Remove the hero, the pillar console, the 6 section blocks, the telemetry strip and the duplicate filters from `EmployeeTrainingPortal.tsx`. Delete the file once Home replaces it.
- [ ] Remove dead code: the clinic modal, `mentorToTrackMap`, the unused `CoursePlayerModal` mount and unused imports.

**Done when:** an employee sees only their own Home, every shelf shows 4 cards plus "Show more", and it works at 375px width.

### Phase 3 — Explore, course page, My Learning (4–5 days)

**3.1 Explore** (`/training/explore`)
- [ ] One search box covering title, code, skills and ability names.
- [ ] Left filter panel (a drawer on mobile): Domain, Level, Duration, Type, "Required for my role" and "Not started". The filter state is kept in the URL query.
- [ ] Sort options: Relevance, Newest, Shortest and A–Z.
- [ ] A 4-column grid with paging or "Load more", and a proper "No results — clear filters" state.

**3.2 Course page** (`/training/course/[courseId]`)
- [ ] Header: title, code, level, duration, "Skills you'll gain" and an Enroll / Resume / View certificate button.
- [ ] Tabs: About · Syllabus (modules → abilities, read-only) · Assessment (the 4 gates explained) · Mentors (related live sessions).
- [ ] An "Assigned by X, due on Y" banner when the course is assigned.
- [ ] Every card links here. The player is reached from "Enroll" or "Resume".

**3.3 My Learning** (`/training/my-learning`)
- [ ] Tabs: In progress · Assigned · Completed · Saved.
- [ ] Assessment schedule (the current Schedule tab) shown as an "Upcoming assessments" side panel.

**3.4 Player trim** (`/training/learn/[courseId]`, 2,714 lines)
- [ ] Add a back-link to the course page, and a "Next recommended" card at the end of the course.
- [ ] Split the player into smaller components without changing behaviour. Visual tests keep it safe.

**Done when:** the user can go from Home or Explore → course page → player → certificate, without the old portal.

### Phase 4 — Live sessions and Mentor Studio (5–6 days)

**4.1 Learner: Live** (`/training/live`)
- [ ] Shelves: My registrations, Upcoming, and Past (recordings, if added later).
- [ ] Session detail drawer: mentor, topic, a **slot picker** (date/time and seats left per slot), an optional question box and Register.
- [ ] Unregistering asks for confirmation. "Join" turns on 10 minutes before the start using `slot.meetLink`, and is disabled before that with a countdown.

**4.2 Mentor Studio** (`/training/mentor`, visible only when `isMentor`)
- [ ] Session list with Create / Edit / Archive.
- [ ] Slot manager for each session:
  - Add a slot (date, time, duration, capacity, Meet link).
  - Edit a slot. Changing the time notifies registrants.
  - Close registration, or cancel a slot. Cancelling notifies registrants.
  - A seats-taken bar.
- [ ] Registrant list for each slot: name, designation, site, question and registration time, with CSV export.
- [ ] After the slot: mark attendance (attended / no-show), then "Mark completed". This writes training hours to each attendee's record.

**4.3 Mentor notifications**
- [ ] When an employee registers, the mentor gets "**{Employee}** ({designation}, {site}) registered for **{topic}** on {date time}. Seats: x/y." with a link to that slot's registrants.
- [ ] When an employee unregisters or adds a question, the mentor gets the matching notification.
- [ ] Reminders go to the mentor (with the registrant count) and the registrants 1 day and 1 hour before the slot. The scheduled job runs on the server.
- [ ] Optional per-mentor setting: "Instant" or "Daily digest", to avoid spam with 30 registrations (see §7).

**4.4 HR/Director: mentor management**
- [ ] Screen to make an employee a mentor, set their specialties, and deactivate them.

**Done when:** an employee registers in one browser → the mentor logs in on another and sees the notification and the registrant → the mentor edits the slot → the employee is notified.

### Phase 5 — Personalisation: role paths, recommendations, manager flags (4–5 days)

**5.1 Role paths**
- [ ] Seed paths per role and designation (content from the client).
- [ ] "Required for your role" shelf, plus a progress checklist on My Learning.
- [ ] Renewal: an expiring certificate puts the course back on the path as "Renew".

**5.2 Recommendation engine**
- [ ] Implement §4 in `client/lib/training/recommend.ts`, so that each result is `{ course, score, reasons[] }`.
- [ ] Move it to the server (`GET /training/recommendations?employeeId=`) and keep the client version as an offline fallback.
- [ ] Remove `matchScorePct`, `badge` and `badgeColor` from `CourseRecommendation`.
- [ ] Unit tests: a flag ranks first, certified courses are excluded, and unmet prerequisites show as "Unlocks after X".

**5.3 Manager flag / assign flow**
- [ ] One `FlagTrainingNeedModal`:
  - Employees (multi-select, limited to the user's scope).
  - Topic or skills (with autocomplete from course skills), or a specific course/ability.
  - Kind: Suggest or Mandatory. Mandatory needs permission and a due date.
  - Note and priority.
- [ ] Entry points:
  - The employee profile (`/employees/[id]` → Training tab).
  - Team progress rows.
  - The LNI matrix "assign" action.
  - After a low score in `EvaluatorScoringModal` ("Flag weak area").
- [ ] The employee gets a `training_flagged` or `training_assigned` notification, and the item shows on their Home with the manager's name and note.
- [ ] Auto-resolve when the matching course is certified or the ability is passed, then send the flagger `training_flag_resolved`.
- [ ] The flagger can see all their open flags, and edit or dismiss them.

**Done when:** a manager flags "polymer dosing" for an operator → the operator's Home shows a matching course with "Suggested by {manager}" → the operator completes it → the manager is notified that it's resolved.

### Phase 6 — Academic Records console (4 days)

- [ ] Replace `NonEmployeeTrainingView` in `app/(app)/training/page.tsx` with the 5-tab console in §2.3.
- [ ] Team progress table: filters for site, role, overdue and course, sticky columns, and drill-down to the employee.
- [ ] Reports: completion % by site, role and course, expiring certificates (30/60/90 days), and mentor session attendance. Add CSV export.
- [ ] The "My team" tab for supervisor, shift_incharge and site_incharge reuses the same table, limited to their scope.
- [ ] Remove the long Segmented labels ("Plant Evaluation & LNI Console…") and the duplicate header bar.

### Phase 7 — Quality, cleanup, tests (3 days)

- [ ] Accessibility: cards are links, tabs have roles, minimum 12px text, AA contrast, and focus states.
- [ ] Mobile pass at 375 / 768 / 1280 px. No horizontal scroll, and filters open as a drawer.
- [ ] Update the `e2e/visual.spec.ts` baselines on purpose, and add flows for register → mentor notified, and flag → resolve.
- [ ] Remove the old training seed keys and unused mock data (`mockMentors` clinics, `sectionTelemetryMetrics`).
- [ ] Update `docs/PAGES_AND_FEATURES.md`.

### Phase 8 — Later / nice to have

- [ ] Real ratings and reviews after completion. Ratings only show once 5 or more reviews exist.
- [ ] Save for later, and a weekly learning goal or streak.
- [ ] Session recordings attached to completed slots.
- [ ] Mentor feedback form after a session.
- [ ] Shift-aware scheduling: hide slots that clash with the employee's roster shift (uses the shifts module).

## 7. Open questions for the client

1. **Who can flag a weak area?** The proposal is director, manager, site_incharge, supervisor and shift_incharge, each for their own team. Can supervisors also assign *mandatory* training, or only suggest?
2. **Who can be a mentor?** Only the 4 current senior people, or any employee HR marks as mentor?
3. **How should mentors be notified?** Instant for every registration, or a daily digest? Should mentors also get email or WhatsApp, or in-app only?
4. **Role paths:** which courses are mandatory for each role/designation, and how often must each be renewed (e.g. the 6-month certificates mentioned in the Safety notes)?
5. **Can employees take courses outside their role path?** The plan assumes yes, through Explore.
6. **Does completing a live session count as training hours or a certificate step?**

## 8. Conclusion — what I understood

What you asked for, in my own words:

1. **Rebuild Training to work like Coursera, not patch the current page.**
   - A personal Home with short shelves of 4 cards each, plus "Show more".
   - A separate Explore page for browsing and searching.
   - A proper course page before the player.
   - A My Learning area.
   - Certifications as Accomplishments.

   The long catalog with 6 large sections, telemetry strips and three duplicate filters goes away.
2. **Every employee sees a different feed.** It depends on their role (operator, shift in-charge, Site Manager/supervisor, safety in-charge…), their plant, their gaps (LNI, low assessment scores, expiring certificates) and what they've already finished. Academy users get the learner view. Academic Records users (HR, manager, director) get a management console.
3. **The manager's opinion counts in the feed.** A manager (or whoever is in charge of an employee) can mark "this person is weak in this topic or concept". That item then appears on the employee's feed with the manager's name and reason. It is either a suggestion that ranks at the top of Recommended, or a mandatory assignment with a due date. It closes automatically when the employee completes the training, and the manager is told.
4. **Mentors become real users of the system.** Each mentor is linked to their employee account. When an employee registers for their session/seminar, the mentor gets a notification ("X has registered for your session on …"), and also when someone cancels or asks a question.
5. **Mentors manage their own sessions and slots.** From a Mentor Studio, they create sessions, add, edit, cancel or close slots, set capacity, see who registered and their questions, and mark attendance. Registrants are notified when a mentor changes or cancels a slot.
6. **This is a full restructure of how training is handled**, not just UI. So the plan starts with the data model, a server notifications module (so a mentor sees registrations made from another device), and the recommendation logic. It then rebuilds the learner, mentor and manager screens on top, in phases that can ship one at a time.

If any of these 6 points doesn't match what you meant, tell me which one and I'll correct the plan before any code is written.
