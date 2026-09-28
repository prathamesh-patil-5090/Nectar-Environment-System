import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CourseDocument = Course & Document;

@Schema({ collection: 'courses', timestamps: true })
export class Course {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ index: true })
  courseId: string;

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true })
  title: string;

  @Prop({ index: true })
  department: string;

  @Prop({ index: true })
  category: string;

  @Prop({ index: true })
  section: string;

  @Prop({ index: true })
  jobCategoryId: string;

  @Prop()
  description: string;

  @Prop({ default: '/courses/etp_plant.jpg' })
  thumbnailUrl: string;

  @Prop({ default: 'Nectar Technical Operations' })
  provider: string;

  @Prop({ default: 4.8 })
  rating: number;

  @Prop({ default: 24 })
  reviewCount: number;

  @Prop({ default: 'Intermediate' })
  level: string;

  @Prop({ default: 40 })
  estimatedHours: number;

  @Prop({ default: 70 })
  passThreshold: number;

  @Prop({ type: Array, default: [] })
  modules: Array<{
    id: string;
    moduleId: string;
    order: number;
    title: string;
    description?: string;
    videos: Array<{
      id: string;
      videoId: string;
      order: number;
      title: string;
      durationMinutes: number;
      videoUrl?: string;
      description?: string;
    }>;
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
