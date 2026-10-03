import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SiteDocument = Site & Document;

@Schema({ collection: 'sites', timestamps: true })
export class Site {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, unique: true, index: true })
  siteId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ index: true })
  plantType: string;

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
}

export const SiteSchema = SchemaFactory.createForClass(Site);
