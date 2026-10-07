import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EPermitsController } from './e-permits.controller';
import { EPermitsService } from './e-permits.service';
import { EPermitsScheduler } from './e-permits.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';
import { EPermit, EPermitSchema } from '../../../db/schemas/e-permit.schema';
import {
  Department,
  DepartmentSchema,
  EPermitSequence,
  EPermitSequenceSchema,
  PermitLocation,
  PermitLocationSchema,
  SiteEmergencyContact,
  SiteEmergencyContactSchema,
} from '../../../db/schemas/e-permit-master.schema';
import { Employee, EmployeeSchema } from '../../../db/schemas/employee.schema';
import { Leader, LeaderSchema } from '../../../db/schemas/leader.schema';
import { LeaveRequest, LeaveRequestSchema } from '../../../db/schemas/leave-request.schema';
import { SafetyEvent, SafetyEventSchema } from '../../../db/schemas/safety-event.schema';

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: EPermit.name, schema: EPermitSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: PermitLocation.name, schema: PermitLocationSchema },
      { name: SiteEmergencyContact.name, schema: SiteEmergencyContactSchema },
      { name: EPermitSequence.name, schema: EPermitSequenceSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: Leader.name, schema: LeaderSchema },
      { name: LeaveRequest.name, schema: LeaveRequestSchema },
      // Read-only here: pending return-to-work clearances soft-block workers
      { name: SafetyEvent.name, schema: SafetyEventSchema },
    ]),
  ],
  controllers: [EPermitsController],
  providers: [EPermitsService, EPermitsScheduler],
  exports: [EPermitsService],
})
export class EPermitsModule {}
