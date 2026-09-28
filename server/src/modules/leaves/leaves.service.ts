import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LeaveRequest, LeaveRequestDocument } from '../../../db/schemas/leave-request.schema';

@Injectable()
export class LeavesService {
  constructor(
    @InjectModel(LeaveRequest.name) private leaveModel: Model<LeaveRequestDocument>,
  ) {}

  async findAll(siteId?: string, employeeId?: string): Promise<LeaveRequest[]> {
    const filter: any = {};
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
    const created = new this.leaveModel(data);
    return created.save();
  }

  async updateStatus(id: string, status: string, meta?: Record<string, any>): Promise<LeaveRequest> {
    const updated = await this.leaveModel
      .findOneAndUpdate({ id }, { status, ...meta, updatedAt: new Date().toISOString() }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(`Leave request ${id} not found`);
    return updated;
  }
}
