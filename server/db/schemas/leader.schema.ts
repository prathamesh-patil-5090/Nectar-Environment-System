import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LeaderDocument = Leader & Document;

/**
 * People who use the system but are not employees (e.g. the Director).
 * id matches the client's person id for logins without an employeeId: "user:<login email>".
 */
@Schema({ collection: 'leaders', timestamps: true })
export class Leader {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  role: string; // UserRole, e.g. "director"

  @Prop()
  title?: string; // e.g. "Founder & Managing Director"

  @Prop()
  email?: string;

  @Prop({ default: true })
  active: boolean;
}

export const LeaderSchema = SchemaFactory.createForClass(Leader);
