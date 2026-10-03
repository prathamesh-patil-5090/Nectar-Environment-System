import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LeavePolicy,
  LeavePolicyDocument,
} from '../../../db/schemas/leave-policy.schema';
import {
  LeaveBalance,
  LeaveBalanceDocument,
} from '../../../db/schemas/leave-balance.schema';
import {
  LeaveRequest,
  LeaveRequestDocument,
} from '../../../db/schemas/leave-request.schema';
import { Employee, EmployeeDocument } from '../../../db/schemas/employee.schema';
import {
  COVERING_LEAVE_STATUSES,
  evaluateLeavePolicy,
  type LeavePolicyInput,
  type LeavePolicyResult,
} from './leave-policy.engine';

const DEFAULT_POLICY: LeavePolicy = {
  id: 'org-default',
  allowedLeaveTypes: [
    'casual',
    'sick',
    'family_emergency',
    'unpaid',
    'other',
  ],
  noticeDays: 2,
  noticeSeverity: 'warn',
  halfDayAllowed: true,
  restrictedPeriods: [],
  active: true,
};

@Injectable()
export class LeavePolicyService {
  constructor(
    @InjectModel(LeavePolicy.name)
    private policyModel: Model<LeavePolicyDocument>,
    @InjectModel(LeaveBalance.name)
    private balanceModel: Model<LeaveBalanceDocument>,
    @InjectModel(LeaveRequest.name)
    private leaveModel: Model<LeaveRequestDocument>,
    @InjectModel(Employee.name)
    private employeeModel: Model<EmployeeDocument>,
  ) {}

  async getActivePolicy(): Promise<LeavePolicy> {
    const doc = await this.policyModel
      .findOne({ active: true })
      .lean()
      .exec();
    return (doc as LeavePolicy) ?? DEFAULT_POLICY;
  }

  async getBalance(employeeId: string): Promise<LeaveBalance | null> {
    return this.balanceModel.findOne({ employeeId }).lean().exec();
  }

  async validate(input: LeavePolicyInput): Promise<LeavePolicyResult> {
    const [policy, employee, balance, overlapping] = await Promise.all([
      this.getActivePolicy(),
      this.employeeModel
        .findOne({
          $or: [{ id: input.employeeId }, { employeeId: input.employeeId }],
        })
        .lean()
        .exec(),
      this.getBalance(input.employeeId),
      this.leaveModel
        .find({
          employeeId: input.employeeId,
          status: { $in: [...COVERING_LEAVE_STATUSES] },
        })
        .select({ id: 1, startDate: 1, endDate: 1, status: 1 })
        .lean()
        .exec(),
    ]);

    return evaluateLeavePolicy(input, {
      employee: employee
        ? {
            id: (employee as any).id,
            employeeId: (employee as any).employeeId,
            employmentStatus: (employee as any).employmentStatus,
          }
        : null,
      policy: {
        allowedLeaveTypes: policy.allowedLeaveTypes,
        noticeDays: policy.noticeDays,
        noticeSeverity: policy.noticeSeverity,
        halfDayAllowed: policy.halfDayAllowed,
        restrictedPeriods: policy.restrictedPeriods ?? [],
      },
      balances: balance?.balances ?? null,
      overlappingLeaves: (overlapping ?? []).map((l: any) => ({
        id: l.id,
        startDate: l.startDate,
        endDate: l.endDate,
        status: l.status,
      })),
    });
  }
}
