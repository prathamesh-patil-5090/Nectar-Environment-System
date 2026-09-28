import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Site, SiteDocument } from '../../../db/schemas/site.schema';
import {
  ShiftRoster,
  ShiftRosterDocument,
} from '../../../db/schemas/shift-roster.schema';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectModel(Site.name) private siteModel: Model<SiteDocument>,
    @InjectModel(ShiftRoster.name)
    private rosterModel: Model<ShiftRosterDocument>,
  ) {}

  async getSites(siteId?: string): Promise<Site[]> {
    const filter =
      siteId && siteId !== 'all' && siteId !== 'undefined' ? { siteId } : {};
    return this.siteModel.find(filter).lean().exec();
  }

  async getRosters(siteId?: string): Promise<ShiftRoster[]> {
    const filter =
      siteId && siteId !== 'all' && siteId !== 'undefined' ? { siteId } : {};
    return this.rosterModel.find(filter).sort({ fromDate: -1 }).lean().exec();
  }

  async getRosterById(id: string): Promise<ShiftRoster> {
    const found = await this.rosterModel.findOne({ id }).lean().exec();
    if (!found) {
      throw new NotFoundException(`Roster with ID ${id} not found`);
    }
    return found;
  }

  async createRoster(data: Partial<ShiftRoster>): Promise<ShiftRoster> {
    const created = new this.rosterModel(data);
    return created.save();
  }

  async updateRoster(
    id: string,
    data: Partial<ShiftRoster>,
  ): Promise<ShiftRoster> {
    const updated = await this.rosterModel
      .findOneAndUpdate({ id }, data, { new: true })
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException(`Roster with ID ${id} not found`);
    }
    return updated;
  }

  async getChangeRequests(siteId?: string): Promise<any[]> {
    const rosters = await this.getRosters(siteId);
    const allRequests: any[] = [];
    for (const r of rosters) {
      if (r.changeRequests && Array.isArray(r.changeRequests)) {
        allRequests.push(...r.changeRequests);
      }
    }
    return allRequests;
  }

  async createChangeRequest(data: any): Promise<any> {
    const roster = await this.rosterModel.findOne({ siteId: data.siteId }).exec();
    if (roster) {
      if (!roster.changeRequests) roster.changeRequests = [];
      roster.changeRequests.push(data);
      await roster.save();
      return data;
    }
    return data;
  }

  async updateChangeRequest(id: string, data: any): Promise<any> {
    const roster = await this.rosterModel.findOne({ 'changeRequests.id': id }).exec();
    if (roster && roster.changeRequests) {
      const idx = roster.changeRequests.findIndex((c) => c.id === id);
      if (idx !== -1) {
        roster.changeRequests[idx] = { ...roster.changeRequests[idx], ...data };
        roster.markModified('changeRequests');
        await roster.save();
        return roster.changeRequests[idx];
      }
    }
    return data;
  }
}
