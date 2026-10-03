import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RolePathDocument = RolePath & Document;

/** Ordered courses required (or suggested) for a role, optionally narrowed by designation / plant type. */
@Schema({ collection: 'role_paths', timestamps: true })
export class RolePath {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  role: string; // UserRole, e.g. "employee", "shift_incharge"

  @Prop()
  designation?: string;

  @Prop()
  plantType?: string; // sites.plantType

  @Prop({ required: true })
  title: string;

  @Prop({ type: Array, default: [] })
  steps: Array<{ courseId: string; mandatory: boolean; order: number }>;

  @Prop()
  renewEveryMonths?: number;
}

export const RolePathSchema = SchemaFactory.createForClass(RolePath);
