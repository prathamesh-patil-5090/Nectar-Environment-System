import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TrainingSessionDocument = TrainingSession & Document;

@Schema({ collection: 'training_sessions', timestamps: true })
export class TrainingSession {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, enum: ['classroom', 'on_site'] })
  type: string;

  @Prop({ required: true, index: true })
  scheduledBy: string;

  @Prop({ required: true })
  scheduledByName: string;

  @Prop({ required: true, index: true })
  scheduledAt: string;

  @Prop({ required: true })
  venueOrLink: string;

  @Prop({ type: [String], default: [] })
  employeeIds: string[];

  @Prop({ required: true, index: true })
  courseId: string;

  @Prop({ required: true, default: 'scheduled', index: true })
  status: string;
}

export const TrainingSessionSchema =
  SchemaFactory.createForClass(TrainingSession);
