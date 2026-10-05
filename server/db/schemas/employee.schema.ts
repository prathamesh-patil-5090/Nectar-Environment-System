import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmployeeDocument = Employee & Document;

@Schema({ collection: 'employees', timestamps: true })
export class Employee {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, unique: true, index: true })
  employeeId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  email: string;

  @Prop()
  phone: string;

  @Prop({ index: true })
  role: string;

  @Prop({ index: true })
  siteId: string;

  @Prop({ index: true })
  designation: string;

  @Prop({ default: 'active', index: true })
  employmentStatus: string;

  @Prop({ index: true })
  shiftId: string;

  @Prop()
  joinedAt: string;

  @Prop({ default: 0 })
  skillScore: number;

  @Prop()
  department: string;

  @Prop()
  employeeType: string;

  @Prop({ default: false })
  otEligible: boolean;

  @Prop()
  payCategory: string;

  @Prop()
  employeeCategory: string;

  @Prop()
  trainingStatus: string;

  @Prop()
  yearsExperience: number;

  @Prop({ index: true })
  reportsToEmployeeId: string;

  @Prop({ index: true })
  managerId: string;

  @Prop({ index: true })
  shiftInChargeId: string;

  @Prop({ index: true })
  supervisorId: string;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
