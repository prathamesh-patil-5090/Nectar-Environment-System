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

@Injectable()
export class LeavesService {
  constructor(
    @InjectModel(LeaveRequest.name)
    private leaveModel: Model<LeaveRequestDocument>,
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

  async create(data: Partial<LeaveRequest>): Promise<LeaveRequest> {
    const now = new Date().toISOString();
    const id =
      data.id && String(data.id).trim()
        ? String(data.id)
        : `lv-${Date.now().toString(36)}`;

    const existing = await this.leaveModel.findOne({ id }).lean().exec();
    if (existing) {
      // Idempotent create (client may retry after optimistic write)
      return existing;
    }

    const created = new this.leaveModel({
      ...data,
      id,
      status: data.status ?? 'REQUESTED',
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
