import { apiClient } from './client';
import type {
  Course,
  CourseEnrollment,
  Certificate,
  TrainingAssignment,
  TrainingSession,
  TrainingEvent,
  EventAttendee,
  EventPost,
  Community,
  MentorProfileRecord,
  Person,
  Recommendation,
  TrainingFeed,
  CatalogItem,
  PendingEvaluation,
  ServerNotification,
  RolePath,
  AbilityScore,
  SkillMappingResult,
  WrittenTestResult,
  PracticalTestResult,
  OralTestResult,
  RsvpStatus,
} from '../training/types';

const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : '';
};
const post = <T>(path: string, body?: unknown) =>
  apiClient<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
const patch = <T>(path: string, body?: unknown) =>
  apiClient<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) });
const id = encodeURIComponent;

// ----- Courses -----
export const getCourses = (section?: string) => apiClient<Course[]>(`/training/courses${q({ section })}`);
export const getCourseById = (courseId: string) => apiClient<Course>(`/training/courses/${id(courseId)}`);
export const getCatalog = (employeeId?: string) => apiClient<CatalogItem[]>(`/training/catalog${q({ employeeId })}`);
export const updateCourseContent = (courseId: string, body: Record<string, unknown> & { actorId: string }) =>
  patch<Course>(`/training/courses/${id(courseId)}/content`, body);

// ----- Personal feed & recommendations -----
export const getTrainingFeed = (employeeId: string) => apiClient<TrainingFeed>(`/training/feed${q({ employeeId })}`);
export const getRecommendations = (employeeId: string) =>
  apiClient<Recommendation[]>(`/training/recommendations${q({ employeeId })}`);
export const getRolePaths = (role?: string, designation?: string, plantType?: string) =>
  apiClient<RolePath[]>(`/training/role-paths${q({ role, designation, plantType })}`);

// ----- Enrollments & assessment gates (scored on the server) -----
export const getEnrollments = (employeeId?: string, courseId?: string) =>
  apiClient<CourseEnrollment[]>(`/training/enrollments${q({ employeeId, courseId })}`);
export const enroll = (employeeId: string, courseId: string) =>
  post<CourseEnrollment>('/training/enrollments', { employeeId, courseId });
export const postVideoProgress = (enrollmentId: string, abilityId: string, watchedPct: number) =>
  post<CourseEnrollment>(`/training/enrollments/${id(enrollmentId)}/video`, { abilityId, watchedPct });
export const postReading = (enrollmentId: string, abilityId: string) =>
  post<CourseEnrollment>(`/training/enrollments/${id(enrollmentId)}/reading`, { abilityId });
export const postMicroQuiz = (enrollmentId: string, abilityId: string, answers: Record<string, string>) =>
  post<{ scorePct: number; passed: boolean; enrollment: CourseEnrollment }>(
    `/training/enrollments/${id(enrollmentId)}/quiz`,
    { abilityId, answers },
  );
type GateResponse<R> = { result: R; certificate: Certificate | null; enrollment: CourseEnrollment };
export const postSkillMap = (enrollmentId: string, answers: Record<string, string>) =>
  post<GateResponse<SkillMappingResult>>(`/training/enrollments/${id(enrollmentId)}/skill-map`, { answers });
export const postWritten = (enrollmentId: string, answers: Record<string, string>) =>
  post<GateResponse<WrittenTestResult>>(`/training/enrollments/${id(enrollmentId)}/written`, { answers });
export const postPractical = (enrollmentId: string, evaluatorId: string, scores: AbilityScore[], notes?: string) =>
  post<GateResponse<PracticalTestResult>>(`/training/enrollments/${id(enrollmentId)}/practical`, { evaluatorId, scores, notes });
export const postOral = (enrollmentId: string, evaluatorId: string, scores: AbilityScore[], notes?: string) =>
  post<GateResponse<OralTestResult>>(`/training/enrollments/${id(enrollmentId)}/oral`, { evaluatorId, scores, notes });
export const getPendingEvaluations = (evaluatorId?: string, siteId?: string) =>
  apiClient<PendingEvaluation[]>(`/training/pending-evaluations${q({ evaluatorId, siteId })}`);

// ----- Certificates & assessment schedule -----
export const getCertificates = (employeeId?: string) =>
  apiClient<Certificate[]>(`/training/certificates${q({ employeeId })}`);
export const getSessions = (employeeId?: string) => apiClient<TrainingSession[]>(`/training/sessions${q({ employeeId })}`);
export const createSession = (body: Partial<TrainingSession> & { actorId: string }) =>
  post<TrainingSession>('/training/sessions', body);

// ----- Assignments & weak-area flags -----
export const getTrainingAssignments = (filter: { employeeId?: string; assignedBy?: string; kind?: string; status?: string } = {}) =>
  apiClient<TrainingAssignment[]>(`/training/assignments${q(filter)}`);
export const createTrainingAssignments = (
  body: Partial<TrainingAssignment> & { employeeIds: string[]; assignedByEmployeeId: string },
) => post<TrainingAssignment[]>('/training/assignments', body);
export const updateTrainingAssignment = (assignmentId: string, body: Partial<TrainingAssignment> & { actorId: string }) =>
  patch<TrainingAssignment>(`/training/assignments/${id(assignmentId)}`, body);
export const resolveTrainingAssignment = (assignmentId: string, actorId: string) =>
  post<TrainingAssignment>(`/training/assignments/${id(assignmentId)}/resolve`, { actorId });
export const dismissTrainingAssignment = (assignmentId: string, actorId: string) =>
  post<TrainingAssignment>(`/training/assignments/${id(assignmentId)}/dismiss`, { actorId });

// ----- Events (Meetup model) -----
export type EventsView = 'upcoming' | 'going' | 'past' | 'hosting';
export type EventInput = Partial<
  Pick<
    TrainingEvent,
    | 'title' | 'type' | 'description' | 'agenda' | 'topics' | 'audience' | 'coverUrl' | 'communityId'
    | 'hostEmployeeIds' | 'startsAt' | 'endsAt' | 'format' | 'meetLink' | 'venue' | 'capacity'
    | 'waitlistEnabled' | 'rsvpOpensAt' | 'rsvpClosesAt' | 'rsvpQuestion' | 'recordingUrl'
  >
> & { publish?: boolean; repeat?: { every: 'week' | 'month'; count: number } };

export const getEvents = (params: {
  viewerId?: string; view?: EventsView; communityId?: string; hostId?: string; format?: string; topic?: string; from?: string; to?: string;
}) => apiClient<TrainingEvent[]>(`/training/events${q(params)}`);
export const getEvent = (eventId: string, viewerId?: string) =>
  apiClient<TrainingEvent>(`/training/events/${id(eventId)}${q({ viewerId })}`);
export const getSimilarEvents = (eventId: string, viewerId?: string) =>
  apiClient<TrainingEvent[]>(`/training/events/${id(eventId)}/similar${q({ viewerId })}`);
export const createEvent = (body: EventInput, actorId: string) =>
  post<TrainingEvent[]>('/training/events', { ...body, actorId });
export const updateEvent = (eventId: string, body: EventInput, actorId: string) =>
  patch<TrainingEvent>(`/training/events/${id(eventId)}`, { ...body, actorId });
export const publishEvent = (eventId: string, actorId: string) =>
  post<TrainingEvent>(`/training/events/${id(eventId)}/publish`, { actorId });
export const cancelEvent = (eventId: string, reason: string, actorId: string) =>
  post<TrainingEvent>(`/training/events/${id(eventId)}/cancel`, { actorId, reason });
export const duplicateEvent = (eventId: string, actorId: string) =>
  post<TrainingEvent>(`/training/events/${id(eventId)}/duplicate`, { actorId });
export const rsvpEvent = (eventId: string, employeeId: string, answer?: string) =>
  post<TrainingEvent>(`/training/events/${id(eventId)}/rsvp`, { employeeId, answer });
export const cancelRsvp = (eventId: string, employeeId: string) =>
  post<TrainingEvent>(`/training/events/${id(eventId)}/rsvp/cancel`, { employeeId });
export const getEventAttendees = (eventId: string, viewerId?: string) =>
  apiClient<EventAttendee[]>(`/training/events/${id(eventId)}/attendees${q({ viewerId })}`);
export const updateAttendee = (eventId: string, rsvpId: string, status: RsvpStatus, actorId: string) =>
  patch<EventAttendee[]>(`/training/events/${id(eventId)}/attendees/${id(rsvpId)}`, { status, actorId });
export const getEventPosts = (eventId: string) => apiClient<EventPost[]>(`/training/events/${id(eventId)}/posts`);
export const addEventPost = (eventId: string, authorEmployeeId: string, text: string, kind: EventPost['kind'] = 'comment') =>
  post<EventPost[]>(`/training/events/${id(eventId)}/posts`, { authorEmployeeId, text, kind });
export const pinEventPost = (eventId: string, postId: string, pinned: boolean, actorId: string) =>
  patch<EventPost[]>(`/training/events/${id(eventId)}/posts/${id(postId)}`, { pinned, actorId });
export const getTrainingHours = (employeeId: string) =>
  apiClient<{ employeeId: string; eventsAttended: number; hours: number; events: { id: string; title: string; startsAt: string; endsAt: string }[] }>(
    `/training/events-hours/${id(employeeId)}`,
  );

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const eventCalendarUrl = (eventId: string) => `${API_BASE}/training/events/${id(eventId)}/calendar.ics`;
export const eventAttendeesCsvUrl = (eventId: string, actorId: string) =>
  `${API_BASE}/training/events/${id(eventId)}/attendees.csv${q({ actorId })}`;

// ----- Communities & mentors -----
export const getCommunities = (viewerId?: string) => apiClient<Community[]>(`/training/communities${q({ viewerId })}`);
export const getCommunity = (slug: string, viewerId?: string) =>
  apiClient<Community>(`/training/communities/${id(slug)}${q({ viewerId })}`);
export const getCommunityMembers = (slug: string) => apiClient<Person[]>(`/training/communities/${id(slug)}/members`);
export const joinCommunity = (slug: string, employeeId: string) =>
  post<Community>(`/training/communities/${id(slug)}/join`, { employeeId });
export const leaveCommunity = (slug: string, employeeId: string) =>
  post<Community>(`/training/communities/${id(slug)}/leave`, { employeeId });
export const createCommunity = (body: Partial<Community> & { autoJoin?: { roles?: string[]; plantTypes?: string[] } }) =>
  post<Community>('/training/communities', body);
export const getMentors = (all = false) => apiClient<MentorProfileRecord[]>(`/training/mentors${all ? '?all=1' : ''}`);
export const getMentor = (employeeId: string) => apiClient<MentorProfileRecord>(`/training/mentors/${id(employeeId)}`);
export const upsertMentor = (employeeId: string, body: Partial<MentorProfileRecord>) =>
  patch<MentorProfileRecord>(`/training/mentors/${id(employeeId)}`, body);

// ----- Notifications (server) -----
export const getServerNotifications = (employeeId: string) =>
  apiClient<ServerNotification[]>(`/notifications${q({ employeeId })}`);
export const markServerNotificationRead = (notificationId: string) =>
  patch<ServerNotification>(`/notifications/${id(notificationId)}/read`);
export const markAllServerNotificationsRead = (employeeId: string) =>
  patch<{ updated: number }>('/notifications/read-all', { employeeId });

export type EventAttendanceRow = {
  id: string; title: string; status: string; startsAt: string; format: string; capacity: number;
  host: string; community?: string; going: number; waitlist: number; attended: number; noShow: number; cancelled: number;
};
export const getEventsReport = (from?: string, to?: string) =>
  apiClient<EventAttendanceRow[]>(`/training/events-report${q({ from, to })}`);
