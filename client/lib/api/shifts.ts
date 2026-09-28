import { apiClient } from './client';
import type { RotationPreview, ShiftChangeRequest } from '../shift/types';

export async function getRosters(siteId?: string): Promise<RotationPreview[]> {
  const query = siteId ? `?siteId=${encodeURIComponent(siteId)}` : '';
  return apiClient<RotationPreview[]>(`/shifts/rosters${query}`);
}

export async function getRosterById(id: string): Promise<RotationPreview> {
  return apiClient<RotationPreview>(`/shifts/rosters/${encodeURIComponent(id)}`);
}

export async function createRoster(
  data: Partial<RotationPreview>,
): Promise<RotationPreview> {
  return apiClient<RotationPreview>('/shifts/rosters', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRoster(
  id: string,
  data: Partial<RotationPreview>,
): Promise<RotationPreview> {
  return apiClient<RotationPreview>(`/shifts/rosters/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getChangeRequests(siteId?: string): Promise<ShiftChangeRequest[]> {
  const query = siteId ? `?siteId=${encodeURIComponent(siteId)}` : '';
  return apiClient<ShiftChangeRequest[]>(`/shifts/change-requests${query}`);
}

export async function createChangeRequest(
  data: Partial<ShiftChangeRequest>,
): Promise<ShiftChangeRequest> {
  return apiClient<ShiftChangeRequest>('/shifts/change-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateChangeRequest(
  id: string,
  data: Partial<ShiftChangeRequest>,
): Promise<ShiftChangeRequest> {
  return apiClient<ShiftChangeRequest>(`/shifts/change-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
