import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reliever, RelieverDocument } from '../../../db/schemas/reliever.schema';

@Injectable()
export class RelieversService {
  constructor(
    @InjectModel(Reliever.name) private relieverModel: Model<RelieverDocument>,
  ) {}

  async findAll(status?: string): Promise<Reliever[]> {
    const filter = status ? { availability: status } : {};
    return this.relieverModel.find(filter).lean().exec();
  }

  async findById(id: string): Promise<Reliever> {
    const found = await this.relieverModel
      .findOne({ $or: [{ id }, { employeeId: id }] })
      .lean()
      .exec();
    if (!found) {
      throw new NotFoundException(`Reliever with ID ${id} not found`);
    }
    return found;
  }

  async updateAvailability(
    id: string,
    availability: string,
  ): Promise<Reliever> {
    const updated = await this.relieverModel
      .findOneAndUpdate(
        { $or: [{ id }, { employeeId: id }] },
        { availability },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException(`Reliever with ID ${id} not found`);
    }
    return updated;
  }

  async assign(data: { relieverId: string; siteId: string; absenceId?: string }): Promise<Reliever> {
    const updated = await this.relieverModel
      .findOneAndUpdate(
        { $or: [{ id: data.relieverId }, { employeeId: data.relieverId }] },
        {
          availability: 'assigned',
          assignedSiteId: data.siteId,
          assignedAbsenceId: data.absenceId,
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException(`Reliever with ID ${data.relieverId} not found`);
    }
    return updated;
  }
}
