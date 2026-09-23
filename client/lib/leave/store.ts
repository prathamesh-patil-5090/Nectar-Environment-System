import { employees, getEmployeeById, getSiteById } from "@/lib/mock-data";
import { getShiftById } from "@/lib/overtime/mock-data";
import {
  findReplacementCandidates,
  getClusterForSite,
  getRelievers,
} from "@/lib/reliever/pool";
import { getPlannedShiftForLeave } from "@/lib/shift";
import type {
  LeaveImpact,
  LeaveMode,
  LeaveRequest,
  LeaveStatus,
  LeaveTimelineEvent,
  LeaveType,
} from "./types";

const OT_HOURLY_COST = 270;

let leaveStore: LeaveRequest[] = [];

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
  const siteId = emp?.siteId ?? "s1";
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
    employeeId: "e1",
    employeeName: "Asha Patil",
    siteId: "s1",
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
    supervisorName: "Farhan Qureshi",
    siteInChargeName: "Thane Site Lead",
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
    employeeId: "e3",
    employeeName: "Meera Kulkarni",
    siteId: "s2",
    department: "Maintenance",
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
    enteredByName: "Amit Supervisor",
    enteredByRole: "supervisor",
    supervisorName: "Amit Supervisor",
    siteInChargeName: "Belapur Site Lead",
    replacementRequired: true,
    potentialOtHours: 8,
    potentialOtCost: 2160,
    leaveBalanceDays: 4,
    daysRequested: 2,
    createdAt: "2026-09-23T07:20:00Z",
    updatedAt: "2026-09-23T07:20:00Z",
    timeline: [
      event("Amit Supervisor", "supervisor", "Absence detected", "Employee did not report", "2026-09-23T06:50:00Z"),
      event("Amit Supervisor", "supervisor", "Contacted employee", "Reason obtained verbally", "2026-09-23T07:10:00Z"),
      event("Amit Supervisor", "supervisor", "Emergency absence recorded", "Entered on behalf of employee", "2026-09-23T07:20:00Z"),
    ],
  },
  {
    id: "lv3",
    employeeId: "e7",
    employeeName: "Priya Sawant",
    siteId: "s2",
    department: "Operations",
    shiftId: "sh-night",
    mode: "planned",
    leaveType: "sick",
    status: "SITE_APPROVED",
    entrySource: "supervisor_on_behalf",
    startDate: "2026-09-28",
    endDate: "2026-09-29",
    expectedReturnDate: "2026-09-30",
    reason: "Medical appointment",
    enteredByName: "Amit Supervisor",
    enteredByRole: "supervisor",
    supervisorName: "Amit Supervisor",
    siteInChargeName: "Belapur Site Lead",
    replacementRequired: true,
    assignedRelieverId: "rv2",
    replacementPlan: "Cluster reliever Lata More assigned",
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 6,
    daysRequested: 2,
    createdAt: "2026-09-18T09:00:00Z",
    updatedAt: "2026-09-19T11:00:00Z",
    timeline: [
      event("Priya Sawant", "employee", "Informed supervisor", undefined, "2026-09-18T08:30:00Z"),
      event("Amit Supervisor", "supervisor", "Verified & entered leave", "On behalf of employee", "2026-09-18T09:00:00Z"),
      event("Belapur Site Lead", "site_incharge", "Site approved", "Reliever arranged — OT risk none", "2026-09-19T11:00:00Z"),
    ],
  },
  {
    id: "lv4",
    employeeId: "e6",
    employeeName: "Vikram Nair",
    siteId: "s5",
    department: "Operations",
    shiftId: "sh-morning",
    mode: "emergency",
    leaveType: "other",
    status: "PENDING_INFORMATION",
    entrySource: "supervisor_on_behalf",
    startDate: "2026-09-21",
    endDate: "2026-09-23",
    expectedReturnDate: "2026-09-24",
    reason: "Family emergency",
    lastCommunication: "Family emergency — no confirmed return date",
    enteredByName: "Site Supervisor",
    enteredByRole: "supervisor",
    supervisorName: "Site Supervisor",
    siteInChargeName: "Vashi Site Lead",
    replacementRequired: true,
    potentialOtHours: 8,
    potentialOtCost: 2160,
    leaveBalanceDays: 2,
    daysRequested: 3,
    createdAt: "2026-09-21T08:00:00Z",
    updatedAt: "2026-09-22T18:00:00Z",
    timeline: [
      event("Site Supervisor", "supervisor", "Absence recorded", "Pending justification", "2026-09-21T08:00:00Z"),
      event("HR Partner", "hr", "Flagged pending information", "Need expected return confirmation", "2026-09-22T18:00:00Z"),
    ],
  },
  {
    id: "lv5",
    employeeId: "e10",
    employeeName: "Suresh Pawar",
    siteId: "s6",
    department: "Operations",
    shiftId: "sh-morning",
    mode: "emergency",
    leaveType: "other",
    status: "UNEXPLAINED_ABSENCE",
    entrySource: "supervisor_on_behalf",
    startDate: "2026-09-22",
    endDate: "2026-09-23",
    expectedReturnDate: "2026-09-24",
    reason: "Not reachable",
    lastCommunication: "Calls unanswered since 22 Sep morning",
    enteredByName: "Aurangabad Supervisor",
    enteredByRole: "supervisor",
    supervisorName: "Aurangabad Supervisor",
    siteInChargeName: "Aurangabad Site Lead",
    replacementRequired: true,
    potentialOtHours: 8,
    potentialOtCost: 2160,
    leaveBalanceDays: 5,
    daysRequested: 2,
    createdAt: "2026-09-22T09:00:00Z",
    updatedAt: "2026-09-23T09:00:00Z",
    timeline: [
      event("Aurangabad Supervisor", "supervisor", "Marked unexplained absence", "Could not contact employee", "2026-09-22T09:00:00Z"),
    ],
  },
  {
    id: "lv6",
    employeeId: "e5",
    employeeName: "Sneha Joshi",
    siteId: "s4",
    department: "Laboratory",
    shiftId: "sh-morning",
    mode: "planned",
    leaveType: "casual",
    status: "APPROVED",
    entrySource: "employee",
    startDate: "2026-09-15",
    endDate: "2026-09-16",
    expectedReturnDate: "2026-09-17",
    actualReturnDate: "2026-09-17",
    reason: "Personal work",
    requestedByName: "Sneha Joshi",
    enteredByName: "Sneha Joshi",
    enteredByRole: "employee",
    supervisorName: "Lab Lead",
    siteInChargeName: "Nashik Site Lead",
    replacementRequired: false,
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 10,
    daysRequested: 2,
    createdAt: "2026-09-10T12:00:00Z",
    updatedAt: "2026-09-17T08:30:00Z",
    timeline: [
      event("Sneha Joshi", "employee", "Leave requested", undefined, "2026-09-10T12:00:00Z"),
      event("Lab Lead", "supervisor", "Verified", undefined, "2026-09-10T14:00:00Z"),
      event("Nashik Site Lead", "site_incharge", "Site approved", "Manpower OK", "2026-09-11T10:00:00Z"),
      event("HR Partner", "hr", "HR validated", "Balance OK", "2026-09-11T16:00:00Z"),
      event("Lab Lead", "supervisor", "Return confirmed", "Duty resumed", "2026-09-17T08:30:00Z"),
    ],
  },
  {
    id: "lv7",
    employeeId: "e8",
    employeeName: "Arjun Mehta",
    siteId: "s3",
    department: "Maintenance",
    shiftId: "sh-afternoon",
    mode: "planned",
    leaveType: "sick",
    status: "EXTENSION_REQUIRED",
    entrySource: "employee",
    startDate: "2026-09-20",
    endDate: "2026-09-22",
    expectedReturnDate: "2026-09-23",
    actualReturnDate: "2026-09-24",
    reason: "Fever",
    requestedByName: "Arjun Mehta",
    enteredByName: "Arjun Mehta",
    enteredByRole: "employee",
    supervisorName: "Pune Supervisor",
    siteInChargeName: "Pune Site Lead",
    replacementRequired: true,
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 3,
    daysRequested: 3,
    createdAt: "2026-09-19T11:00:00Z",
    updatedAt: "2026-09-24T09:00:00Z",
    timeline: [
      event("Arjun Mehta", "employee", "Leave requested", undefined, "2026-09-19T11:00:00Z"),
      event("Pune Supervisor", "supervisor", "Verified", undefined, "2026-09-19T12:00:00Z"),
      event("Pune Site Lead", "site_incharge", "Site approved", undefined, "2026-09-19T15:00:00Z"),
      event("HR Partner", "hr", "Validated", undefined, "2026-09-19T17:00:00Z"),
      event("Pune Supervisor", "supervisor", "Late return recorded", "+1 day vs planned — extension required", "2026-09-24T09:00:00Z"),
    ],
  },
  {
    id: "lv8",
    employeeId: "e11",
    employeeName: "Neha Gupta",
    siteId: "s4",
    department: "Maintenance",
    shiftId: "sh-afternoon",
    mode: "planned",
    leaveType: "casual",
    status: "HR_VALIDATED",
    entrySource: "employee",
    startDate: "2026-10-02",
    endDate: "2026-10-03",
    expectedReturnDate: "2026-10-04",
    reason: "Travel",
    requestedByName: "Neha Gupta",
    enteredByName: "Neha Gupta",
    enteredByRole: "employee",
    supervisorName: "Lab Lead",
    siteInChargeName: "Nashik Site Lead",
    replacementRequired: false,
    potentialOtHours: 0,
    potentialOtCost: 0,
    leaveBalanceDays: 7,
    daysRequested: 2,
    createdAt: "2026-09-21T10:00:00Z",
    updatedAt: "2026-09-22T14:00:00Z",
    timeline: [
      event("Neha Gupta", "employee", "Leave requested", undefined, "2026-09-21T10:00:00Z"),
      event("Lab Lead", "supervisor", "Verified", undefined, "2026-09-21T13:00:00Z"),
      event("Nashik Site Lead", "site_incharge", "Site approved", undefined, "2026-09-22T09:00:00Z"),
      event("HR Partner", "hr", "Policy validated", "Awaiting final approve stamp", "2026-09-22T14:00:00Z"),
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

export function getLeaveRequests(siteId?: string) {
  return [...leaveStore]
    .filter((l) => (siteId ? l.siteId === siteId : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLeaveById(id: string) {
  return leaveStore.find((l) => l.id === id);
}

export function getLeaveKpis(siteId?: string) {
  const rows = getLeaveRequests(siteId);
  const today = "2026-09-23";
  const pending = rows.filter((l) =>
    [
      "REQUESTED",
      "SUPERVISOR_VERIFIED",
      "SUPERVISOR_RECORDED",
      "SITE_APPROVED",
      "SITE_VERIFIED",
      "HR_VALIDATED",
      "PENDING_INFORMATION",
    ].includes(l.status),
  ).length;
  const unverified = rows.filter((l) =>
    ["ABSENT", "PENDING_INFORMATION", "UNEXPLAINED_ABSENCE"].includes(l.status),
  ).length;
  const onLeave = rows.filter(
    (l) =>
      ["APPROVED", "SITE_APPROVED", "HR_VALIDATED", "SUPERVISOR_RECORDED", "SITE_VERIFIED"].includes(
        l.status,
      ) &&
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
    totalEmployees: siteId
      ? employees.filter((e) => e.siteId === siteId).length
      : employees.length,
    pendingRequests: pending,
    unverifiedAbsences: unverified,
    currentlyOnLeave: onLeave,
    leaveWithoutInformation: withoutInfo,
    overdueLeaveClosure: overdueClosure,
    leaveOtRisk: otRisk,
    criticalSiteShortages: criticalShortages,
    longLeaveCases: longLeave,
  };
}

export function getPendingJustifications() {
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
  lastCommunication?: string;
};

export function createLeaveRequest(input: CreateLeaveInput): LeaveRequest {
  const emp = getEmployeeById(input.employeeId);
  if (!emp) throw new Error("Employee not found");
  const impact = computeLeaveImpact(input.employeeId, input.startDate);
  const id = `lv-${Date.now().toString(36)}`;
  const status: LeaveStatus =
    input.mode === "emergency"
      ? input.entrySource === "supervisor_on_behalf"
        ? "SUPERVISOR_RECORDED"
        : "ABSENT"
      : "REQUESTED";

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
      input.entrySource === "employee" ? emp.name : undefined,
    enteredByName: input.enteredByName,
    enteredByRole: input.enteredByRole,
    supervisorName: input.supervisorName,
    siteInChargeName: input.siteInChargeName,
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
        input.mode === "emergency"
          ? "Emergency absence recorded"
          : "Leave requested",
        input.entrySource === "supervisor_on_behalf"
          ? "Entered by supervisor on behalf of employee"
          : "Requested by employee",
      ),
    ],
  };

  leaveStore = [row, ...leaveStore];
  return row;
}

function updateLeave(id: string, patch: Partial<LeaveRequest>, ev: LeaveTimelineEvent) {
  leaveStore = leaveStore.map((l) => {
    if (l.id !== id) return l;
    return {
      ...l,
      ...patch,
      updatedAt: new Date().toISOString(),
      timeline: [...l.timeline, ev],
    };
  });
  return getLeaveById(id)!;
}

export function supervisorVerify(id: string, actor: string) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  const next: LeaveStatus =
    leave.mode === "emergency" ? "SUPERVISOR_RECORDED" : "SUPERVISOR_VERIFIED";
  return updateLeave(
    id,
    { status: next },
    event(actor, "supervisor", "Supervisor verified", "Reason and dates confirmed"),
  );
}

export function siteApprove(
  id: string,
  actor: string,
  opts?: { arrangeReplacement?: boolean; approveAnyway?: boolean },
) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  const impact = computeLeaveImpact(leave.employeeId, leave.startDate);
  let replacementPlan = leave.replacementPlan;
  let assignedRelieverId = leave.assignedRelieverId;
  let potentialOtHours = impact.potentialOtHours;
  let potentialOtCost = impact.potentialOtCost;

  if (opts?.arrangeReplacement) {
    const stubAbsence = {
      id: leave.id,
      employeeId: leave.employeeId,
      employeeName: leave.employeeName,
      siteId: leave.siteId,
      clusterId: getClusterForSite(leave.siteId)?.id ?? "",
      date: leave.startDate,
      shiftId: leave.shiftId,
      reason: leave.reason,
      requiredSkills: [] as never[],
      status: "open" as const,
    };
    const { local, cluster } = findReplacementCandidates(stubAbsence);
    const pick = local[0] ?? cluster[0];
    if (pick) {
      assignedRelieverId = pick.id;
      replacementPlan = `${pick.name} arranged from reliever pool`;
      potentialOtHours = 0;
      potentialOtCost = 0;
    } else {
      replacementPlan = "No pool match — approve may create OT";
    }
  }

  if (opts?.approveAnyway && potentialOtHours > 0) {
    replacementPlan =
      (replacementPlan ? replacementPlan + " · " : "") +
      "Approved with OT risk accepted";
  }

  const next: LeaveStatus =
    leave.mode === "emergency" ? "SITE_VERIFIED" : "SITE_APPROVED";

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
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  const next: LeaveStatus =
    leave.mode === "emergency" ? "HR_VALIDATED" : "HR_VALIDATED";
  return updateLeave(
    id,
    { status: next },
    event(actor, "hr", "HR validated", "Policy & balance check OK"),
  );
}

export function finalizeApprove(id: string, actor: string) {
  return updateLeave(
    id,
    { status: "APPROVED" },
    event(actor, "hr", "Leave approved", "Final status"),
  );
}

export function rejectLeave(id: string, actor: string, note: string) {
  return updateLeave(
    id,
    { status: "REJECTED" },
    event(actor, "site_incharge", "Leave rejected", note),
  );
}

export function confirmReturn(id: string, actor: string, actualReturnDate: string) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error("Not found");
  const planned = new Date(leave.expectedReturnDate + "T00:00:00Z").getTime();
  const actual = new Date(actualReturnDate + "T00:00:00Z").getTime();
  const late = actual > planned;
  return updateLeave(
    id,
    {
      actualReturnDate,
      status: late ? "EXTENSION_REQUIRED" : "CLOSED",
      assignedRelieverId: undefined,
      replacementPlan: leave.replacementPlan
        ? `${leave.replacementPlan} · replacement released`
        : "Temporary replacement released",
    },
    event(
      actor,
      "supervisor",
      late ? "Late return — extension required" : "Return to duty confirmed",
      `Actual return ${actualReturnDate}`,
    ),
  );
}

export function escalateLeave(id: string, actor: string, note: string) {
  return updateLeave(
    id,
    { status: "PENDING_INFORMATION" },
    event(actor, "site_incharge", "Escalated", note),
  );
}

export { dayCount };
