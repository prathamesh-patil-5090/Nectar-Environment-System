import { apiClient } from './client';
import type { Site } from '../types/site.types';

export async function getSites(siteId?: string): Promise<Site[]> {
  const query = siteId ? `?siteId=${encodeURIComponent(siteId)}` : '';
  return apiClient<Site[]>(`/sites${query}`);
}

export async function getSiteById(id: string): Promise<Site> {
  return apiClient<Site>(`/sites/${encodeURIComponent(id)}`);
}
