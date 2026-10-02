import { apiClient } from './client';
import type { LeaveRequest } from '../leave/types';

export type LeavePolicyResult = {
  verdict: 'PASS' | 'WARN' | 'BLOCK';
  flags: Array<{
    code: string;
    severity: 'warn' | 'block';
    message: string;
  }>;
  daysRequested: number;
  balanceSnapshot?: {
    leaveType: string;
    available: number;
    afterRequest: number;
  };
  suggestions?: string[];
};

export type LeavePolicyConfig = {
  id: string;
  allowedLeaveTypes: string[];
  noticeDays: number;
  noticeSeverity: 'warn' | 'block';
  halfDayAllowed: boolean;
  restrictedPeriods: Array<{
    id: string;
    label: string;
    startDate: string;
    endDate: string;
  }>;
  active?: boolean;
};

export type ValidateLeaveInput = {
  employeeId: string;
  mode: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  expectedReturnDate?: string;
  entrySource?: string;
  isHalfDay?: boolean;
  halfDaySlot?: string;
  asOfDate?: string;
};

export async function getLeaves(params?: {
  siteId?: string;
  employeeId?: string;
}): Promise<LeaveRequest[]> {
  const searchParams = new URLSearchParams();
  if (params?.siteId) searchParams.set('siteId', params.siteId);
  if (params?.employeeId) searchParams.set('employeeId', params.employeeId);
  const q = searchParams.toString();
  return apiClient<LeaveRequest[]>(`/leaves${q ? `?${q}` : ''}`);
}

export async function getLeaveById(id: string): Promise<LeaveRequest> {
  return apiClient<LeaveRequest>(`/leaves/${encodeURIComponent(id)}`);
}

export async function createLeave(
  data: Partial<LeaveRequest>,
): Promise<LeaveRequest> {
  return apiClient<LeaveRequest>('/leaves', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateLeaveStatus(
  id: string,
  status: string,
  meta?: Record<string, unknown>,
): Promise<LeaveRequest> {
  return apiClient<LeaveRequest>(`/leaves/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...meta }),
  });
}

export async function validateLeave(
  input: ValidateLeaveInput,
): Promise<LeavePolicyResult> {
  return apiClient<LeavePolicyResult>('/leaves/validate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
