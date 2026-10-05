import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

/** In-app notification for one employee. Created server-side by the action that triggers it. */
@Schema({ collection: 'notifications', timestamps: true })
export class Notification {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  employeeId: string; // recipient

  @Prop({ required: true, index: true })
  kind: string; // e.g. "training_session_registered"

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop()
  href?: string;

  @Prop({ default: false, index: true })
  read: boolean;

  @Prop({ type: Object })
  meta?: Record<string, string>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ employeeId: 1, createdAt: -1 });
