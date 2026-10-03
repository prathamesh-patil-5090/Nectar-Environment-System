import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Site, SiteDocument } from '../../../db/schemas/site.schema';

@Injectable()
export class SitesService {
  constructor(@InjectModel(Site.name) private siteModel: Model<SiteDocument>) {}

  async findAll(): Promise<Site[]> {
    return this.siteModel.find().lean().exec();
  }

  async findById(id: string): Promise<Site> {
    const site = await this.siteModel
      .findOne({ $or: [{ id }, { siteId: id }] })
      .lean()
      .exec();
    if (!site) throw new NotFoundException(`Site ${id} not found`);
    return site;
  }
}
