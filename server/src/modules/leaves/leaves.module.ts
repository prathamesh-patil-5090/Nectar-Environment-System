import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';
import { LeavePolicyService } from './leave-policy.service';
import {
  LeaveRequest,
  LeaveRequestSchema,
} from '../../../db/schemas/leave-request.schema';
import {
  LeavePolicy,
  LeavePolicySchema,
} from '../../../db/schemas/leave-policy.schema';
import {
  LeaveBalance,
  LeaveBalanceSchema,
} from '../../../db/schemas/leave-balance.schema';
import { Employee, EmployeeSchema } from '../../../db/schemas/employee.schema';
import { SafetyEvent, SafetyEventSchema } from '../../../db/schemas/safety-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LeaveRequest.name, schema: LeaveRequestSchema },
      { name: LeavePolicy.name, schema: LeavePolicySchema },
      { name: LeaveBalance.name, schema: LeaveBalanceSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: SafetyEvent.name, schema: SafetyEventSchema },
    ]),
  ],
  controllers: [LeavesController],
  providers: [LeavesService, LeavePolicyService],
  exports: [LeavesService, LeavePolicyService],
})
export class LeavesModule {}
