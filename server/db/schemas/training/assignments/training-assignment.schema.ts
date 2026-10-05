import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/** 'assigned' / 'completed' are legacy values kept readable for existing rows. */
export const ASSIGNMENT_STATUSES = ['open', 'in_progress', 'resolved', 'dismissed', 'assigned', 'completed'];

export type TrainingAssignmentDocument = TrainingAssignment & Document;

@Schema({ collection: 'training_assignments', timestamps: true })
export class TrainingAssignment {
  @Prop({ required: true, unique: true, index: true })
  id: string; // e.g. "asgn-0126-etp101"

  @Prop({ required: true, index: true })
  employeeId: string; // Target employee id (e.g. "emp0126")

  @Prop({ required: true })
  assignedByEmployeeId: string; // Manager/Supervisor employee id (e.g. "emp0125")

  @Prop({ required: true })
  assignedByName: string; // e.g. "Anand Dakave (ETP Plant Manager)"

  @Prop({ index: true })
  courseId?: string; // optional: a flag can name a weak topic without a course

  @Prop()
  moduleId?: string; // Optional: target a specific module_id

  @Prop({ required: true })
  reason: string; // e.g. "Priority SVI control & shock load management for monsoon shift"

  @Prop({ default: 'high', enum: ['critical', 'high', 'normal'] })
  priority: string;

  @Prop({ default: 'open', enum: ASSIGNMENT_STATUSES, index: true })
  status: string;

  @Prop()
  dueDate?: string;

  /** mandatory → "Assigned to you" shelf; suggested → boosts recommendations with its reason */
  @Prop({ default: 'mandatory', enum: ['mandatory', 'suggested'], index: true })
  kind: string;

  @Prop()
  topic?: string; // weak area in the flagger's words, e.g. "Polymer dosing"

  @Prop({ type: [String], default: [] })
  skills: string[]; // matched against courses.skills

  @Prop({ type: [String], default: [] })
  abilityIds: string[];

  @Prop({ default: 'manager', enum: ['manager', 'lni', 'evaluation', 'role_path'] })
  source: string;

  @Prop()
  resolvedAt?: string;

  @Prop()
  resolvedBy?: string; // employee id, or "system" when auto-resolved
}

export const TrainingAssignmentSchema = SchemaFactory.createForClass(TrainingAssignment);
