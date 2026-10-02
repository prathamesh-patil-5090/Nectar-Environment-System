# Code Compaction Plan

**Goal:** shrink code that was written long (50–100+ lines) when it could be 5–15 lines, **without changing anything the user sees or does**: same pixels, same text, same data, same behaviour, same localStorage contents.

Scanned 2026-10-02 · client ≈ 44.8k lines · server ≈ 2k lines.

## ✅ Outcome (2026-10-02)

**Client `.ts/.tsx` went from 40,678 to about 33,620 lines (about −7,050).** Each phase was verified with 0-pixel screenshot diffs (265 shots: 8 roles × 33 pages incl. `/meetings`, plus login), unchanged logic snapshots (41/41 vitest), `tsc` clean on client and server, and no new ESLint problems compared with the original code.

| Phase | Status | Result |
|---|---|---|
| 0 Safety net | ✅ | Playwright screenshot suite + `lib/logic-baseline.test.ts` |
| 3 Lookup tables | ✅ | `rbac.ts` 293 → 174; domain metadata, catalog filters, leave KPIs |
| 4 Store helpers | ✅ | `lib/storage.ts`; leave workflow `requireLeave`, merged `confirmReturn`, `applyCover`; learn-page resume helper |
| 1 Styles | ✅ | 63 repeated multi-line styles hoisted (`lib/styles.ts` + per-file); whitespace-only compaction of styles, tags, short objects and single-line elements |
| 2 JSX → components | ✅ | Dashboard `CrewRow`/`DotPill`/`LeaveQuotaBox`/`CardTitle`; salary `MetricCard`; shared `components/Panel.tsx` (5 copies); SkillHeatmap legend; LNI `scoreColumn`; evaluation queue `evaluationColumn` |
| 5 Shared catalog | ⛔ not done | The client catalog and the server seed are **not** the same data. The server has 7 extra modules, 3 extra videos, 25 video descriptions and 1 extra ability; the client has micro-quizzes on 8 abilities. A single source would change what one side shows. |

Corrections to the original estimates: Phase 1 hoisting alone saved about 675 lines, not ~3,000, because most repeated styles were already one-liners. The rest of the savings came from whitespace-only compaction instead.

Biggest files: EmployeeTrainingPortal 3,557 → 2,609 · learn page 3,377 → 2,714 · EmployeeDashboardView 1,589 → 810 · track page 1,281 → 891 · salary 1,113 → 737.

Skipped on purpose (too little gain for the risk): CoursePlayerModal quiz option lists (3 copies, ~10 lines), the duplicate one-line `formatDate` (sharing it would couple the shift and overtime modules), and the learn page's oral-viva questions (data, not repeated code).

---

## 1. Where the bulk is

| Source of bloat | Size | Typical shrink |
|---|---|---|
| Inline `style={{…}}` objects (2,129 of them, 1,307 distinct) | **~7,900 lines** | 40–50% |
| Repeated JSX blocks (same markup, different text/colour) | ~1,200 lines | 70–80% |
| Same course catalog stored twice (client + server seed) | ~1,500 lines | 100% of one copy |
| Lookup tables written as `if` chains (RBAC, domain metadata, filters) | ~450 lines | 60–70% |
| Store boilerplate (storage read/write, leave workflow steps) | ~350 lines | 40% |

Exact copy-paste is low (jscpd: about 1%). The bloat comes from **verbose patterns**, not duplicated files.

The server is already compact (simple Nest CRUD); it's out of scope except for the shared catalog in Phase 5.

### Biggest files and how much of each is inline styling

| File | Lines | Lines inside `style={{}}` |
|---|---|---|
| [EmployeeTrainingPortal.tsx](../client/components/training/EmployeeTrainingPortal.tsx) | 3,557 | ~1,630 |
| [training/learn/[courseId]/page.tsx](../client/app/(app)/training/learn/[courseId]/page.tsx) | 3,377 | ~1,320 |
| [EmployeeDashboardView.tsx](../client/components/dashboard/EmployeeDashboardView.tsx) | 1,589 | ~900 |
| [training/track/[trackId]/page.tsx](../client/app/(app)/training/track/[trackId]/page.tsx) | 1,281 | ~600 |
| [salary/page.tsx](../client/app/(app)/salary/page.tsx) | 1,113 | ~490 |
| [CoursePlayerModal.tsx](../client/components/training/CoursePlayerModal.tsx) | 959 | ~300 |

---

## 2. Ground rules ("nothing changes")

1. **Exact values only.** A style moved into a shared constant must have identical properties and values. Don't change `14.5` to `14`, `#64748B` to `nectarColors.muted`, or `borderRadius: 10` to `12`, even if they look the same. Where two blocks differ by one value, that value becomes a prop.
2. **Same DOM tree.** Keep every wrapper `div`, the element types (`h3` stays `h3`) and the order. CSS such as `.nectar-employee-grid` targets children, and antd components rely on structure.
3. **No Tailwind conversion.** Tailwind is installed but unused. Converting thousands of pixel values to classes risks subtle visual drift. Use plain TS style constants and small components instead.
4. **Store contracts frozen.** These all stay byte-identical: localStorage keys (`nectar-enviro-leave-store-v2`, …), stored object shapes, seed data values, API request/response shapes, toast and message strings, and `setTimeout` delays.
5. **Same order of side effects** in store functions (assert → release reliever → update → API push).
6. **One phase per commit** (or per PR), each verified before the next starts.

---

## 3. Phase 0: Safety net (do first) ✅ done 2026-10-02

**How to use it:**
- `cd client && npm run test:visual` compares 257 screenshots (8 roles × 32 pages + login). It must say **257 passed**. It builds a separate copy into `.next-e2e` on port 3100, so a running `npm run dev` isn't touched.
- `cd client && npm test` runs vitest, including `lib/logic-baseline.test.ts`. Its snapshot must stay unchanged; never run `-u` during a refactor.
- Baseline screenshots are in `client/e2e/__screenshots__/` (about 50 MB, gitignored, local only). Re-record with `npm run test:visual:baseline` **only** before starting work, never after code changes.
- Known exception: on `/overtime/sites/s-etp` the two line-chart curves are masked, because recharts re-animates them indefinitely (this was already happening; it isn't caused by the refactor).

There are only 34 unit tests, so screenshots are the real guard for UI changes.

- [ ] Add Playwright as a dev dependency (client). Write one script that logs in as each demo role (`client/lib/auth.ts`) and screenshots every route under `client/app/(app)/**` at a fixed viewport, with localStorage reset to the seeded state first (`client/lib/demo-reset.ts`).
- [ ] Freeze time and randomness in the script (`page.clock`) so dates and `Date.now()` ids don't produce noise.
- [ ] Commit the **baseline screenshots**. After every phase, re-run and require **0 pixel diff** (`toHaveScreenshot` with `maxDiffPixels: 0`).
- [ ] Unit snapshot for pure logic: dump `getLeaveKpis()`, `getOverviewKpis()`, every `can*()` × every role, etc. into a JSON snapshot test. Phase 3–4 refactors must keep it identical.
- [ ] Existing gates still apply each phase: `npx tsc --noEmit`, `npx vitest run`, `npx eslint` (no new problems).

---

## 4. Phase 1: Shared style tokens + UI primitives (largest win, ~3,000 lines)

Create `client/components/ui/` and `client/lib/styles.ts`. Extract only patterns that already repeat **with identical values**:

| Pattern (exact current values) | Occurrences | Becomes |
|---|---|---|
| `display:flex, alignItems:center, gap:10` | 28 | `row10` style const |
| `display:flex, flexDirection:column, gap:16` | 22 | `col16` |
| `fontSize:12, color:nectarColors.muted` | 22 | `mutedSm` |
| Card: `white, padding 22, radius 14, border rgba(28,68,99,.08), shadow…` | 6+ | `<Card>` |
| Section heading: Fraunces 16/600 ink, margin 0 | 7+ | `<CardTitle>` |
| Eyebrow label: 10–11px / 600 / muted / uppercase / .06em | 8+ | `<Eyebrow size={10 \| 11}>` |
| Metric value: 26px / 700 / ink / Fraunces / lh 1.1 | many | `<MetricValue>` |
| Icon tile 32×32 radius 8 | several | `<IconTile>` |
| Status pill with dot (On Site / Console Room …) | several | `<DotPill color bg border dot>` |
| Initials avatar (`name.split(" ").map(w=>w[0]).slice(0,2).join("")`) | several | `<InitialsAvatar>` + `initials()` helper |

Steps:
1. Run the style-frequency script again (method in §8) to list every object repeated 2+ times. Name a constant only for objects that are **exactly** equal.
2. Replace file by file, biggest first: EmployeeDashboardView → salary → EmployeeTrainingPortal → learn page → track page → CoursePlayerModal.
3. Where a block differs by one value (e.g. eyebrow 10px vs 11px), use a prop or spread: `{ ...eyebrow, fontSize: 10 }`.
4. Screenshot diff = 0 after each file.

---

## 5. Phase 2: Repeated JSX → data + `.map()` (~900 lines)

Each item below is the same markup written 3–6 times with only text, colour or icon changed.

| Where | Now | After | What changes |
|---|---|---|---|
| [EmployeeDashboardView.tsx:412-614](../client/components/dashboard/EmployeeDashboardView.tsx#L412-L614) crew rows (Supervisor / Shift In-Charge / Plant Manager) | ~200 | ~45 | `<CrewRow role name avatarColors badge/>` ×3. The last row uses `<Tag>` instead of a dot pill, so pass `badge` as a ReactNode. |
| Other EmployeeDashboardView near-clones (172-185, 439-605) | ~220 | ~60 | same approach |
| [salary/page.tsx:466-680](../client/app/(app)/salary/page.tsx#L466) four metric cards | ~220 | ~50 | `<MetricCard label badge value sub/>`. Card 3 has a different value style (18px, monospace sub), so take `valueStyle`/`subStyle` overrides. |
| `Panel` component defined in 6 pages ([leave](../client/app/(app)/leave/page.tsx#L313), [shifts](../client/app/(app)/shifts/page.tsx#L197), [shifts/master](../client/app/(app)/shifts/master/page.tsx#L143), [overtime/analysis](../client/app/(app)/overtime/analysis/page.tsx#L418), [overtime/sites/[id]](../client/app/(app)/overtime/sites/[id]/page.tsx#L195), [reliever-pool](../client/app/(app)/reliever-pool/page.tsx#L613)) | 171 | ~35 | One shared `Panel`. There are 4 slightly different variants (hashes differ), so keep their differences as props. Don't unify them visually. |
| [SiteReadiness.tsx:24-50](../client/components/SiteReadiness.tsx#L24) ≈ [SkillHeatmap.tsx:21-47](../client/components/SkillHeatmap.tsx#L21) ≈ [employees/[id]:414](../client/app/(app)/employees/[id]/page.tsx#L414) | ~70 | ~25 | shared header/legend component |
| [LniMatrixView.tsx:108-184](../client/components/training/LniMatrixView.tsx#L108) three near-identical column blocks | ~75 | ~25 | map over a column config |
| [CoursePlayerModal.tsx](../client/components/training/CoursePlayerModal.tsx) 234-290 ≈ 325-364, 801-845 ≈ 881-925 | ~150 | ~60 | extract the 2 internal sub-components |
| [PendingEvaluationsQueue.tsx:108-172](../client/components/training/PendingEvaluationsQueue.tsx#L108) two identical blocks | ~56 | ~30 | one helper |
| learn page tab headers (1354-1432, 1618, 1982, 2191) | ~90 | ~25 | `<TabSectionHeader>` |
| [overtime/employees](../client/app/(app)/overtime/employees/page.tsx#L63) ≈ [overtime/sites](../client/app/(app)/overtime/sites/page.tsx#L39) list headers | ~42 | ~20 | shared component |
| [shifts/deviations:69](../client/app/(app)/shifts/deviations/page.tsx#L69) ≈ [shifts/schedule:82](../client/app/(app)/shifts/schedule/page.tsx#L82) | ~30 | ~15 | shared helper |

Keep the `key` props stable and the render order identical.

---

## 6. Phase 3: `if` chains → lookup tables (~300 lines)

| Where | Now | After | Approach |
|---|---|---|---|
| [rbac.ts](../client/lib/rbac.ts) (34 exports, each `role === "a" \|\| role === "b" …`) | 293 | ~90 | `const ROLES = { canAssignOt: ["director","manager"], … }` plus one `has(user, list)` helper. **Keep every exported function name and signature** (`export const canAssignOt = (u) => has(u, ROLES.canAssignOt)`), so no call sites change. Keep the special cases as they are (`normalizeRole`, `scopedSiteId`, `canAccessEmployeeRecord`, the `canDownloadReports` alias). |
| [EmployeeTrainingPortal.tsx:72-149](../client/components/training/EmployeeTrainingPortal.tsx#L72) `getDomainMeta` (6 `if` blocks returning objects) | 78 | ~25 | ordered array `[{ match: ["ETP","Effluent"], meta: {...} }, …]` + `find`. **Order matters** ("Water" must be checked after "ETP"), so keep the array order the same as the current `if` order. Default is O&M. |
| [EmployeeTrainingPortal.tsx:353-383](../client/components/training/EmployeeTrainingPortal.tsx#L353) `matchesCourseFilter` category chain | 31 | ~12 | `CATEGORY_TO_SECTION` map; unknown category → `true` (same as today) |
| [EmployeeTrainingPortal.tsx:386-412](../client/components/training/EmployeeTrainingPortal.tsx#L386) recommendation keyword chain | 27 | ~12 | keyword-group table, same first-match order |
| [leave/store.ts:418-490](../client/lib/leave/store.ts#L418) `getLeaveKpis` inline status arrays | 73 | ~45 | named `const PENDING_STATUSES = [...]` etc.; logic unchanged |

Gate: the role × permission JSON snapshot from Phase 0 must be identical.

---

## 7. Phase 4: Store boilerplate (~200 lines)

| Where | Approach |
|---|---|
| `readAll`/`writeAll` copied in [notifications.ts:151](../client/lib/notifications.ts#L151) and [overtime/assignments.ts:100](../client/lib/overtime/assignments.ts#L100), plus similar persist/hydrate code in leave, shift and reliever stores | `client/lib/storage.ts` with `readJson(key, fallback)` / `writeJson(key, value)`. **Keep each store's error handling the way it is:** leave swallows quota errors, notifications doesn't. Make that a parameter rather than merging the behaviours. Leave training's `readStorage`/`writeStorage` alone (it has special quota-cleanup and sanitizing). |
| [leave/store.ts:762-1110](../client/lib/leave/store.ts#L762) every action repeats `getLeaveById → throw "Not found" → assertLeaveTransition → updateLeave` | `transition(id, next, patch, event)` helper. About 10 functions × 4 lines saved; same order, same error messages. |
| [leave/store.ts:1003-1068](../client/lib/leave/store.ts#L1003) `confirmReturn`: two CLOSED branches identical except the timeline text | merge into one branch with a ternary for the message |
| [leave/store.ts:809-847](../client/lib/leave/store.ts#L809) `siteApprove` cover-assignment branches repeat the "zero OT / clear ids" pattern | small `applyCover()` helper |
| learn page: "seek position from watched %" computed 3× ([page.tsx:227](../client/app/(app)/training/learn/[courseId]/page.tsx#L227), 294, and the engine callback) | `resumeSecFor(ability, enrollment)` helper |
| `formatDate` duplicated in [overtime/data.ts:59](../client/lib/overtime/data.ts#L59) and [shift/store.ts:132](../client/lib/shift/store.ts#L132); `dayCount` client and server | Merge only if the implementations are byte-identical; otherwise leave them. |

Gate: vitest (`ops-flow.test.ts` covers the leave flows) + KPI snapshot + screenshots.

---

## 8. Phase 5 (optional, larger): Single course catalog (~1,500 lines)

[client/lib/training/courses-data.ts](../client/lib/training/courses-data.ts) (1,539 lines) and [server/db/seeds/training/courses.seed.ts](../server/db/seeds/training/courses.seed.ts) (1,570 lines) hold the same catalog. All 110 client titles exist in the seed; the seed has 18 more.

Options:
- **A (recommended):** move the catalog to `shared/courses.ts` at the repo root. The server seed and the client both import it, and each keeps its own small adapter (the client's `baseCoursesCatalog.map(...)` post-processing). The client still works offline, so behaviour doesn't change.
- B: the client fetches from the API only. **This changes behaviour** (offline/demo mode would break), so skip it.

Before doing A, diff the two files field by field; any value differences must be kept exactly per side. Also needs a Next config change to allow importing outside `client/` (`experimental.externalDir` or a tsconfig path). Coordinate with Prathamesh, since it touches the server seed.

A similar check is worth doing for `client/lib/mock-data.ts` vs `server/db/seeds/employees.seed.ts`.

---

## 9. Not in scope

- **Splitting the 3,000-line components into files.** Good for readability, but it doesn't remove lines; do it after Phases 1–2 if wanted.
- Seed/demo data values, copy text, colours, layout.
- Server modules (already lean).
- The ~85 pre-existing `noUnusedLocals` warnings and lint `any` errors (separate cleanup).

---

## 10. Expected result

| Phase | Lines removed (est.) | Risk |
|---|---|---|
| 0 Safety net | +~150 (tests) | none |
| 1 Style tokens / primitives | ~3,000 | low with pixel diff |
| 2 JSX → map | ~900 | low |
| 3 Lookup tables | ~300 | low with snapshot |
| 4 Store helpers | ~200 | medium (side-effect order) |
| 5 Shared catalog | ~1,500 | medium (build config) |
| **Total** | **~5,900 (≈13% of client)** | |

Order: 0 → 3 → 4 (logic, protected by snapshots) → 1 → 2 (UI, protected by screenshots) → 5.

### Method notes (to re-run the scan)
- Exact clones: `npx jscpd client/app client/components client/lib --min-lines 8 --min-tokens 60`
- Inline style frequency and near-clone JSX windows: small node scripts that normalize each `style={{…}}` object or 12-line window (literals → placeholders) and count repeats. They're quick to recreate; ask Claude.
