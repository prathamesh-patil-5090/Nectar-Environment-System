import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SiteDocument = Site & Document;

/** operational = running under O&M; the rest are pipeline/closed plants shown to the Director only. */
export const SITE_STATUSES = ['operational', 'new', 'upcoming', 'closed'] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

/** Matches running plants, including records saved before `status` existed. */
export const OPERATIONAL_SITE_FILTER = { status: { $nin: ['new', 'upcoming', 'closed'] } };

@Schema({ collection: 'sites', timestamps: true })
export class Site {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, unique: true, index: true })
  siteId: string;

  @Prop({ required: true })
  name: string;

  /** Primary process — used for training audience targeting. */
  @Prop({ index: true })
  plantType: string;

  /** Every treatment process the plant runs (a plant can be ETP + RO + MEE). */
  @Prop({ type: [String], default: [], index: true })
  plantTypes: string[];

  @Prop()
  location: string;

  @Prop({ default: 0 })
  headcount: number;

  @Prop({ default: 0 })
  readiness: number;

  @Prop()
  managerId?: string;

  @Prop()
  managerName?: string;

  @Prop()
  managerEmail?: string;

  @Prop({ enum: SITE_STATUSES, default: 'operational', index: true })
  status: SiteStatus;
}

export const SiteSchema = SchemaFactory.createForClass(Site);
