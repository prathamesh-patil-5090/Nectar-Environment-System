import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CertificateDocument = Certificate & Document;

@Schema({ collection: 'certificates', timestamps: true })
export class Certificate {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, unique: true, index: true })
  certificateNo: string;

  @Prop({ index: true })
  enrollmentId?: string;

  @Prop({ required: true, index: true })
  employeeId: string;

  @Prop({ required: true })
  employeeName: string;

  @Prop({ required: true, index: true })
  courseId: string;

  @Prop({ required: true })
  courseTitle: string;

  @Prop({ required: true })
  issuedAt: string;

  @Prop()
  expiresAt?: string;

  @Prop({ default: 0 })
  overallPct: number;

  @Prop({ default: 0 })
  skillMapPct: number;

  @Prop({ default: 0 })
  writtenPct: number;

  @Prop({ default: 0 })
  practicalPct: number;

  @Prop({ default: 0 })
  oralPct: number;

  @Prop()
  managerSignatory?: string;

  @Prop()
  verificationHash?: string;

  @Prop({ default: 'active', index: true })
  status: string;
}

export const CertificateSchema = SchemaFactory.createForClass(Certificate);
