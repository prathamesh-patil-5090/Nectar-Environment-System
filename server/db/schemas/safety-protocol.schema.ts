import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SafetyProtocolDocument = SafetyProtocol & Document;

export type EmergencyContact = { label: string; phone: string };

/** Emergency / safety procedure. Readable by all; edited by Safety In-charge + Director. */
@Schema({ collection: 'safety_protocols', timestamps: true })
export class SafetyProtocol {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, index: true })
  category: string;

  @Prop({ default: '' })
  summary: string;

  @Prop({ type: [String], default: [] })
  steps: string[];

  @Prop({ type: [Object], default: [] })
  emergencyContacts: EmergencyContact[];

  /** Empty = applies to all sites. */
  @Prop({ type: [String], default: [] })
  siteIds: string[];

  @Prop({ default: 1 })
  version: number;

  @Prop()
  updatedBy?: string;

  @Prop()
  updatedAtIso?: string;
}

export const SafetyProtocolSchema = SchemaFactory.createForClass(SafetyProtocol);
