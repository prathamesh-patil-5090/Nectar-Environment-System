# Safety — reports & protocols (changes to do)

Client feedback (Oct 2026) on top of the existing Safety module. Use this as the build checklist. Broader architecture stays in [SAFETY_PLAN.md](./SAFETY_PLAN.md).

## Goals

1. **Emergency protocols** — Safety In-charge / Director can **add, edit, and delete** protocols from `/safety/protocols` (not read-only + edit only).
2. **Post-incident safety reports** — After something has already happened, capture a full report with **details + images + videos**.
3. **People on the report** — An event can **happen to multiple employees** and be **seen by many employees** (not one “Employee 1” / one “Employee 2”).
4. **Hazard = Other** — When hazard is **Other**, show a free-text field for the custom hazard name.

---

## 1. Emergency protocols — add / edit / delete

**Page:** `/safety/protocols`  
**Who:** `safety_incharge`, `director` (existing `canEditSafetyProtocols`)

| Status today | Gap |
|---|---|
| Add (“New protocol”) + Edit exist via `ProtocolEditor` | **Delete** missing on list/detail |
| Version + updatedBy tracked | Confirm delete soft or hard; bump version on edit |

### To do

- [ ] Add **Delete** on protocol detail (and optionally on list card overflow menu).
- [ ] Confirm modal: “Delete protocol *{title}*? Sites will no longer see these steps.”
- [ ] Client store + API: `deleteSafetyProtocol(id)` (prefer soft-delete `archivedAt` so history stays).
- [ ] Keep **Add** / **Edit** visible for editors; viewers stay read-only.
- [ ] After delete, select next protocol or empty state; refresh filter counts.

### Acceptance

- Editor can create, update, and remove a protocol; hard refresh still reflects the change.
- Non-editors never see Add / Edit / Delete.

---

## 2. Post-incident safety reports (details + media)

**Intent:** Reports filed **after** the incident (not only live emergency), with narrative + evidence.

**Routes (prefer):**

| Route | Role |
|---|---|
| `/safety/report` | Existing wizard — extend for multi-person + Other hazard + media |
| `/safety/incidents` + `/safety/incidents/[id]` | History + detail (timeline, media gallery) |
| Optional: `/safety/reports` | Alias / filtered list of “closed incident reports” if product wants a separate nav label |

### Report fields (minimum)

| Field | Notes |
|---|---|
| Site, when, location | Existing |
| Type | Incident / near-miss / breakdown (existing) |
| Hazard / category | Existing list; **Other → text** (§3) |
| Severity | Existing |
| Title + description | Existing |
| **Affected employees** | **Multi-select** (§4) |
| **Witnesses / informed by** | **Multi-select** (§4) |
| Stakeholders | Auto from site; editable |
| **Photos / videos** | Upload on create + on detail (existing upload path; ensure both work) |
| Corrective actions / status | Detail page |

### Media

- [ ] Allow **images and videos** on create (`Upload.Dragger` already present — verify both MIME types + size limits).
- [ ] On detail: gallery with preview; upload more after create (`uploadSafetyMedia`).
- [ ] Store `media[] { id, url, kind: "image" \| "video", uploadedBy, at }` (already on `SafetyEvent`).
- [ ] Show clear errors if upload fails; report should still save if media partially fails (current pattern OK).

### Acceptance

- User can file a report after the fact with text + at least one image and one video.
- Report appears in history, visible per existing RBAC; detail shows media and people lists.

---

## 3. Hazard = Other → free-text input

**Where:** Report form hazard `Select` (`client/app/(app)/safety/report/page.tsx`).

### To do

- [ ] When `hazard === "other"`, show required `Input` e.g. `hazardOther` / `categoryOther`.
- [ ] Persist on the event (new optional field `categoryOther?: string` on `SafetyEvent` + server schema).
- [ ] Display on detail / PDF / tables: “Other — {text}” when set.
- [ ] Clear `categoryOther` when hazard changes away from Other.

### Acceptance

- Selecting Other without text blocks submit.
- Selecting Chemical (etc.) hides and clears the Other text box.

---

## 4. Multiple affected + multiple witnesses

**Client ask:** “can happen to multiple employee and can be seen by many employees too.”

### Today

- Concern flow: single `affected` + single `witness`.
- Incident flow: `involved` multi exists in places; witnesses/`informedBy` not consistently multi.

### To do

- [ ] **Affected** → multi-select (searchable people picker, site-scoped). Required ≥ 1 for incident / near-miss.
- [ ] **Witnesses / who saw it** → multi-select (optional, can be empty). Cannot include people already only in affected unless product allows overlap — prefer allow overlap with a soft warning.
- [ ] Map to `involved[]` and `informedBy[]` on `SafetyEvent` (already arrays in types).
- [ ] Detail UI: list all names (chips or bullets), not a single string.
- [ ] Labels e.g. “People it happened to” / “People who saw it or informed” (drop “Employee 1 / Employee 2”).

### Acceptance

- Can select 3 affected + 2 witnesses; all saved and shown on detail after refresh.

---

## 5. Suggested implementation order

1. Hazard Other text field (small, form-only + type/schema).
2. Multi-select affected + witnesses on report form + detail display.
3. Protocol **Delete** + soft-delete API/store.
4. Harden post-incident media (create + detail): image/video validation, empty states, copy on Safety nav (“Report incident” / “Safety reports”).
5. Docs: update [PAGES_AND_FEATURES.md](./PAGES_AND_FEATURES.md) Safety section when shipped.

---

## 6. Files likely to touch

| Area | Files |
|---|---|
| Report UI | `client/app/(app)/safety/report/page.tsx` |
| Detail / media | `client/components/safety/EventDetail.tsx` |
| Protocols UI | `client/app/(app)/safety/protocols/page.tsx`, `ProtocolEditor.tsx` |
| Types / store | `client/lib/safety/types.ts`, `store.ts` |
| API | `client/lib/api/safety.ts` |
| Server | `server/db/schemas/*safety*`, `server/src/modules/safety/*` |
| Nav / docs | `AppShell.tsx` (if Reports label), `docs/PAGES_AND_FEATURES.md` |

---

## 7. Out of scope (unless asked)

- Changing emergency call numbers / “Report emergency” alert flow.
- Safety training course content.
- Replacing the whole incident status machine (keep `REPORTED → … → CLOSED`).

---

## 8. Open questions

1. Soft-delete vs hard-delete for protocols?
2. Should witnesses be required for near-miss?
3. Max media count / max file size per report?
4. Separate sidebar item **Safety reports**, or keep everything under Incidents + Report?
