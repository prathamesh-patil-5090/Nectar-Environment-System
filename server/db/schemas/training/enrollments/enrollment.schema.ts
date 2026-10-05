import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EnrollmentDocument = Enrollment & Document;

export const ENROLLMENT_STATUSES = ['IN_PROGRESS', 'SKILL_MAP_DONE', 'PRACTICAL_DONE', 'ORAL_DONE', 'CERTIFIED'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export type AbilityProgress = {
  abilityId: string;
  videoWatchedPct: number; // >= 90 marks the video complete
  videoComplete: boolean;
  readingAcknowledged: boolean;
  quizAttempts: number;
  quizPassed: boolean;
  quizScorePct?: number;
  unlockedAt: string;
  completedAt?: string;
};

export type QuizResult = {
  id: string;
  enrollmentId: string;
  scorePct: number;
  passed: boolean;
  takenAt: string;
  answers: Record<string, string>;
};

export type AbilityScore = { abilityId: string; abilityTitle: string; score: number; remark: string };

export type EvaluationResult = {
  id: string;
  enrollmentId: string;
  evaluatorId: string;
  evaluatorName: string;
  scores: AbilityScore[];
  overallPct: number;
  conductedAt: string;
  signatureVerified?: boolean;
  generalNotes?: string;
  interviewNotes?: string;
};

/** One learner on one course: ability progress plus the 4 assessment gates. */
@Schema({ collection: 'enrollments', timestamps: true })
export class Enrollment {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  employeeId: string;

  @Prop({ required: true, index: true })
  courseId: string;

  @Prop({ type: String, required: true, enum: ENROLLMENT_STATUSES, default: 'IN_PROGRESS', index: true })
  status: EnrollmentStatus;

  @Prop({ required: true })
  startedAt: string;

  @Prop()
  completedAt?: string;

  @Prop({ type: Object, default: {} })
  abilityProgress: Record<string, AbilityProgress>;

  @Prop({ type: Object, default: {} })
  assessments: {
    skillMap?: QuizResult;
    written?: QuizResult;
    practical?: EvaluationResult;
    oral?: EvaluationResult;
  };
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);
EnrollmentSchema.index({ employeeId: 1, courseId: 1 }, { unique: true });
