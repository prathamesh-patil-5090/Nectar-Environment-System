import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Course,
  CourseDocument,
  TrainingRecord,
  TrainingRecordDocument,
  Certificate,
  CertificateDocument,
  TrainingSession,
  TrainingSessionDocument,
  MentorLiveSession,
  MentorLiveSessionDocument,
  TrainingAssignment,
  TrainingAssignmentDocument,
  RolePath,
  RolePathDocument,
} from '../../../db/schemas/training';
import { NotificationsService } from '../notifications/notifications.service';
import { PeopleService } from './people.service';

/** 'assigned' is the legacy open status. */
const OPEN_STATUSES = ['open', 'in_progress', 'assigned'];
import { Employee, EmployeeDocument } from '../../../db/schemas/employee.schema';

@Injectable()
export class TrainingService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(TrainingRecord.name)
    private recordModel: Model<TrainingRecordDocument>,
    @InjectModel(Certificate.name)
    private certModel: Model<CertificateDocument>,
    @InjectModel(TrainingSession.name)
    private sessionModel: Model<TrainingSessionDocument>,
    @InjectModel(MentorLiveSession.name)
    private mentorSessionModel: Model<MentorLiveSessionDocument>,
    @InjectModel(TrainingAssignment.name)
    private assignmentModel: Model<TrainingAssignmentDocument>,
    @InjectModel(Employee.name)
    private employeeModel: Model<EmployeeDocument>,
    @InjectModel(RolePath.name)
    private rolePathModel: Model<RolePathDocument>,
    private readonly people: PeopleService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAllCourses(section?: string): Promise<Course[]> {
    const filter = section ? { section } : {};
    return this.courseModel.find(filter).lean().exec();
  }

  // -------------------------------------------------------------------
  // Manager assignments & weak-area flags
  // -------------------------------------------------------------------
  async findAssignments(q: {
    employeeId?: string;
    assignedBy?: string;
    kind?: string;
    status?: string;
  } = {}): Promise<TrainingAssignment[]> {
    const filter: Record<string, unknown> = {};
    if (q.employeeId) filter.employeeId = q.employeeId;
    if (q.assignedBy) filter.assignedByEmployeeId = q.assignedBy;
    if (q.kind) filter.kind = q.kind;
    if (q.status === 'open') filter.status = { $in: OPEN_STATUSES };
    else if (q.status) filter.status = q.status;
    return this.assignmentModel.find(filter).sort({ createdAt: -1 }).lean().exec();
  }

  /** One row per employee. Mandatory needs a course and a due date; a suggestion needs a course, topic or skills. */
  async createAssignments(data: Partial<TrainingAssignment> & { employeeIds?: string[] }): Promise<TrainingAssignment[]> {
    const employeeIds = data.employeeIds?.length ? data.employeeIds : data.employeeId ? [data.employeeId] : [];
    if (!employeeIds.length) throw new BadRequestException('employeeIds is required');
    if (!data.assignedByEmployeeId) throw new BadRequestException('assignedByEmployeeId is required');
    const kind = data.kind === 'suggested' ? 'suggested' : 'mandatory';
    if (kind === 'mandatory' && (!data.courseId || !data.dueDate)) {
      throw new BadRequestException('Mandatory training needs a course and a due date');
    }
    if (!data.courseId && !data.topic?.trim() && !data.skills?.length) {
      throw new BadRequestException('Pick a course, or describe the weak topic');
    }
    const reason = data.reason?.trim();
    if (!reason) throw new BadRequestException('A reason is required');

    const people = await this.people.many([...employeeIds, data.assignedByEmployeeId]);
    const flagger = people.get(data.assignedByEmployeeId);
    if (!flagger) throw new BadRequestException(`Employee ${data.assignedByEmployeeId} not found`);
    const course = data.courseId
      ? await this.courseModel.findOne({ $or: [{ id: data.courseId }, { code: data.courseId }] }).lean().exec()
      : null;
    if (data.courseId && !course) throw new BadRequestException(`Course ${data.courseId} not found`);

    // Only the Director, or the employee's allotted manager, can assign or flag
    for (const employeeId of employeeIds) {
      const target = people.get(employeeId);
      if (!target) throw new BadRequestException(`Employee ${employeeId} not found`);
      if (flagger.role !== 'director' && target.managerId !== flagger.id) {
        throw new ForbiddenException(`${flagger.name} is not ${target.name}'s manager`);
      }
    }

    const rows: TrainingAssignment[] = [];
    for (const employeeId of employeeIds) {
      const row = await this.assignmentModel.create({
        id: `asgn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        employeeId,
        assignedByEmployeeId: flagger.id,
        assignedByName: flagger.name,
        courseId: course?.id,
        moduleId: data.moduleId,
        reason,
        priority: data.priority ?? 'normal',
        status: 'open',
        dueDate: data.dueDate,
        kind,
        topic: data.topic?.trim(),
        skills: data.skills ?? [],
        abilityIds: data.abilityIds ?? [],
        source: data.source ?? 'manager',
      });
      rows.push(row.toObject());
      const what = course ? course.title : data.topic?.trim() || (data.skills ?? []).join(', ');
      await this.notifications.notify({
        employeeId,
        kind: kind === 'mandatory' ? 'training_assigned' : 'training_flagged',
        title:
          kind === 'mandatory'
            ? `${flagger.name} assigned you: ${what}`
            : `${flagger.name} suggests more training on ${what}`,
        body: `${reason}${data.dueDate ? ` · Due ${data.dueDate}` : ''}`,
        href: course ? `/training/course/${course.id}` : '/training',
        meta: { assignmentId: row.id },
      });
    }
    return rows;
  }

  async updateAssignment(id: string, patch: Partial<TrainingAssignment>, actorId: string) {
    const row = await this.assignmentModel.findOne({ id }).lean().exec();
    if (!row) throw new NotFoundException(`Assignment ${id} not found`);
    if (row.assignedByEmployeeId !== actorId) throw new ForbiddenException('Only the person who created this can edit it');
    const allowed: Record<string, unknown> = {};
    for (const k of ['reason', 'priority', 'dueDate', 'topic', 'skills', 'courseId'] as const) {
      if (patch[k] !== undefined) allowed[k] = patch[k];
    }
    return this.assignmentModel.findOneAndUpdate({ id }, allowed, { new: true }).lean().exec();
  }

  /** resolved (training done) or dismissed (no longer needed). Resolution notifies the flagger. */
  async closeAssignment(id: string, status: 'resolved' | 'dismissed', actorId: string) {
    const row = await this.assignmentModel.findOne({ id }).lean().exec();
    if (!row) throw new NotFoundException(`Assignment ${id} not found`);
    if (!OPEN_STATUSES.includes(row.status)) throw new BadRequestException('This item is already closed');
    if (status === 'dismissed' && row.assignedByEmployeeId !== actorId) {
      throw new ForbiddenException('Only the person who created this can dismiss it');
    }
    const updated = await this.assignmentModel
      .findOneAndUpdate({ id }, { status, resolvedAt: new Date().toISOString(), resolvedBy: actorId }, { new: true })
      .lean()
      .exec();
    if (status === 'resolved') {
      const learner = await this.people.one(row.employeeId);
      await this.notifications.notify({
        employeeId: row.assignedByEmployeeId,
        kind: 'training_flag_resolved',
        title: `${learner?.name ?? row.employeeId} completed: ${row.topic || row.courseId}`,
        body: row.reason,
        href: `/employees/${row.employeeId}`,
        meta: { assignmentId: id },
      });
    }
    return updated;
  }

  // -------------------------------------------------------------------
  // Role paths
  // -------------------------------------------------------------------
  async findRolePaths(q: { role?: string; designation?: string; plantType?: string }) {
    const filter: Record<string, unknown> = {};
    if (q.role) filter.role = q.role;
    const and: Record<string, unknown>[] = [];
    const anyOr = (field: string, value: string) => ({
      $or: [{ [field]: value }, { [field]: { $exists: false } }, { [field]: '' }],
    });
    if (q.designation) and.push(anyOr('designation', q.designation));
    if (q.plantType) and.push(anyOr('plantType', q.plantType));
    if (and.length) filter.$and = and;
    return this.rolePathModel.find(filter).lean().exec();
  }

  /** Course authoring: assessment content and certificate settings. Only HR or the Director. */
  async updateCourseContent(
    id: string,
    body: {
      actorId: string;
      skillMappingQuestions?: unknown[];
      writtenTestQuestions?: unknown[];
      microQuizzes?: Record<string, { passThreshold?: number; questions: unknown[] }>;
      certificateValidityMonths?: number;
      passThreshold?: number;
      skills?: string[];
      audience?: Course['audience'];
    },
  ): Promise<Course> {
    const actor = await this.people.one(body.actorId);
    if (!actor || !['hr', 'director'].includes(actor.role)) {
      throw new ForbiddenException('Only HR or the Director can edit course content');
    }
    const course = await this.courseModel.findOne({ $or: [{ id }, { code: id }] }).exec();
    if (!course) throw new NotFoundException(`Course ${id} not found`);
    const validQ = (qs: unknown[]) =>
      qs.every((q: any) => q?.id && q?.text && Array.isArray(q.options) && q.options.some((o: any) => o.id === q.correctOptionId));
    for (const qs of [body.skillMappingQuestions, body.writtenTestQuestions, ...Object.values(body.microQuizzes ?? {}).map((m) => m.questions)]) {
      if (qs && !validQ(qs)) throw new BadRequestException('Each question needs id, text, options and a correctOptionId that is one of the options');
    }
    if (body.skillMappingQuestions) course.skillMappingQuestions = body.skillMappingQuestions as any[];
    if (body.writtenTestQuestions) course.writtenTestQuestions = body.writtenTestQuestions as any[];
    if (body.certificateValidityMonths !== undefined) {
      if (![6, 12].includes(body.certificateValidityMonths)) throw new BadRequestException('Validity is 6 or 12 months');
      course.certificateValidityMonths = body.certificateValidityMonths;
    }
    if (body.passThreshold !== undefined) course.passThreshold = body.passThreshold;
    if (body.skills) course.skills = body.skills;
    if (body.audience) course.audience = body.audience;
    if (body.microQuizzes) {
      course.abilities = course.abilities.map((a) =>
        body.microQuizzes![a.id]
          ? { ...a, microQuiz: { id: `mq-${a.id}`, abilityId: a.id, passThreshold: body.microQuizzes![a.id].passThreshold ?? 70, questions: body.microQuizzes![a.id].questions as any[] } }
          : a,
      );
      course.markModified('abilities');
    }
    await course.save();
    return course.toObject();
  }

  async findCourseById(id: string): Promise<Course> {
    const course = await this.courseModel
      .findOne({ $or: [{ id }, { code: id }] })
      .lean()
      .exec();
    if (!course) throw new NotFoundException(`Course ${id} not found`);
    return course;
  }

  async findRecords(employeeId?: string): Promise<TrainingRecord[]> {
    const filter = employeeId ? { employeeId } : {};
    return this.recordModel.find(filter).lean().exec();
  }

  async saveRecord(data: Partial<TrainingRecord>): Promise<TrainingRecord> {
    return this.recordModel
      .findOneAndUpdate({ id: data.id }, data, { upsert: true, new: true })
      .lean()
      .exec();
  }

  // Backward compatibility alias for enrollments
  async findEnrollments(employeeId?: string): Promise<any[]> {
    return this.findRecords(employeeId);
  }

  async saveEnrollment(data: any): Promise<any> {
    return this.saveRecord(data);
  }

  async findCertificates(employeeId?: string): Promise<Certificate[]> {
    const filter = employeeId ? { employeeId } : {};
    return this.certModel.find(filter).lean().exec();
  }

  /** Schedule an on-site practical / oral slot (Director or the candidates' manager). */
  async createSession(data: Partial<TrainingSession> & { actorId: string }): Promise<TrainingSession> {
    const actor = await this.people.one(data.actorId);
    if (!actor || !['manager', 'director'].includes(actor.role)) {
      throw new ForbiddenException('Only managers or the Director can schedule assessments');
    }
    if (!data.title?.trim() || !data.scheduledAt || !data.employeeIds?.length) {
      throw new BadRequestException('title, scheduledAt and employeeIds are required');
    }
    const row = await this.sessionModel.create({
      id: `sess-${Date.now().toString(36)}`,
      title: data.title.trim(),
      type: data.type ?? 'PRACTICAL',
      scheduledBy: actor.id,
      scheduledByName: actor.name,
      scheduledAt: data.scheduledAt,
      venueOrLink: data.venueOrLink ?? '',
      employeeIds: data.employeeIds,
      courseId: data.courseId,
      status: 'scheduled',
    });
    await this.notifications.notifyMany(
      data.employeeIds.map((employeeId) => ({
        employeeId,
        kind: 'assessment_scheduled',
        title: `Assessment scheduled: ${row.title}`,
        body: `${new Date(row.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · ${row.venueOrLink || 'Venue to be shared'} · by ${actor.name}`,
        href: '/training/my-learning',
        meta: { sessionId: row.id },
      })),
    );
    return row.toObject();
  }

  async findSessions(employeeId?: string): Promise<TrainingSession[]> {
    const filter = employeeId ? { employeeIds: employeeId } : {};
    return this.sessionModel.find(filter).lean().exec();
  }

  // -------------------------------------------------------------------
  // Executive & Plant Lead Masterclasses (Mentor Live Sessions)
  // -------------------------------------------------------------------
  async findAllMentorLiveSessions(): Promise<MentorLiveSession[]> {
    return this.mentorSessionModel.find().lean().exec();
  }

  async findMentorLiveSessionById(id: string): Promise<MentorLiveSession> {
    const session = await this.mentorSessionModel.findOne({ id }).lean().exec();
    if (!session) throw new NotFoundException(`Masterclass ${id} not found`);
    return session;
  }

  async enrollInMentorLiveSession(
    sessionId: string,
    employeeId: string,
    employeeName: string,
    question?: string,
  ): Promise<MentorLiveSession> {
    const session = await this.mentorSessionModel.findOne({ id: sessionId }).exec();
    if (!session) throw new NotFoundException(`Masterclass ${sessionId} not found`);

    if (session.enrolledEmployeeIds.includes(employeeId)) {
      if (question?.trim()) {
        session.questions.push({
          id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          employeeId,
          employeeName: employeeName || 'Employee',
          question: question.trim(),
          submittedAt: new Date().toISOString(),
        });
        await session.save();
      }
      return session.toObject();
    }

    if (session.registeredCount >= session.maxCapacity) {
      throw new BadRequestException(
        `This masterclass is at maximum capacity (${session.maxCapacity} seats). No more slots available.`,
      );
    }

    session.enrolledEmployeeIds.push(employeeId);
    session.registeredCount = session.enrolledEmployeeIds.length;

    if (question?.trim()) {
      session.questions.push({
        id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        employeeId,
        employeeName: employeeName || 'Employee',
        question: question.trim(),
        submittedAt: new Date().toISOString(),
      });
    }

    await session.save();
    return session.toObject();
  }

  async cancelMentorLiveSession(
    sessionId: string,
    employeeId: string,
  ): Promise<MentorLiveSession> {
    const session = await this.mentorSessionModel.findOne({ id: sessionId }).exec();
    if (!session) throw new NotFoundException(`Masterclass ${sessionId} not found`);

    session.enrolledEmployeeIds = session.enrolledEmployeeIds.filter((e) => e !== employeeId);
    session.registeredCount = session.enrolledEmployeeIds.length;
    await session.save();
    return session.toObject();
  }

  async addQuestionToMentorSession(
    sessionId: string,
    employeeId: string,
    employeeName: string,
    question: string,
  ): Promise<MentorLiveSession> {
    const session = await this.mentorSessionModel.findOne({ id: sessionId }).exec();
    if (!session) throw new NotFoundException(`Masterclass ${sessionId} not found`);

    session.questions.push({
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      employeeId,
      employeeName: employeeName || 'Employee',
      question: question.trim(),
      submittedAt: new Date().toISOString(),
    });

    await session.save();
    return session.toObject();
  }
}
