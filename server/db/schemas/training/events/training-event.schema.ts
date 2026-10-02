import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TrainingEventDocument = TrainingEvent & Document;

export const EVENT_TYPES = ['masterclass', 'seminar', 'workshop', 'clinic'] as const;
/** online = Google Meet; in_person = at a plant (venue.siteId required). */
export const EVENT_FORMATS = ['online', 'in_person'] as const;
export const EVENT_STATUSES = ['draft', 'published', 'cancelled', 'completed'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** One dated occurrence of a mentor session / seminar (Meetup "event"). A repeating session shares a seriesId. */
@Schema({ collection: 'training_events', timestamps: true })
export class TrainingEvent {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ index: true })
  seriesId?: string;

  @Prop({ index: true })
  communityId?: string;

  @Prop({ required: true, enum: EVENT_TYPES, default: 'masterclass' })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: Array, default: [] })
  agenda: Array<{ time: string; item: string }>;

  @Prop({ type: [String], default: [], index: true })
  topics: string[]; // matched against courses.skills

  /** Who it is meant for. Empty = everyone. Others can still attend. */
  @Prop({ type: Object, default: {} })
  audience: { roles?: string[]; plantTypes?: string[] };

  @Prop()
  coverUrl?: string;

  /** First id is the main host. */
  @Prop({ type: [String], required: true, index: true })
  hostEmployeeIds: string[];

  @Prop({ required: true, index: true })
  startsAt: string; // ISO

  @Prop({ required: true })
  endsAt: string; // ISO

  @Prop({ required: true, enum: EVENT_FORMATS, default: 'online' })
  format: string;

  /** Only returned to attendees and hosts. */
  @Prop({ default: '' })
  meetLink: string;

  /** In-plant events only. */
  @Prop({ type: Object })
  venue?: { siteId: string; room?: string };

  @Prop({ required: true })
  capacity: number;

  @Prop({ default: true })
  waitlistEnabled: boolean;

  @Prop()
  rsvpOpensAt?: string;

  @Prop()
  rsvpClosesAt?: string;

  @Prop()
  rsvpQuestion?: string;

  @Prop({ type: String, required: true, enum: EVENT_STATUSES, default: 'draft', index: true })
  status: EventStatus;

  @Prop()
  cancelReason?: string;

  @Prop()
  recordingUrl?: string;

  /** Reminder bookkeeping so the scheduler sends each one once. */
  @Prop({ type: [String], default: [] })
  remindersSent: string[]; // "roster" | "1d" | "1h" | "start" | "feedback"
}

export const TrainingEventSchema = SchemaFactory.createForClass(TrainingEvent);
TrainingEventSchema.index({ status: 1, startsAt: 1 });
