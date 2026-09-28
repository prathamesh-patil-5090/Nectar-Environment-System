import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TrainingRecordDocument = TrainingRecord & Document;

@Schema({ collection: 'training_records', timestamps: true })
export class TrainingRecord {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  employeeId: string;

  @Prop({ required: true })
  employeeName: string;

  @Prop({ required: true, index: true })
  courseId: string;

  @Prop({ required: true })
  courseTitle: string;

  @Prop({ required: true, default: 'enrolled', index: true })
  status: string; // 'enrolled' | 'in_progress' | 'assessed' | 'certified'

  @Prop({ default: 0 })
  progressPct: number;

  @Prop({ default: 0 })
  overallScorePct: number;

  @Prop({ required: true })
  enrolledAt: string;

  @Prop()
  completedAt?: string;

  @Prop({ type: Object, default: {} })
  abilityProgress?: Record<string, boolean>;

  @Prop({ type: Object, default: {} })
  assessments: {
    skillMap?: {
      scorePct: number;
      conductedAt?: string;
    };
    written?: {
      scorePct: number;
      conductedAt?: string;
    };
    practical?: {
      scorePct: number;
      evaluatorId?: string;
      evaluatorName?: string;
      conductedAt?: string;
      scores?: Array<{
        abilityId: string;
        abilityTitle?: string;
        score: number;
        remark?: string;
      }>;
      generalNotes?: string;
    };
    oral?: {
      scorePct: number;
      evaluatorId?: string;
      evaluatorName?: string;
      conductedAt?: string;
      scores?: Array<{
        abilityId: string;
        abilityTitle?: string;
        score: number;
        remark?: string;
      }>;
      interviewNotes?: string;
    };
  };

  @Prop()
  certificateId?: string;

  @Prop()
  certificateNo?: string;

  @Prop({ type: Object })
  learningNeed?: {
    competencyAreaId?: string;
    competencyAreaName?: string;
    currentLevel?: string;
    trainingRequired?: boolean;
    aiInsight?: string;
  };
}

export const TrainingRecordSchema =
  SchemaFactory.createForClass(TrainingRecord);
