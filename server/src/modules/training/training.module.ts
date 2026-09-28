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
} from '../../../db/schemas/training';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: TrainingRecord.name, schema: TrainingRecordSchema },
      { name: Certificate.name, schema: CertificateSchema },
      { name: TrainingSession.name, schema: TrainingSessionSchema },
      { name: MentorLiveSession.name, schema: MentorLiveSessionSchema },
    ]),
  ],
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
