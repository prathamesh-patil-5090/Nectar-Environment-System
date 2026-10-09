import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EPermitDocument = EPermit & Document;

export type EPermitApproval = {
  kind: 'authoriser' | 'department' | 'safety' | 'emergency';
  departmentId?: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  decidedByName?: string;
  onBehalfOf?: string;
  at?: string;
  remark?: string;
};

export type EPermitChecklistAnswer = { key: string; value: 'yes' | 'na' | ''; refNo?: string; label?: string };

export type EPermitGasReading = {
  gas: string;
  value: number;
  unit: string;
  ok: boolean;
  round: number;
  by: string;
  byName: string;
  at: string;
};

export type EPermitAck = {
  personId: string;
  personName: string;
  role: 'issuer' | 'holder' | 'worker';
  context: 'issue' | 'renewal' | 'return';
  round: number;
  via: 'self' | 'holder' | 'issuer';
  by: string;
  at: string;
  lat?: number;
  lng?: number;
};

export type EPermitRenewal = {
  n: number;
  ref: string;
  status: 'pending' | 'approved' | 'rejected';
  shiftCode: string;
  validFrom: string;
  validTo: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  newIssuerId?: string;
  newHolderId?: string;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  remark?: string;
};

export type EPermitReturn = {
  outcome: 'complete' | 'incomplete' | 'cancelled';
  note?: string;
  holderAt?: string;
  holderBy?: string;
  holderName?: string;
  issuerAt?: string;
  issuerBy?: string;
  issuerName?: string;
  authoriserAt?: string;
  authoriserBy?: string;
  authoriserName?: string;
  /** Where a send-back returns the permit to. */
  returnedFrom?: 'ACTIVE' | 'SUSPENDED';
};

export type EPermitTimelineEntry = {
  at: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  kind: string;
  title: string;
  detail?: string;
};

/**
 * Permit to Work. One document per permit; approvals, renewals, acknowledgements,
 * gas readings and the audit timeline are embedded (append-only timeline).
 * Status changes are validated by src/modules/e-permits/e-permit-rules.ts.
 */
@Schema({ collection: 'e_permits', timestamps: true })
export class EPermit {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, unique: true, index: true })
  permitNo: string;

  @Prop({ required: true, index: true })
  siteId: string;

  @Prop({ required: true, index: true })
  locationId: string;

  @Prop({ default: '' })
  locationName: string;

  @Prop({ required: true, enum: ['hot_work', 'cold_work'] })
  category: string;

  @Prop({ required: true })
  subCategory: string;

  @Prop({ required: true, index: true })
  status: string;

  @Prop({ default: false })
  emergency: boolean;

  @Prop({ required: true })
  policyVersion: number;

  @Prop({ required: true, index: true })
  issuerId: string;

  @Prop({ default: '' })
  issuerName: string;

  @Prop({ type: [String], default: [] })
  previousIssuerIds: string[];

  @Prop({ required: true, index: true })
  holderId: string;

  @Prop({ type: [String], default: [], index: true })
  workerIds: string[];

  @Prop({ required: true, index: true })
  authoriserDepartmentId: string;

  @Prop({ type: [Object], default: [] })
  approvals: EPermitApproval[];

  @Prop({ type: [Object], default: [] })
  postReviews: EPermitApproval[];

  @Prop()
  firstApprovalAt?: string;

  @Prop({ required: true })
  shiftCode: string;

  @Prop({ required: true })
  windowStart: string;

  @Prop({ required: true })
  windowEnd: string;

  @Prop()
  plannedFrom?: string;

  @Prop()
  plannedTo?: string;

  @Prop()
  validFrom?: string;

  @Prop({ index: true })
  validTo?: string;

  @Prop()
  firstValidFrom?: string;

  @Prop({ default: 0 })
  renewalCount: number;

  @Prop({ type: [Object], default: [] })
  renewals: EPermitRenewal[];

  @Prop({ index: true })
  parentPermitId?: string;

  /** Safety breakdown this permit repairs. */
  @Prop({ index: true })
  safetyEventId?: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  hazardsText: string;

  @Prop({ default: '' })
  jsaRef: string;

  @Prop({ type: [Object], default: [] })
  safetyMeasures: EPermitChecklistAnswer[];

  @Prop({ type: [Object], default: [] })
  ppe: EPermitChecklistAnswer[];

  @Prop({ type: [Object], default: [] })
  customPpe: EPermitChecklistAnswer[];

  @Prop({ type: [Object], default: [] })
  fireGas: EPermitChecklistAnswer[];

  @Prop({ type: [Object], default: [] })
  certificates: EPermitChecklistAnswer[];

  @Prop({ type: [Object], default: [] })
  gasReadings: EPermitGasReading[];

  @Prop({ type: [Object], default: [] })
  acks: EPermitAck[];

  @Prop({ type: Object })
  returnInfo?: EPermitReturn;

  @Prop()
  completedAt?: string;

  @Prop()
  actualHours?: number;

  @Prop({ type: Object })
  suspension?: { by: string; byName: string; at: string; reason: string; fromStatus: string };

  @Prop({ type: [Object], default: [] })
  overrides: { kind: string; by: string; byName: string; remark: string; at: string }[];

  @Prop({ type: [String], default: [] })
  otDecisionIds: string[];

  @Prop()
  warnedForValidTo?: string;

  @Prop()
  overdueNotifiedFor?: string;

  @Prop()
  postReviewEscalatedAt?: string;

  @Prop({ type: [Object], default: [] })
  timeline: EPermitTimelineEntry[];

  @Prop({ required: true })
  createdBy: string;
}

export const EPermitSchema = SchemaFactory.createForClass(EPermit);
EPermitSchema.index({ siteId: 1, status: 1 });
EPermitSchema.index({ locationId: 1, status: 1 });
EPermitSchema.index({ 'approvals.departmentId': 1, status: 1 });
