import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
} from '../../../db/schemas/training';
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
  ) {}

  async findAllCourses(section?: string): Promise<Course[]> {
    const filter = section ? { section } : {};
    return this.courseModel.find(filter).lean().exec();
  }

  // -------------------------------------------------------------------
  // Manager Training Directives & Assignments
  // -------------------------------------------------------------------
  async findAssignments(employeeId?: string): Promise<TrainingAssignment[]> {
    const filter = employeeId ? { employeeId } : {};
    return this.assignmentModel.find(filter).sort({ createdAt: -1 }).lean().exec();
  }

  async createAssignment(data: Partial<TrainingAssignment>): Promise<TrainingAssignment> {
    const id = data.id || `asgn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    return this.assignmentModel
      .findOneAndUpdate({ id }, { ...data, id }, { upsert: true, new: true })
      .lean()
      .exec();
  }

  // -------------------------------------------------------------------
  // 4-Tier Personalized Recommendation Engine (100% DB-backed)
  // -------------------------------------------------------------------
  async getPersonalizedRecommendations(employeeId?: string): Promise<any[]> {
    // 1. Fetch all available courses from database
    const allCourses = await this.courseModel.find().lean().exec();

    // 2. Fetch employee profile if employeeId provided
    let emp: Employee | null = null;
    let assignments: TrainingAssignment[] = [];
    let records: TrainingRecord[] = [];

    if (employeeId) {
      emp = await this.employeeModel
        .findOne({ $or: [{ id: employeeId }, { employeeId }] })
        .lean()
        .exec();

      assignments = await this.assignmentModel
        .find({ employeeId, status: { $ne: 'completed' } })
        .lean()
        .exec();

      records = await this.recordModel.find({ employeeId }).lean().exec();
    }

    const assignmentMap = new Map<string, TrainingAssignment>();
    assignments.forEach((a) => {
      assignmentMap.set(a.courseId, a);
    });

    const recordsMap = new Map<string, TrainingRecord>();
    records.forEach((r) => {
      recordsMap.set(r.courseId, r);
    });

    // 3. Determine employee's primary plant specialization
    let primaryCategory = 'Effluent Treatment Plants (ETP)';
    if (emp) {
      const dept = (emp.department || '').toLowerCase();
      const site = (emp.siteId || '').toLowerCase();
      const role = (emp.role || '').toLowerCase();

      if (dept.includes('wtp') || dept.includes('ro') || site.includes('ro')) {
        primaryCategory = 'Water Treatment Plants (WTP)';
      } else if (dept.includes('stp') || site.includes('stp')) {
        primaryCategory = 'Sewage Treatment Plants (STP)';
      } else if (dept.includes('zld') || dept.includes('mee') || site.includes('mee')) {
        primaryCategory = 'Zero Liquid Discharge (ZLD)';
      } else if (dept.includes('consult') || dept.includes('audit') || role.includes('auditor')) {
        primaryCategory = 'Environmental Consulting Services';
      } else if (dept.includes('maint') || dept.includes('elect') || dept.includes('mech')) {
        primaryCategory = 'Operation and Maintenance (O&M)';
      }
    }

    // 4. Score and map courses into 4 tiers
    const scoredCourses = allCourses.map((c) => {
      const assignment = assignmentMap.get(c.id) || assignmentMap.get(c.courseId) || assignmentMap.get(c.code);
      const record = recordsMap.get(c.id) || recordsMap.get(c.courseId) || recordsMap.get(c.code);

      const moduleCount = c.modules?.length || 3;
      const videoCount =
        c.modules?.reduce((acc, m) => acc + (m.videos?.length || 0), 0) ||
        c.abilities?.length ||
        3;

      let tierRank = 4;
      let matchScorePct = 85 + Math.floor(((c.rating || 4.7) - 4.5) * 10);
      let badge = 'Industrial Elective';
      let badgeColor = '#10b981'; // Emerald Green
      let isAssignedByManager = false;
      let assignedByName: string | undefined;
      let directiveReason: string | undefined;
      let priority: string | undefined;
      let dueDate: string | undefined;

      // Tier 1: Explicit Manager Directive
      if (assignment) {
        tierRank = 1;
        matchScorePct = 99;
        badge = '★ Assigned by Plant Manager';
        badgeColor = '#eab308'; // Premium Amber Gold
        isAssignedByManager = true;
        assignedByName = assignment.assignedByName;
        directiveReason = assignment.reason;
        priority = assignment.priority;
        dueDate = assignment.dueDate;
      }
      // Tier 2: Competency Assessment Gap (< 70% or uncompleted)
      else if (record && (record.status !== 'certified' || (record.overallScorePct && record.overallScorePct < 70))) {
        tierRank = 2;
        matchScorePct = 97;
        badge = 'Skill Gap Focus';
        badgeColor = '#f97316'; // Orange / Volcano
      }
      // Tier 3: Role & Plant Domain Alignment
      else if (c.category === primaryCategory || c.section === primaryCategory) {
        tierRank = 3;
        matchScorePct = 93 + (c.rating && c.rating >= 4.9 ? 2 : 0);
        badge = 'Role Pathway';
        badgeColor = '#3b82f6'; // Industrial Blue
      }

      return {
        id: c.id,
        courseId: c.courseId || c.id,
        title: c.title,
        code: c.code,
        category: c.category || c.section,
        section: c.section || c.category,
        department: c.department,
        provider: c.provider || 'Nectar Technical Operations',
        thumbnailUrl: c.thumbnailUrl || '/courses/etp_plant.jpg',
        rating: c.rating || 4.8,
        reviewCount: c.reviewCount || 30,
        level: c.level || 'Intermediate',
        durationHours: c.estimatedHours || 4.0,
        estimatedHours: c.estimatedHours || 4.0,
        passThreshold: c.passThreshold || 70,
        matchScorePct,
        tierRank,
        badge,
        badgeColor,
        isAssignedByManager,
        assignedByName,
        directiveReason,
        priority,
        dueDate,
        moduleCount,
        videoCount,
        modules: c.modules || [],
        abilities: c.abilities || [],
      };
    });

    // 5. Sort by Tier Rank (1 -> 2 -> 3 -> 4) and then highest Match Score
    scoredCourses.sort((a, b) => {
      if (a.tierRank !== b.tierRank) return a.tierRank - b.tierRank;
      if (b.matchScorePct !== a.matchScorePct) return b.matchScorePct - a.matchScorePct;
      return (b.rating || 0) - (a.rating || 0);
    });

    return scoredCourses;
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
