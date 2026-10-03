import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MentorProfileDocument = MentorProfile & Document;

/** Mentor is a capability on an employee, not a role. HR / director manage these. */
@Schema({ collection: 'mentor_profiles', timestamps: true })
export class MentorProfile {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  /** employees.id, or leaders.id ("user:<email>") for non-employees such as the Director. */
  @Prop({ required: true, unique: true, index: true })
  employeeId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  title?: string; // e.g. "ETP Plant Manager"

  @Prop()
  department?: string;

  @Prop()
  bio?: string;

  @Prop()
  photoUrl?: string;

  @Prop({ type: [String], default: [] })
  specialties: string[];

  @Prop({ default: true, index: true })
  active: boolean;
}

export const MentorProfileSchema = SchemaFactory.createForClass(MentorProfile);
