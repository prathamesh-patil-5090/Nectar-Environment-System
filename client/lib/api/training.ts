import { apiClient } from './client';
import type { Course, CourseEnrollment, Certificate } from '../training/types';

export async function getCourses(section?: string): Promise<Course[]> {
  const query = section ? `?section=${encodeURIComponent(section)}` : '';
  return apiClient<Course[]>(`/training/courses${query}`);
}

export async function getCourseById(id: string): Promise<Course> {
  return apiClient<Course>(`/training/courses/${encodeURIComponent(id)}`);
}

export async function getEnrollments(employeeId?: string): Promise<CourseEnrollment[]> {
  const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  return apiClient<CourseEnrollment[]>(`/training/enrollments${query}`);
}

export async function saveEnrollment(
  data: Partial<CourseEnrollment>,
): Promise<CourseEnrollment> {
  return apiClient<CourseEnrollment>('/training/enrollments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getRecords(employeeId?: string): Promise<any[]> {
  const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  return apiClient<any[]>(`/training/records${query}`);
}

export async function saveRecord(data: any): Promise<any> {
  return apiClient<any>('/training/records', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getCertificates(employeeId?: string): Promise<Certificate[]> {
  const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  return apiClient<Certificate[]>(`/training/certificates${query}`);
}

export async function getSessions(employeeId?: string): Promise<any[]> {
  const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  return apiClient<any[]>(`/training/sessions${query}`);
}
