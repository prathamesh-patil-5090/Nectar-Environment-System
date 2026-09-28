import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LeaveRequestDocument = LeaveRequest & Document;

@Schema({ collection: 'leaves', timestamps: true })
export class LeaveRequest {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  employeeId: string;

  @Prop({ required: true })
  employeeName: string;

  @Prop()
  siteId: string;

  @Prop()
  department: string;

  @Prop()
  shiftId: string;

  @Prop({ enum: ['planned', 'emergency'] })
  mode: string;

  @Prop()
  leaveType: string;

  @Prop({ required: true })
  status: string;

  @Prop()
  entrySource: string;

  @Prop({ required: true })
  startDate: string;

  @Prop({ required: true })
  endDate: string;

  @Prop()
  expectedReturnDate: string;

  @Prop()
  actualReturnDate: string;

  @Prop()
  reason: string;

  @Prop()
  enteredByName: string;

  @Prop()
  enteredByRole: string;

  @Prop()
  supervisorName: string;

  @Prop()
  siteInChargeName: string;

  @Prop()
  managerName: string;

  @Prop()
  employeeConsent: string;

  @Prop()
  managerDecision: string;

  @Prop()
  managerDecisionAt: string;

  @Prop()
  rejectionReason: string;

  @Prop({ default: false })
  replacementRequired: boolean;

  @Prop()
  assignedRelieverId: string;

  @Prop()
  replacementPlan: string;

  @Prop({ default: 0 })
  potentialOtHours: number;

  @Prop({ default: 0 })
  potentialOtCost: number;

  @Prop({ default: 0 })
  leaveBalanceDays: number;

  @Prop({ default: 1 })
  daysRequested: number;

  @Prop({ type: Array, default: [] })
  timeline: any[];

  @Prop({ required: true })
  createdAt: string;

  @Prop({ required: true })
  updatedAt: string;
}

export const LeaveRequestSchema = SchemaFactory.createForClass(LeaveRequest);
