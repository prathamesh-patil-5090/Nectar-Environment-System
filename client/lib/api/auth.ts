import { apiClient } from './client';
import type { UserRole } from '@/lib/auth';

/** A login account as the server returns it (users collection, never the password). */
export type LoginAccount = {
  email: string;
  name: string;
  role: UserRole;
  siteId?: string;
  employeeId?: string;
  /** Heads of Department only. */
  departmentName?: string;
  isDeputy?: boolean;
};

export async function getLoginAccounts(role?: UserRole): Promise<LoginAccount[]> {
  return apiClient<LoginAccount[]>(`/auth/accounts${role ? `?role=${encodeURIComponent(role)}` : ''}`);
}

export async function loginWithServer(email: string, password: string): Promise<LoginAccount> {
  return apiClient<LoginAccount>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
