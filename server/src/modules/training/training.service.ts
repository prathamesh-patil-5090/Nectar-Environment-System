import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Course,
  CourseDocument,
} from '../../../db/schemas/training/course.schema';
import {
  TrainingRecord,
  TrainingRecordDocument,
} from '../../../db/schemas/training/training-record.schema';
import {
  Certificate,
  CertificateDocument,
} from '../../../db/schemas/training/certificate.schema';
import {
  TrainingSession,
  TrainingSessionDocument,
} from '../../../db/schemas/training/training-session.schema';

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
}
