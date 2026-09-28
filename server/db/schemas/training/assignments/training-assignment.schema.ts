import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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

  @Prop({ required: true, index: true })
  courseId: string; // e.g. "course-etp-201"

  @Prop()
  moduleId?: string; // Optional: target a specific module_id

  @Prop({ required: true })
  reason: string; // e.g. "Priority SVI control & shock load management for monsoon shift"

  @Prop({ default: 'high', enum: ['critical', 'high', 'normal'] })
  priority: string;

  @Prop({ default: 'assigned', enum: ['assigned', 'in_progress', 'completed'] })
  status: string;

  @Prop()
  dueDate?: string;
}

export const TrainingAssignmentSchema = SchemaFactory.createForClass(TrainingAssignment);
