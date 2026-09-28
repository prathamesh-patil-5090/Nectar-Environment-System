import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import {
  Course,
  CourseSchema,
} from '../../../db/schemas/training/course.schema';
import {
  TrainingRecord,
  TrainingRecordSchema,
} from '../../../db/schemas/training/training-record.schema';
import {
  Certificate,
  CertificateSchema,
} from '../../../db/schemas/training/certificate.schema';
import {
  TrainingSession,
  TrainingSessionSchema,
} from '../../../db/schemas/training/training-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: TrainingRecord.name, schema: TrainingRecordSchema },
      { name: Certificate.name, schema: CertificateSchema },
      { name: TrainingSession.name, schema: TrainingSessionSchema },
    ]),
  ],
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
