import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

/**
 * Demo / ops login accounts (email + password).
 * Separate from `employees` so org-wide roles (director) can exist without a plant row.
 */
@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  email: string;

  /** Demo plaintext password — replace with hash before production auth. */
  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  name: string;

  @Prop({
    required: true,
    index: true,
    enum: [
      'director',
      'manager',
      'management',
      'hr',
      'site_incharge',
      'shift_incharge',
      'safety_incharge',
      'supervisor',
      'employee',
    ],
  })
  role: string;

  @Prop({ index: true })
  siteId?: string;

  @Prop({ index: true })
  employeeId?: string;

  @Prop({ default: true })
  visibleOnLogin: boolean;

  @Prop({ default: true })
  active: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
