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

  @Prop()
  thumbnailUrl?: string;

  @Prop()
  provider?: string;

  @Prop()
  rating?: number;

  @Prop()
  reviewCount?: number;

  @Prop()
  level?: string;

  @Prop()
  estimatedHours?: number;

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

  /** Who the course targets. Empty arrays = open to everyone. */
  @Prop({ type: Object, default: {} })
  audience?: { roles?: string[]; designations?: string[]; plantTypes?: string[] };

  /** Skills taught — shown as "Skills you'll gain" and matched against manager flags. */
  @Prop({ type: [String], default: [], index: true })
  skills: string[];

  @Prop({ type: [String], default: [] })
  prerequisites: string[]; // course ids

  @Prop({ default: 'course', enum: ['course', 'micro', 'specialization'] })
  type: string;

  /** Certificate validity. Most courses 12 months, some 6. */
  @Prop({ default: 12 })
  certificateValidityMonths: number;

  @Prop({ type: Array, default: [] })
  skillMappingQuestions?: any[];

  @Prop({ type: Array, default: [] })
  writtenTestQuestions?: any[];
}

export const CourseSchema = SchemaFactory.createForClass(Course);
