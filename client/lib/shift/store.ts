import { employees, getEmployeeById, sites } from "@/lib/mock-data";
import { getRelievers, getClusterForSite } from "@/lib/reliever/pool";
import { nectarColors } from "@/lib/theme";
import type {
  EmployeeRotationRow,
  PlannedShiftDay,
  RelieverSuggestion,
  RestRuleConfig,
  RotationPattern,
  RotationPreview,
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

function buildRotationRows(): EmployeeRotationRow[] {
  return employees
    .filter((e) => e.employmentStatus === "active")
    .map((e, i) => {
      const currentCode = CODE_FROM_EMP_SHIFT[e.shiftId] ?? "A";
      const nxt = nextCode(currentCode, ACTIVE_PATTERN);
      const groupId = `G${(i % 3) + 1}`;
      return {
        employeeId: e.id,
        employeeName: e.name,
        siteId: e.siteId,
        groupId,
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
    status: "pending_review",
  },
  {
    id: "rp2",
    siteId: "s-ro",
    fromDate: "2026-09-25",
    toDate: "2026-10-01",
    employeesAffected: 2,
    fromCode: "B",
    toCode: "C",
    status: "pending_review",
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
    employeeId: "e-etp-s2",
    employeeName: "Rohan Deshmukh",
    siteId: "s-etp",
    date: "2026-09-28",
    fromShiftId: "sh-afternoon",
    toShiftId: "sh-night",
    reason: "Replacement required due to absence",
    requestedBy: "Amit Supervisor",
    status: "PENDING",
    potentialOtHours: 0,
    manpowerOk: true,
    createdAt: "2026-09-22T10:00:00Z",
  },
  {
    id: "scr2",
    employeeId: "e-ro-s1",
    employeeName: "Imran Shaikh",
    siteId: "s-ro",
    date: "2026-09-24",
    fromShiftId: "sh-night",
    toShiftId: "sh-morning",
    reason: "Personal constraint",
    requestedBy: "Neha Kamat",
    status: "PENDING",
    potentialOtHours: 8,
    manpowerOk: false,
    createdAt: "2026-09-21T14:00:00Z",
  },
];

const SHIFT_STORAGE_KEY = "nectar-enviro-shift-store-v1";
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
      rotationPreviews = parsed.rotationPreviews;
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
  return [...rotationPreviews];
}

export function activateRotationPreview(id: string) {
  ensureShiftHydrated();
  rotationPreviews = rotationPreviews.map((p) =>
    p.id === id ? { ...p, status: "active" } : p,
  );
  const preview = rotationPreviews.find((p) => p.id === id);
  if (preview) {
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
  persistShiftStore();
  return rotationPreviews.find((p) => p.id === id);
}

export function rejectRotationPreview(id: string) {
  ensureShiftHydrated();
  rotationPreviews = rotationPreviews.map((p) =>
    p.id === id ? { ...p, status: "rejected" } : p,
  );
  persistShiftStore();
  return rotationPreviews.find((p) => p.id === id);
}

export function generateNextRotation(siteId: string): RotationPreview {
  ensureShiftHydrated();
  const preview: RotationPreview = {
    id: `rp-${Date.now().toString(36)}`,
    siteId,
    fromDate: EFFECTIVE,
    toDate: addDays(EFFECTIVE, 6),
    employeesAffected: rotationRows.filter((r) => r.siteId === siteId).length,
    fromCode: "A",
    toCode: "B",
    status: "pending_review",
  };
  rotationPreviews = [preview, ...rotationPreviews];
  persistShiftStore();
  return preview;
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

export { ACTIVE_PATTERN, TODAY, EFFECTIVE, addDays };
