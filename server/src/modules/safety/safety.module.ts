import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { SafetyScheduler } from './safety.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';
import { SafetyEvent, SafetyEventSchema } from '../../../db/schemas/safety-event.schema';
import { SafetyProtocol, SafetyProtocolSchema } from '../../../db/schemas/safety-protocol.schema';
import { Employee, EmployeeSchema } from '../../../db/schemas/employee.schema';
import { Leader, LeaderSchema } from '../../../db/schemas/leader.schema';
import { LeaveRequest, LeaveRequestSchema } from '../../../db/schemas/leave-request.schema';

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: SafetyEvent.name, schema: SafetyEventSchema },
      { name: SafetyProtocol.name, schema: SafetyProtocolSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: Leader.name, schema: LeaderSchema },
      { name: LeaveRequest.name, schema: LeaveRequestSchema },
    ]),
  ],
  controllers: [SafetyController],
  providers: [SafetyService, SafetyScheduler],
  exports: [SafetyService],
})
export class SafetyModule {}
