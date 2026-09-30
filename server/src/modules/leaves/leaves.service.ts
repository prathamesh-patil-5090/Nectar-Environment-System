import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LeaveRequest,
  LeaveRequestDocument,
} from '../../../db/schemas/leave-request.schema';
import { assertLeaveTransition } from './leave-transitions';
import { LeavePolicyService } from './leave-policy.service';
import type { LeavePolicyInput, LeavePolicyResult } from './leave-policy.engine';

@Injectable()
export class LeavesService {
  constructor(
    @InjectModel(LeaveRequest.name)
    private leaveModel: Model<LeaveRequestDocument>,
    private readonly leavePolicyService: LeavePolicyService,
  ) {}

  async findAll(siteId?: string, employeeId?: string): Promise<LeaveRequest[]> {
    const filter: Record<string, string> = {};
    if (siteId) filter.siteId = siteId;
    if (employeeId) filter.employeeId = employeeId;
    return this.leaveModel.find(filter).sort({ createdAt: -1 }).lean().exec();
  }

  async findById(id: string): Promise<LeaveRequest> {
    const leave = await this.leaveModel.findOne({ id }).lean().exec();
    if (!leave) throw new NotFoundException(`Leave request ${id} not found`);
    return leave;
  }

  async validatePolicy(input: LeavePolicyInput): Promise<LeavePolicyResult> {
    return this.leavePolicyService.validate(input);
  }

  async getPolicy() {
    return this.leavePolicyService.getActivePolicy();
  }

  async getBalance(employeeId: string) {
    const balance = await this.leavePolicyService.getBalance(employeeId);
    if (!balance) {
      return {
        employeeId,
        balances: {
          casual: 0,
          sick: 0,
          family_emergency: 0,
          unpaid: 30,
          other: 0,
        },
      };
    }
    return balance;
  }

  async create(data: Partial<LeaveRequest> & Record<string, any>): Promise<LeaveRequest> {
    const now = new Date().toISOString();
    const id =
      data.id && String(data.id).trim()
        ? String(data.id)
        : `lv-${Date.now().toString(36)}`;

    const existing = await this.leaveModel.findOne({ id }).lean().exec();
    if (existing) {
      return existing;
    }

    const policyInput: LeavePolicyInput = {
      employeeId: data.employeeId!,
      mode: (data.mode as string) ?? 'planned',
      leaveType: data.leaveType ?? 'casual',
      startDate: data.startDate!,
      endDate: data.endDate!,
      expectedReturnDate: data.expectedReturnDate,
      entrySource: data.entrySource,
      isHalfDay: Boolean(data.isHalfDay),
      halfDaySlot: data.halfDaySlot,
    };

    const policyResult = await this.leavePolicyService.validate(policyInput);
    if (policyResult.verdict === 'BLOCK') {
      throw new BadRequestException({
        message: 'Leave policy blocked this request',
        policyVerdict: policyResult.verdict,
        policyFlags: policyResult.flags,
        suggestions: policyResult.suggestions,
      });
    }

    const available =
      policyResult.balanceSnapshot?.available ?? data.leaveBalanceDays ?? 0;

    const created = new this.leaveModel({
      ...data,
      id,
      status: data.status ?? 'REQUESTED',
      daysRequested: policyResult.daysRequested || data.daysRequested || 1,
      leaveBalanceDays: available,
      isHalfDay: Boolean(data.isHalfDay),
      halfDaySlot: data.halfDaySlot,
      policyVerdict: policyResult.verdict,
      policyFlags: policyResult.flags,
      policySuggestions: policyResult.suggestions,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
      timeline: data.timeline ?? [],
    });
    return created.save();
  }

  async updateStatus(
    id: string,
    status: string,
    meta?: Record<string, unknown>,
  ): Promise<LeaveRequest> {
    if (!status) {
      throw new BadRequestException('status is required');
    }

    const current = await this.leaveModel.findOne({ id }).lean().exec();
    if (!current) throw new NotFoundException(`Leave request ${id} not found`);

    try {
      assertLeaveTransition(current.mode, current.status, status);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid leave transition',
      );
    }

    const { id: _ignoreId, status: _ignoreStatus, ...safeMeta } = meta ?? {};

    if (status === 'CANCELLED') {
      const reason =
        typeof safeMeta.cancellationReason === 'string'
          ? safeMeta.cancellationReason.trim()
          : '';
      if (!reason) {
        throw new BadRequestException(
          'A reason is required to withdraw this leave',
        );
      }
      safeMeta.cancellationReason = reason;
      if (!safeMeta.cancelledAt) {
        safeMeta.cancelledAt = new Date().toISOString();
      }
    }

    const updated = await this.leaveModel
      .findOneAndUpdate(
        { id },
        {
          ...safeMeta,
          status,
          updatedAt: new Date().toISOString(),
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`Leave request ${id} not found`);
    return updated;
  }
}
