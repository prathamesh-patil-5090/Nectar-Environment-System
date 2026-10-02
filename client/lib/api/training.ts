import { apiClient } from './client';
import type {
  Course,
  CourseEnrollment,
  Certificate,
  MentorLiveSession,
  CourseRecommendation,
  TrainingAssignment,
} from '../training/types';

export async function getCourses(section?: string): Promise<Course[]> {
  const query = section ? `?section=${encodeURIComponent(section)}` : '';
  return apiClient<Course[]>(`/training/courses${query}`);
}

export async function getCourseById(id: string): Promise<Course> {
  return apiClient<Course>(`/training/courses/${encodeURIComponent(id)}`);
}

export async function saveEnrollment(
  data: Partial<CourseEnrollment>,
): Promise<CourseEnrollment> {
  return apiClient<CourseEnrollment>('/training/enrollments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
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

// -------------------------------------------------------------------
// Executive & Plant Lead Masterclasses (Mentor Live Sessions)
// -------------------------------------------------------------------
export async function getMentorLiveSessions(): Promise<MentorLiveSession[]> {
  return apiClient<MentorLiveSession[]>('/training/mentor-sessions');
}

export async function enrollInLiveSession(
  sessionId: string,
  employeeId: string,
  employeeName: string,
  question?: string,
): Promise<MentorLiveSession> {
  return apiClient<MentorLiveSession>(
    `/training/mentor-sessions/${encodeURIComponent(sessionId)}/enroll`,
    {
      method: 'POST',
      body: JSON.stringify({ employeeId, employeeName, question }),
    },
  );
}

export async function cancelLiveSessionEnrollment(
  sessionId: string,
  employeeId: string,
): Promise<MentorLiveSession> {
  return apiClient<MentorLiveSession>(
    `/training/mentor-sessions/${encodeURIComponent(sessionId)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    },
  );
}

export async function submitSessionQuestion(
  sessionId: string,
  employeeId: string,
  employeeName: string,
  question: string,
): Promise<MentorLiveSession> {
  return apiClient<MentorLiveSession>(
    `/training/mentor-sessions/${encodeURIComponent(sessionId)}/questions`,
    {
      method: 'POST',
      body: JSON.stringify({ employeeId, employeeName, question }),
    },
  );
}

// -------------------------------------------------------------------
// 4-Tier Personalized Recommendation & Manager Assignments
// -------------------------------------------------------------------
export async function getRecommendedCourses(employeeId?: string): Promise<CourseRecommendation[]> {
  const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  return apiClient<CourseRecommendation[]>(`/training/recommendations${query}`);
}

export async function getTrainingAssignments(employeeId?: string): Promise<TrainingAssignment[]> {
  const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  return apiClient<TrainingAssignment[]>(`/training/assignments${query}`);
}

export async function createTrainingAssignment(
  data: Partial<TrainingAssignment>,
): Promise<TrainingAssignment> {
  return apiClient<TrainingAssignment>('/training/assignments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
