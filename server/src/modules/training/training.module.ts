import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import {
  Course,
  CourseSchema,
  TrainingRecord,
  TrainingRecordSchema,
  Certificate,
  CertificateSchema,
  TrainingSession,
  TrainingSessionSchema,
  MentorLiveSession,
  MentorLiveSessionSchema,
  TrainingAssignment,
  TrainingAssignmentSchema,
} from '../../../db/schemas/training';
import { Employee, EmployeeSchema } from '../../../db/schemas/employee.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: TrainingRecord.name, schema: TrainingRecordSchema },
      { name: Certificate.name, schema: CertificateSchema },
      { name: TrainingSession.name, schema: TrainingSessionSchema },
      { name: MentorLiveSession.name, schema: MentorLiveSessionSchema },
      { name: TrainingAssignment.name, schema: TrainingAssignmentSchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
