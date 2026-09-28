import { employees, getEmployeeById, sites } from "@/lib/mock-data";
import { employeeHasCoveringLeave } from "@/lib/leave/coverage";
import { getRelievers, getClusterForSite } from "@/lib/reliever/pool";
import { nectarColors } from "@/lib/theme";
import type {
  EmployeeRotationRow,
  PlannedShiftDay,
  RelieverSuggestion,
  RestRuleConfig,
  RotationAssignmentCell,
  RotationDecision,
  RotationPattern,
  RotationPatternId,
  RotationPreview,
  RotationPreviewStatus,
  ShiftChangeRequest,
  ShiftCode,
  ShiftConflict,
  ShiftDeviationAgg,
  ShiftMaster,
} from "./types";

export const shiftMaster: ShiftMaster[] = [
  {
    id: "sh-morning",
    code: "A",
    name: "A Shift (Morning)",
    startTime: "06:00",
    endTime: "14:00",
    scheduledHours: 8,
    breakMinutes: 30,
    color: nectarColors.leaf,
  },
  {
    id: "sh-afternoon",
    code: "B",
    name: "B Shift (Afternoon)",
    startTime: "14:00",
    endTime: "22:00",
    scheduledHours: 8,
    breakMinutes: 30,
    color: nectarColors.sky,
  },
  {
    id: "sh-night",
    code: "C",
    name: "C Shift (Night)",
    startTime: "22:00",
    endTime: "06:00",
    scheduledHours: 8,
    breakMinutes: 30,
    color: "#7C3AED",
  },
  {
    id: "sh-general",
    code: "G",
    name: "General Shift",
    startTime: "09:00",
    endTime: "18:00",
    scheduledHours: 8,
    breakMinutes: 60,
    color: "#0E7490",
  },
];

export const rotationPatterns: RotationPattern[] = [
  {
    id: "weekly_abc",
    name: "Weekly A → B → C",
    description: "Week 1 A, Week 2 B, Week 3 C, then repeat.",
    sequence: ["A", "B", "C"],
    periodDays: 7,
  },
  {
    id: "paired_aabbcc",
    name: "Paired A A B B C C",
    description: "Two days on each shift before rotating.",
    sequence: ["A", "A", "B", "B", "C", "C"],
    periodDays: 2,
  },
];

/** Configurable rest / weekly-off rules — HR/compliance validates values */
export let restRules: RestRuleConfig = {
  minimumRestHours: 11,
  weeklyOffDay: 0,
  weeklyOffOtEnabled: true,
};

export function getRestRules(): RestRuleConfig {
  ensureShiftHydrated();
  return { ...restRules };
}

export function updateRestRules(patch: Partial<RestRuleConfig>) {
  ensureShiftHydrated();
  restRules = { ...restRules, ...patch };
  persistShiftStore();
  return restRules;
}

export function getShiftByCode(code: ShiftCode) {
  return shiftMaster.find((s) => s.code === code);
}

export function getShiftMasterById(id: string) {
  return shiftMaster.find((s) => s.id === id);
}

const CODE_FROM_EMP_SHIFT: Record<string, ShiftCode> = {
  "sh-morning": "A",
  "sh-afternoon": "B",
  "sh-night": "C",
  "sh-general": "G",
};

function nextCode(code: ShiftCode, pattern: RotationPattern): ShiftCode {
  const seq = pattern.sequence.filter((c): c is Exclude<ShiftCode, "OFF"> => c !== "OFF");
  if (code === "OFF") return seq[0] ?? "A";
  const idx = seq.indexOf(code);
  if (idx < 0) return seq[0] ?? "A";
  return seq[(idx + 1) % seq.length];
}

function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const ACTIVE_PATTERN = rotationPatterns[0];
const EFFECTIVE = "2026-10-01";
const TODAY = "2026-09-23";

/**
 * Demo monthly roster: four people per plant only —
 * one A (morning), one B (afternoon), one C (night), one Reliever (general).
 * IDs: e-{site}-s1|s2|s3|g1 (excludes managers, SIC, supervisors, extra s4).
 */
const DEMO_ROTATION_EMP_IDS = new Set([
  // ETP (s1, s2, s3, g1)
  "emp0126", "emp0127", "emp0128", "emp0130",
  // RO (s1, s2, s3, g1)
  "emp0134", "emp0135", "emp0136", "emp0138",
  // MEE (s1, s2, s3, g1)
  "emp0142", "emp0143", "emp0144", "emp0146",
]);

function isDemoRotationEmployee(employeeId: string): boolean {
  if (DEMO_ROTATION_EMP_IDS.has(employeeId)) return true;
  return /-(s[123]|g1)$/.test(employeeId);
}

function groupLabelForCode(code: ShiftCode): string {
  if (code === "A") return "A";
  if (code === "B") return "B";
  if (code === "C") return "C";
  return "Reliever";
}

function buildRotationRows(): EmployeeRotationRow[] {
  return employees
    .filter(
      (e) =>
        e.employmentStatus === "active" && isDemoRotationEmployee(e.id),
    )
    .map((e) => {
      const currentCode = CODE_FROM_EMP_SHIFT[e.shiftId] ?? "A";
      const nxt = nextCode(currentCode, ACTIVE_PATTERN);
      return {
        employeeId: e.id,
        employeeName: e.name,
        siteId: e.siteId,
        groupId: groupLabelForCode(currentCode),
        currentShiftId: getShiftByCode(currentCode)?.id ?? e.shiftId,
        currentCode,
        nextShiftId: getShiftByCode(nxt)?.id ?? e.shiftId,
        nextCode: nxt,
        effectiveDate: EFFECTIVE,
        weeklyOffDay: restRules.weeklyOffDay,
      };
    });
}

let rotationRows = buildRotationRows();

function buildPlannedDays(): PlannedShiftDay[] {
  const days: PlannedShiftDay[] = [];
  const start = new Date("2026-09-20T00:00:00Z");
  const end = new Date("2026-10-07T00:00:00Z");
  let seq = 0;

  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const dateStr = formatDate(day);
    const dow = day.getUTCDay();
    for (const row of rotationRows) {
      const isOff = dow === row.weeklyOffDay;
      const useNext = dateStr >= row.effectiveDate;
      const code = isOff ? ("OFF" as ShiftCode) : useNext ? row.nextCode : row.currentCode;
      const shift = code === "OFF" ? undefined : getShiftByCode(code);
      const plannedShiftId = shift?.id ?? "off";

      // Seed some deviations for demo
      let actualShiftId: string | undefined;
      let actualCode: ShiftCode | undefined;
      if (!isOff && dateStr < TODAY) {
        const roll = (seq + row.employeeId.charCodeAt(1)) % 7;
        if (roll === 0) {
          const alt = nextCode(code as ShiftCode, ACTIVE_PATTERN);
          actualCode = alt;
          actualShiftId = getShiftByCode(alt)?.id;
        } else {
          actualCode = code;
          actualShiftId = plannedShiftId;
        }
      }

      seq += 1;
      days.push({
        id: `psd-${seq}`,
        employeeId: row.employeeId,
        siteId: row.siteId,
        date: dateStr,
        plannedShiftId,
        plannedCode: code,
        actualShiftId,
        actualCode,
        isWeeklyOff: isOff,
        status: dateStr < TODAY ? "completed" : dateStr === TODAY ? "active" : "planned",
      });
    }
  }
  return days;
}

let plannedDays = buildPlannedDays();

let rotationPreviews: RotationPreview[] = [
  {
    id: "rp1",
    siteId: "s-etp",
    fromDate: "2026-09-25",
    toDate: "2026-10-01",
    employeesAffected: 2,
    fromCode: "A",
    toCode: "B",
    status: "pending_manager",
  },
  {
    id: "rp2",
    siteId: "s-ro",
    fromDate: "2026-09-25",
    toDate: "2026-10-01",
    employeesAffected: 2,
    fromCode: "B",
    toCode: "C",
    status: "pending_manager",
  },
  {
    id: "rp3",
    siteId: "s-mee",
    fromDate: "2026-09-26",
    toDate: "2026-10-02",
    employeesAffected: 1,
    fromCode: "C",
    toCode: "A",
    status: "draft",
  },
];

let changeRequests: ShiftChangeRequest[] = [
  {
    id: "scr1",
    employeeId: "emp0127",
    employeeName: "Rohit Kumar Singh",
    siteId: "s-etp",
    date: "2026-09-28",
    fromShiftId: "sh-afternoon",
    toShiftId: "sh-night",
    reason: "Replacement required due to absence",
    requestedBy: "Neetesh Diwathe",
    status: "PENDING",
    potentialOtHours: 0,
    manpowerOk: true,
    createdAt: "2026-09-22T10:00:00Z",
  },
  {
    id: "scr2",
    employeeId: "emp0134",
    employeeName: "Rafik Shaikh",
    siteId: "s-ro",
    date: "2026-09-24",
    fromShiftId: "sh-night",
    toShiftId: "sh-morning",
    reason: "Personal constraint",
    requestedBy: "Vikas Dabade",
    status: "PENDING",
    potentialOtHours: 8,
    manpowerOk: false,
    createdAt: "2026-09-21T14:00:00Z",
  },
];

const shiftSeed = {
  changeRequests: changeRequests.map((c) => ({ ...c })),
  rotationPreviews: rotationPreviews.map((p) => ({ ...p })),
  rotationRows: rotationRows.map((r) => ({ ...r })),
  plannedDays: plannedDays.map((d) => ({ ...d })),
  restRules: { ...restRules },
};

const SHIFT_STORAGE_KEY = "nectar-enviro-shift-store-v3";
let shiftHydrated = false;

type ShiftPersisted = {
  changeRequests: ShiftChangeRequest[];
  rotationPreviews: RotationPreview[];
  rotationRows: EmployeeRotationRow[];
  plannedDays: PlannedShiftDay[];
  restRules?: RestRuleConfig;
};

function persistShiftStore() {
  if (typeof window === "undefined") return;
  try {
    const payload: ShiftPersisted = {
      changeRequests,
      rotationPreviews,
      rotationRows,
      plannedDays,
      restRules,
    };
    localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

function ensureShiftHydrated() {
  if (shiftHydrated || typeof window === "undefined") return;
  shiftHydrated = true;
  try {
    const raw = localStorage.getItem(SHIFT_STORAGE_KEY);
    if (!raw) {
      persistShiftStore();
      return;
    }
    const parsed = JSON.parse(raw) as Partial<ShiftPersisted>;
    if (Array.isArray(parsed.changeRequests)) changeRequests = parsed.changeRequests;
    if (Array.isArray(parsed.rotationPreviews)) {
      rotationPreviews = parsed.rotationPreviews.map(normalizePreviewStatus);
    }
    if (Array.isArray(parsed.rotationRows) && parsed.rotationRows.length) {
      rotationRows = parsed.rotationRows;
    }
    if (Array.isArray(parsed.plannedDays) && parsed.plannedDays.length) {
      plannedDays = parsed.plannedDays;
    }
    if (parsed.restRules && typeof parsed.restRules.minimumRestHours === "number") {
      restRules = { ...restRules, ...parsed.restRules };
    }
  } catch {
    // keep seed
  }
}

function parseMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Map legacy pending_review → pending_manager */
function normalizePreviewStatus(p: RotationPreview): RotationPreview {
  const rawStatus = String(p.status);
  const status: RotationPreviewStatus =
    rawStatus === "pending_review"
      ? "pending_manager"
      : (rawStatus as RotationPreviewStatus);
  return { ...p, status };
}

export function monthKeyFromDates(fromDate: string): string {
  return fromDate.slice(0, 7);
}

/** True when this site already has a published (active) roster for YYYY-MM */
export function hasPublishedMonth(siteId: string, monthKey: string): boolean {
  ensureShiftHydrated();
  return rotationPreviews.some(
    (p) =>
      p.siteId === siteId &&
      p.status === "active" &&
      monthKeyFromDates(p.fromDate) === monthKey,
  );
}

function restHoursBetween(fromCode: ShiftCode, toCode: ShiftCode): number {
  const a = getShiftByCode(fromCode);
  const b = getShiftByCode(toCode);
  if (!a || !b || fromCode === "OFF" || toCode === "OFF") return 24;
  let end = parseMinutes(a.endTime);
  let start = parseMinutes(b.startTime);
  if (a.endTime < a.startTime) end += 24 * 60; // overnight
  if (start < end) start += 24 * 60;
  return (start - end) / 60;
}

/** Rest between a shift on day D and the shift on day D+1. */
function consecutiveDayRestHours(fromCode: ShiftCode, toCode: ShiftCode): number {
  const a = getShiftByCode(fromCode);
  const b = getShiftByCode(toCode);
  if (!a || !b || fromCode === "OFF" || toCode === "OFF") return 24;
  let end = parseMinutes(a.endTime);
  if (a.endTime < a.startTime) end += 24 * 60;
  const start = parseMinutes(b.startTime) + 24 * 60;
  return (start - end) / 60;
}

function plannedDay(employeeId: string, date: string) {
  return plannedDays.find((d) => d.employeeId === employeeId && d.date === date);
}

function assertShiftChangeApprovable(req: ShiftChangeRequest) {
  if (employeeHasCoveringLeave(req.employeeId, req.date)) {
    throw new Error(
      `Employee has leave covering ${req.date}; shift change cannot be approved`,
    );
  }
  const toCode = getShiftMasterById(req.toShiftId)?.code;
  if (!toCode || toCode === "OFF") return;

  const min = restRules.minimumRestHours;
  const prev = plannedDay(req.employeeId, addDays(req.date, -1));
  const next = plannedDay(req.employeeId, addDays(req.date, 1));

  if (prev && prev.plannedCode !== "OFF") {
    const rest = consecutiveDayRestHours(prev.plannedCode, toCode);
    if (rest < min) {
      throw new Error(
        `Insufficient rest (${rest}h < ${min}h) before this shift`,
      );
    }
  }
  if (next && next.plannedCode !== "OFF") {
    const rest = consecutiveDayRestHours(toCode, next.plannedCode);
    if (rest < min) {
      throw new Error(
        `Insufficient rest (${rest}h < ${min}h) after this shift`,
      );
    }
  }
}

export function getRotationRows(siteId?: string) {
  ensureShiftHydrated();
  return rotationRows.filter((r) => (siteId ? r.siteId === siteId : true));
}

export function getPlannedDays(opts?: {
  siteId?: string;
  employeeId?: string;
  from?: string;
  to?: string;
}) {
  ensureShiftHydrated();
  return plannedDays.filter((d) => {
    if (opts?.siteId && d.siteId !== opts.siteId) return false;
    if (opts?.employeeId && d.employeeId !== opts.employeeId) return false;
    if (opts?.from && d.date < opts.from) return false;
    if (opts?.to && d.date > opts.to) return false;
    return true;
  });
}

export function getPlannedShiftForLeave(
  employeeId: string,
  startDate: string,
  endDate: string,
) {
  return getPlannedDays({ employeeId, from: startDate, to: endDate }).filter(
    (d) => d.plannedCode !== "OFF",
  );
}

export function detectConflicts(siteId?: string): ShiftConflict[] {
  const conflicts: ShiftConflict[] = [];
  const days = getPlannedDays({
    siteId,
    from: TODAY,
    to: addDays(TODAY, 10),
  });

  const byEmp = new Map<string, PlannedShiftDay[]>();
  for (const d of days) {
    const list = byEmp.get(d.employeeId) ?? [];
    list.push(d);
    byEmp.set(d.employeeId, list);
  }

  for (const [employeeId, list] of byEmp) {
    const emp = getEmployeeById(employeeId);
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const nxt = sorted[i + 1];
      if (cur.plannedCode === "OFF" || nxt.plannedCode === "OFF") continue;
      if (addDays(cur.date, 1) !== nxt.date) continue;
      const rest = restHoursBetween(cur.plannedCode, nxt.plannedCode);
      if (rest < restRules.minimumRestHours) {
        conflicts.push({
          id: `cf-rest-${employeeId}-${nxt.date}`,
          type: "rest",
          employeeId,
          employeeName: emp?.name ?? employeeId,
          siteId: cur.siteId,
          date: nxt.date,
          severity: "attention",
          message: `Insufficient configured rest (${rest.toFixed(1)}h < ${restRules.minimumRestHours}h) between ${cur.plannedCode} and ${nxt.plannedCode}.`,
        });
      }
    }

    for (const d of sorted) {
      const row = rotationRows.find((r) => r.employeeId === employeeId);
      if (!row) continue;
      const dow = new Date(d.date + "T00:00:00Z").getUTCDay();
      if (dow === row.weeklyOffDay && d.plannedCode !== "OFF") {
        conflicts.push({
          id: `cf-off-${employeeId}-${d.date}`,
          type: "weekly_off",
          employeeId,
          employeeName: emp?.name ?? employeeId,
          siteId: d.siteId,
          date: d.date,
          severity: "watch",
          message: `Weekly-off conflict: work (${d.plannedCode}) scheduled on configured weekly off.`,
        });
      }
    }
  }

  return conflicts;
}

export function getDeviations(siteId?: string) {
  return getPlannedDays({ siteId, to: TODAY }).filter(
    (d) =>
      d.actualCode &&
      d.plannedCode !== "OFF" &&
      d.actualCode !== d.plannedCode,
  );
}

export function getDeviationAggregates(): ShiftDeviationAgg[] {
  return sites.map((site) => {
    const devs = getDeviations(site.id);
    const employeesAffected = new Set(devs.map((d) => d.employeeId)).size;
    return {
      siteId: site.id,
      siteName: site.name,
      deviations: devs.length,
      employeesAffected,
      otHoursAssociated: Math.round(devs.length * 1.7 * 10) / 10,
    };
  });
}

export function getRotationPreviews() {
  ensureShiftHydrated();
  return rotationPreviews.map(normalizePreviewStatus);
}

export function getRotationPreviewById(id: string) {
  ensureShiftHydrated();
  const p = rotationPreviews.find((x) => x.id === id);
  return p ? normalizePreviewStatus(p) : undefined;
}

/**
 * Apply a draft's assignments onto plannedDays / rotationRows and mark active.
 * Prefer adminDecideRotation — this remains for tests / internal use.
 */
export function activateRotationPreview(id: string) {
  ensureShiftHydrated();
  const preview = rotationPreviews.find((p) => p.id === id);
  if (!preview) throw new Error("Rotation draft not found");
  const status = normalizePreviewStatus(preview).status;
  if (
    status !== "pending_manager" &&
    status !== "pending_director" &&
    status !== "draft"
  ) {
    throw new Error("Only a pending draft can be published");
  }
  applyPreviewToLiveRoster(preview);
  rotationPreviews = rotationPreviews.map((p) =>
    p.id === id ? { ...normalizePreviewStatus(p), status: "active" } : p,
  );
  persistShiftStore();
  return rotationPreviews.find((p) => p.id === id);
}

function applyPreviewToLiveRoster(preview: RotationPreview) {
  if (preview.assignments?.length) {
    const byKey = new Map(
      preview.assignments.map((a) => [`${a.employeeId}|${a.date}`, a]),
    );
    plannedDays = plannedDays.map((d) => {
      if (d.siteId !== preview.siteId) return d;
      if (d.date < preview.fromDate || d.date > preview.toDate) return d;
      const cell = byKey.get(`${d.employeeId}|${d.date}`);
      if (!cell) return d;
      const code = cell.code;
      const shift = code === "OFF" ? undefined : getShiftByCode(code);
      return {
        ...d,
        plannedCode: code,
        plannedShiftId: shift?.id ?? "off",
        isWeeklyOff: code === "OFF",
      };
    });

    const existing = new Set(plannedDays.map((d) => `${d.employeeId}|${d.date}`));
    let seq = plannedDays.length;
    for (const cell of preview.assignments) {
      const key = `${cell.employeeId}|${cell.date}`;
      if (existing.has(key)) continue;
      const row = rotationRows.find((r) => r.employeeId === cell.employeeId);
      if (!row || row.siteId !== preview.siteId) continue;
      const code = cell.code;
      const shift = code === "OFF" ? undefined : getShiftByCode(code);
      seq += 1;
      plannedDays.push({
        id: `psd-pub-${seq}`,
        employeeId: cell.employeeId,
        siteId: preview.siteId,
        date: cell.date,
        plannedShiftId: shift?.id ?? "off",
        plannedCode: code,
        isWeeklyOff: code === "OFF",
        status:
          cell.date < TODAY ? "completed" : cell.date === TODAY ? "active" : "planned",
      });
      existing.add(key);
    }

    rotationRows = rotationRows.map((r) => {
      if (r.siteId !== preview.siteId) return r;
      const last = preview.assignments!
        .filter((a) => a.employeeId === r.employeeId && a.code !== "OFF")
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!last) return r;
      const nxt = nextCode(last.code, ACTIVE_PATTERN);
      return {
        ...r,
        currentCode: last.code,
        currentShiftId: getShiftByCode(last.code)?.id ?? r.currentShiftId,
        nextCode: nxt,
        nextShiftId: getShiftByCode(nxt)?.id ?? r.nextShiftId,
        effectiveDate: preview.fromDate,
      };
    });
  } else {
    rotationRows = rotationRows.map((r) => {
      if (r.siteId !== preview.siteId) return r;
      if (r.currentCode !== preview.fromCode) return r;
      return {
        ...r,
        currentCode: preview.toCode,
        currentShiftId: getShiftByCode(preview.toCode)?.id ?? r.currentShiftId,
        nextCode: nextCode(preview.toCode, ACTIVE_PATTERN),
        nextShiftId:
          getShiftByCode(nextCode(preview.toCode, ACTIVE_PATTERN))?.id ??
          r.nextShiftId,
      };
    });
    plannedDays = buildPlannedDays();
  }
}

export function markRotationScheduleViewed(
  id: string,
  role: "manager" | "director",
) {
  ensureShiftHydrated();
  const now = new Date().toISOString();
  rotationPreviews = rotationPreviews.map((p) => {
    if (p.id !== id) return p;
    if (role === "manager") return { ...p, managerViewedAt: now };
    return { ...p, directorViewedAt: now };
  });
  persistShiftStore();
  return getRotationPreviewById(id);
}

export function managerDecideRotation(
  id: string,
  input: { by: string; remark: string; outcome: "approved" | "rejected" },
) {
  ensureShiftHydrated();
  const preview = getRotationPreviewById(id);
  if (!preview) throw new Error("Rotation draft not found");
  if (preview.status !== "pending_manager" && preview.status !== "draft") {
    throw new Error("Draft is not awaiting manager review");
  }
  if (!preview.managerViewedAt) {
    throw new Error("View the schedule before approving or rejecting");
  }
  const remark = input.remark.trim();
  if (!remark) throw new Error("Remark is required");

  const decision: RotationDecision = {
    by: input.by,
    at: new Date().toISOString(),
    remark,
    outcome: input.outcome,
  };

  if (input.outcome === "rejected") {
    rotationPreviews = rotationPreviews.map((p) =>
      p.id === id
        ? { ...p, status: "rejected", managerDecision: decision }
        : p,
    );
  } else {
    rotationPreviews = rotationPreviews.map((p) =>
      p.id === id
        ? { ...p, status: "pending_director", managerDecision: decision }
        : p,
    );
  }
  persistShiftStore();
  return getRotationPreviewById(id);
}

/**
 * Director final decide — approve publishes the rotation onto live roster.
 * Prefer adminDecideRotation — this name kept for backwards compat.
 */
export function adminDecideRotation(
  id: string,
  input: { by: string; remark: string; outcome: "approved" | "rejected" },
) {
  ensureShiftHydrated();
  const preview = getRotationPreviewById(id);
  if (!preview) throw new Error("Rotation draft not found");
  if (preview.status !== "pending_director") {
    throw new Error("Draft is not awaiting director approval");
  }
  if (!preview.directorViewedAt) {
    throw new Error("View the schedule before approving or rejecting");
  }
  const remark = input.remark.trim();
  if (!remark) throw new Error("Remark is required");

  const decision: RotationDecision = {
    by: input.by,
    at: new Date().toISOString(),
    remark,
    outcome: input.outcome,
  };

  if (input.outcome === "rejected") {
    rotationPreviews = rotationPreviews.map((p) =>
      p.id === id ? { ...p, status: "rejected", directorDecision: decision } : p,
    );
    persistShiftStore();
    return getRotationPreviewById(id);
  }

  const monthKey = monthKeyFromDates(preview.fromDate);
  if (hasPublishedMonth(preview.siteId, monthKey)) {
    throw new Error(
      `A schedule for ${monthKey} is already published for this site`,
    );
  }

  applyPreviewToLiveRoster(preview);
  rotationPreviews = rotationPreviews.map((p) =>
    p.id === id ? { ...p, status: "active", directorDecision: decision } : p,
  );
  persistShiftStore();
  return getRotationPreviewById(id);
}

export function rejectRotationPreview(id: string, remark = "Rejected") {
  ensureShiftHydrated();
  const preview = getRotationPreviewById(id);
  if (!preview) throw new Error("Rotation draft not found");
  if (preview.status === "pending_director") {
    if (!preview.directorViewedAt) {
      throw new Error("View the schedule before rejecting");
    }
    return adminDecideRotation(id, {
      by: "System",
      remark,
      outcome: "rejected",
    });
  }
  if (!preview.managerViewedAt) {
    // allow legacy one-click reject only after view — mark view if missing for seed stubs?
    throw new Error("View the schedule before rejecting");
  }
  return managerDecideRotation(id, {
    by: "System",
    remark,
    outcome: "rejected",
  });
}

/** First/last calendar day of YYYY-MM */
export function monthBounds(monthKey: string): { fromDate: string; toDate: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const fromDate = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const toDate = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { fromDate, toDate };
}

function patternSequence(patternId: RotationPatternId): ShiftCode[] {
  const pattern =
    rotationPatterns.find((p) => p.id === patternId) ?? rotationPatterns[0];
  return pattern.sequence.filter((c): c is Exclude<ShiftCode, "OFF"> => c !== "OFF");
}

function getPattern(patternId: RotationPatternId): RotationPattern {
  return rotationPatterns.find((p) => p.id === patternId) ?? rotationPatterns[0]!;
}

/** Index of the employee's starting code inside the pattern sequence. */
function sequenceStartIndex(currentCode: ShiftCode, patternId: RotationPatternId): number {
  const seq = patternSequence(patternId);
  if (!seq.length) return 0;
  const code = currentCode === "OFF" || currentCode === "G" ? seq[0]! : currentCode;
  const idx = seq.indexOf(code);
  return idx < 0 ? 0 : idx;
}

/**
 * Bucket index for pattern advancement.
 * weekly_abc (period 7): calendar weeks aligned to weeklyOffDay so Sunday OFF
 * sits between weeks and C→A does not land on consecutive work days.
 * paired_aabbcc: one sequence slot per calendar day (sequence already has AA BB CC).
 */
function patternBucketIndex(
  dateStr: string,
  monthFrom: string,
  patternId: RotationPatternId,
  weeklyOffDay: number,
): number {
  const pattern = getPattern(patternId);
  const dayOffset = Math.round(
    (new Date(dateStr + "T00:00:00Z").getTime() -
      new Date(monthFrom + "T00:00:00Z").getTime()) /
      86400000,
  );
  if (pattern.periodDays >= 7) {
    const startDow = new Date(monthFrom + "T00:00:00Z").getUTCDay();
    const daysFromWeekStart = (startDow - weeklyOffDay + 7) % 7;
    return Math.floor((dayOffset + daysFromWeekStart) / 7);
  }
  // Paired / short periods: walk the expanded sequence day-by-day
  return dayOffset;
}

function codeForBucket(
  currentCode: ShiftCode,
  bucket: number,
  patternId: RotationPatternId,
): ShiftCode {
  const seq = patternSequence(patternId);
  if (!seq.length) return currentCode === "OFF" ? "A" : currentCode;
  const start = sequenceStartIndex(currentCode, patternId);
  return seq[(start + bucket) % seq.length]!;
}

/** Force OFF on the later day when consecutive work codes break minimum rest (e.g. C→A). */
function applyRestSafeOffs(
  assignments: RotationAssignmentCell[],
): RotationAssignmentCell[] {
  const byEmp = new Map<string, RotationAssignmentCell[]>();
  for (const a of assignments) {
    const list = byEmp.get(a.employeeId) ?? [];
    list.push({ ...a });
    byEmp.set(a.employeeId, list);
  }
  const out: RotationAssignmentCell[] = [];
  for (const list of byEmp.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const cur = list[i]!;
      if (prev.code === "OFF" || cur.code === "OFF") continue;
      if (addDays(prev.date, 1) !== cur.date) continue;
      if (consecutiveDayRestHours(prev.code, cur.code) < restRules.minimumRestHours) {
        cur.code = "OFF";
      }
    }
    out.push(...list);
  }
  return out;
}

/** Mark leave-covered work days as OFF so auto-fill is submit-ready. */
function applyLeaveSafeOffs(
  assignments: RotationAssignmentCell[],
): RotationAssignmentCell[] {
  return assignments.map((a) => {
    if (a.code === "OFF") return a;
    if (employeeHasCoveringLeave(a.employeeId, a.date)) {
      return { ...a, code: "OFF" as ShiftCode };
    }
    return a;
  });
}

export function buildMonthScheduleAssignments(input: {
  siteId: string;
  monthKey: string;
  patternId: RotationPatternId;
  groupIds?: string[];
}): RotationAssignmentCell[] {
  ensureShiftHydrated();
  const { fromDate, toDate } = monthBounds(input.monthKey);
  const groups = input.groupIds?.length ? new Set(input.groupIds) : null;
  const rows = rotationRows.filter(
    (r) =>
      r.siteId === input.siteId &&
      (!groups || groups.has(r.groupId)),
  );

  const assignments: RotationAssignmentCell[] = [];
  const start = new Date(fromDate + "T00:00:00Z");
  const end = new Date(toDate + "T00:00:00Z");

  for (const row of rows) {
    const cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = formatDate(cursor);
      const dow = cursor.getUTCDay();
      const isOff = dow === row.weeklyOffDay;
      const bucket = patternBucketIndex(
        dateStr,
        fromDate,
        input.patternId,
        row.weeklyOffDay,
      );
      const weekCode = codeForBucket(row.currentCode, bucket, input.patternId);
      assignments.push({
        employeeId: row.employeeId,
        date: dateStr,
        code: isOff ? "OFF" : weekCode,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return applyRestSafeOffs(applyLeaveSafeOffs(assignments));
}

export function validateScheduleAssignments(
  siteId: string,
  assignments: RotationAssignmentCell[],
): ShiftConflict[] {
  ensureShiftHydrated();
  const conflicts: ShiftConflict[] = [];
  const byEmp = new Map<string, RotationAssignmentCell[]>();
  for (const a of assignments) {
    const list = byEmp.get(a.employeeId) ?? [];
    list.push(a);
    byEmp.set(a.employeeId, list);
  }

  for (const [employeeId, list] of byEmp) {
    const emp = getEmployeeById(employeeId);
    const name = emp?.name ?? employeeId;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i]!;
      const nxt = sorted[i + 1]!;
      if (cur.code === "OFF" || nxt.code === "OFF") continue;
      if (addDays(cur.date, 1) !== nxt.date) continue;
      const rest = consecutiveDayRestHours(cur.code, nxt.code);
      if (rest < restRules.minimumRestHours) {
        conflicts.push({
          id: `cf-rest-${employeeId}-${nxt.date}`,
          type: "rest",
          employeeId,
          employeeName: name,
          siteId,
          date: nxt.date,
          severity: "attention",
          message: `Insufficient rest (${rest.toFixed(1)}h < ${restRules.minimumRestHours}h) between ${cur.code} and ${nxt.code}.`,
        });
      }
    }
    for (const d of sorted) {
      const row = rotationRows.find((r) => r.employeeId === employeeId);
      if (!row) continue;
      const dow = new Date(d.date + "T00:00:00Z").getUTCDay();
      if (dow === row.weeklyOffDay && d.code !== "OFF") {
        conflicts.push({
          id: `cf-off-${employeeId}-${d.date}`,
          type: "weekly_off",
          employeeId,
          employeeName: name,
          siteId,
          date: d.date,
          severity: "watch",
          message: `Work (${d.code}) scheduled on weekly off.`,
        });
      }
      if (d.code !== "OFF" && employeeHasCoveringLeave(employeeId, d.date)) {
        conflicts.push({
          id: `cf-leave-${employeeId}-${d.date}`,
          type: "leave",
          employeeId,
          employeeName: name,
          siteId,
          date: d.date,
          severity: "attention",
          message: `Employee has leave covering ${d.date}.`,
        });
      }
    }
  }
  return conflicts;
}

export function submitMonthlyScheduleDraft(input: {
  siteId: string;
  monthKey: string;
  patternId: RotationPatternId;
  groupIds?: string[];
  assignments: RotationAssignmentCell[];
}): RotationPreview {
  ensureShiftHydrated();
  if (hasPublishedMonth(input.siteId, input.monthKey)) {
    throw new Error(
      `A schedule for ${input.monthKey} is already published. Shift In-Charge cannot submit another draft for this month.`,
    );
  }
  const attention = validateScheduleAssignments(input.siteId, input.assignments).filter(
    (c) => c.severity === "attention",
  );
  if (attention.length) {
    throw new Error(
      `Cannot submit: ${attention.length} conflict(s) need fixing (rest or leave).`,
    );
  }
  const { fromDate, toDate } = monthBounds(input.monthKey);
  const employeeIds = new Set(input.assignments.map((a) => a.employeeId));
  const workCodes = input.assignments
    .filter((a) => a.code !== "OFF")
    .map((a) => a.code);
  const preview: RotationPreview = {
    id: `rp-${Date.now().toString(36)}`,
    siteId: input.siteId,
    fromDate,
    toDate,
    employeesAffected: employeeIds.size,
    fromCode: workCodes[0] ?? "A",
    toCode: workCodes[workCodes.length - 1] ?? "B",
    status: "pending_manager",
    patternId: input.patternId,
    groupIds: input.groupIds,
    assignments: input.assignments.map((a) => ({ ...a })),
    label: `Monthly · ${input.monthKey}`,
  };
  rotationPreviews = [preview, ...rotationPreviews];
  persistShiftStore();
  return preview;
}

export function generateNextRotation(siteId: string): RotationPreview {
  ensureShiftHydrated();
  const monthKey = EFFECTIVE.slice(0, 7);
  const assignments = buildMonthScheduleAssignments({
    siteId,
    monthKey,
    patternId: ACTIVE_PATTERN.id,
  });
  return submitMonthlyScheduleDraft({
    siteId,
    monthKey,
    patternId: ACTIVE_PATTERN.id,
    assignments,
  });
}

export function getChangeRequests(siteId?: string) {
  ensureShiftHydrated();
  return changeRequests.filter((c) => (siteId ? c.siteId === siteId : true));
}

export function decideChangeRequest(
  id: string,
  status: "APPROVED" | "REJECTED",
) {
  ensureShiftHydrated();
  const current = changeRequests.find((c) => c.id === id);
  if (!current) throw new Error("Shift change request not found");
  if (current.status !== "PENDING") {
    throw new Error("Shift change is no longer pending");
  }
  if (status === "APPROVED") {
    assertShiftChangeApprovable(current);
  }
  changeRequests = changeRequests.map((c) =>
    c.id === id ? { ...c, status } : c,
  );
  const req = changeRequests.find((c) => c.id === id);
  if (req && status === "APPROVED") {
    plannedDays = plannedDays.map((d) =>
      d.employeeId === req.employeeId && d.date === req.date
        ? {
            ...d,
            plannedShiftId: req.toShiftId,
            plannedCode:
              getShiftMasterById(req.toShiftId)?.code ?? d.plannedCode,
          }
        : d,
    );
  }
  persistShiftStore();
  return req;
}

export function resetShiftStore() {
  changeRequests = shiftSeed.changeRequests.map((c) => ({ ...c }));
  rotationPreviews = shiftSeed.rotationPreviews.map((p) => ({ ...p }));
  rotationRows = shiftSeed.rotationRows.map((r) => ({ ...r }));
  plannedDays = shiftSeed.plannedDays.map((d) => ({ ...d }));
  restRules = { ...shiftSeed.restRules };
  shiftHydrated = true;
  persistShiftStore();
}

export function createChangeRequest(
  input: Omit<ShiftChangeRequest, "id" | "status" | "createdAt">,
) {
  ensureShiftHydrated();
  const row: ShiftChangeRequest = {
    ...input,
    id: `scr-${Date.now().toString(36)}`,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  changeRequests = [row, ...changeRequests];
  persistShiftStore();
  return row;
}

export function getRelieverSuggestions(siteId?: string): RelieverSuggestion[] {
  ensureShiftHydrated();
  const targetSites = siteId ? sites.filter((s) => s.id === siteId) : sites;
  const suggestions: RelieverSuggestion[] = [];

  for (const site of targetSites) {
    for (const shift of shiftMaster.filter((s) => s.code !== "G")) {
      const todayPlanned = getPlannedDays({
        siteId: site.id,
        from: TODAY,
        to: TODAY,
      }).filter((d) => d.plannedShiftId === shift.id);
      const required = Math.max(2, Math.ceil(site.headcount / 3));
      const available = todayPlanned.length;
      const absent = Math.max(0, required - available);
      if (absent <= 0) continue;

      const cluster = getClusterForSite(site.id);
      const pool = getRelievers(cluster?.id)
        .filter((r) => r.availability === "available")
        .slice(0, 3);

      suggestions.push({
        shiftId: shift.id,
        shiftCode: shift.code,
        siteId: site.id,
        required,
        available,
        absent,
        suggestedRelieverIds: pool.map((r) => r.id),
      });
    }
  }
  return suggestions;
}

export function getShiftDashboardKpis(siteId?: string) {
  ensureShiftHydrated();
  const today = getPlannedDays({ siteId, from: TODAY, to: TODAY }).filter(
    (d) => d.plannedCode !== "OFF",
  );
  const count = (code: ShiftCode) =>
    today.filter((d) => d.plannedCode === code).length;

  const conflicts = detectConflicts(siteId);
  const pendingChanges = getChangeRequests(siteId).filter(
    (c) => c.status === "PENDING",
  ).length;
  const uncovered = getRelieverSuggestions(siteId).reduce(
    (s, r) => s + r.absent,
    0,
  );
  const rotationChangesToday = getRotationPreviews().filter(
    (p) => p.fromDate === TODAY || p.fromDate === addDays(TODAY, 2),
  ).length;

  return {
    employeesToday: today.length,
    aShift: count("A"),
    bShift: count("B"),
    cShift: count("C"),
    general: count("G"),
    rotationChangesToday,
    pendingChanges,
    shiftConflicts: conflicts.length,
    uncoveredPositions: uncovered,
  };
}

export function getShiftInsights(siteId?: string) {
  const devs = getDeviations(siteId);
  const byEmp = new Map<string, number>();
  for (const d of devs) {
    byEmp.set(d.employeeId, (byEmp.get(d.employeeId) ?? 0) + 1);
  }
  const frequent = [...byEmp.entries()]
    .filter(([, n]) => n >= 2)
    .map(([employeeId, count]) => ({
      employeeId,
      employeeName: getEmployeeById(employeeId)?.name ?? employeeId,
      changes: count,
    }))
    .sort((a, b) => b.changes - a.changes);

  const siteIssues = getDeviationAggregates()
    .filter((s) => (siteId ? s.siteId === siteId : true))
    .filter((s) => s.deviations > 0)
    .sort((a, b) => b.deviations - a.deviations);

  const otAfterChanges = Math.round(
    devs.length * 1.7 * 10,
  ) / 10;

  const otByShift = shiftMaster
    .filter((s) => s.code !== "OFF" as ShiftCode)
    .map((s) => ({
      shift: s.name,
      code: s.code,
      otHours:
        s.code === "C"
          ? 264
          : s.code === "B"
            ? 182
            : s.code === "A"
              ? 120
              : 54,
    }));

  return { frequent, siteIssues, otAfterChanges, otByShift };
}

export function getOtByShiftCause() {
  return {
    totalOt: 1284,
    byCause: [
      { cause: "Absence", hours: 320 },
      { cause: "Shift Gap", hours: 280 },
      { cause: "Shift Deviation", hours: 184 },
      { cause: "Weekly-Off Coverage", hours: 160 },
      { cause: "Emergency", hours: 110 },
      { cause: "Other", hours: 230 },
    ],
    byShift: getShiftInsights().otByShift,
  };
}

// ----------------------------------------------------
// Live NestJS Backend Synchronization
// ----------------------------------------------------
export async function syncShiftsWithApi(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { getRosters, getChangeRequests } = await import('../api/shifts');
    const [rosters, requests] = await Promise.all([
      getRosters().catch(() => []),
      getChangeRequests().catch(() => []),
    ]);

    if (rosters && rosters.length) {
      rotationPreviews = rosters.map(normalizePreviewStatus);
    }
    if (requests && requests.length) {
      changeRequests = requests;
    }
    persistShiftStore();
  } catch {
    // Graceful offline fallback
  }
}

export { ACTIVE_PATTERN, TODAY, EFFECTIVE, addDays };
