import { apiClient } from './client';
import type { LeaveRequest } from '../leave/types';

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
  meta?: Record<string, any>,
): Promise<LeaveRequest> {
  return apiClient<LeaveRequest>(`/leaves/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...meta }),
  });
}
