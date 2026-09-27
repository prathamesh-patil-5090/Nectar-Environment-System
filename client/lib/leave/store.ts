import { employees, getEmployeeById, getSiteById } from "@/lib/mock-data";
import { getShiftById } from "@/lib/overtime/mock-data";
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
const LEAVE_STORAGE_KEY = "nectar-enviro-leave-store-v1";

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
    employeeId: "e-etp-s1",
    employeeName: "Asha Patil",
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
    requestedByName: "Asha Patil",
    enteredByName: "Asha Patil",
    enteredByRole: "employee",
    supervisorName: "Amit Supervisor",
    siteInChargeName: "Sanjay Jadhav",
    managerName: "Rajesh Kulkarni",
    replacementRequired: true,
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 8,
    daysRequested: 2,
    createdAt: "2026-09-20T10:00:00Z",
    updatedAt: "2026-09-20T10:00:00Z",
    timeline: [
      event("Asha Patil", "employee", "Leave requested", "Planned leave submitted", "2026-09-20T10:00:00Z"),
    ],
  },
  {
    id: "lv2",
    employeeId: "e-etp-s2",
    employeeName: "Rohan Deshmukh",
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
    requestedByName: "Amit Supervisor",
    enteredByName: "Amit Supervisor",
    enteredByRole: "supervisor",
    submittedByEmployeeId: "e-etp-sup",
    supervisorName: "Amit Supervisor",
    siteInChargeName: "Sanjay Jadhav",
    managerName: "Rajesh Kulkarni",
    replacementRequired: true,
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 6,
    daysRequested: 2,
    createdAt: "2026-09-22T09:00:00Z",
    updatedAt: "2026-09-22T09:00:00Z",
    timeline: [
      event(
        "Amit Supervisor",
        "supervisor",
        "Leave submitted on behalf of employee",
        "Awaiting employee consent",
        "2026-09-22T09:00:00Z",
      ),
    ],
  },
  {
    id: "lv3",
    employeeId: "e-ro-s1",
    employeeName: "Imran Shaikh",
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
    requestedByName: "Neha Kamat",
    enteredByName: "Neha Kamat",
    enteredByRole: "supervisor",
    submittedByEmployeeId: "e-ro-sup",
    employeeConsent: "approved",
    employeeConsentAt: "2026-09-21T11:00:00Z",
    supervisorName: "Neha Kamat",
    siteInChargeName: "Vikram Shah",
    managerName: "Priya Iyer",
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
      event("Neha Kamat", "supervisor", "Leave submitted on behalf", undefined, "2026-09-20T09:00:00Z"),
      event("Imran Shaikh", "employee", "Employee consented", "Approved to proceed to manager", "2026-09-21T11:00:00Z"),
    ],
  },
  {
    id: "lv4",
    employeeId: "e-mee-s1",
    employeeName: "Vikram Nair",
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
    enteredByName: "Sunita Rane",
    enteredByRole: "supervisor",
    submittedByEmployeeId: "e-mee-sup",
    employeeConsent: "approved",
    employeeConsentAt: "2026-09-23T07:15:00Z",
    supervisorName: "Sunita Rane",
    siteInChargeName: "Farhan Qureshi",
    managerName: "Anil Desai",
    replacementRequired: true,
    potentialOtHours: 8,
    potentialOtCost: 2160,
    leaveBalanceDays: 2,
    daysRequested: 2,
    createdAt: "2026-09-23T07:20:00Z",
    updatedAt: "2026-09-23T07:20:00Z",
    timeline: [
      event("Sunita Rane", "supervisor", "Absence detected", "Employee did not report", "2026-09-23T06:50:00Z"),
      event("Vikram Nair", "employee", "Employee consented", "Permission to file emergency leave", "2026-09-23T07:15:00Z"),
      event("Sunita Rane", "supervisor", "Emergency absence recorded", "Entered on behalf of employee", "2026-09-23T07:20:00Z"),
    ],
  },
  {
    id: "lv5",
    employeeId: "e-etp-g1",
    employeeName: "Nisha Salvi",
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
    requestedByName: "Nisha Salvi",
    enteredByName: "Nisha Salvi",
    enteredByRole: "employee",
    supervisorName: "Amit Supervisor",
    siteInChargeName: "Sanjay Jadhav",
    managerName: "Rajesh Kulkarni",
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
      event("Nisha Salvi", "employee", "Leave requested", undefined, "2026-09-10T12:00:00Z"),
      event("Rajesh Kulkarni", "management", "Manager approved", "Manpower OK", "2026-09-11T10:00:00Z"),
      event("Amit Supervisor", "supervisor", "Return confirmed", "Duty resumed", "2026-09-17T08:30:00Z"),
    ],
  },
  {
    id: "lv6",
    employeeId: "e-ro-s2",
    employeeName: "Arjun Mehta",
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
    requestedByName: "Arjun Mehta",
    enteredByName: "Arjun Mehta",
    enteredByRole: "employee",
    supervisorName: "Neha Kamat",
    siteInChargeName: "Vikram Shah",
    managerName: "Priya Iyer",
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
      event("Arjun Mehta", "employee", "Leave requested", undefined, "2026-09-19T11:00:00Z"),
      event(
        "Priya Iyer",
        "management",
        "Manager rejected",
        "Critical RO maintenance window — reschedule after 25 Sep",
        "2026-09-19T15:00:00Z",
      ),
    ],
  },
  {
    id: "lv7",
    employeeId: "e-mee-s2",
    employeeName: "Pooja Ghate",
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
    requestedByName: "Sunita Rane",
    enteredByName: "Sunita Rane",
    enteredByRole: "supervisor",
    submittedByEmployeeId: "e-mee-sup",
    employeeConsent: "rejected",
    employeeConsentAt: "2026-09-22T14:00:00Z",
    employeeConsentNote: "I did not ask for leave — please cancel",
    rejectionReason: "Employee rejected consent",
    supervisorName: "Sunita Rane",
    siteInChargeName: "Farhan Qureshi",
    managerName: "Anil Desai",
    replacementRequired: false,
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 7,
    daysRequested: 1,
    createdAt: "2026-09-22T10:00:00Z",
    updatedAt: "2026-09-22T14:00:00Z",
    timeline: [
      event("Sunita Rane", "supervisor", "Leave submitted on behalf", undefined, "2026-09-22T10:00:00Z"),
      event(
        "Pooja Ghate",
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
};

export function createLeaveRequest(input: CreateLeaveInput): LeaveRequest {
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
    daysRequested: dayCount(input.startDate, input.endDate),
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
  return row;
}

const PLANNED_NEXT: Partial<Record<LeaveStatus, LeaveStatus[]>> = {
  PENDING_EMPLOYEE_CONSENT: ["REQUESTED", "REJECTED", "CANCELLED"],
  REQUESTED: ["SUPERVISOR_VERIFIED", "REJECTED", "CANCELLED"],
  SUPERVISOR_VERIFIED: ["SITE_APPROVED", "PENDING_INFORMATION", "REJECTED", "CANCELLED"],
  SITE_APPROVED: ["MANAGER_APPROVED", "REJECTED", "CANCELLED"],
  MANAGER_APPROVED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["CLOSED", "EXTENSION_REQUIRED", "CANCELLED"],
  EXTENSION_REQUIRED: ["CLOSED", "CANCELLED"],
};

const EMERGENCY_NEXT: Partial<Record<LeaveStatus, LeaveStatus[]>> = {
  ABSENT: ["SUPERVISOR_RECORDED", "REJECTED", "CANCELLED"],
  SUPERVISOR_RECORDED: ["SITE_VERIFIED", "PENDING_INFORMATION", "REJECTED", "CANCELLED"],
  SITE_VERIFIED: ["MANAGER_APPROVED", "REJECTED", "CANCELLED"],
  MANAGER_APPROVED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["CLOSED", "EXTENSION_REQUIRED", "CANCELLED"],
  EXTENSION_REQUIRED: ["CLOSED", "CANCELLED"],
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
  return getLeaveById(id)!;
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
    event(actor, "admin", "Leave approved by Admin", "Final admin sign-off"),
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
      ...(actorRole === "management" || actorRole === "admin"
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
      "Awaiting Admin final approval",
    ),
  );
}

/** Admin final approve / reject after manager */
export function adminFinalizeLeave(
  id: string,
  actor: string,
  decision: "approved" | "rejected",
  note?: string,
) {
  if (decision === "rejected") {
    return rejectLeave(id, actor, note ?? "Rejected by admin", "admin");
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

export function cancelLeave(id: string, actor: string, note?: string) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  assertLeaveTransition(leave, "CANCELLED");
  releaseRelieverForLeave(id);
  return updateLeave(
    id,
    {
      status: "CANCELLED",
      assignedRelieverId: undefined,
      replacementPlan: leave.replacementPlan
        ? `${leave.replacementPlan} · replacement released`
        : undefined,
    },
    event(actor, leave.enteredByRole, "Leave cancelled", note),
  );
}

export { dayCount };
