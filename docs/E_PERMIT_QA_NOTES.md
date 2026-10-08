# E-Permit — QA / UI issues (demo)

**Date:** 8 Oct 2026  
**Where found:** Issue permit wizard + Permit detail  
**Status:** Fixed (developer side) — awaiting QA re-test · commit `8a7dec5` on `aniket-ui`  

---

## 1. Planned schedule allows times outside the chosen shift — ✅ Fixed (dev)

**Page:** `/e-permits/new` · Step 1 — Work & shift  
**Field:** Plan a schedule (optional)

**Problem:**  
Shift is selected as e.g. **Shift A · 06:00–14:00**, and helper text says schedule must be **“Inside the chosen shift.”**  
But the date/time picker still lets you pick **00:00** (midnight) and other hours **outside** 06:00–14:00.

**Expected:**  
Only times **within the selected shift window** should be selectable (or selection outside the window should be blocked with a clear error).

**Likely place:** `client/app/(app)/e-permits/new/page.tsx` — `DatePicker.RangePicker` for planned schedule (needs `disabledTime` / validation against shift start–end).

---

## 2. Yes / NA buttons — pressed state hard to see — ✅ Fixed (dev)

**Page:** Issue permit · checklist steps (safety measures, PPE, fire/gas, certificates)  
**Control:** Yes / NA button group

**Problem:**  
Selected option only gets a **blue border / text**. Background stays **white** for both Yes and NA, so pressed vs unpressed is easy to miss.

**Expected:**  
Selected Yes / NA should have a **clear filled background** (and contrast) so the choice is obvious at a glance.

**Likely place:** `client/components/e-permit/PermitBits.tsx` — `YesNaList` (`Radio.Group` `optionType="button"`).

---

## 3. Start and end date/time can be the same — ✅ Fixed (dev)

**Page:** `/e-permits/new` · Plan a schedule  
**Example:** `08 Oct 00:00 → 08 Oct 00:00`

**Problem:**  
User can set **start = end** (same date and time). That is not a valid work window.

**Expected:**  
Start must be **before** end. Block OK / Next with a short validation message when equal (or end ≤ start).

**Likely place:** Same RangePicker + submit/validation on issue wizard (`e-permits/new/page.tsx`).

---

## 4. React duplicate key on Permit detail (`emp0124`) — ✅ Fixed (dev)

**Page:** Permit detail — Acknowledgements  
**Error (×2 in overlay):**  

> Encountered two children with the same key, `emp0124`.  
> `components/e-permit/PermitDetail.tsx` (658:19)

**Problem:**  
`people.map(...)` uses `key={person.id}`. The `people` list can include the **same employee id twice** (e.g. issuer and holder / worker are the same person → `emp0124` appears twice). React warns and list behaviour can glitch.

**Code today:**

```ts
const people = [
  { id: p.issuerId, role: tr("Issuer") },
  { id: p.holderId, role: tr("Permit Holder") },
  ...p.workerIds.filter((w) => w !== p.holderId && w !== p.issuerId).map(...)
];
```

Filter only drops workers that equal holder/issuer — it does **not** dedupe when **issuer === holder**.

**Expected:**  
Unique React keys (e.g. `${person.id}-${person.role}` or `${person.id}-${index}`), and/or one row per person with combined roles.

**Likely place:** `client/components/e-permit/PermitDetail.tsx` ~lines 365–369 and 657–659.

---

## Quick checklist for fixes

| # | Fix in short | Dev status | What was done |
|---|---|---|---|
| 1 | Constrain planned schedule picker to shift start–end | ✅ Fixed | Only the shift's days/hours are pickable; picker locked until a shift is chosen; server also rejects a start before the shift |
| 2 | Style selected Yes/NA with filled bg | ✅ Fixed | `buttonStyle="solid"` — selected option is filled |
| 3 | Reject start ≥ end on planned schedule | ✅ Fixed | Inline error under the field, Next disabled, listed under "Still needed" (shared `validatePlannedSchedule` rule, client + server) |
| 4 | Unique keys / dedupe acknowledgements people list | ✅ Fixed | One row per person with combined roles (e.g. "Issuer · Permit Holder") |

Verified in the browser on the test stack (Shift C 22:00–06:00, issuer = holder `emp0124`). QA to re-test and close.

---

## Screenshots (reference)

Captured in demo: Issue permit schedule picker at 00:00 with Shift A 06:00–14:00; Yes/NA border-only selection; same start/end; Next.js duplicate-key overlay on Permit detail.
