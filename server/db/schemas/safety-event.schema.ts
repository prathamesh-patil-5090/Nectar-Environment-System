import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SafetyEventDocument = SafetyEvent & Document;

export type SafetyPersonRef = { personId: string; name: string; role: string };

export type SafetyTimelineEntry = {
  at: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  kind: 'created' | 'status' | 'comment' | 'action' | 'clearance' | 'leave' | 'call' | 'media' | 'notify' | 'edit' | 'promote';
  title: string;
  detail?: string;
};

export type SafetyCorrectiveAction = {
  id: string;
  text: string;
  ownerId?: string;
  dueDate?: string;
  done: boolean;
  doneAt?: string;
  doneBy?: string;
};

export type SafetyClearance = {
  employeeId: string;
  status: 'pending' | 'cleared' | 'waived';
  clearedBy?: string;
  clearedByRole?: string;
  at?: string;
  remark?: string;
};

export type SafetyMedia = {
  id: string;
  url: string;
  kind: 'image' | 'video';
  name: string;
  size: number;
  uploadedBy: string;
  at: string;
};

export type SafetyOtEntry = { employeeId: string; hours: number; date?: string; otDecisionId?: string };

/**
 * Incident, near-miss or breakdown. One collection, discriminated by `type`.
 * Visible to every role; status changes are validated by safety-rules.ts.
 */
@Schema({ collection: 'safety_events', timestamps: true })
export class SafetyEvent {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, enum: ['incident', 'near_miss', 'breakdown'], index: true })
  type: string;

  @Prop({ required: true, index: true })
  siteId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  location: string;

  @Prop({ required: true })
  occurredAt: string;

  @Prop({ required: true })
  reportedAt: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true, enum: ['low', 'medium', 'high', 'critical'] })
  severity: string;

  @Prop({ required: true, index: true })
  status: string;

  @Prop({ type: Object, required: true })
  reportedBy: SafetyPersonRef;

  @Prop({ type: [String], default: [] })
  informedBy: string[];

  @Prop({ type: [String], default: [], index: true })
  involved: string[];

  @Prop({ type: [Object], default: [] })
  stakeholders: SafetyPersonRef[];

  @Prop({ type: [Object], default: [] })
  media: SafetyMedia[];

  @Prop({ default: '' })
  rootCause: string;

  @Prop({ type: [Object], default: [] })
  correctiveActions: SafetyCorrectiveAction[];

  @Prop({ type: [Object], default: [] })
  timeline: SafetyTimelineEntry[];

  @Prop({ default: false })
  isEmergency: boolean;

  /** Everyone alerted by the emergency broadcast, and who has acknowledged. */
  @Prop({ type: [String], default: [] })
  emergencyRecipients: string[];

  @Prop({ type: [String], default: [] })
  emergencyAcks: string[];

  @Prop()
  meetLink?: string;

  /** Safety meeting: when it was called, who was called to it and who joined. */
  @Prop()
  callStartedAt?: string;

  @Prop({ type: [String], default: [] })
  callInvited: string[];

  @Prop({ type: [String], default: [] })
  callJoined: string[];

  /** Last no-show reminder per person (every 4 h until they join or the Director closes the case). */
  @Prop({ type: Object, default: {} })
  callNudgedAt: Record<string, string>;

  @Prop()
  lastNotifiedAt?: string;

  @Prop({ default: 0 })
  notifyCount: number;

  @Prop()
  escalatedAt?: string;

  @Prop()
  promotedFrom?: string;

  @Prop()
  promotedTo?: string;

  // ── Leave / return-to-work ──
  @Prop({ type: [String], default: [] })
  linkedLeaveIds: string[];

  @Prop({ default: false })
  requiresReturnClearance: boolean;

  @Prop({ type: [Object], default: [] })
  clearance: SafetyClearance[];

  // ── Breakdown ──
  @Prop()
  equipment?: string;

  @Prop()
  whatFailed?: string;

  @Prop()
  why?: string;

  @Prop()
  how?: string;

  @Prop()
  failedAt?: string;

  @Prop()
  restoredAt?: string;

  @Prop({ type: [Object], default: [] })
  otEntries: SafetyOtEntry[];

  @Prop({ type: [String], default: [] })
  otDecisionIds: string[];
}

export const SafetyEventSchema = SchemaFactory.createForClass(SafetyEvent);
SafetyEventSchema.index({ siteId: 1, reportedAt: -1 });
SafetyEventSchema.index({ 'clearance.employeeId': 1, 'clearance.status': 1 });
