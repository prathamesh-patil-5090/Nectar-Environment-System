import type { ShiftConflict } from "@/lib/shift/types";
import type { RotationAssignmentCell } from "@/lib/shift/types";

type LeaveRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId: string;
  startDate: string;
  endDate: string;
  status: string;
  assignedRelieverId?: string;
  assignedCoverEmployeeId?: string;
  coverSource?: string;
};

type Sources = {
  detectConflicts: (siteId?: string) => ShiftConflict[];
  validateScheduleAssignments: (
    siteId: string,
    assignments: RotationAssignmentCell[],
  ) => ShiftConflict[];
  getLeaveById: (id: string) => LeaveRow | undefined;
  getLeaveRequests: (siteId?: string) => LeaveRow[];
  getPlantOverlappingLeaves: (leaveId: string) => LeaveRow[];
};

let sources: Sources | null = null;

export function registerManpowerSources(api: Sources) {
  sources = api;
}

export function getManpowerSources(): Sources {
  if (!sources) {
    throw new Error("Manpower conflict sources are not registered");
  }
  return sources;
}
