import { apiClient } from './client';
import type { Employee } from '../types/employee.types';

export async function getEmployees(siteId?: string): Promise<Employee[]> {
  const query = siteId ? `?siteId=${encodeURIComponent(siteId)}` : '';
  return apiClient<Employee[]>(`/employees${query}`);
}

export async function getEmployeeById(id: string): Promise<Employee> {
  return apiClient<Employee>(`/employees/${encodeURIComponent(id)}`);
}

export async function getEmployeesCount(siteId?: string): Promise<{ count: number }> {
  const query = siteId ? `?siteId=${encodeURIComponent(siteId)}` : '';
  return apiClient<{ count: number }>(`/employees/count${query}`);
}

export async function updateEmployee(
  id: string,
  data: Partial<Employee>,
): Promise<Employee> {
  return apiClient<Employee>(`/employees/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
