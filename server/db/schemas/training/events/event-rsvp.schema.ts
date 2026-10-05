import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventRsvpDocument = EventRsvp & Document;

export const RSVP_STATUSES = ['going', 'waitlist', 'cancelled', 'attended', 'no_show'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

/** One per employee per event. Going counts are always computed from these rows. */
@Schema({ collection: 'event_rsvps', timestamps: true })
export class EventRsvp {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  eventId: string;

  @Prop({ required: true, index: true })
  employeeId: string;

  @Prop({ type: String, required: true, enum: RSVP_STATUSES, index: true })
  status: RsvpStatus;

  @Prop()
  answer?: string; // reply to the event's rsvpQuestion

  @Prop({ required: true })
  rsvpAt: string; // ISO; waitlist order = rsvpAt ascending
}

export const EventRsvpSchema = SchemaFactory.createForClass(EventRsvp);
EventRsvpSchema.index({ eventId: 1, employeeId: 1 }, { unique: true });
