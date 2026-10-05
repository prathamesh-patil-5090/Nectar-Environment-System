import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MentorLiveSessionDocument = MentorLiveSession & Document;

@Schema({ _id: false })
export class SessionDoubt {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, index: true })
  employeeId: string;

  @Prop({ required: true })
  employeeName: string;

  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  submittedAt: string;
}
export const SessionDoubtSchema = SchemaFactory.createForClass(SessionDoubt);

@Schema({ collection: 'mentor_live_sessions', timestamps: true })
export class MentorLiveSession {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true })
  mentorName: string;

  @Prop({ required: true })
  mentorRole: string;

  @Prop({ required: true })
  mentorDepartment: string;

  @Prop({ default: false, index: true })
  isFounder: boolean;

  @Prop({ required: true })
  badgeText: string;

  @Prop({ required: true })
  photoDataUrl: string;

  @Prop({ default: 4.9 })
  mentorRating: number;

  @Prop({ required: true })
  topic: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  scheduledAt: string;

  @Prop({ default: 60 })
  durationMinutes: number;

  @Prop({ required: true, default: 35 })
  maxCapacity: number; // 30 - 35 max

  @Prop({ default: 0 })
  registeredCount: number;

  @Prop({ type: [String], default: [] })
  enrolledEmployeeIds: string[];

  @Prop({ type: [SessionDoubtSchema], default: [] })
  questions: SessionDoubt[];

  @Prop({ default: 'google_meet' })
  meetingPlatform: string;

  @Prop({ default: 'coming_soon' })
  platformStatus: string;

  @Prop({ default: '' })
  meetingLink: string;
}

export const MentorLiveSessionSchema =
  SchemaFactory.createForClass(MentorLiveSession);
