import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventPostDocument = EventPost & Document;

export const POST_KINDS = ['question', 'comment', 'announcement'] as const;

/** Event discussion. Only attendees and hosts can post. */
@Schema({ collection: 'event_posts', timestamps: true })
export class EventPost {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  eventId: string;

  @Prop({ required: true })
  authorEmployeeId: string;

  @Prop({ required: true })
  text: string;

  @Prop({ required: true, enum: POST_KINDS, default: 'comment' })
  kind: string;

  @Prop()
  parentId?: string;

  @Prop({ default: false })
  pinned: boolean;
}

export const EventPostSchema = SchemaFactory.createForClass(EventPost);
