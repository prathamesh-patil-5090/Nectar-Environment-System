import { apiClient } from './client';
import type { Meeting } from '../meetings/types';

// Meetings API — placeholder; server endpoint returns an empty list until implemented.

export async function getMeetings(): Promise<Meeting[]> {
  return apiClient<Meeting[]>('/meetings');
}
