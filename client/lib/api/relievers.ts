import { apiClient } from './client';

export type RelieverData = {
  id: string;
  employeeId?: string;
  name: string;
  designation?: string;
  skills?: string[];
  skillTags?: string[];
  availability: 'available' | 'assigned' | 'deployed' | 'unavailable' | 'on_leave' | 'inactive';
  homeSiteId?: string;
  clusterId?: string;
  phone?: string;
  email?: string;
  currentAssignment?: any;
};

export async function getRelievers(status?: string): Promise<RelieverData[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiClient<RelieverData[]>(`/relievers${query}`);
}

export async function updateRelieverAvailability(
  id: string,
  availability: string,
): Promise<RelieverData> {
  return apiClient<RelieverData>(`/relievers/${encodeURIComponent(id)}/availability`, {
    method: 'PATCH',
    body: JSON.stringify({ availability }),
  });
}

export async function assignReliever(
  relieverId: string,
  siteId: string,
  absenceId?: string,
): Promise<RelieverData> {
  return apiClient<RelieverData>('/relievers/assign', {
    method: 'POST',
    body: JSON.stringify({ relieverId, siteId, absenceId }),
  });
}

export async function releaseReliever(opts: {
  relieverId?: string;
  absenceId?: string;
}): Promise<{ released?: number } | RelieverData> {
  return apiClient('/relievers/release', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}
