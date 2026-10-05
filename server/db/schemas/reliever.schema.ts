import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RelieverDocument = Reliever & Document;

@Schema({ collection: 'reliever_pool', timestamps: true })
export class Reliever {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ index: true })
  employeeId?: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  phone: string;

  @Prop()
  email?: string;

  @Prop({ index: true })
  clusterId: string;

  @Prop({ index: true })
  homeSiteId?: string;

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({ type: [String], default: [] })
  plantTypes: string[];

  @Prop({ enum: ['available', 'assigned', 'deployed', 'unavailable'], default: 'available', index: true })
  availability: string;

  @Prop()
  assignedSiteId?: string;

  @Prop()
  assignedAbsenceId?: string;

  @Prop({ type: Array, default: [] })
  absenceHistory?: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    siteId: string;
    date: string;
    shiftId: string;
    reason: string;
    status: string;
  }>;
}

export const RelieverSchema = SchemaFactory.createForClass(Reliever);
