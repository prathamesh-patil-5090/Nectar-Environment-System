/**
 * Manager OT assign / notify — localStorage-backed for demo.
 */

import { getEmployeeById } from "@/lib/mock-data";
import { pushNotification } from "@/lib/notifications";

export const OT_ASSIGNMENTS_KEY = "nectar-enviro-ot-assignments";

export type OtAssignmentStatus =
  | "assigned"
  | "acknowledged"
  | "completed"
  | "cancelled";

export type OtAssignment = {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId: string;
  date: string;
  hours: number;
  reason: string;
  assignedBy: string;
  assignedByEmployeeId?: string;
  status: OtAssignmentStatus;
  createdAt: string;
  notes?: string;
};

const DEMO_OT: OtAssignment[] = [
  {
    id: "seed-ota-asha-1",
    employeeId: "e-etp-s1",
    employeeName: "Asha Patil",
    siteId: "s-etp",
    date: "2026-09-27",
    hours: 4,
    reason: "Coverage during Rohan's leave",
    assignedBy: "Rajesh Kulkarni",
    assignedByEmployeeId: "e-etp-mgr",
    status: "assigned",
    createdAt: "2026-09-25T09:15:00Z",
    notes: "Report by 06:00 — coordinate with Sanjay Jadhav",
  },
  {
    id: "seed-ota-asha-2",
    employeeId: "e-etp-s1",
    employeeName: "Asha Patil",
    siteId: "s-etp",
    date: "2026-09-12",
    hours: 3,
    reason: "Plant upset — aeration recovery",
    assignedBy: "Rajesh Kulkarni",
    assignedByEmployeeId: "e-etp-mgr",
    status: "completed",
    createdAt: "2026-09-12T18:00:00Z",
  },
  {
    id: "seed-ota-rohan-1",
    employeeId: "e-etp-s2",
    employeeName: "Rohan Deshmukh",
    siteId: "s-etp",
    date: "2026-09-26",
    hours: 6,
    reason: "Plant upset coverage",
    assignedBy: "Rajesh Kulkarni",
    assignedByEmployeeId: "e-etp-mgr",
    status: "assigned",
    createdAt: "2026-09-24T08:00:00Z",
  },
  {
    id: "seed-ota-imran-1",
    employeeId: "e-ro-s1",
    employeeName: "Imran Shaikh",
    siteId: "s-ro",
    date: "2026-09-25",
    hours: 8,
    reason: "Membrane CIP support",
    assignedBy: "Priya Iyer",
    assignedByEmployeeId: "e-ro-mgr",
    status: "acknowledged",
    createdAt: "2026-09-24T16:00:00Z",
  },
  {
    id: "seed-ota-vikram-1",
    employeeId: "e-mee-s1",
    employeeName: "Vikram Nair",
    siteId: "s-mee",
    date: "2026-09-26",
    hours: 5,
    reason: "Evaporator restart after shutdown",
    assignedBy: "Anil Desai",
    assignedByEmployeeId: "e-mee-mgr",
    status: "assigned",
    createdAt: "2026-09-25T06:30:00Z",
  },
];

function readAll(): OtAssignment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OT_ASSIGNMENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OtAssignment[];
  } catch {
    return [];
  }
}

function writeAll(rows: OtAssignment[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(OT_ASSIGNMENTS_KEY, JSON.stringify(rows));
}

export function ensureOtAssignmentSeed(): void {
  if (typeof window === "undefined") return;
  const existing = readAll();
  const have = new Set(existing.map((a) => a.id));
  const missing = DEMO_OT.filter((a) => !have.has(a.id));
  if (missing.length) writeAll([...missing, ...existing]);
}

/** Restore demo OT assignments (drops manager-created assigns in this browser). */
export function resetOtAssignments(): void {
  if (typeof window === "undefined") return;
  writeAll(DEMO_OT.map((a) => ({ ...a })));
}

export function getOtAssignments(opts?: {
  siteId?: string;
  employeeId?: string;
}): OtAssignment[] {
  ensureOtAssignmentSeed();
  return readAll()
    .filter((a) => (opts?.siteId ? a.siteId === opts.siteId : true))
    .filter((a) => (opts?.employeeId ? a.employeeId === opts.employeeId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function assignOt(input: {
  employeeId: string;
  date: string;
  hours: number;
  reason: string;
  assignedBy: string;
  assignedByEmployeeId?: string;
  notes?: string;
}): OtAssignment {
  ensureOtAssignmentSeed();
  const emp = getEmployeeById(input.employeeId);
  if (!emp) throw new Error("Employee not found");
  const row: OtAssignment = {
    id: `ota-${Date.now().toString(36)}`,
    employeeId: emp.id,
    employeeName: emp.name,
    siteId: emp.siteId,
    date: input.date,
    hours: input.hours,
    reason: input.reason,
    assignedBy: input.assignedBy,
    assignedByEmployeeId: input.assignedByEmployeeId,
    status: "assigned",
    createdAt: new Date().toISOString(),
    notes: input.notes,
  };
  writeAll([row, ...readAll()]);
  pushNotification({
    employeeId: emp.id,
    kind: "ot_assign",
    title: "OT assignment",
    body: `${input.assignedBy} assigned you ${input.hours}h OT on ${input.date}: ${input.reason}`,
    href: "/notifications",
    meta: { assignmentId: row.id },
  });
  return row;
}

export function updateOtAssignmentStatus(
  id: string,
  status: OtAssignmentStatus,
) {
  writeAll(readAll().map((a) => (a.id === id ? { ...a, status } : a)));
  return readAll().find((a) => a.id === id);
}
