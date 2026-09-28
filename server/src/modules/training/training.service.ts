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
} from '../../../db/schemas/training';

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
  ) {}

  async findAllCourses(section?: string): Promise<Course[]> {
    const filter = section ? { section } : {};
    return this.courseModel.find(filter).lean().exec();
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
