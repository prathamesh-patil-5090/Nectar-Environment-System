/**
 * E-Permit (Permit to Work) rules — status machine, who may act, shift validity, renewal cap,
 * permit form checklists, gas limits, conflicts and permit numbering.
 *
 * SHARED FILE: an identical copy lives at server/src/modules/e-permits/e-permit-rules.ts.
 * client/lib/e-permit/e-permit.test.ts fails if the two drift — edit both together.
 * Keep this file free of imports (it runs in Next.js and in Nest). Labels are plain English;
 * the client translates them where they are rendered.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export type EPermitStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "REJECTED"
  | "ACTIVE"
  | "RENEWAL_PENDING"
  | "SUSPENDED"
  | "RETURN_PENDING"
  | "COMPLETED"
  | "RETURNED_INCOMPLETE"
  | "CANCELLED";

export type EPermitCategory = "hot_work" | "cold_work";

export type EPermitSubCategory =
  | "welding"
  | "gas_cutting"
  | "grinding"
  | "open_flame"
  | "general_maintenance"
  | "isolation_check"
  | "non_spark_work"
  | "electrical_work"
  | "working_at_height"
  | "tank_entry"
  | "confined_space"
  | "breakdown_repair";

export type PermitShiftCode = "A" | "B" | "C" | "G";
export type ReturnOutcome = "complete" | "incomplete" | "cancelled";
export type ApprovalKind = "authoriser" | "department" | "safety" | "emergency";
export type ApprovalState = "pending" | "approved" | "rejected";
export type AckContext = "issue" | "renewal" | "return";
export type AckVia = "self" | "holder" | "issuer";
export type YesNa = "yes" | "na";
export type GasKey = "oxygen" | "carbon_monoxide" | "hydrogen" | "lpg" | "ammonia" | "chlorine";

export type EPermitRole =
  | "director"
  | "manager"
  | "hr"
  | "site_incharge"
  | "shift_incharge"
  | "safety_incharge"
  | "supervisor"
  | "hod"
  | "employee";

// ── Statuses ──────────────────────────────────────────────────────────────

export const EPERMIT_STATUSES: EPermitStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "REJECTED",
  "ACTIVE",
  "RENEWAL_PENDING",
  "SUSPENDED",
  "RETURN_PENDING",
  "COMPLETED",
  "RETURNED_INCOMPLETE",
  "CANCELLED",
];

export const EPERMIT_TRANSITIONS: Record<EPermitStatus, EPermitStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["ACTIVE", "REJECTED", "CANCELLED"],
  REJECTED: ["DRAFT", "CANCELLED"],
  ACTIVE: ["RENEWAL_PENDING", "SUSPENDED", "RETURN_PENDING", "CANCELLED"],
  RENEWAL_PENDING: ["ACTIVE", "SUSPENDED", "RETURN_PENDING", "CANCELLED"],
  SUSPENDED: ["ACTIVE", "RENEWAL_PENDING", "RETURN_PENDING", "CANCELLED"],
  /** Accepted (closed) — or sent back to where it was returned from. */
  RETURN_PENDING: ["COMPLETED", "RETURNED_INCOMPLETE", "CANCELLED", "ACTIVE", "SUSPENDED"],
  COMPLETED: [],
  RETURNED_INCOMPLETE: [],
  CANCELLED: [],
};

/** Finished — read-only. */
export const TERMINAL_STATUSES: EPermitStatus[] = ["COMPLETED", "RETURNED_INCOMPLETE", "CANCELLED"];

/** Work is allowed (until validTo). */
export const LIVE_STATUSES: EPermitStatus[] = ["ACTIVE", "RENEWAL_PENDING"];

/** Count against "one location, no clashing work". */
export const OCCUPYING_STATUSES: EPermitStatus[] = ["PENDING_APPROVAL", "ACTIVE", "RENEWAL_PENDING", "SUSPENDED"];

export function isTerminalStatus(status: EPermitStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransition(from: EPermitStatus, to: EPermitStatus): boolean {
  return (EPERMIT_TRANSITIONS[from] ?? []).includes(to);
}

export function assertPermitTransition(from: EPermitStatus, to: EPermitStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid permit status change: ${from} → ${to}`);
  }
}

// ── Categories ────────────────────────────────────────────────────────────

export const SUBCATEGORIES: Record<EPermitCategory, EPermitSubCategory[]> = {
  hot_work: ["welding", "gas_cutting", "grinding", "open_flame", "breakdown_repair"],
  cold_work: [
    "general_maintenance",
    "isolation_check",
    "non_spark_work",
    "electrical_work",
    "working_at_height",
    "tank_entry",
    "confined_space",
    "breakdown_repair",
  ],
};

export function isValidSubCategory(category: string, sub: string): boolean {
  return (SUBCATEGORIES[category as EPermitCategory] ?? []).includes(sub as EPermitSubCategory);
}

// ── Policy (versioned; every permit stores the version it was issued under) ──

const HOUR = 3_600_000;
const MINUTE = 60_000;
const DAY = 24 * HOUR;

export type ExtraClearanceRule = {
  categories?: EPermitCategory[];
  subCategories?: EPermitSubCategory[];
  /** Location must carry one of these tags (e.g. "mee", "chemical"). Omitted = any location. */
  locationTags?: string[];
  departmentIds: string[];
};

export type ConflictRule = { a: string; b: string };

export const EPERMIT_POLICY = {
  version: 1,
  validity: "shift" as const,
  allowStartNextShift: true,
  maxRenewals: 2,
  maxTotalHours: 24,
  renewalRequires: ["authoriser", "issuer_ack", "holder_ack", "worker_ack"],
  warnBeforeEndMinutes: 60,
  autoClose: false,
  clearanceValidityHours: 12,
  /** Sub-categories that also need the Safety In-charge. */
  requireSafetyFor: ["confined_space", "tank_entry"] as EPermitSubCategory[],
  /** Categories that must fill the fire & gas checklist with readings. */
  requireFireGasFor: ["hot_work"] as EPermitCategory[],
  /** Fire & gas items that must be "yes" for those categories. */
  requiredFireItems: ["fire_watcher", "fire_extinguishers"],
  /** Gas readings that must be taken for those categories. */
  requiredGasReadings: ["oxygen"] as GasKey[],
  extraClearanceRules: [
    {
      categories: ["hot_work"],
      subCategories: ["welding", "gas_cutting", "grinding", "open_flame"],
      locationTags: ["mee"],
      departmentIds: ["dept-electrical"],
    },
    { subCategories: ["electrical_work", "isolation_check"], departmentIds: ["dept-electrical"] },
    { categories: ["hot_work"], locationTags: ["chemical"], departmentIds: ["dept-chemical"] },
    { subCategories: ["tank_entry", "confined_space"], departmentIds: ["dept-mechanical"] },
  ] as ExtraClearanceRule[],
  conflictRules: [
    { a: "hot_work", b: "tank_entry" },
    { a: "hot_work", b: "confined_space" },
    { a: "electrical_work", b: "tank_entry" },
  ] as ConflictRule[],
  emergency: {
    allowedFor: ["breakdown_repair"] as EPermitSubCategory[],
    maxHours: 4,
    postReviewWithinHours: 24,
  },
  otLinkWhenOverdue: true,
};

export type EPermitPolicy = typeof EPERMIT_POLICY;

// ── Shifts (mirror client/lib/shift/store.ts shiftMaster) ─────────────────

/** Plant local time is IST; everything is stored in UTC. */
export const PLANT_UTC_OFFSET_MINUTES = 330;

export const PERMIT_SHIFTS: Record<PermitShiftCode, { start: string; end: string }> = {
  A: { start: "06:00", end: "14:00" },
  B: { start: "14:00", end: "22:00" },
  C: { start: "22:00", end: "06:00" },
  G: { start: "09:00", end: "18:00" },
};

/** The rotating shifts that tile the whole day (G overlaps A/B). */
const ROTATING: PermitShiftCode[] = ["A", "B", "C"];

export type ShiftWindow = { shiftCode: PermitShiftCode; start: string; end: string };

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Occurrences of a shift that start on plant-local day `dayIndex` (days since epoch). */
function occurrence(code: PermitShiftCode, dayIndex: number): { start: number; end: number } {
  const def = PERMIT_SHIFTS[code];
  const s = minutesOf(def.start);
  let e = minutesOf(def.end);
  if (e <= s) e += 24 * 60;
  const start = dayIndex * DAY + s * MINUTE - PLANT_UTC_OFFSET_MINUTES * MINUTE;
  return { start, end: start + (e - s) * MINUTE };
}

const localDay = (ms: number) => Math.floor((ms + PLANT_UTC_OFFSET_MINUTES * MINUTE) / DAY);

/** The occurrence of `code` running at `now`, else the next one to start. */
export function shiftWindow(code: PermitShiftCode, now: number): ShiftWindow {
  const day = localDay(now);
  const occ = [day - 1, day, day + 1, day + 2].map((d) => occurrence(code, d));
  const running = occ.find((o) => o.start <= now && now < o.end);
  const pick = running ?? occ.filter((o) => o.start > now).sort((a, b) => a.start - b.start)[0];
  return { shiftCode: code, start: new Date(pick.start).toISOString(), end: new Date(pick.end).toISOString() };
}

/** Is `code` running at `now` (as opposed to starting later)? */
export function isShiftRunning(code: PermitShiftCode, now: number): boolean {
  const w = shiftWindow(code, now);
  return Date.parse(w.start) <= now;
}

/** The rotating shift (A/B/C) running at `t`. */
export function rotatingShiftAt(t: number): ShiftWindow {
  for (const code of ROTATING) {
    const w = shiftWindow(code, t);
    if (Date.parse(w.start) <= t && t < Date.parse(w.end)) return w;
  }
  return shiftWindow("A", t); // unreachable: A/B/C tile the day
}

/** The rotating shift that follows the one ending at `t` (used for renewals). */
export function nextShiftWindow(t: number): ShiftWindow {
  return rotatingShiftAt(t);
}

/** Choices the issuer sees: every shift, running now or next. */
export function shiftChoices(now: number): (ShiftWindow & { running: boolean })[] {
  return (Object.keys(PERMIT_SHIFTS) as PermitShiftCode[]).map((code) => {
    const w = shiftWindow(code, now);
    return { ...w, running: Date.parse(w.start) <= now };
  });
}

/**
 * Validity when a permit is activated: from now (or the shift start if later) to the shift end.
 * If the chosen shift has already ended, the rotating shift running now is used instead.
 * Emergency permits are capped at `emergency.maxHours`.
 */
export function activationValidity(
  chosen: { shiftCode: PermitShiftCode; windowStart: string; windowEnd: string },
  now: number,
  emergency = false,
  policy: EPermitPolicy = EPERMIT_POLICY,
): { shiftCode: PermitShiftCode; validFrom: string; validTo: string; rolled: boolean } {
  let shiftCode = chosen.shiftCode;
  let start = Date.parse(chosen.windowStart);
  let end = Date.parse(chosen.windowEnd);
  let rolled = false;
  if (!(end > now)) {
    const w = rotatingShiftAt(now);
    shiftCode = w.shiftCode;
    start = Date.parse(w.start);
    end = Date.parse(w.end);
    rolled = true;
  }
  const from = Math.max(now, start);
  let to = end;
  if (emergency) to = Math.min(to, from + policy.emergency.maxHours * HOUR);
  return { shiftCode, validFrom: new Date(from).toISOString(), validTo: new Date(to).toISOString(), rolled };
}

// ── Renewal ───────────────────────────────────────────────────────────────

export type RenewalRef = { renewalCount: number; firstValidFrom?: string; validTo?: string };

/** Why another renewal is not allowed, or null. */
export function renewalBlocker(p: RenewalRef, policy: EPermitPolicy = EPERMIT_POLICY): string | null {
  if (!p.firstValidFrom || !p.validTo) return "Permit has not been activated";
  if (p.renewalCount >= policy.maxRenewals) {
    return `Renewal limit reached (${policy.maxRenewals} renewals) — issue a new permit`;
  }
  const cap = Date.parse(p.firstValidFrom) + policy.maxTotalHours * HOUR;
  if (Date.parse(p.validTo) >= cap) return `${policy.maxTotalHours} h limit reached — issue a new permit`;
  return null;
}

/** The next shift's window for a renewal, capped at maxTotalHours from first activation. */
export function renewalWindow(
  p: RenewalRef,
  policy: EPermitPolicy = EPERMIT_POLICY,
): { shiftCode: PermitShiftCode; validFrom: string; validTo: string } {
  const from = Date.parse(p.validTo!);
  const next = nextShiftWindow(from);
  const cap = Date.parse(p.firstValidFrom!) + policy.maxTotalHours * HOUR;
  const to = Math.min(Date.parse(next.end), cap);
  return { shiftCode: next.shiftCode, validFrom: new Date(from).toISOString(), validTo: new Date(to).toISOString() };
}

// ── Time checks ───────────────────────────────────────────────────────────

export type TimedPermitRef = { status: EPermitStatus; validTo?: string };

/** Overdue is derived, not stored: live and past validTo. */
export function isOverdue(p: TimedPermitRef, now: number): boolean {
  if (!LIVE_STATUSES.includes(p.status) || !p.validTo) return false;
  return now > Date.parse(p.validTo);
}

/** Inside the warning window before validTo (and not yet warned for this validTo). */
export function shouldWarn(
  p: TimedPermitRef & { warnedForValidTo?: string },
  now: number,
  policy: EPermitPolicy = EPERMIT_POLICY,
): boolean {
  if (!LIVE_STATUSES.includes(p.status) || !p.validTo) return false;
  if (p.warnedForValidTo === p.validTo) return false;
  const end = Date.parse(p.validTo);
  return now < end && end - now <= policy.warnBeforeEndMinutes * MINUTE;
}

/** Overdue and not yet notified for this validTo. */
export function shouldNotifyOverdue(p: TimedPermitRef & { overdueNotifiedFor?: string }, now: number): boolean {
  return isOverdue(p, now) && p.overdueNotifiedFor !== p.validTo;
}

/** Minutes left (negative once overdue). */
export function minutesLeft(p: { validTo?: string }, now: number): number | null {
  if (!p.validTo) return null;
  return Math.round((Date.parse(p.validTo) - now) / MINUTE);
}

/** Approvals lapse when the permit is not active within clearanceValidityHours of the first approval. */
export function approvalsLapsed(
  p: { status: EPermitStatus; firstApprovalAt?: string },
  now: number,
  policy: EPermitPolicy = EPERMIT_POLICY,
): boolean {
  if (p.status !== "PENDING_APPROVAL" || !p.firstApprovalAt) return false;
  return now - Date.parse(p.firstApprovalAt) > policy.clearanceValidityHours * HOUR;
}

/** Emergency post-review overdue (24 h after activation). */
export function postReviewOverdue(
  p: { emergency?: boolean; firstValidFrom?: string; postReviews?: { status: string }[] },
  now: number,
  policy: EPermitPolicy = EPERMIT_POLICY,
): boolean {
  if (!p.emergency || !p.firstValidFrom) return false;
  if (!(p.postReviews ?? []).some((r) => r.status === "pending")) return false;
  return now - Date.parse(p.firstValidFrom) > policy.emergency.postReviewWithinHours * HOUR;
}

/** Hours from first activation to completion, one decimal. */
export function actualHours(firstValidFrom?: string, completedAt?: string): number {
  if (!firstValidFrom || !completedAt) return 0;
  const ms = Date.parse(completedAt) - Date.parse(firstValidFrom);
  return ms > 0 ? Math.round((ms / HOUR) * 10) / 10 : 0;
}

// ── Permit form ───────────────────────────────────────────────────────────

export type ChecklistItemDef = { key: string; label: string };

/** Part B1 — safety measures taken (Yes / NA). */
export const SAFETY_MEASURES: ChecklistItemDef[] = [
  { key: "gas_free", label: "Equipment is free from flammable / hydrocarbon / toxic gases" },
  { key: "drained_cleaned", label: "Equipment properly drained, cleaned" },
  { key: "water_seal", label: "Water seal has been made" },
  { key: "bleeders_open", label: "Bleeders have been opened" },
  { key: "nitrogen_purged", label: "Nitrogen purging has been done" },
  { key: "radioactive_protected", label: "Radioactive sources protected" },
  { key: "ventilation", label: "Mechanical ventilation (blower)" },
  { key: "access_platform", label: "Scaffold / ladder / grating / platform" },
  { key: "spill_kit", label: "Spill kit / containment" },
  { key: "actuator_rest", label: "Cylinder / actuator resting position" },
];

/** Part B3A — PPE & others (Yes / NA), plus up to 3 custom rows. */
export const PPE_ITEMS: ChecklistItemDef[] = [
  { key: "eye", label: "Eye protection" },
  { key: "face", label: "Face protection" },
  { key: "ear", label: "Ear protection" },
  { key: "leg_apron", label: "Leg protection / apron" },
  { key: "head", label: "Head protection" },
  { key: "body", label: "Body protection" },
  { key: "harness", label: "Full body safety harness" },
  { key: "ba_set", label: "BA set / ELBA" },
  { key: "dust_mask", label: "Dust mask" },
  { key: "safe_access", label: "Safe means of access" },
  { key: "enclosures", label: "Enclosures" },
  { key: "scaffolding", label: "Scaffolding" },
  { key: "roof_ladder", label: "Roof ladder" },
  { key: "gas_cutting_set", label: "Gas cutting set" },
  { key: "co_monitor", label: "Portable CO monitor" },
];
export const MAX_CUSTOM_PPE = 3;

/** Part B3B — fire precautions & gas tests (Yes / NA). */
export const FIRE_GAS_ITEMS: ChecklistItemDef[] = [
  { key: "fire_watcher", label: "Competent fire watcher" },
  { key: "fire_extinguishers", label: "Fire extinguishers" },
  { key: "fire_hose", label: "Pressurised fire hose" },
  { key: "fire_tender", label: "Fire tender" },
  { key: "screen_off", label: "Screen off area" },
  { key: "explosive_test", label: "Explosive test" },
  { key: "co_test", label: "Carbon monoxide test" },
  { key: "oxygen_test", label: "Oxygen test" },
  { key: "toxic_gas_test", label: "Toxic gas test" },
];

/** Part B3C — associated certificates (tick + reference number). */
export const CERTIFICATE_TYPES: ChecklistItemDef[] = [
  { key: "tool_box_talk", label: "Tool Box Talk" },
  { key: "confined_space", label: "Confined Space Entry" },
  { key: "loto", label: "LOTO" },
  { key: "electrical", label: "Electrical" },
  { key: "road_closure", label: "Road Closure" },
  { key: "scaffolding", label: "Scaffolding" },
  { key: "working_at_height", label: "Working at Height" },
  { key: "excavation", label: "Excavation" },
  { key: "heavy_lift", label: "Heavy Lift" },
  { key: "radiography", label: "Radiography" },
  { key: "hydra_farana", label: "Hydra / Farana" },
];

export type GasLimit = { label: string; unit: string; min?: number; max: number; safe: string; flammable: string };

/** Safe concentration for 8 h + flammable range (display). Hydrogen / LPG max = 10% of the lower flammable limit. */
export const GAS_LIMITS: Record<GasKey, GasLimit> = {
  oxygen: { label: "Oxygen", unit: "% vol", min: 19.5, max: 23.5, safe: "19.5 – 23.5 % vol", flammable: "— / >23.5 %" },
  carbon_monoxide: { label: "Carbon monoxide", unit: "ppm", max: 50, safe: "50 ppm", flammable: "12.5 % – 74.2 %" },
  hydrogen: { label: "Hydrogen", unit: "% vol", max: 0.4, safe: "—", flammable: "4.0 % – 75 %" },
  lpg: { label: "LPG", unit: "ppm", max: 1000, safe: "1000 ppm", flammable: "2.2 % – 9.9 %" },
  ammonia: { label: "Ammonia", unit: "ppm", max: 25, safe: "25 ppm", flammable: "15 % – 23 %" },
  chlorine: { label: "Chlorine", unit: "ppm", max: 1, safe: "1 ppm", flammable: "—" },
};

export const GAS_KEYS = Object.keys(GAS_LIMITS) as GasKey[];

export type GasReadingInput = { gas: string; value: number };

/** Readings outside the safe limits (or unknown gases / bad numbers). */
export function validateGasReadings(readings: GasReadingInput[]): string[] {
  const out: string[] = [];
  for (const r of readings) {
    const lim = GAS_LIMITS[r.gas as GasKey];
    if (!lim) {
      out.push(`Unknown gas: ${r.gas}`);
      continue;
    }
    if (typeof r.value !== "number" || !Number.isFinite(r.value) || r.value < 0) {
      out.push(`${lim.label}: enter a valid reading`);
      continue;
    }
    if (lim.min !== undefined && r.value < lim.min) out.push(`${lim.label} ${r.value} ${lim.unit} is below the safe limit (${lim.safe})`);
    if (r.value > lim.max) out.push(`${lim.label} ${r.value} ${lim.unit} is above the safe limit (${lim.safe === "—" ? `${lim.max} ${lim.unit}` : lim.safe})`);
  }
  return out;
}

export function isGasReadingOk(r: GasReadingInput): boolean {
  return validateGasReadings([r]).length === 0;
}

/** Does this permit need the fire & gas checklist with readings? */
export function requiresFireGas(category: string, policy: EPermitPolicy = EPERMIT_POLICY): boolean {
  return policy.requireFireGasFor.includes(category as EPermitCategory);
}

export function requiresSafetyGate(subCategory: string, policy: EPermitPolicy = EPERMIT_POLICY): boolean {
  return policy.requireSafetyFor.includes(subCategory as EPermitSubCategory);
}

export type ChecklistAnswer = { key: string; value: YesNa | ""; refNo?: string; label?: string };

export type PermitFormRef = {
  siteId?: string;
  locationId?: string;
  category?: string;
  subCategory?: string;
  description?: string;
  shiftCode?: string;
  workerIds?: string[];
  holderId?: string;
  emergency?: boolean;
  safetyMeasures?: ChecklistAnswer[];
  ppe?: ChecklistAnswer[];
  fireGas?: ChecklistAnswer[];
  certificates?: ChecklistAnswer[];
  gasReadings?: GasReadingInput[];
};

const answered = (defs: ChecklistItemDef[], answers: ChecklistAnswer[] = []) =>
  defs.filter((d) => {
    const a = answers.find((x) => x.key === d.key);
    return a?.value === "yes" || a?.value === "na";
  }).length;

/** Everything that stops a draft from being submitted for approval. Empty = ready. */
export function validateForSubmit(p: PermitFormRef, policy: EPermitPolicy = EPERMIT_POLICY): string[] {
  const errors: string[] = [];
  if (!p.siteId) errors.push("Choose a plant");
  if (!p.locationId) errors.push("Choose a location");
  if (!p.category || !SUBCATEGORIES[p.category as EPermitCategory]) errors.push("Choose Hot Work or Cold Work");
  else if (!p.subCategory || !isValidSubCategory(p.category, p.subCategory)) errors.push("Choose the type of work");
  if (!p.description?.trim()) errors.push("Describe the work");
  if (!p.shiftCode || !PERMIT_SHIFTS[p.shiftCode as PermitShiftCode]) errors.push("Choose the shift");
  const workers = p.workerIds ?? [];
  if (!workers.length) errors.push("Assign at least one worker");
  if (!p.holderId) errors.push("Choose the Permit Holder");
  else if (!workers.includes(p.holderId)) errors.push("The Permit Holder must be one of the workers");
  if (p.emergency && !policy.emergency.allowedFor.includes(p.subCategory as EPermitSubCategory)) {
    errors.push("Emergency permits are only for breakdown repair");
  }
  if (answered(SAFETY_MEASURES, p.safetyMeasures) < SAFETY_MEASURES.length) errors.push("Answer every safety measure (Yes / NA)");
  if (answered(PPE_ITEMS, p.ppe) < PPE_ITEMS.length) errors.push("Answer every PPE item (Yes / NA)");
  if (p.category && requiresFireGas(p.category, policy)) {
    if (answered(FIRE_GAS_ITEMS, p.fireGas) < FIRE_GAS_ITEMS.length) errors.push("Hot work: answer every fire & gas item");
    for (const key of policy.requiredFireItems) {
      if (p.fireGas?.find((a) => a.key === key)?.value !== "yes") {
        const def = FIRE_GAS_ITEMS.find((d) => d.key === key);
        errors.push(`Hot work needs: ${def?.label ?? key}`);
      }
    }
    const readings = p.gasReadings ?? [];
    for (const gas of policy.requiredGasReadings) {
      if (!readings.some((r) => r.gas === gas)) errors.push(`Hot work needs a ${GAS_LIMITS[gas].label.toLowerCase()} reading`);
    }
  }
  errors.push(...validateGasReadings(p.gasReadings ?? []));
  return errors;
}

// ── Approvals ─────────────────────────────────────────────────────────────

export type LocationRef = { id: string; siteId: string; ownerDepartmentId: string; tags?: string[]; concernedDepartmentIds?: string[] };

/**
 * Departments that must clear the permit in addition to the location's owner: every other department
 * concerned with the location (they run equipment or people there), plus any the policy rules add for this work.
 */
export function extraClearances(
  location: LocationRef,
  category: string,
  subCategory: string,
  policy: EPermitPolicy = EPERMIT_POLICY,
): string[] {
  const tags = location.tags ?? [];
  const out = new Set<string>(location.concernedDepartmentIds ?? []);
  for (const rule of policy.extraClearanceRules) {
    if (rule.categories && !rule.categories.includes(category as EPermitCategory)) continue;
    if (rule.subCategories && !rule.subCategories.includes(subCategory as EPermitSubCategory)) continue;
    if (rule.locationTags && !rule.locationTags.some((t) => tags.includes(t))) continue;
    for (const d of rule.departmentIds) out.add(d);
  }
  out.delete(location.ownerDepartmentId);
  return [...out];
}

export type ApprovalRef = { kind: ApprovalKind; departmentId?: string; status: ApprovalState };

/** The approvals a submitted permit needs. Emergency permits: the Plant Manager only (the rest become post-reviews). */
export function requiredApprovals(
  location: LocationRef,
  category: string,
  subCategory: string,
  emergency: boolean,
  policy: EPermitPolicy = EPERMIT_POLICY,
): ApprovalRef[] {
  if (emergency) return [{ kind: "emergency", status: "pending" }];
  return [
    { kind: "authoriser", departmentId: location.ownerDepartmentId, status: "pending" },
    ...extraClearances(location, category, subCategory, policy).map(
      (departmentId): ApprovalRef => ({ kind: "department", departmentId, status: "pending" }),
    ),
    ...(requiresSafetyGate(subCategory, policy) ? [{ kind: "safety" as const, status: "pending" as const }] : []),
  ];
}

/** Post-reviews an emergency permit owes once it is active (what the normal path would have asked). */
export function emergencyPostReviews(
  location: LocationRef,
  category: string,
  subCategory: string,
  policy: EPermitPolicy = EPERMIT_POLICY,
): ApprovalRef[] {
  return requiredApprovals(location, category, subCategory, false, policy);
}

// ── Conflicts ─────────────────────────────────────────────────────────────

export type ConflictRef = {
  id?: string;
  locationId: string;
  category: string;
  subCategory: string;
  status: EPermitStatus;
};

const tagsOfPermit = (p: { category: string; subCategory: string }) => [p.category, p.subCategory];

/** Other permits at the same location whose work clashes with this one. */
export function findConflicts(
  permit: ConflictRef,
  others: ConflictRef[],
  policy: EPermitPolicy = EPERMIT_POLICY,
): ConflictRef[] {
  const mine = tagsOfPermit(permit);
  return others.filter((o) => {
    if (o.id && o.id === permit.id) return false;
    if (o.locationId !== permit.locationId || !OCCUPYING_STATUSES.includes(o.status)) return false;
    const theirs = tagsOfPermit(o);
    return policy.conflictRules.some(
      (r) => (mine.includes(r.a) && theirs.includes(r.b)) || (mine.includes(r.b) && theirs.includes(r.a)),
    );
  });
}

// ── Roles & permissions ───────────────────────────────────────────────────

/** Same aliasing as client rbac: legacy "management" → manager. */
export function normalizePermitRole(role?: string): EPermitRole {
  if (!role) return "employee";
  if (role === "management") return "manager";
  const known: EPermitRole[] = [
    "director",
    "manager",
    "hr",
    "site_incharge",
    "shift_incharge",
    "safety_incharge",
    "supervisor",
    "hod",
    "employee",
  ];
  return known.includes(role as EPermitRole) ? (role as EPermitRole) : "employee";
}

/** Supervisor (main), Shift In-Charge, Plant Manager. */
export const ISSUER_ROLES: EPermitRole[] = ["supervisor", "shift_incharge", "site_incharge", "manager"];
/** Approve emergency permits; force-cancel; override soft blocks. */
export const PLANT_OVERRIDE_ROLES: EPermitRole[] = ["manager", "director"];
/** Suspend every live permit at a site. */
export const SITE_SUSPEND_ROLES: EPermitRole[] = ["manager", "director", "safety_incharge"];
/** Raise / approve OT hours for permitted work. */
export const OT_ROLES: EPermitRole[] = ["manager", "director"];
/** See every permit in the organisation. */
export const ORG_WIDE_PERMIT_ROLES: EPermitRole[] = ["director", "safety_incharge"];
/** See every permit at their own site. */
export const SITE_PERMIT_ROLES: EPermitRole[] = ["manager", "site_incharge", "shift_incharge", "supervisor"];

/** Who is looking / acting. `departmentIds` = departments this person heads or deputises (HoDs). */
export type PermitViewer = { id?: string; role?: string; siteId?: string | null; departmentIds?: string[] };

export type PermitPartiesRef = {
  siteId: string;
  issuerId?: string;
  holderId?: string;
  workerIds?: string[];
  authoriserDepartmentId?: string;
  approvals?: { departmentId?: string }[];
  postReviews?: { departmentId?: string }[];
  previousIssuerIds?: string[];
};

export function isIssuerRole(role?: string): boolean {
  return ISSUER_ROLES.includes(normalizePermitRole(role));
}

/** May this person open the issue form at all? */
export function canIssuePermits(viewer: PermitViewer | null | undefined): boolean {
  return Boolean(viewer) && isIssuerRole(viewer!.role) && Boolean(viewer!.siteId);
}

/** Departments named on the permit (authoriser, extra clearances, post-reviews). */
export function permitDepartmentIds(p: PermitPartiesRef): string[] {
  return [
    ...new Set(
      [p.authoriserDepartmentId, ...(p.approvals ?? []).map((a) => a.departmentId), ...(p.postReviews ?? []).map((a) => a.departmentId)].filter(
        (x): x is string => Boolean(x),
      ),
    ),
  ];
}

/** Worker, holder or issuer (now or earlier) on this permit. */
export function isOnPermit(personId: string | undefined, p: PermitPartiesRef): boolean {
  if (!personId) return false;
  return (
    p.issuerId === personId ||
    p.holderId === personId ||
    (p.workerIds ?? []).includes(personId) ||
    (p.previousIssuerIds ?? []).includes(personId)
  );
}

/** Visibility: only concerned people (plan §10). */
export function canViewPermit(viewer: PermitViewer | null | undefined, p: PermitPartiesRef): boolean {
  if (!viewer) return false;
  const role = normalizePermitRole(viewer.role);
  if (ORG_WIDE_PERMIT_ROLES.includes(role)) return true;
  if (isOnPermit(viewer.id, p)) return true;
  if (SITE_PERMIT_ROLES.includes(role)) return Boolean(viewer.siteId) && viewer.siteId === p.siteId;
  if (role === "hod") {
    const mine = viewer.departmentIds ?? [];
    return permitDepartmentIds(p).some((d) => mine.includes(d));
  }
  return false;
}

/** Is the viewer the location owner's HoD / deputy for this permit? */
export function isAuthoriserOf(viewer: PermitViewer | null | undefined, p: PermitPartiesRef): boolean {
  if (!viewer || !p.authoriserDepartmentId) return false;
  return normalizePermitRole(viewer.role) === "hod" && (viewer.departmentIds ?? []).includes(p.authoriserDepartmentId);
}

/** May the viewer decide this approval? Director may always decide (waive / escalate). */
export function canDecideApproval(
  viewer: PermitViewer | null | undefined,
  approval: { kind: ApprovalKind; departmentId?: string },
  p: { siteId: string },
): boolean {
  if (!viewer) return false;
  const role = normalizePermitRole(viewer.role);
  if (role === "director") return true;
  switch (approval.kind) {
    case "authoriser":
    case "department":
      return role === "hod" && Boolean(approval.departmentId) && (viewer.departmentIds ?? []).includes(approval.departmentId!);
    case "safety":
      return role === "safety_incharge";
    case "emergency":
      return role === "manager" && viewer.siteId === p.siteId;
    default:
      return false;
  }
}

/** Issuer of this permit, or a plant override role on its site. */
export function canManageAsIssuer(viewer: PermitViewer | null | undefined, p: PermitPartiesRef): boolean {
  if (!viewer) return false;
  if (viewer.id && viewer.id === p.issuerId) return true;
  const role = normalizePermitRole(viewer.role);
  if (role === "director") return true;
  return role === "manager" && viewer.siteId === p.siteId;
}

/** Accept a return / approve a renewal / resume: the Authoriser, or Plant Manager / Director. */
export function canActAsAuthoriser(viewer: PermitViewer | null | undefined, p: PermitPartiesRef): boolean {
  if (!viewer) return false;
  if (isAuthoriserOf(viewer, p)) return true;
  const role = normalizePermitRole(viewer.role);
  if (role === "director") return true;
  return role === "manager" && viewer.siteId === p.siteId;
}

/** Suspend: issuer, authoriser, Safety In-charge, Plant Manager (own site), Director. */
export function canSuspend(viewer: PermitViewer | null | undefined, p: PermitPartiesRef): boolean {
  if (!viewer) return false;
  if (canManageAsIssuer(viewer, p) || isAuthoriserOf(viewer, p)) return true;
  return normalizePermitRole(viewer.role) === "safety_incharge";
}

export function canSuspendSite(viewer: PermitViewer | null | undefined, siteId: string): boolean {
  if (!viewer) return false;
  const role = normalizePermitRole(viewer.role);
  if (role === "director" || role === "safety_incharge") return true;
  return role === "manager" && viewer.siteId === siteId;
}

export function canRaisePermitOt(viewer: PermitViewer | null | undefined, p: { siteId: string }): boolean {
  if (!viewer) return false;
  const role = normalizePermitRole(viewer.role);
  if (role === "director") return true;
  return OT_ROLES.includes(role) && viewer.siteId === p.siteId;
}

/** Override a soft block (conflict, worker on leave, pending safety clearance) — Plant Manager / Director. */
export function canOverrideSoftBlocks(viewer: PermitViewer | null | undefined, siteId: string): boolean {
  if (!viewer) return false;
  const role = normalizePermitRole(viewer.role);
  if (role === "director") return true;
  return PLANT_OVERRIDE_ROLES.includes(role) && viewer.siteId === siteId;
}

/** Who may change which departments are concerned with a location: the Director, or that plant's Plant Manager. */
export function canEditLocationDepartments(viewer: PermitViewer | null | undefined, siteId: string): boolean {
  return canOverrideSoftBlocks(viewer, siteId);
}

/** Record an acknowledgement for `personId`: themselves, or on the holder's / issuer's device in person. */
export function ackViaFor(
  actorId: string | undefined,
  personId: string,
  p: { issuerId?: string; holderId?: string },
): AckVia | null {
  if (!actorId) return null;
  if (actorId === personId) return "self";
  if (actorId === p.holderId) return "holder";
  if (actorId === p.issuerId) return "issuer";
  return null;
}

// ── Leave soft-block ──────────────────────────────────────────────────────

/** Approved / absent leave statuses — a worker on one of these that day is soft-blocked. */
export const LEAVE_BLOCKING_STATUSES = [
  "SITE_APPROVED",
  "MANAGER_APPROVED",
  "HR_VALIDATED",
  "APPROVED",
  "ABSENT",
  "SUPERVISOR_RECORDED",
  "SITE_VERIFIED",
];

// ── Permit numbers ────────────────────────────────────────────────────────

/** "s-etp" → "ETP". */
export function siteCode(siteId: string): string {
  return siteId.replace(/^s-/, "").toUpperCase() || "SITE";
}

/** Indian financial year (April–March) of a moment, as its closing year: Oct 2026 → 2027. */
export function financialYear(ms: number): number {
  const local = new Date(ms + PLANT_UTC_OFFSET_MINUTES * MINUTE);
  const y = local.getUTCFullYear();
  return local.getUTCMonth() >= 3 ? y + 1 : y;
}

/** `{SITE}/FY{yy}/{seq}` — e.g. ETP/FY27/00123. */
export function formatPermitNo(siteId: string, ms: number, seq: number): string {
  const fy = String(financialYear(ms) % 100).padStart(2, "0");
  return `${siteCode(siteId)}/FY${fy}/${String(seq).padStart(5, "0")}`;
}

/** Renewal reference — ETP/FY27/00123/R1. */
export function renewalRef(permitNo: string, n: number): string {
  return `${permitNo}/R${n}`;
}

// ── Labels (English; the client translates where rendered) ────────────────

export const EPERMIT_STATUS_LABELS: Record<EPermitStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  REJECTED: "Rejected",
  ACTIVE: "Active",
  RENEWAL_PENDING: "Renewal pending",
  SUSPENDED: "Suspended",
  RETURN_PENDING: "Return pending",
  COMPLETED: "Completed",
  RETURNED_INCOMPLETE: "Returned — work not complete",
  CANCELLED: "Cancelled",
};

export const EPERMIT_CATEGORY_LABELS: Record<EPermitCategory, string> = {
  hot_work: "Hot Work",
  cold_work: "Cold Work",
};

export const EPERMIT_SUBCATEGORY_LABELS: Record<EPermitSubCategory, string> = {
  welding: "Welding",
  gas_cutting: "Gas cutting",
  grinding: "Grinding",
  open_flame: "Open flame",
  general_maintenance: "General maintenance",
  isolation_check: "Isolation check",
  non_spark_work: "Non-spark work",
  electrical_work: "Electrical work",
  working_at_height: "Working at height",
  tank_entry: "Tank entry",
  confined_space: "Confined space",
  breakdown_repair: "Breakdown repair",
};

export const RETURN_OUTCOME_LABELS: Record<ReturnOutcome, string> = {
  complete: "Work Complete",
  incomplete: "Work Not Complete",
  cancelled: "Cancelled",
};

export const APPROVAL_KIND_LABELS: Record<ApprovalKind, string> = {
  authoriser: "Authoriser",
  department: "Department clearance",
  safety: "Safety In-charge",
  emergency: "Emergency approval",
};

/** Back panel — rules printed on every permit. */
export const PERMIT_RULES: string[] = [
  "Permit is valid for one shift; it can be renewed for two more shifts (24 h max).",
  "Permit is not valid if conditions at the location become hazardous, or in any emergency / fire.",
  "Only authorised people issue permits.",
  "All working instructions & protocols are strictly followed.",
  "If not completed within the valid period, re-approval is required.",
  "Permit is returned to the Authoriser after job completion.",
  "Teams coordinate for safety when working together.",
  "No job is attempted without a permit.",
  "Workers are briefed about dangers before starting.",
  "People working at height and in confined spaces must be medically fit.",
  "Certificates are required for activities like excavation, working at height, scaffolding, etc.",
  "Confined-space gas results are recorded periodically.",
  "Risk assessment is mandatory for all permits.",
];
