import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CourseDocument = Course & Document;

@Schema({ collection: 'courses', timestamps: true })
export class Course {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true })
  title: string;

  @Prop({ index: true })
  department: string;

  @Prop({ index: true })
  category: string;

  @Prop()
  description: string;

  @Prop({ default: 40 })
  estimatedHours: number;

  @Prop({ default: 70 })
  passThreshold: number;

  @Prop({ type: Array, default: [] })
  modules: Array<{
    id: string;
    order: number;
    title: string;
    description?: string;
  }>;

  @Prop({ type: Array, default: [] })
  abilities: Array<{
    id: string;
    courseId: string;
    order: number;
    code: string;
    title: string;
    description: string;
    videoDurationMinutes: number;
    competencyAreaId: string;
    readingContent?: string;
    microQuiz?: {
      id: string;
      abilityId: string;
      passThreshold: number;
      questions: Array<{
        id: string;
        text: string;
        options: Array<{ id: string; text: string }>;
        correctOptionId: string;
        explanation: string;
      }>;
    };
  }>;

  @Prop({ type: Array, default: [] })
  skillMappingQuestions?: any[];

  @Prop({ type: Array, default: [] })
  writtenTestQuestions?: any[];
}

export const CourseSchema = SchemaFactory.createForClass(Course);
