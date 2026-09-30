import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LeavePolicyDocument = LeavePolicy & Document;

export type NoticeSeverity = 'warn' | 'block';

@Schema({ _id: false })
export class RestrictedPeriod {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  startDate: string;

  @Prop({ required: true })
  endDate: string;
}

@Schema({ collection: 'leave_policies', timestamps: true })
export class LeavePolicy {
  @Prop({ required: true, unique: true, default: 'org-default' })
  id: string;

  @Prop({ type: [String], default: ['casual', 'sick', 'family_emergency', 'unpaid', 'other'] })
  allowedLeaveTypes: string[];

  /** Minimum calendar days between request date and leave start (planned only). */
  @Prop({ default: 2 })
  noticeDays: number;

  @Prop({ enum: ['warn', 'block'], default: 'warn' })
  noticeSeverity: NoticeSeverity;

  @Prop({ default: true })
  halfDayAllowed: boolean;

  @Prop({ type: [RestrictedPeriod], default: [] })
  restrictedPeriods: RestrictedPeriod[];

  @Prop({ default: true })
  active: boolean;
}

export const LeavePolicySchema = SchemaFactory.createForClass(LeavePolicy);
