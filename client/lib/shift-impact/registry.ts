import type { Employee } from "@/lib/mock-data";
import type { SkillTag } from "@/lib/reliever/pool";
import type { PlannedShiftDay, ShiftCode, ShiftMaster } from "@/lib/shift/types";

export type LeaveRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId: string;
  shiftId: string;
  startDate: string;
  endDate: string;
  status: string;
  assignedRelieverId?: string;
  assignedCoverEmployeeId?: string;
  coverSource?: string;
  replacementPlan?: string;
};

export type RelieverRow = {
  id: string;
  employeeId?: string;
  name: string;
  phone: string;
  clusterId: string;
  homeSiteId?: string;
  skills: SkillTag[];
  plantTypes: string[];
  availability: string;
};

export type ClusterRow = {
  id: string;
  siteIds: string[];
};

export type SiteRow = {
  id: string;
  name: string;
  plantType: string;
  headcount: number;
};

type LeaveApi = {
  getLeaveRequests: (siteId?: string, employeeId?: string) => LeaveRow[];
  getLeaveById: (id: string) => LeaveRow | undefined;
};

type ShiftApi = {
  getPlannedDays: (opts?: {
    siteId?: string;
    employeeId?: string;
    from?: string;
    to?: string;
  }) => PlannedShiftDay[];
  getPlannedShiftForLeave: (
    employeeId: string,
    startDate: string,
    endDate: string,
  ) => PlannedShiftDay[];
  shiftMaster: ShiftMaster[];
  getShiftByCode: (code: ShiftCode) => ShiftMaster | undefined;
};

type PoolApi = {
  getClusterForSite: (siteId: string) => ClusterRow | undefined;
  getRelievers: (clusterId?: string) => RelieverRow[];
  sites: SiteRow[];
};

type CoverageApi = {
  employeeHasCoveringLeave: (employeeId: string, date: string) => boolean;
};

let leaveApi: LeaveApi | null = null;
let shiftApi: ShiftApi | null = null;
let poolApi: PoolApi | null = null;
let coverageApi: CoverageApi | null = null;

export function registerLeaveApi(api: LeaveApi) {
  leaveApi = api;
}

export function registerShiftApi(api: ShiftApi) {
  shiftApi = api;
}

export function registerPoolApi(api: PoolApi) {
  poolApi = api;
}

export function registerCoverageApi(api: CoverageApi) {
  coverageApi = api;
}

export function getLeaveApi(): LeaveApi {
  if (!leaveApi) {
    throw new Error("Shift Impact leave API is not registered");
  }
  return leaveApi;
}

export function getShiftApi(): ShiftApi {
  if (!shiftApi) {
    throw new Error("Shift Impact shift API is not registered");
  }
  return shiftApi;
}

export function getPoolApi(): PoolApi {
  if (!poolApi) {
    throw new Error("Shift Impact pool API is not registered");
  }
  return poolApi;
}

export function getCoverageApi(): CoverageApi {
  if (!coverageApi) {
    return { employeeHasCoveringLeave: () => false };
  }
  return coverageApi;
}

export type { Employee };
