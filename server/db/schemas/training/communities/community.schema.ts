import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CommunityDocument = Community & Document;

/** Meetup-style group: a learning circle per plant type or topic. Members hear about new events. */
@Schema({ collection: 'communities', timestamps: true })
export class Community {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ index: true })
  domain?: string; // sites.plantType or a topic, e.g. "ETP", "Safety"

  @Prop()
  coverUrl?: string;

  @Prop({ type: [String], default: [] })
  organizerEmployeeIds: string[];

  /** Members who joined explicitly. Effective members = these + autoJoin matches − optedOut. */
  @Prop({ type: [String], default: [], index: true })
  memberEmployeeIds: string[];

  /** Auto-joined employees who chose to leave. */
  @Prop({ type: [String], default: [] })
  optedOutEmployeeIds: string[];

  /** Employees matching these are added automatically. Empty = no auto-join. */
  @Prop({ type: Object, default: {} })
  autoJoin: { roles?: string[]; plantTypes?: string[] };
}

export const CommunitySchema = SchemaFactory.createForClass(Community);
