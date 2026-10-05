import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShiftRosterDocument = ShiftRoster & Document;

@Schema({ collection: 'shift_rosters', timestamps: true })
export class ShiftRoster {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  siteId: string;

  @Prop({ required: true, index: true })
  fromDate: string;

  @Prop({ required: true, index: true })
  toDate: string;

  @Prop({ default: 0 })
  employeesAffected: number;

  @Prop({ default: 'G' })
  fromCode: string;

  @Prop({ default: 'A' })
  toCode: string;

  @Prop({ required: true, default: 'draft', index: true })
  status: string;

  @Prop()
  patternId?: string;

  @Prop({ type: [String], default: [] })
  groupIds?: string[];

  @Prop({ type: Array, default: [] })
  assignments?: Array<{
    employeeId: string;
    employeeName?: string;
    date: string;
    code: string;
    shiftId?: string;
  }>;

  @Prop({ type: Array, default: [] })
  changeRequests?: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    siteId: string;
    date: string;
    fromShiftId: string;
    toShiftId: string;
    reason: string;
    requestedBy: string;
    status: string;
    potentialOtHours: number;
    manpowerOk: boolean;
    createdAt: string;
  }>;

  @Prop()
  label?: string;

  @Prop()
  managerViewedAt?: string;

  @Prop()
  directorViewedAt?: string;

  @Prop({ type: Object })
  managerDecision?: {
    by: string;
    at: string;
    remark: string;
    outcome: string;
  };

  @Prop({ type: Object })
  directorDecision?: {
    by: string;
    at: string;
    remark: string;
    outcome: string;
  };
}

export const ShiftRosterSchema = SchemaFactory.createForClass(ShiftRoster);
