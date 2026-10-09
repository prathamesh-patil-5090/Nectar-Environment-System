import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * E-Permit masters: departments (HoD + deputies), seeded locations with an owner department,
 * per-site emergency contacts and the permit number sequence.
 */

export type DepartmentDocument = Department & Document;

@Schema({ collection: 'departments', timestamps: true })
export class Department {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true })
  name: string;

  /** Head of Department login id ("user:<email>"). */
  @Prop({ required: true, index: true })
  headUserId: string;

  @Prop({ default: '' })
  headName: string;

  @Prop({ type: [String], default: [], index: true })
  deputyUserIds: string[];

  @Prop({ type: [String], default: [] })
  deputyNames: string[];

  @Prop({ type: [String], default: [] })
  siteIds: string[];

  /** HoD marked unavailable until this moment — approval requests also go to deputies. */
  @Prop()
  headUnavailableUntil?: string;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);

export type PermitLocationDocument = PermitLocation & Document;

@Schema({ collection: 'permit_locations', timestamps: true })
export class PermitLocation {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  siteId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  ownerDepartmentId: string;

  /** e.g. "mee", "tank", "chemical" — drive extra clearances. */
  @Prop({ type: [String], default: [] })
  tags: string[];

  /** Other departments that run equipment or people here — each one must clear every permit at this location. */
  @Prop({ type: [String], default: [] })
  concernedDepartmentIds: string[];

  @Prop({ default: true })
  active: boolean;
}

export const PermitLocationSchema = SchemaFactory.createForClass(PermitLocation);

export type SiteEmergencyContactDocument = SiteEmergencyContact & Document;

@Schema({ collection: 'site_emergency_contacts', timestamps: true })
export class SiteEmergencyContact {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  siteId: string;

  @Prop({ required: true })
  team: string;

  @Prop({ required: true })
  mobile: string;

  @Prop()
  extension?: string;
}

export const SiteEmergencyContactSchema = SchemaFactory.createForClass(SiteEmergencyContact);

export type EPermitSequenceDocument = EPermitSequence & Document;

/** One row per site + financial year: `{ key: "s-etp:2027", lastSeq }`. */
@Schema({ collection: 'e_permit_sequences', timestamps: true })
export class EPermitSequence {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop({ default: 0 })
  lastSeq: number;
}

export const EPermitSequenceSchema = SchemaFactory.createForClass(EPermitSequence);
