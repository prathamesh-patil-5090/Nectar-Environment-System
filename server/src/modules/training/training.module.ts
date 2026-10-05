import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventsScheduler } from './events.scheduler';
import { CommunitiesService } from './communities.service';
import { MentorsService } from './mentors.service';
import { PeopleService } from './people.service';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { FeedService } from './feed.service';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  Course,
  CourseSchema,
  TrainingRecord,
  TrainingRecordSchema,
  Certificate,
  CertificateSchema,
  TrainingSession,
  TrainingSessionSchema,
  MentorLiveSession,
  MentorLiveSessionSchema,
  TrainingAssignment,
  TrainingAssignmentSchema,
  MentorProfile,
  MentorProfileSchema,
  RolePath,
  RolePathSchema,
  Community,
  CommunitySchema,
  TrainingEvent,
  TrainingEventSchema,
  EventRsvp,
  EventRsvpSchema,
  EventPost,
  EventPostSchema,
  Enrollment,
  EnrollmentSchema,
} from '../../../db/schemas/training';
import { Employee, EmployeeSchema } from '../../../db/schemas/employee.schema';
import { Site, SiteSchema } from '../../../db/schemas/site.schema';
import { Leader, LeaderSchema } from '../../../db/schemas/leader.schema';

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: TrainingRecord.name, schema: TrainingRecordSchema },
      { name: Certificate.name, schema: CertificateSchema },
      { name: TrainingSession.name, schema: TrainingSessionSchema },
      { name: MentorLiveSession.name, schema: MentorLiveSessionSchema },
      { name: TrainingAssignment.name, schema: TrainingAssignmentSchema },
      { name: MentorProfile.name, schema: MentorProfileSchema },
      { name: RolePath.name, schema: RolePathSchema },
      { name: Community.name, schema: CommunitySchema },
      { name: TrainingEvent.name, schema: TrainingEventSchema },
      { name: EventRsvp.name, schema: EventRsvpSchema },
      { name: EventPost.name, schema: EventPostSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: Site.name, schema: SiteSchema },
      { name: Leader.name, schema: LeaderSchema },
    ]),
  ],
  controllers: [TrainingController, EventsController, EnrollmentsController],
  providers: [
    TrainingService,
    EventsService,
    EventsScheduler,
    CommunitiesService,
    MentorsService,
    PeopleService,
    EnrollmentsService,
    FeedService,
  ],
  exports: [TrainingService],
})
export class TrainingModule {}
