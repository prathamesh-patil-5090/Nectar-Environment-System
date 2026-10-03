import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LeaveBalanceDocument = LeaveBalance & Document;

@Schema({ collection: 'leave_balances', timestamps: true })
export class LeaveBalance {
  @Prop({ required: true, unique: true, index: true })
  employeeId: string;

  /** Remaining days by leave type. */
  @Prop({
    type: Object,
    default: () => ({
      casual: 8,
      sick: 6,
      family_emergency: 3,
      unpaid: 30,
      other: 2,
    }),
  })
  balances: Record<string, number>;
}

export const LeaveBalanceSchema = SchemaFactory.createForClass(LeaveBalance);
