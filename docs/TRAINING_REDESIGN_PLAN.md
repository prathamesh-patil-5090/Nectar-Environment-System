# Training Redesign — Implementation Plan

Goal: rebuild Training as a Coursera-style learning platform. Each employee gets their own feed, based on their role, their requirements and what their manager flags.

Live mentorship sessions and seminars work like **Meetup events**. Each one has its own event page with hosts, date and time, venue or online link, details, an attendee list, seats left, a waitlist, a registration deadline and an event chat. Mentors act as event organizers: they create and manage their events, and get a notification when someone registers.

This plan builds on what already exists:

- Next.js client, using localStorage stores plus fire-and-forget API sync (`client/lib/training/store.ts`, `client/lib/api/training.ts`).
- A NestJS + Mongoose server training module, with routes for courses, enrollments, records, certificates, sessions, mentor-sessions, recommendations and assignments.
- The course player at `/training/learn/[courseId]` and the specialization page at `/training/track/[trackId]`.
- The sidebar groups **Academy** (employee, supervisor, shift_incharge, safety_incharge) and **Academic Records** (hr, manager, director).

> **Rule: database only.** Every value shown in Training comes from MongoDB through the NestJS API. There are no mock files, no `initial*` fallbacks and no invented defaults ("% match", placeholder names, fallback thumbnails). If the data is missing or the API fails, the UI shows an empty or error state. Seed data lives only in `server/db/seeds`, and schema changes go through `server/db/migrations`.
>
> **Exceptions agreed with the client (§7):** specialization tracks and the LNI competency list stay as client-side mock data for now. Seeded course ratings stay visible for the demo.

> **Progress (2 Oct 2026):** Phases 0–6 are built and tested. `[x]` done · `[~]` partly done (note says what is missing) · `[ ]` not done. Phase 8 is not started.

## Table of contents

1. [What's wrong today](#1-whats-wrong-today)
2. [Target structure (Coursera + Meetup mapping)](#2-target-structure-coursera--meetup-mapping)
3. [Data model changes](#3-data-model-changes)
4. [Recommendation logic](#4-recommendation-logic)
5. [Permissions](#5-permissions)
6. [Phases and checklists](#6-phases-and-checklists)
7. [Client decisions](#7-client-decisions-answered-2-oct-2026)
8. [Conclusion — what I understood](#8-conclusion--what-i-understood)

---

## 1. What's wrong today

- **One very long page.** `EmployeeTrainingPortal.tsx` (2,609 lines) stacks 12+ blocks: hero, sessions, masterclasses, recommendations, a pillar console, 6 large section blocks and specializations. Card counts vary between 3, 4, 6 and "all".
- **No personal view.** There is no "Continue learning", "Assigned to me" or "My learning". Courses assigned by a manager are mixed in with recommendations.
- **Recommendations aren't personal.** `getRecommendedCourses()` returns the same list for everyone. Its "% Match" is a fixed 92 (or 99 if the course was assigned). Ratings, review counts and "Video Lessons" counts are invented defaults.
- **Mentors aren't linked to employees.** (Fixed in Phase 1.) `MentorLiveSession` stores `mentorName` as plain text, with no employee id, so the system can't notify a mentor and a mentor can't log in to manage their sessions.
- **Sessions don't behave like events.** `scheduledAt` is free text ("Tomorrow · 14:00"), so it can't be sorted, used for reminders or added to a calendar. The stored `registeredCount` (e.g. 24) doesn't match the real `enrolledEmployeeIds` (e.g. 3). There is no waitlist, RSVP deadline, attendee list or discussion.
- **Slots don't really work.** The `slots`, `selectedSlotMap` and `selectedAgendaMap` fields exist, but there's no UI to pick a slot. Enrollment counts are per session, not per slot.
- **Notifications are browser-only.** They live in localStorage (`client/lib/notifications.ts`). A notification created in the employee's browser never reaches the mentor's login on another device. There are no training notification kinds.
- **Manager input is underused.** `TrainingAssignment` exists, but it can only be created from the LNI matrix. A manager can't simply say "this person is weak in X" without picking a full course.
- **Mock data on both sides.**
  - The client reads courses, enrollments, certificates, mentors and sessions from `client/lib/training/data.ts` and `courses-data.ts`, and falls back to them when the API fails.
  - The server's recommendation endpoint invents a rating (4.8), a review count (30), a thumbnail and a "% match". It also defaults an employee to ETP when their plant type is unknown.
  - The `Course` schema has fake defaults (`rating: 4.8`, `reviewCount: 24`, `estimatedHours: 40`).
- **Known bugs:**
  - The WTP filter matches "envi**ro**nmental".
  - A missing course falls back to `allCourses[0]`, so the wrong course opens.
  - The progress pip bar is wrong.
  - Certified courses still show "Resume".
  - Hardcoded "Shilpa Hotkar"/`emp0126` fallbacks.
  - The clinic modal and the course player modal can never open (dead code).

## 2. Target structure (Coursera + Meetup mapping)

### 2.1 Learner side — "Academy"

| Coursera | Ours | Route |
|---|---|---|
| Home (Continue learning, Recommended, Because you…) | **Training Home** — personal feed | `/training` |
| Explore / search with filters | **Explore catalog** — search, filters and sort | `/training/explore` |
| Course landing page (About, Syllabus, Instructor, Skills, Enroll) | **Course page** — new, sits before the player | `/training/course/[courseId]` |
| Course player (weeks → videos, readings, quizzes) | **Player** — existing, keep and trim | `/training/learn/[courseId]` |
| Specializations / Professional Certificates | **Learning paths / Specializations** — existing | `/training/track/[trackId]` |
| My Learning (In progress / Completed) | **My Learning** — new | `/training/my-learning` |
| Live events (Meetup-style, see §2.2) | **Events**: browse page plus one page per event | `/training/events`, `/training/events/[eventId]` |
| Accomplishments | **Certifications** — existing | `/certifications` |

**Training Home layout.** Every shelf shows 4 cards, then "Show more" (+4 each time) and "View all".

1. A compact header: greeting, plus 3 stat chips (Assigned, In progress, Certified) that link into My Learning.
2. **Assigned to you**: mandatory items from a manager, sorted by due date, with overdue items in red.
3. **Continue learning**: in-progress courses, with a progress bar and "Resume".
4. **Recommended for you**: from the engine in §4. Each card shows a one-line reason, e.g. "Suggested by Anand D. — weak in polymer dosing".
5. **Required for your role**: the role path checklist (e.g. Shift In-Charge path: 3 of 7 done).
6. **Upcoming events**: the next 4 events (Meetup-style cards, see §2.2), with a "Going" or "Waitlisted" badge where it applies.
7. **Popular at your site**: courses most often completed by people with the same role at the same site.

The 6 large section blocks, the telemetry strip, division codes and the pillar console all go. Domain becomes a single filter on Explore.

**Card rules (one shared `CourseCard`):**

- Thumbnail, a provider/mentor line, a 2-line title and a 1-line "Skills you'll gain".
- A meta row: level, duration and type.
- At most one status badge: Assigned, Required, Due soon, In progress or Certified.
- A progress bar only if the learner is enrolled.
- The whole card is a link, with no duplicate button inside it.
- No fake match %. Seeded course ratings stay visible for the demo (§7 Q8).

### 2.2 Live events — the Meetup model

Reference: Meetup's event page (e.g. a Power BI Club summit). It has a title, hosts, a group, a date/time block, a venue, a registration deadline, details, attendees, event chat, sponsors and an "Attend" button. Mentor sessions, seminars, workshops and drop-in clinics all become **events** that follow this pattern.

| Meetup | Ours |
|---|---|
| Group (e.g. "UP Power BI Club") | **Community**: a learning circle per domain or plant (e.g. "ETP Operators Circle", "RO & Membrane Circle"). It has organizers (mentors) and members. Members get notified of new events. |
| Event | **Training event**: one dated occurrence. A repeating session is a *series* of events. |
| Hosted by (organizer + co-hosts) | **Hosts**: one main mentor plus optional co-hosts, each linked to an employee record. |
| Online / in-person | **Format**: online (Google Meet), or in person at a plant (plant and room, e.g. a seminar in the ETP control room). There is no hybrid. |
| Registration closes Wed, Oct 7 · 8:00 AM | **RSVP deadline**, set per event. |
| Attend / Going / Waitlist | **RSVP** with seat capacity and an automatic waitlist. |
| Attendees (N) | **Attendees list**: avatars, names and designations. Only registered employees and hosts can see it; everyone else sees the count. |
| Event chat (only attendees can post) | **Event discussion**: attendees post questions before the event, and the host replies or pins them. This replaces the old one-off "question for mentor" box. |
| Related topics | **Topics / skills tags**, linked to course skills so events can appear in recommendations. |
| Similar events nearby | **More events like this**: same community, host or skills. |
| Add to calendar / Share | **Add to calendar** (.ics download) and **Copy link** (internal link only). |
| Sponsors | Not needed. |

#### Event page (`/training/events/[eventId]`)

Top to bottom on mobile. On desktop, the info card is a sticky right column.

1. **Header**: event type chip (Masterclass, Seminar, Workshop or Clinic), title, community name, and "Hosted by" with host avatars and titles.
2. **Info card**:
   - The date and time range in IST, with **Add to calendar**.
   - Format and location: the Meet link is shown only to attendees, starting 10 minutes before the event. In-person events show the site and room.
   - "Registration closes {date time}".
   - Seats: "12 of 30 spots left", or "Full · 4 on waitlist".
3. **Details**: description, agenda (a time-stamped list), "Who should attend" (audience roles or plant types) and what to bring or prepare.
4. **Topics**: skill tags, each linking to Explore filtered by that skill.
5. **Attendees ({n})**: the first 8 avatars plus "See all", which opens a list with name, designation and site.
6. **Hosts**: a card for each host, with their bio and specialties. Links to the host's other events.
7. **Discussion**: questions and comments. Only attendees can post. Hosts can pin a post and post announcements, which notify every attendee.
8. **After the event**: recording or slides link, an attendance badge on the attendee's record, and a feedback prompt.
9. **More events like this**: up to 4 cards.

**Sticky bottom bar** (Meetup-style, always visible): the date, the title, the spots left, and a primary button that changes with state:

| State | Button | Secondary |
|---|---|---|
| Open, has seats | **Attend** | — |
| Going | **Going ✓** (menu: Cancel RSVP, Edit answer) | Add to calendar |
| Full, waitlist on | **Join waitlist** | "You'll be notified if a spot opens" |
| On waitlist | **On waitlist (#3)** (menu: Leave waitlist) | — |
| RSVP deadline passed | **Registration closed** (disabled) | — |
| Live (10 min before start → end) | **Join now** (opens the Meet link) | — |
| Ended | **Event ended** | Recording or feedback, if any |
| Cancelled by host | **Cancelled** banner with the reason | — |
| Not in the audience | **Attend** enabled, with an "Intended for Shift In-Charges" note | — |

When a host sets an **RSVP question** (e.g. "What problem do you want to discuss?"), the Attend button opens a short form first.

#### Events browse page (`/training/events`)

- Tabs: **Upcoming · Going · Past**, plus **Hosting** for mentors.
- A list grouped by day ("Today", "Tomorrow", "Thu, 8 Oct"). Each row shows the time, title, host, format, community and spots left. Includes a calendar view toggle.
- Filters: format, community, host, topic and "Open to my role".
- Event cards: a date badge, title, host avatar, format and spots left. 4 per shelf on Home.

#### Organizer tools — "Mentor Studio" (`/training/mentor`)

Visible only to employees with a mentor profile. It follows Meetup's organizer tools:

- **My events**: tabs for Drafts · Upcoming · Past. Actions: Create, Duplicate, Edit, Cancel.
- **Create or edit an event**:
  - Basics: title, type, community, co-hosts, description, agenda, topics and audience.
  - When: date, time and duration, or **repeat** (weekly or monthly, creating a series).
  - Where: online with a Meet link, or in person with site and room.
  - Capacity, waitlist on/off, RSVP open and close times, and an optional RSVP question.
  - Save as draft, or publish. Publishing notifies community members, plus employees whose role matches the audience.
- **Manage attendees** for each event:
  - The list of Going, Waitlist and Cancelled, with each person's RSVP answer.
  - Move someone from the waitlist, or remove them.
  - Mark attended or no-show after the event, and export CSV.
- **Message attendees**: an announcement to everyone going, delivered as a notification and pinned in the discussion.
- **Changes notify people**: changing the time or venue notifies everyone going. Cancelling asks for a reason and notifies everyone going and waitlisted.
- **Communities**: mentors who organize a community can edit its description and see its members.

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

### 3.4 Mentors, communities and events (Meetup model)

These replace `MentorLiveSession`, its free-text `scheduledAt`, `slots`, `selectedSlotMap` and `selectedAgendaMap`. Existing rows are migrated (Phase 1.4).

- **`MentorProfile`**: `{ id, employeeId (unique), name, title, department, bio, photoUrl, specialties[], active }`. HR or a director creates it. Mentor is a capability, not a role. `employeeId` is an employee id, or a `leaders` id for non-employees such as the Director.
- **`Leader`**: `{ id: "user:<login email>", name, role, title, email, active }`. These are non-employee users, such as the Director.
- **`Community`** (the Meetup group): `{ id, name, slug, description, domain (plantType or topic), coverUrl, organizerEmployeeIds[], memberEmployeeIds[], autoJoin: { roles?, plantTypes? } }`. `autoJoin` adds matching employees automatically, e.g. every ETP operator joins "ETP Operators Circle".
- **`TrainingEvent`**:
  - Identity: `id`, `seriesId?`, `communityId?`, `type: "masterclass" | "seminar" | "workshop" | "clinic"`, `title`, `description`, `agenda[] { time, item }`, `topics[]`, `audience { roles?, plantTypes? }`, `coverUrl?`
  - People: `hostEmployeeIds[]` (the first one is the main host)
  - Time: `startsAt`, `endsAt` (ISO, shown in IST)
  - Place: `format: "online" | "in_person"`, `meetLink?` (only returned to attendees), `venue? { siteId, room }` (in person = at a plant)
  - Capacity: `capacity`, `waitlistEnabled`, `rsvpOpensAt?`, `rsvpClosesAt?`, `rsvpQuestion?`
  - Lifecycle: `status: "draft" | "published" | "cancelled" | "completed"`, `cancelReason?`, `recordingUrl?`
- **`EventRsvp`**: `{ id, eventId, employeeId, status: "going" | "waitlist" | "cancelled" | "attended" | "no_show", answer?, waitlistPosition?, rsvpAt, updatedAt }`. One per employee per event. The going count comes from these rows only, never from a stored number.
- **`EventPost`** (the discussion): `{ id, eventId, authorEmployeeId, text, kind: "question" | "comment" | "announcement", parentId?, pinned, createdAt }`.
- **Waitlist rule**: when someone going cancels, the first person on the waitlist moves to going and is notified. This happens in one server action, so two people can't take the same seat.

### 3.5 Notifications

- New `NotificationKind` values:
  - **To hosts:** `event_roster` (the complete attendee list, 48 hours before), `event_rsvp_going` ("Rohit Kumar Singh (Plant Operator, ETP) is going to *Clarifier troubleshooting* · Thu 8 Oct 15:00 · 13/30"), `event_rsvp_cancelled`, `event_waitlist_joined`, `event_post_question`.
  - **To attendees:** `event_rsvp_confirmed`, `event_waitlist_promoted`, `event_changed` (time or venue), `event_cancelled`, `event_announcement`, `event_reminder` (1 day and 1 hour before; hosts get one too, with the attendee count), `event_starting` (10 minutes before, with the Join link), `event_feedback_request`.
  - **To community members and the matching audience:** `event_published`.
  - **Learning:** `training_assigned` and `training_flagged` (to the employee), and `training_flag_resolved` (to the manager).
- **Server persistence is required.** A `notifications` collection and module (`GET /notifications?employeeId=`, `POST`, `PATCH /:id/read`, `PATCH /read-all`). Notifications are created on the server inside the action that triggers them. The bell reads from the server. Without this, a mentor never sees a registration made from another device.
- **Scheduled jobs** (server): reminders, the "starting now" alert, marking events completed after `endsAt`, and the feedback request.

## 4. Recommendation logic

The engine is rule-based and explainable. It runs **on the server only** (`GET /training/recommendations?employeeId=`), using database data. There is no client-side fallback; if the API fails, the shelf shows an error state.

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
- **`canHostEvent(event)`**: the user is one of the event's `hostEmployeeIds`. Only hosts can edit the event, manage attendees, pin posts and message attendees.
- **`canPostInEvent`**: the user's RSVP is going or attended (Meetup's "only attendees can chat"). Hosts can always post.
- **`canSeeMeetLink`**: the user's RSVP is going, or the user is a host.
- **`canSeeAttendees`**: the user is registered (going, waitlist or attended), or is a host (§7 Q10).
- **`canFlagTrainingNeed`** (decided, §7 Q1): the Director, or the employee's allotted manager (`employees.managerId`). This replaces the broader list above.
- **`canManageMentors`**: director and hr.
- **`canViewTeamTraining`**: anyone with allotted employees, limited to that scope.

## 6. Phases and checklists

Each phase can ship on its own. Phases 2 and 3 can overlap once Phase 1 is merged.

### Phase 0 — Decisions and quick fixes (1–2 days)

**0.1 Sign-off**
- [x] Review this plan with the client. Answer the §7 questions.
- [ ] Freeze the routes in §2 and the data model in §3.
  - *Status:* open.

**0.2 Bug fixes on the current page** (cheap, and they stop users seeing wrong data now)
- [x] Fix the WTP filter matching "environmental" (`REC_KEYWORD_GROUPS`).
- [x] Remove the `allCourses[0]` fallback for missing courses.
- [x] Fix the progress pip bar and the `pct` NaN when a course has 0 abilities.
- [x] Show "Certified / Review" instead of "Resume" on certified courses.
- [x] Remove the "Shilpa Hotkar"/`emp0126`/"Plant Operator" fallbacks. Show a neutral empty state instead.

### Phase 1 — Data model and backend (4–5 days)

**1.1 Types and schemas**
- [x] Extend `Course` with `audience`, `skills`, `prerequisites` and `type` (client types and server schema).
- [x] Add the `RolePath` schema and the `GET` endpoint. Seed data waits for the client's role → course mapping (§7 Q4).
- [x] Extend `TrainingAssignment` with `kind`, an optional `courseId`, `topic`, `skills`, `abilityIds`, `source`, the new status values and `resolved*` fields.
- [x] Add the `MentorProfile`, `Community`, `TrainingEvent`, `EventRsvp` and `EventPost` schemas (§3.4).
- [x] Add the `Notification` schema (§3.5).

**1.2 Server endpoints** (training module)
- [x] `GET /training/role-paths?role=&designation=`
- [x] `GET/POST/PATCH /training/assignments`, with filters for employee, flagger, kind and status. Add `PATCH /:id/resolve`.
- [x] `GET/POST/PATCH /training/mentors` (HR/director).
- [x] `GET/POST/PATCH /training/communities`, plus `POST /:id/join` and `POST /:id/leave`.
- [x] `GET /training/events?from=&to=&communityId=&hostId=&format=&topic=&employeeId=`. The response includes the going count, spots left and `myRsvp`. `meetLink` is included only when the requester can see it.
- [x] `GET /training/events/:id`, `POST /training/events` (draft or publish, with optional repeat → series), `PATCH /training/events/:id`, `POST /:id/publish`, `POST /:id/cancel` (with a reason) and `POST /:id/duplicate`.
- [x] `POST /training/events/:id/rsvp` (going, or waitlist when full; respects the RSVP deadline; stores the answer) and `POST /:id/rsvp/cancel` (promotes the first waitlisted person).
- [x] `GET /training/events/:id/attendees` (hosts see everything and the answers; others see going names only), `PATCH /attendees/:rsvpId` (attended, no-show, move off the waitlist, remove) and `GET /:id/attendees.csv`.
- [x] `GET/POST /training/events/:id/posts`, `PATCH /posts/:postId` (pin) and `POST /:id/announce`.
- [x] `GET /training/events/:id.ics` (add to calendar).

**1.3 Notifications module (server)**
- [x] `notifications` schema and module: `GET ?employeeId=`, `POST`, `PATCH /:id/read`, `PATCH /read-all`.
- [x] Training notifications are created **on the server** inside the action itself (register, cancel, flag…), not by the client.
- [x] Client bell: read training notifications from the server. Removing the other modules' `DEMO_SEED` is part of the app-wide mock-data cleanup.

**1.4 Migration** (`server/db/migrations/2026-10-training-events.ts`, additive, with a dry run by default). The script is written and the dry run passes. **Applying it needs approval**, because it writes to the shared Atlas database.
- [x] Create mentor profiles for session mentors who match an `employees` record by name (Anand Dakave, Uday Patil, Sanjay Waghaskar). The director has no employee record yet (§7).
- [x] Convert each `mentor_live_sessions` row into a `TrainingEvent`, only where `scheduledAt` parses to a real date (otherwise create it as a **draft** for the host to fix). Convert `enrolledEmployeeIds` into `EventRsvp` going rows, and `questions` into `EventPost` questions. The fake `registeredCount` is dropped, and counts come from real RSVPs.
- [x] Create one community per plant type that has sites (ETP, RO/WTP, MEE/ZLD), using `sites.plantType`. Auto-join employees from those sites, with that plant's manager as organizer. The names are to be confirmed (§7).
- [x] Derive course `skills` from each course's ability titles. Leave `audience` and `prerequisites` empty until the client supplies them (empty means open to everyone).
- [x] Remove the fake defaults from the `Course` schema.

**1.5 Remove client mock data for Training**
- [x] Stop `client/lib/training/store.ts` from falling back to `initial*` and `mock*` data. Delete `client/lib/training/data.ts` and `courses-data.ts` once nothing imports them.
- [x] Remove the client-side `getRecommendedCourses` fallback generator.

**1.7 Move learning progress into the database** (found during Phase 1)

Today, enrollments, video and quiz progress, skill-map/written/practical/oral results, certificate issuing and LNI records live **only in browser localStorage**, seeded from mock data. The `training_records` collection exists but has a different shape, and the client never writes to it. Specialization tracks and the LNI competency list are also mock-only.

- [x] Server: an `enrollments` collection (ability progress, quiz attempts) and endpoints for enroll, video progress, reading acknowledgement and micro-quiz submission (scored on the server).
- [x] Server: skill-map and written test submission (scored on the server), practical and oral scoring by evaluators, and certificate issuing when all 4 gates pass. This ports the rules from `client/lib/training/store.ts` (`submitSkillMapping`, `checkAndTriggerCertification`, …).
- [x] Reconcile `training_records` (existing database rows) with the new enrollment and assessment shape, through a migration.
- [ ] `specialization_tracks` and `lni_competencies` collections, plus endpoints. The current mock content stays out unless the client confirms it is real (§7).
  - *Status:* not done by client decision (§7 Q12): they stay client-side mock content for now.
- [~] LNI records are computed on the server from assessment results.
  - *Partly done:* computed from database assessment results, but on the client (store.getLearningNeedRecords), not the server.
- [x] Course player (`/training/learn/[courseId]`) and certificates read and write through these endpoints only.

**1.6 Store and API layer**
- [x] Add client functions in `store.ts` and `api/training.ts` for everything above.
- [~] Server unit tests: capacity, waitlist promotion, the RSVP deadline, Meet link visibility, auto-resolving flags and role-path progress.
  - *Partly done:* covered by end-to-end suites `server/test/training-events.e2e.ts` and `training-enrollments.e2e.ts` (all pass); Jest itself can't run because ts-jest isn't installed in server/node_modules.

**Done when:** the APIs work from a REST client, the seed loads, and the baseline tests pass.

### Phase 2 — Learner shell and Training Home (4–5 days)

**2.1 Shared components** (`client/components/training/ui/`)
- [x] `CourseCard`, `EventCard` (date badge, host avatar, format, spots left) and `PathCard`, following the card rules in §2.1.
- [x] `Shelf`: title, subtitle, items, `limit = 4`, "Show more" (+4), a "View all" link, and an empty state.
- [x] `ReasonLine`: the "why you're seeing this" line.
- [x] `TrainingSubNav`: Home · Explore · My Learning · Events · Certifications, plus Mentor Studio and My Team when allowed. It uses real tab/link semantics.
- [~] Theme tokens only (no stray hex colours) and CSS hover instead of JS `onMouseEnter`.
  - *Partly done:* new screens use one CSS module with theme values and CSS hover; the old course player still has inline styles and JS hover.

**2.2 Training Home** (`/training` for the Academy group)
- [x] Compact header with 3 stat chips.
- [x] The 6 shelves from §2.1, each limited to 4 cards. Hide a shelf when it's empty, except "Assigned" (show "Nothing assigned 🎉").
- [x] A loading skeleton while `syncTrainingWithApi` runs, to stop the content jumping.

**2.3 Remove the old page**
- [x] Remove the hero, the pillar console, the 6 section blocks, the telemetry strip and the duplicate filters from `EmployeeTrainingPortal.tsx`. Delete the file once Home replaces it.
- [x] Remove dead code: the clinic modal, `mentorToTrackMap`, the unused `CoursePlayerModal` mount and unused imports.

**Done when:** an employee sees only their own Home, every shelf shows 4 cards plus "Show more", and it works at 375px width.

### Phase 3 — Explore, course page, My Learning (4–5 days)

**3.1 Explore** (`/training/explore`)
- [x] One search box covering title, code, skills and ability names.
- [~] Left filter panel (a drawer on mobile): Domain, Level, Duration, Type, "Required for my role" and "Not started". The filter state is kept in the URL query.
  - *Partly done:* Domain, Plant, Level and "Not started" are done; Duration, Type and "Required for my role" are not.
- [~] Sort options: Relevance, Newest, Shortest and A–Z.
  - *Partly done:* Relevance, Highest rated, Shortest and A–Z; "Newest" is not done (courses have no created date shown).
- [x] A 4-column grid with paging or "Load more", and a proper "No results — clear filters" state.

**3.2 Course page** (`/training/course/[courseId]`)
- [x] Header: title, code, level, duration, "Skills you'll gain" and an Enroll / Resume / View certificate button.
- [x] Tabs: About · Syllabus (modules → abilities, read-only) · Assessment (the 4 gates explained) · Events (upcoming events whose topics match the course's skills).
- [x] An "Assigned by X, due on Y" banner when the course is assigned.
- [x] Every card links here. The player is reached from "Enroll" or "Resume".

**3.3 My Learning** (`/training/my-learning`)
- [~] Tabs: In progress · Assigned · Completed · Saved.
  - *Partly done:* In progress, Assigned, Suggested by manager, Completed and Assessment schedule; "Saved" waits for Phase 8.
- [x] Assessment schedule (the current Schedule tab) shown as an "Upcoming assessments" side panel.

**3.4 Player trim** (`/training/learn/[courseId]`, 2,714 lines)
- [ ] Add a back-link to the course page, and a "Next recommended" card at the end of the course.
  - *Status:* not done.
- [ ] Split the player into smaller components without changing behaviour. Visual tests keep it safe.
  - *Status:* not done (it now reads the database, but is still one large file).

**Done when:** the user can go from Home or Explore → course page → player → certificate, without the old portal.

### Phase 4 — Meetup-style events and Mentor Studio (6–7 days)

**4.1 Event page** (`/training/events/[eventId]`, see §2.2)
- [x] Header, sticky info card (date, add to calendar, format and location, RSVP deadline, spots left), details, agenda, "Who should attend", topics.
- [x] Attendees block (8 avatars plus "See all"), host cards, and "More events like this" (4 cards).
- [x] Sticky bottom bar with every RSVP state in the §2.2 table: Attend / Going ✓ / Join waitlist / On waitlist / Registration closed / Join now / Ended / Cancelled.
- [x] An RSVP question form when the host has set one. Cancelling an RSVP asks for confirmation.
- [x] Discussion: attendees post questions and comments. Pinned posts and host announcements show on top. Non-attendees see "Attend to join the discussion".
- [x] After the event: recording link and feedback prompt.

**4.2 Events browse page** (`/training/events`)
- [x] Tabs: Upcoming · Going · Past, plus Hosting for mentors. A day-grouped list and a calendar view toggle.
- [~] Filters: format, community, host, topic and "Open to my role". The state is kept in the URL.
  - *Partly done:* format, community, host and topic are done; "Open to my role" is not.
- [x] Community pages (`/training/communities/[slug]`): about, organizers, members, upcoming and past events, and Join/Leave.

**4.3 Mentor Studio** (`/training/mentor`, visible only when `isMentor`)
- [x] My events: Drafts · Upcoming · Past, with Create, Duplicate, Edit and Cancel (with a reason).
- [x] Event form: basics, when (including repeat → series), where, capacity, waitlist, RSVP window and RSVP question. Save as draft or publish.
- [x] Manage attendees: Going, Waitlist and Cancelled tabs, RSVP answers, move off the waitlist, remove, mark attended or no-show, and CSV export.
- [x] Message attendees (an announcement). Pin or unpin discussion posts.

**4.4 Event notifications** (all server-side, §3.5)
- [x] When an employee RSVPs, each host gets "**{Employee}** ({designation}, {site}) is going to **{title}** on {date time}. {n}/{capacity} going." with a link to Manage attendees. The same applies to cancel, waitlist and new questions.
- [x] Attendees get notified for confirmation, waitlist promotion, time or venue change, cancellation, announcements, reminders (1 day and 1 hour), "starting now" with the Join link, and the feedback request.
- [x] Publishing an event notifies community members and the matching audience.
- [x] Instant in-app notification for every RSVP (§7 Q3).
- [x] The complete attendee list goes to hosts 48 hours before the event (§7 Q3).

**4.5 HR/Director: mentors and communities**
- [x] Screens to make an employee a mentor (specialties, bio, active) and to create communities (organizers, auto-join rules).

**Done when:**
1. An employee RSVPs in one browser, and the host, logged in elsewhere, sees the notification and the attendee.
2. The event fills, so the next employee joins the waitlist.
3. Someone cancels, so the waitlisted employee is promoted and notified.
4. The host changes the time, so everyone going is notified.
5. At start time, "Join now" appears only for attendees.

### Phase 5 — Personalisation: role paths, recommendations, manager flags (4–5 days)

**5.1 Role paths**
- [ ] Seed paths per role and designation (content from the client).
  - *Status:* waiting for the client's role → course list (§7 Q4).
- [~] "Required for your role" shelf, plus a progress checklist on My Learning.
  - *Partly done:* the shelf and progress count are built and show once role paths exist in the database; no paths are seeded yet (needs the client's list).
- [~] Renewal: an expiring certificate puts the course back on the path as "Renew".
  - *Partly done:* expiring certificates (60 days) rank in Recommended with "Renew it"; not yet tied to role paths.

**5.2 Recommendation engine**
- [x] Implement §4 in the server training service, so that each result is `{ course, score, reasons[] }`. No client fallback.
- [ ] Remove `matchScorePct`, `badge` and `badgeColor` from `CourseRecommendation`.
  - *Status:* the server no longer sends them and no screen uses them; the unused `CourseRecommendation` type is still in types.ts.
- [ ] Unit tests: a flag ranks first, certified courses are excluded, and unmet prerequisites show as "Unlocks after X".
  - *Status:* not written yet (the browser test checks a flag reaches the learner's Home).

**5.3 Manager flag / assign flow**
- [x] One `FlagTrainingNeedModal`:
  - Employees (multi-select, limited to the user's scope).
  - Topic or skills (with autocomplete from course skills), or a specific course/ability.
  - Kind: Suggest or Mandatory. Mandatory needs permission and a due date.
  - Note and priority.
- [~] Entry points:
  - *Partly done:* employee profile, team progress rows and the LNI matrix are done; "Flag weak area" after a low score in the scoring modal is not.
  - The employee profile (`/employees/[id]` → Training tab).
  - Team progress rows.
  - The LNI matrix "assign" action.
  - After a low score in `EvaluatorScoringModal` ("Flag weak area").
- [x] The employee gets a `training_flagged` or `training_assigned` notification, and the item shows on their Home with the manager's name and note.
- [x] Auto-resolve when the matching course is certified or the ability is passed, then send the flagger `training_flag_resolved`.
- [~] The flagger can see all their open flags, and edit or dismiss them.
  - *Partly done:* list and dismiss are done; editing exists in the API but has no screen yet.

**Done when:** a manager flags "polymer dosing" for an operator → the operator's Home shows a matching course with "Suggested by {manager}" → the operator completes it → the manager is notified that it's resolved.

### Phase 6 — Academic Records console (4 days)

- [x] Replace `NonEmployeeTrainingView` in `app/(app)/training/page.tsx` with the 5-tab console in §2.3.
- [~] Team progress table: filters for site, role, overdue and course, sticky columns, and drill-down to the employee.
  - *Partly done:* search, site, overdue-only, fixed name column and drill-down are done; role and course filters are not.
- [~] Reports: completion % by site, role and course, expiring certificates (30/60/90 days), and event attendance (RSVPs vs attended, no-show rate per host and community). Add CSV export.
  - *Partly done:* by site, by course, expiring certificates (30/60/90) and event attendance are done, with CSV; "by role" is not.
- [x] The "My team" tab for supervisor, shift_incharge and site_incharge reuses the same table, limited to their scope.
- [x] Remove the long Segmented labels ("Plant Evaluation & LNI Console…") and the duplicate header bar.

### Phase 7 — Quality, cleanup, tests (3 days)

- [~] Accessibility: cards are links, tabs have roles, minimum 12px text, AA contrast, and focus states.
  - *Partly done:* new cards are links with focus outlines and the sub-nav uses aria-current; no full contrast / 12px audit yet.
- [~] Mobile pass at 375 / 768 / 1280 px. No horizontal scroll, and filters open as a drawer.
  - *Partly done:* Home verified at 375px with no horizontal scroll; the app sidebar now starts collapsed under 768px; other pages not checked one by one.
- [~] Update the `e2e/visual.spec.ts` baselines on purpose, and add flows for RSVP → host notified, waitlist → promotion, and flag → resolve.
  - *Partly done:* new browser flow test `client/e2e/training-flow.mjs` (29 checks) added; the old pixel baselines for /training were NOT re-recorded and will differ.
- [x] Remove the old training seed keys and unused mock data (`mockMentors` clinics, `sectionTelemetryMetrics`).
- [x] Update `docs/PAGES_AND_FEATURES.md`.

### Phase 8 — Later / nice to have

- [ ] Real ratings and reviews after completion. Ratings only show once 5 or more reviews exist.
- [ ] Save for later, and a weekly learning goal or streak.
- [ ] Event photos uploaded by attendees after in-person seminars (Meetup's "Photos").
- [ ] Host ratings from event feedback, shown only after 5 or more responses.
- [ ] Shift-aware RSVP: warn when an event clashes with the employee's roster shift (uses the shifts module).
- [ ] Email or WhatsApp delivery of reminders, in addition to in-app.

## 7. Client decisions (answered 2 Oct 2026)

| # | Question | Decision | Where it is applied |
|---|---|---|---|
| 1 | Who can flag a weak area? | **The Director and the employee's allotted manager** (`employees.managerId`). | The server rejects other flaggers (`createAssignments`). |
| 2 | Who can be a mentor? | **The current people only**: Anand Dakave, Uday Patil, Sanjay Waghaskar and the Director. | Migration creates these 4 mentor profiles. |
| 3 | How are mentors notified? | **In-app, instantly after every registration.** Plus the **complete attendee list 48 hours before** the event. | `event_rsvp_going` (instant) and `event_roster` (scheduler, 48h). |
| 4 | Certificate validity? | **Most 1 year, some 6 months.** | `courses.certificateValidityMonths` (default 12). |
| 5 | Courses outside the role path? | **Yes.** Learners can take any course. | Explore shows everything; role paths only rank. |
| 6 | Do live sessions count? | They count as a **training stage** (hours), **not a certificate stage**. | `GET /training/events-hours/:employeeId` sums attended events. |
| 7 | The Director has no employee record | He stays a non-employee, with his own record that is linked here. | New `leaders` collection; his id is `user:director@nectarenviro.com` (his login). |
| 8 | Seeded course ratings? | **Keep and show them**, because they help the demo for the Nectar team. | Ratings stay visible on cards. |
| 9 | Event formats? | **Online, plus offline at a plant only** (like Meetup in-person). There is no hybrid. | `format: online | in_person`; in-person needs `venue.siteId`. |
| 10 | Who sees the attendee list? | **Only employees registered for that event** (and its hosts). | `GET /events/:id/attendees` returns 403 to others. |
| 11 | Communities? | Proposed (accepted for now): **ETP Operators Circle, RO & Membrane Circle, MEE & ZLD Circle, Shift Leadership Circle, Safety Circle**. | Migration creates all 5 with auto-join rules. |
| 12 | Specialization tracks and the LNI list | **They are mock data for now. Keep them outside the database** and use them from the client files. | A recorded exception to the database-only rule. They stay in `client/lib/training/data.ts`. |

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
4. **Mentors become real users of the system.** Each mentor is linked to their employee account. When an employee registers for their session/seminar, the mentor gets a notification ("X is going to your session on …, 13/30"), and also when someone cancels, joins the waitlist or posts a question.
5. **Mentors manage their own sessions like Meetup organizers.** From a Mentor Studio, they create events (or a repeating series), and set the date, time, online or venue, capacity, waitlist, registration deadline and RSVP question. They can save drafts, publish, edit or cancel, see who's going and their answers, move people off the waitlist, message attendees, and mark attendance. Attendees are notified about every change.
6. **Live sessions and seminars look and work like a Meetup event page.**
   - A page per event: hosts, community/group, date and time with add to calendar, online link or venue, "registration closes …", details and agenda, topics, attendees list, seats left, waitlist, and a discussion where only attendees can post.
   - A sticky "Attend" button that changes with state: Going ✓, Join waitlist, Registration closed, Join now, Ended.
   - Communities like Meetup groups, so the right people hear about new events.
7. **This is a full restructure of how training is handled**, not just UI. So the plan starts with the data model, a server notifications module (so a mentor sees registrations made from another device), and the recommendation logic. It then rebuilds the learner, mentor and manager screens on top, in phases that can ship one at a time.

If any of these 7 points doesn't match what you meant, tell me which one and I'll correct the plan before any code is written.
