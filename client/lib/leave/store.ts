import { employees, getEmployeeById, getSiteById } from "@/lib/mock-data";
import { getShiftById } from "@/lib/overtime/data";
import {
  assignChosenRelieverForLeave,
  assignRelieverForLeave,
  getClusterForSite,
  getRelievers,
  releaseRelieverForLeave,
} from "@/lib/reliever/pool";
import { getPlannedShiftForLeave } from "@/lib/shift/store";
import { registerCoveringLeaveCheck } from "./coverage";
import type {
  LeaveImpact,
  LeaveMode,
  LeaveRequest,
  LeaveStatus,
  LeaveTimelineEvent,
  LeaveType,
} from "./types";

const OT_HOURLY_COST = 270;
const LEAVE_STORAGE_KEY = "nectar-enviro-leave-store-v2";

let leaveStore: LeaveRequest[] = [];
let leaveHydrated = false;

function dayCount(start: string, end: string) {
  const a = new Date(start + "T00:00:00Z").getTime();
  const b = new Date(end + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export type LeaveShiftImpactDay = {
  date: string;
  shiftCode: string;
  shiftName: string;
  replacementRequired: boolean;
};

export function computeLeaveImpact(
  employeeId: string,
  date: string,
  endDate?: string,
): LeaveImpact & { affectedShiftDays: LeaveShiftImpactDay[] } {
  const emp = getEmployeeById(employeeId);
  const siteId = emp?.siteId ?? "s-etp";
  const site = getSiteById(siteId);
  const shift = getShiftById(emp?.shiftId ?? "sh-morning");
  const siteStaff = employees.filter(
    (e) => e.siteId === siteId && e.employmentStatus === "active",
  ).length;
  const onLeaveSameDay = leaveStore.filter(
    (l) =>
      l.siteId === siteId &&
      l.startDate <= date &&
      l.endDate >= date &&
      !["REJECTED", "CANCELLED", "CLOSED"].includes(l.status) &&
      l.employeeId !== employeeId,
  ).length;

  const currentManpower = Math.max(0, siteStaff - onLeaveSameDay - 1);
  const requiredManpower = site?.headcount
    ? Math.max(8, Math.round(site.headcount * 0.85))
    : 10;

  const cluster = getClusterForSite(siteId);
  const availableRelievers = getRelievers(cluster?.id).filter(
    (r) => r.availability === "available",
  ).length;

  const nearbyAvailableWorkers = getRelievers(cluster?.id).filter(
    (r) =>
      r.availability === "available" &&
      r.homeSiteId &&
      r.homeSiteId !== siteId,
  ).length;

  const planned = getPlannedShiftForLeave(
    employeeId,
    date,
    endDate ?? date,
  );
  const affectedShiftDays: LeaveShiftImpactDay[] = planned.map((p) => ({
    date: p.date,
    shiftCode: p.plannedCode,
    shiftName:
      p.plannedCode === "OFF"
        ? "Weekly Off"
        : `${p.plannedCode} Shift`,
    replacementRequired: p.plannedCode !== "OFF",
  }));

  const affectedWorkingDays =
    affectedShiftDays.filter((d) => d.replacementRequired).length || 1;

  const shortfall = Math.max(0, requiredManpower - currentManpower);
  const coveredByPool = Math.min(shortfall, availableRelievers);
  const uncovered = shortfall - coveredByPool;
  const potentialOtHours =
    uncovered > 0 ? uncovered * 8 : Math.max(0, affectedWorkingDays - availableRelievers) * 8;
  const potentialOtCost = potentialOtHours * OT_HOURLY_COST;

  let risk: LeaveImpact["risk"] = "none";
  if (potentialOtHours >= 8) risk = "high";
  else if (potentialOtHours > 0 || availableRelievers === 0) risk = "low";

  return {
    employeeId,
    employeeName: emp?.name ?? employeeId,
    siteId,
    siteName: site?.name ?? siteId,
    shiftId: emp?.shiftId ?? "sh-morning",
    shiftName: shift?.name ?? "Shift",
    date,
    currentManpower,
    requiredManpower,
    availableRelievers,
    nearbyAvailableWorkers,
    potentialOtHours,
    potentialOtCost,
    risk,
    affectedShiftDays,
  };
}

function event(
  actor: string,
  role: LeaveTimelineEvent["role"],
  action: string,
  note?: string,
  at?: string,
): LeaveTimelineEvent {
  return {
    at: at ?? new Date().toISOString(),
    actor,
    role,
    action,
    note,
  };
}

const seed: LeaveRequest[] = [
  {
    id: "lv1",
    employeeId: "emp0126",
    employeeName: "Shilpa Hotkar",
    siteId: "s-etp",
    department: "Operations",
    shiftId: "sh-morning",
    mode: "planned",
    leaveType: "casual",
    status: "REQUESTED",
    entrySource: "employee",
    startDate: "2026-09-25",
    endDate: "2026-09-26",
    expectedReturnDate: "2026-09-27",
    reason: "Family function",
    requestedByName: "Shilpa Hotkar",
    enteredByName: "Shilpa Hotkar",
    enteredByRole: "employee",
    supervisorName: "Neetesh Diwathe",
    siteInChargeName: "Bidhichand Rajbhar",
    managerName: "Anand Dakave",
    replacementRequired: true,
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 8,
    daysRequested: 2,
    createdAt: "2026-09-20T10:00:00Z",
    updatedAt: "2026-09-20T10:00:00Z",
    timeline: [
      event("Shilpa Hotkar", "employee", "Leave requested", "Planned leave submitted", "2026-09-20T10:00:00Z"),
    ],
  },
  {
    id: "lv2",
    employeeId: "emp0127",
    employeeName: "Rohit Kumar Singh",
    siteId: "s-etp",
    department: "Operations",
    shiftId: "sh-afternoon",
    mode: "planned",
    leaveType: "sick",
    status: "PENDING_EMPLOYEE_CONSENT",
    entrySource: "supervisor_on_behalf",
    startDate: "2026-09-28",
    endDate: "2026-09-29",
    expectedReturnDate: "2026-09-30",
    reason: "Medical appointment — employee asked supervisor to file",
    requestedByName: "Neetesh Diwathe",
    enteredByName: "Neetesh Diwathe",
    enteredByRole: "supervisor",
    submittedByEmployeeId: "emp0125",
    supervisorName: "Neetesh Diwathe",
    siteInChargeName: "Bidhichand Rajbhar",
    managerName: "Anand Dakave",
    replacementRequired: true,
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 6,
    daysRequested: 2,
    createdAt: "2026-09-22T09:00:00Z",
    updatedAt: "2026-09-22T09:00:00Z",
    timeline: [
      event(
        "Neetesh Diwathe",
        "supervisor",
        "Leave submitted on behalf of employee",
        "Awaiting employee consent",
        "2026-09-22T09:00:00Z",
      ),
    ],
  },
  {
    id: "lv3",
    employeeId: "emp0134",
    employeeName: "Rafik Shaikh",
    siteId: "s-ro",
    department: "Operations",
    shiftId: "sh-morning",
    mode: "planned",
    leaveType: "casual",
    status: "REQUESTED",
    entrySource: "supervisor_on_behalf",
    startDate: "2026-10-01",
    endDate: "2026-10-02",
    expectedReturnDate: "2026-10-03",
    reason: "Personal work",
    requestedByName: "Vikas Dabade",
    enteredByName: "Vikas Dabade",
    enteredByRole: "supervisor",
    submittedByEmployeeId: "emp0133",
    employeeConsent: "approved",
    employeeConsentAt: "2026-09-21T11:00:00Z",
    supervisorName: "Vikas Dabade",
    siteInChargeName: "Pawan Jagdhane",
    managerName: "Uday Patil",
    replacementRequired: true,
    assignedRelieverId: "rv2",
    replacementPlan: "Cluster reliever Lata More assigned",
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 5,
    daysRequested: 2,
    createdAt: "2026-09-20T09:00:00Z",
    updatedAt: "2026-09-21T11:00:00Z",
    timeline: [
      event("Vikas Dabade", "supervisor", "Leave submitted on behalf", undefined, "2026-09-20T09:00:00Z"),
      event("Rafik Shaikh", "employee", "Employee consented", "Approved to proceed to manager", "2026-09-21T11:00:00Z"),
    ],
  },
  {
    id: "lv4",
    employeeId: "emp0142",
    employeeName: "Abhinandan Sanjay Pawane",
    siteId: "s-mee",
    department: "Operations",
    shiftId: "sh-morning",
    mode: "emergency",
    leaveType: "family_emergency",
    status: "SUPERVISOR_RECORDED",
    entrySource: "supervisor_on_behalf",
    startDate: "2026-09-23",
    endDate: "2026-09-24",
    expectedReturnDate: "2026-09-25",
    reason: "Family emergency — informed verbally",
    lastCommunication: "Called supervisor at 07:10 — will return by 25 Sep",
    enteredByName: "Rushikesh Pawar",
    enteredByRole: "supervisor",
    submittedByEmployeeId: "emp0141",
    employeeConsent: "approved",
    employeeConsentAt: "2026-09-23T07:15:00Z",
    supervisorName: "Rushikesh Pawar",
    siteInChargeName: "Gaurav Khandagale",
    managerName: "Sanjay Waghaskar",
    replacementRequired: true,
    potentialOtHours: 8,
    potentialOtCost: 2160,
    leaveBalanceDays: 2,
    daysRequested: 2,
    createdAt: "2026-09-23T07:20:00Z",
    updatedAt: "2026-09-23T07:20:00Z",
    timeline: [
      event("Rushikesh Pawar", "supervisor", "Absence detected", "Employee did not report", "2026-09-23T06:50:00Z"),
      event("Abhinandan Sanjay Pawane", "employee", "Employee consented", "Permission to file emergency leave", "2026-09-23T07:15:00Z"),
      event("Rushikesh Pawar", "supervisor", "Emergency absence recorded", "Entered on behalf of employee", "2026-09-23T07:20:00Z"),
    ],
  },
  {
    id: "lv5",
    employeeId: "emp0130",
    employeeName: "Sandip Ohol",
    siteId: "s-etp",
    department: "Operations",
    shiftId: "sh-general",
    mode: "planned",
    leaveType: "casual",
    status: "APPROVED",
    entrySource: "employee",
    startDate: "2026-09-15",
    endDate: "2026-09-16",
    expectedReturnDate: "2026-09-17",
    actualReturnDate: "2026-09-17",
    reason: "Personal work",
    requestedByName: "Sandip Ohol",
    enteredByName: "Sandip Ohol",
    enteredByRole: "employee",
    supervisorName: "Neetesh Diwathe",
    siteInChargeName: "Bidhichand Rajbhar",
    managerName: "Anand Dakave",
    managerDecision: "approved",
    managerDecisionAt: "2026-09-11T10:00:00Z",
    replacementRequired: false,
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 10,
    daysRequested: 2,
    createdAt: "2026-09-10T12:00:00Z",
    updatedAt: "2026-09-17T08:30:00Z",
    timeline: [
      event("Sandip Ohol", "employee", "Leave requested", undefined, "2026-09-10T12:00:00Z"),
      event("Anand Dakave", "management", "Manager approved", "Manpower OK", "2026-09-11T10:00:00Z"),
      event("Neetesh Diwathe", "supervisor", "Return confirmed", "Duty resumed", "2026-09-17T08:30:00Z"),
    ],
  },
  {
    id: "lv6",
    employeeId: "emp0135",
    employeeName: "Siddhant Marale",
    siteId: "s-ro",
    department: "Operations",
    shiftId: "sh-afternoon",
    mode: "planned",
    leaveType: "sick",
    status: "REJECTED",
    entrySource: "employee",
    startDate: "2026-09-20",
    endDate: "2026-09-22",
    expectedReturnDate: "2026-09-23",
    reason: "Fever",
    requestedByName: "Siddhant Marale",
    enteredByName: "Siddhant Marale",
    enteredByRole: "employee",
    supervisorName: "Vikas Dabade",
    siteInChargeName: "Pawan Jagdhane",
    managerName: "Uday Patil",
    managerDecision: "rejected",
    managerDecisionAt: "2026-09-19T15:00:00Z",
    rejectionReason: "Critical RO maintenance window — reschedule after 25 Sep",
    replacementRequired: true,
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 3,
    daysRequested: 3,
    createdAt: "2026-09-19T11:00:00Z",
    updatedAt: "2026-09-19T15:00:00Z",
    timeline: [
      event("Siddhant Marale", "employee", "Leave requested", undefined, "2026-09-19T11:00:00Z"),
      event(
        "Uday Patil",
        "management",
        "Manager rejected",
        "Critical RO maintenance window — reschedule after 25 Sep",
        "2026-09-19T15:00:00Z",
      ),
    ],
  },
  {
    id: "lv7",
    employeeId: "emp0143",
    employeeName: "Bhairavi Kadu",
    siteId: "s-mee",
    department: "Operations",
    shiftId: "sh-afternoon",
    mode: "planned",
    leaveType: "casual",
    status: "REJECTED",
    entrySource: "supervisor_on_behalf",
    startDate: "2026-09-26",
    endDate: "2026-09-26",
    expectedReturnDate: "2026-09-27",
    reason: "Personal errand",
    requestedByName: "Rushikesh Pawar",
    enteredByName: "Rushikesh Pawar",
    enteredByRole: "supervisor",
    submittedByEmployeeId: "emp0141",
    employeeConsent: "rejected",
    employeeConsentAt: "2026-09-22T14:00:00Z",
    employeeConsentNote: "I did not ask for leave — please cancel",
    rejectionReason: "Employee rejected consent",
    supervisorName: "Rushikesh Pawar",
    siteInChargeName: "Gaurav Khandagale",
    managerName: "Sanjay Waghaskar",
    replacementRequired: false,
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 7,
    daysRequested: 1,
    createdAt: "2026-09-22T10:00:00Z",
    updatedAt: "2026-09-22T14:00:00Z",
    timeline: [
      event("Rushikesh Pawar", "supervisor", "Leave submitted on behalf", undefined, "2026-09-22T10:00:00Z"),
      event(
        "Bhairavi Kadu",
        "employee",
        "Employee rejected consent",
        "I did not ask for leave — please cancel",
        "2026-09-22T14:00:00Z",
      ),
    ],
  },
];

leaveStore = seed.map((l) => {
  const impact = computeLeaveImpact(l.employeeId, l.startDate);
  return {
    ...l,
    potentialOtHours: l.potentialOtHours || impact.potentialOtHours,
    potentialOtCost: l.potentialOtCost || impact.potentialOtCost,
    daysRequested: dayCount(l.startDate, l.endDate),
  };
});

const seedSnapshot = leaveStore.map((l) => ({ ...l, timeline: [...l.timeline] }));

function persistLeaveStore() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(leaveStore));
  } catch {
    // ignore quota / private mode
  }
}

/** Fire-and-forget create on Nest — keeps UI snappy offline. */
function pushLeaveCreate(leave: LeaveRequest) {
  if (typeof window === "undefined") return;
  void import("../api/leaves")
    .then(async ({ createLeave }) => {
      const remote = await createLeave(leave);
      leaveStore = leaveStore.map((l) =>
        l.id === leave.id || l.id === remote.id ? { ...l, ...remote } : l,
      );
      persistLeaveStore();
    })
    .catch(() => {});
}

/** Fire-and-forget status/meta sync on Nest. */
function pushLeaveUpdate(leave: LeaveRequest) {
  if (typeof window === "undefined") return;
  const { id, status, ...meta } = leave;
  void import("../api/leaves")
    .then(({ updateLeaveStatus }) => updateLeaveStatus(id, status, meta))
    .catch(() => {});
}

function ensureLeaveHydrated() {
  if (leaveHydrated || typeof window === "undefined") return;
  leaveHydrated = true;
  try {
    const raw = localStorage.getItem(LEAVE_STORAGE_KEY);
    if (!raw) {
      persistLeaveStore();
      return;
    }
    const parsed = JSON.parse(raw) as LeaveRequest[];
    if (Array.isArray(parsed) && parsed.length) {
      leaveStore = parsed;
    }
  } catch {
    leaveStore = seedSnapshot.map((l) => ({
      ...l,
      timeline: [...l.timeline],
    }));
  }
}

/** Reset leave demo data to seed (optional helper) */
export function resetLeaveStore() {
  leaveStore = seedSnapshot.map((l) => ({
    ...l,
    timeline: [...l.timeline],
  }));
  leaveHydrated = true;
  persistLeaveStore();
}

export function getLeaveRequests(siteId?: string, employeeId?: string) {
  ensureLeaveHydrated();
  return [...leaveStore]
    .filter((l) => (siteId ? l.siteId === siteId : true))
    .filter((l) => (employeeId ? l.employeeId === employeeId : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLeaveById(id: string) {
  ensureLeaveHydrated();
  return leaveStore.find((l) => l.id === id);
}

export function getLeaveKpis(siteId?: string, employeeId?: string) {
  ensureLeaveHydrated();
  const rows = getLeaveRequests(siteId, employeeId);
  const today = "2026-09-23";
  const pending = rows.filter((l) =>
    [
      "REQUESTED",
      "PENDING_EMPLOYEE_CONSENT",
      "SUPERVISOR_VERIFIED",
      "SUPERVISOR_RECORDED",
      "SITE_APPROVED",
      "SITE_VERIFIED",
      "MANAGER_APPROVED",
      "HR_VALIDATED",
      "PENDING_INFORMATION",
    ].includes(l.status),
  ).length;
  const unverified = rows.filter((l) =>
    ["ABSENT", "PENDING_INFORMATION", "UNEXPLAINED_ABSENCE"].includes(l.status),
  ).length;
  const onLeave = rows.filter(
    (l) =>
      [
        "APPROVED",
        "MANAGER_APPROVED",
        "SITE_APPROVED",
        "HR_VALIDATED",
        "SUPERVISOR_RECORDED",
        "SITE_VERIFIED",
      ].includes(l.status) &&
      l.startDate <= today &&
      l.endDate >= today,
  ).length;
  const withoutInfo = rows.filter((l) =>
    ["UNEXPLAINED_ABSENCE", "PENDING_INFORMATION"].includes(l.status),
  ).length;
  const overdueClosure = rows.filter((l) =>
    ["EXTENSION_REQUIRED", "PENDING_INFORMATION"].includes(l.status),
  ).length;
  const otRisk = rows.filter(
    (l) =>
      l.potentialOtHours > 0 &&
      !["REJECTED", "CANCELLED", "CLOSED"].includes(l.status),
  ).length;
  const criticalShortages = new Set(
    rows
      .filter((l) => l.potentialOtHours >= 8 && l.status !== "CLOSED")
      .map((l) => l.siteId),
  ).size;
  const longLeave = rows.filter((l) => l.daysRequested >= 3 && l.status !== "CLOSED")
    .length;

  return {
    totalEmployees: employeeId
      ? 1
      : employees.filter(
          (e) =>
            e.employmentStatus === "active" &&
            (siteId ? e.siteId === siteId : true),
        ).length,
    pendingRequests: pending,
    unverifiedAbsences: unverified,
    currentlyOnLeave: onLeave,
    leaveWithoutInformation: withoutInfo,
    overdueLeaveClosure: overdueClosure,
    leaveOtRisk: otRisk,
    criticalSiteShortages: criticalShortages,
    longLeaveCases: longLeave,
    totalRequests: rows.length,
    approvedCount: rows.filter((l) => l.status === "APPROVED" || l.status === "CLOSED").length,
    rejectedCount: rows.filter((l) => l.status === "REJECTED").length,
  };
}

export function getPendingJustifications() {
  ensureLeaveHydrated();
  return getLeaveRequests().filter((l) =>
    ["PENDING_INFORMATION", "UNEXPLAINED_ABSENCE", "EXTENSION_REQUIRED"].includes(
      l.status,
    ),
  );
}

export type CreateLeaveInput = {
  employeeId: string;
  mode: LeaveMode;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  expectedReturnDate: string;
  reason: string;
  entrySource: LeaveRequest["entrySource"];
  enteredByName: string;
  enteredByRole: LeaveRequest["enteredByRole"];
  supervisorName: string;
  siteInChargeName: string;
  managerName?: string;
  submittedByEmployeeId?: string;
  lastCommunication?: string;
  isHalfDay?: boolean;
  halfDaySlot?: "morning" | "afternoon";
};

export function createLeaveRequest(
  input: CreateLeaveInput,
  options?: { skipApiPush?: boolean },
): LeaveRequest {
  ensureLeaveHydrated();
  const emp = getEmployeeById(input.employeeId);
  if (!emp) throw new Error("Employee not found");
  const impact = computeLeaveImpact(input.employeeId, input.startDate);
  const id = `lv-${Date.now().toString(36)}`;
  const manager =
    input.managerName ??
    (emp.managerId ? getEmployeeById(emp.managerId)?.name : undefined) ??
    "Plant Manager";

  let status: LeaveStatus;
  if (input.entrySource === "supervisor_on_behalf" && input.mode === "planned") {
    status = "PENDING_EMPLOYEE_CONSENT";
  } else if (input.mode === "emergency") {
    status =
      input.entrySource === "supervisor_on_behalf"
        ? "SUPERVISOR_RECORDED"
        : "ABSENT";
  } else {
    status = "REQUESTED";
  }

  const daysRequested = input.isHalfDay
    ? 0.5
    : dayCount(input.startDate, input.endDate);

  const row: LeaveRequest = {
    id,
    employeeId: emp.id,
    employeeName: emp.name,
    siteId: emp.siteId,
    department: emp.department,
    shiftId: emp.shiftId,
    mode: input.mode,
    leaveType: input.leaveType,
    status,
    entrySource: input.entrySource,
    startDate: input.startDate,
    endDate: input.endDate,
    expectedReturnDate: input.expectedReturnDate,
    reason: input.reason,
    lastCommunication: input.lastCommunication,
    requestedByName:
      input.entrySource === "employee" ? emp.name : input.enteredByName,
    enteredByName: input.enteredByName,
    enteredByRole: input.enteredByRole,
    submittedByEmployeeId: input.submittedByEmployeeId,
    supervisorName: input.supervisorName,
    siteInChargeName: input.siteInChargeName,
    managerName: manager,
    replacementRequired: impact.potentialOtHours > 0 || impact.availableRelievers > 0,
    potentialOtHours: impact.potentialOtHours,
    potentialOtCost: impact.potentialOtCost,
    leaveBalanceDays: 6,
    daysRequested,
    isHalfDay: input.isHalfDay,
    halfDaySlot: input.halfDaySlot,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [
      event(
        input.enteredByName,
        input.enteredByRole,
        status === "PENDING_EMPLOYEE_CONSENT"
          ? "Leave submitted on behalf of employee"
          : input.mode === "emergency"
            ? "Emergency absence recorded"
            : "Leave requested",
        status === "PENDING_EMPLOYEE_CONSENT"
          ? "Awaiting employee consent"
          : input.entrySource === "supervisor_on_behalf"
            ? "Entered by supervisor on behalf of employee"
            : "Requested by employee",
      ),
    ],
  };

  leaveStore = [row, ...leaveStore];
  persistLeaveStore();
  if (!options?.skipApiPush) {
    pushLeaveCreate(row);
  }
  return row;
}

/**
 * Create with server policy gate first.
 * BLOCK → throws (nothing persisted). PASS/WARN → local row + Nest create.
 */
export async function createLeaveRequestViaApi(
  input: CreateLeaveInput,
): Promise<LeaveRequest> {
  ensureLeaveHydrated();
  const emp = getEmployeeById(input.employeeId);
  if (!emp) throw new Error("Employee not found");

  try {
    const { validateLeave, createLeave } = await import("../api/leaves");
    const validation = await validateLeave({
      employeeId: input.employeeId,
      mode: input.mode,
      leaveType: input.leaveType,
      startDate: input.startDate,
      endDate: input.endDate,
      expectedReturnDate: input.expectedReturnDate,
      entrySource: input.entrySource,
      isHalfDay: input.isHalfDay,
      halfDaySlot: input.halfDaySlot,
    });
    if (validation.verdict === "BLOCK") {
      const detail = validation.flags
        .filter((f) => f.severity === "block")
        .map((f) => f.message)
        .join("; ");
      throw new Error(detail || "Leave policy blocked this request");
    }

    const local = createLeaveRequest(input, { skipApiPush: true });
    const enriched: LeaveRequest = {
      ...local,
      daysRequested: validation.daysRequested || local.daysRequested,
      leaveBalanceDays:
        validation.balanceSnapshot?.available ?? local.leaveBalanceDays,
      policyVerdict: validation.verdict,
      policyFlags: validation.flags,
      policySuggestions: validation.suggestions,
    };
    leaveStore = leaveStore.map((l) => (l.id === local.id ? enriched : l));
    persistLeaveStore();

    try {
      const remote = await createLeave(enriched);
      leaveStore = leaveStore.map((l) =>
        l.id === enriched.id ? { ...enriched, ...remote } : l,
      );
      persistLeaveStore();
      return leaveStore.find((l) => l.id === enriched.id)!;
    } catch {
      return enriched;
    }
  } catch (err) {
    if (
      err instanceof Error &&
      /blocked|Overlap|Invalid|inactive|not found/i.test(err.message)
    ) {
      throw err;
    }
    return createLeaveRequest(input);
  }
}

const PLANNED_NEXT: Partial<Record<LeaveStatus, LeaveStatus[]>> = {
  PENDING_EMPLOYEE_CONSENT: ["REQUESTED", "REJECTED", "CANCELLED"],
  REQUESTED: ["SUPERVISOR_VERIFIED", "REJECTED", "CANCELLED"],
  /** Withdraw allowed until site coverage / escalation */
  SUPERVISOR_VERIFIED: ["SITE_APPROVED", "PENDING_INFORMATION", "REJECTED", "CANCELLED"],
  SITE_APPROVED: ["MANAGER_APPROVED", "REJECTED"],
  MANAGER_APPROVED: ["APPROVED", "REJECTED"],
  APPROVED: ["CLOSED", "EXTENSION_REQUIRED"],
  EXTENSION_REQUIRED: ["CLOSED"],
};

const EMERGENCY_NEXT: Partial<Record<LeaveStatus, LeaveStatus[]>> = {
  ABSENT: ["SUPERVISOR_RECORDED", "REJECTED", "CANCELLED"],
  SUPERVISOR_RECORDED: [
    "SITE_VERIFIED",
    "PENDING_INFORMATION",
    "REJECTED",
    "CANCELLED",
  ],
  SITE_VERIFIED: ["MANAGER_APPROVED", "REJECTED"],
  MANAGER_APPROVED: ["APPROVED", "REJECTED"],
  APPROVED: ["CLOSED", "EXTENSION_REQUIRED"],
  EXTENSION_REQUIRED: ["CLOSED"],
};

/** Statuses that still cover the employee's planned shift days. */
const COVERING_LEAVE_STATUSES: LeaveStatus[] = [
  "REQUESTED",
  "PENDING_EMPLOYEE_CONSENT",
  "SUPERVISOR_VERIFIED",
  "SITE_APPROVED",
  "MANAGER_APPROVED",
  "HR_VALIDATED",
  "APPROVED",
  "ABSENT",
  "SUPERVISOR_RECORDED",
  "SITE_VERIFIED",
  "PENDING_INFORMATION",
  "UNEXPLAINED_ABSENCE",
  "EXTENSION_REQUIRED",
];

export function assertLeaveTransition(leave: LeaveRequest, next: LeaveStatus) {
  const table = leave.mode === "emergency" ? EMERGENCY_NEXT : PLANNED_NEXT;
  const allowed = table[leave.status] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Cannot move leave from ${leave.status} to ${next}`);
  }
}

export function employeeHasCoveringLeave(employeeId: string, date: string) {
  ensureLeaveHydrated();
  return leaveStore.some(
    (l) =>
      l.employeeId === employeeId &&
      l.startDate <= date &&
      l.endDate >= date &&
      COVERING_LEAVE_STATUSES.includes(l.status),
  );
}

registerCoveringLeaveCheck(employeeHasCoveringLeave);

function updateLeave(id: string, patch: Partial<LeaveRequest>, ev: LeaveTimelineEvent) {
  ensureLeaveHydrated();
  leaveStore = leaveStore.map((l) => {
    if (l.id !== id) return l;
    return {
      ...l,
      ...patch,
      updatedAt: new Date().toISOString(),
      timeline: [...l.timeline, ev],
    };
  });
  persistLeaveStore();
  const updated = getLeaveById(id)!;
  pushLeaveUpdate(updated);
  return updated;
}

export function supervisorVerify(id: string, actor: string) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  const next: LeaveStatus =
    leave.mode === "emergency" ? "SUPERVISOR_RECORDED" : "SUPERVISOR_VERIFIED";
  assertLeaveTransition(leave, next);
  return updateLeave(
    id,
    { status: next },
    event(actor, "supervisor", "Supervisor verified", "Reason and dates confirmed"),
  );
}

export function siteApprove(
  id: string,
  actor: string,
  opts?: {
    arrangeReplacement?: boolean;
    relieverId?: string;
    otFallback?: boolean;
    approveAnyway?: boolean;
  },
) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  const next: LeaveStatus =
    leave.mode === "emergency" ? "SITE_VERIFIED" : "SITE_APPROVED";
  assertLeaveTransition(leave, next);

  const impact = computeLeaveImpact(leave.employeeId, leave.startDate);
  let replacementPlan = leave.replacementPlan;
  let assignedRelieverId = leave.assignedRelieverId;
  let potentialOtHours = impact.potentialOtHours;
  let potentialOtCost = impact.potentialOtCost;

  const coverInput = {
    leaveId: leave.id,
    employeeId: leave.employeeId,
    employeeName: leave.employeeName,
    siteId: leave.siteId,
    shiftId: leave.shiftId,
    date: leave.startDate,
    reason: leave.reason,
  };

  if (opts?.relieverId || opts?.otFallback) {
    const cover = assignChosenRelieverForLeave(
      coverInput,
      opts.relieverId ? { relieverId: opts.relieverId } : { ot: true },
    );
    replacementPlan = cover.plan;
    if (cover.relieverId) {
      assignedRelieverId = cover.relieverId;
      potentialOtHours = 0;
      potentialOtCost = 0;
    } else {
      assignedRelieverId = undefined;
    }
  } else if (opts?.arrangeReplacement) {
    const cover = assignRelieverForLeave(coverInput);
    replacementPlan = cover.plan;
    if (cover.relieverId) {
      assignedRelieverId = cover.relieverId;
      potentialOtHours = 0;
      potentialOtCost = 0;
    } else {
      assignedRelieverId = undefined;
    }
  }

  if (opts?.approveAnyway && potentialOtHours > 0) {
    replacementPlan =
      (replacementPlan ? replacementPlan + " · " : "") +
      "Approved with OT risk accepted";
  }

  return updateLeave(
    id,
    {
      status: next,
      replacementPlan,
      assignedRelieverId,
      potentialOtHours,
      potentialOtCost,
      replacementRequired: potentialOtHours > 0 || !!assignedRelieverId,
    },
    event(
      actor,
      "site_incharge",
      "Site decision",
      replacementPlan ??
        (potentialOtHours > 0
          ? `OT risk ${potentialOtHours} hrs`
          : "Manpower OK"),
    ),
  );
}

export function hrValidate(id: string, actor: string) {
  void id;
  void actor;
  throw new Error("HR validation is not used in this approval chain");
}

export function finalizeApprove(id: string, actor: string) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  assertLeaveTransition(leave, "APPROVED");
  return updateLeave(
    id,
    {
      status: "APPROVED",
    },
    event(actor, "director", "Leave approved by Director", "Final director sign-off"),
  );
}

export function rejectLeave(
  id: string,
  actor: string,
  note: string,
  actorRole: LeaveTimelineEvent["role"] = "management",
) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  if (!note.trim()) throw new Error("A remark is required to reject");
  assertLeaveTransition(leave, "REJECTED");
  releaseRelieverForLeave(id);
  const at = new Date().toISOString();
  return updateLeave(
    id,
    {
      status: "REJECTED",
      ...(actorRole === "management" || actorRole === "director"
        ? { managerDecision: "rejected" as const, managerDecisionAt: at }
        : {}),
      rejectionReason: note.trim(),
      assignedRelieverId: undefined,
    },
    event(actor, actorRole, "Leave rejected", note.trim()),
  );
}

/** Employee consents to a supervisor-submitted leave request */
export function employeeConsentLeave(
  id: string,
  actor: string,
  decision: "approved" | "rejected",
  note?: string,
) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  if (leave.status !== "PENDING_EMPLOYEE_CONSENT") {
    throw new Error("Leave is not awaiting employee consent");
  }
  const at = new Date().toISOString();
  if (decision === "rejected") {
    assertLeaveTransition(leave, "REJECTED");
    return updateLeave(
      id,
      {
        status: "REJECTED",
        employeeConsent: "rejected",
        employeeConsentAt: at,
        employeeConsentNote: note,
        rejectionReason: note ?? "Employee rejected consent",
      },
      event(actor, "employee", "Employee rejected consent", note),
    );
  }
  assertLeaveTransition(leave, "REQUESTED");
  return updateLeave(
    id,
    {
      status: "REQUESTED",
      employeeConsent: "approved",
      employeeConsentAt: at,
      employeeConsentNote: note,
    },
    event(actor, "employee", "Employee consented", "Approved to proceed to supervisor"),
  );
}

/** Plant manager approve / reject after the shift is covered → awaits Admin */
export function managerDecideLeave(
  id: string,
  actor: string,
  decision: "approved" | "rejected",
  note?: string,
) {
  if (decision === "rejected") {
    return rejectLeave(id, actor, note ?? "Rejected by manager", "management");
  }
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  assertLeaveTransition(leave, "MANAGER_APPROVED");
  return updateLeave(
    id,
    {
      status: "MANAGER_APPROVED",
      managerDecision: "approved",
      managerDecisionAt: new Date().toISOString(),
    },
    event(
      actor,
      "management",
      "Manager approved",
      "Awaiting Director final approval",
    ),
  );
}

/** Director final approve / reject after manager */
export function adminFinalizeLeave(
  id: string,
  actor: string,
  decision: "approved" | "rejected",
  note?: string,
) {
  if (decision === "rejected") {
    return rejectLeave(id, actor, note ?? "Rejected by director", "director");
  }
  return finalizeApprove(id, actor);
}

export function confirmReturn(id: string, actor: string, actualReturnDate: string) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  const planned = new Date(leave.expectedReturnDate + "T00:00:00Z").getTime();
  const actual = new Date(actualReturnDate + "T00:00:00Z").getTime();
  const late = leave.status === "APPROVED" && actual > planned;

  if (leave.status === "EXTENSION_REQUIRED") {
    assertLeaveTransition(leave, "CLOSED");
    releaseRelieverForLeave(id);
    return updateLeave(
      id,
      {
        actualReturnDate,
        status: "CLOSED",
        assignedRelieverId: undefined,
        replacementPlan: leave.replacementPlan
          ? `${leave.replacementPlan} · replacement released`
          : "Temporary replacement released",
      },
      event(
        actor,
        "supervisor",
        "Extension closed — return confirmed",
        `Actual return ${actualReturnDate}`,
      ),
    );
  }

  if (late) {
    assertLeaveTransition(leave, "EXTENSION_REQUIRED");
    return updateLeave(
      id,
      {
        actualReturnDate,
        status: "EXTENSION_REQUIRED",
      },
      event(
        actor,
        "supervisor",
        "Late return — extension required",
        `Actual return ${actualReturnDate}`,
      ),
    );
  }

  assertLeaveTransition(leave, "CLOSED");
  releaseRelieverForLeave(id);
  return updateLeave(
    id,
    {
      actualReturnDate,
      status: "CLOSED",
      assignedRelieverId: undefined,
      replacementPlan: leave.replacementPlan
        ? `${leave.replacementPlan} · replacement released`
        : "Temporary replacement released",
    },
    event(
      actor,
      "supervisor",
      "Return to duty confirmed",
      `Actual return ${actualReturnDate}`,
    ),
  );
}

export function escalateLeave(id: string, actor: string, note: string) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  assertLeaveTransition(leave, "PENDING_INFORMATION");
  return updateLeave(
    id,
    { status: "PENDING_INFORMATION" },
    event(actor, "site_incharge", "Escalated", note),
  );
}

export function cancelLeave(
  id: string,
  actor: string,
  note: string,
  actorRole: LeaveRequest["enteredByRole"] = "employee",
) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  const reason = note?.trim();
  if (!reason) throw new Error("A reason is required to withdraw this leave");
  assertLeaveTransition(leave, "CANCELLED");
  releaseRelieverForLeave(id);
  return updateLeave(
    id,
    {
      status: "CANCELLED",
      cancellationReason: reason,
      cancelledByName: actor,
      cancelledByRole: actorRole,
      cancelledAt: new Date().toISOString(),
      assignedRelieverId: undefined,
      replacementPlan: leave.replacementPlan
        ? `${leave.replacementPlan} · replacement released`
        : undefined,
    },
    event(actor, actorRole, "Leave withdrawn", reason),
  );
}

/** Same plant + overlapping dates (active covering leaves), excluding self. */
export function getPlantOverlappingLeaves(leaveId: string): LeaveRequest[] {
  ensureLeaveHydrated();
  const leave = getLeaveById(leaveId);
  if (!leave) return [];
  return leaveStore.filter(
    (l) =>
      l.id !== leave.id &&
      l.siteId === leave.siteId &&
      COVERING_LEAVE_STATUSES.includes(l.status) &&
      l.startDate <= leave.endDate &&
      leave.startDate <= l.endDate,
  );
}

/** Statuses where the requester may still withdraw (not yet site-approved / escalated / finalized). */
export const WITHDRAWABLE_LEAVE_STATUSES: LeaveStatus[] = [
  "REQUESTED",
  "PENDING_EMPLOYEE_CONSENT",
  "SUPERVISOR_VERIFIED",
  "ABSENT",
  "SUPERVISOR_RECORDED",
];

export function canWithdrawLeaveStatus(status: LeaveStatus): boolean {
  return WITHDRAWABLE_LEAVE_STATUSES.includes(status);
}

// ----------------------------------------------------
// Live NestJS Backend Synchronization
// ----------------------------------------------------
export async function syncLeavesWithApi(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { getLeaves, createLeave } = await import("../api/leaves");
    let live = await getLeaves().catch(() => [] as LeaveRequest[]);

    // First-time bootstrap: push demo seed if Mongo has no leaves yet
    if (!live?.length) {
      ensureLeaveHydrated();
      await Promise.all(
        seedSnapshot.map((row) => createLeave(row).catch(() => null)),
      );
      live = await getLeaves().catch(() => [] as LeaveRequest[]);
    }

    if (live && live.length) {
      leaveStore = live.map((l) => ({
        ...l,
        timeline: Array.isArray(l.timeline) ? l.timeline : [],
      }));
      leaveHydrated = true;
      persistLeaveStore();
    }
  } catch {
    // Graceful offline fallback
  }
}

export { dayCount };
