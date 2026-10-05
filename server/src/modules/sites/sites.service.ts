import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OPERATIONAL_SITE_FILTER, Site, SiteDocument } from '../../../db/schemas/site.schema';

@Injectable()
export class SitesService {
  constructor(@InjectModel(Site.name) private siteModel: Model<SiteDocument>) {}

  /** Running plants only, unless `includePipeline` (new / upcoming / closed plants — Director view). */
  async findAll(includePipeline = false): Promise<Site[]> {
    return this.siteModel.find(includePipeline ? {} : OPERATIONAL_SITE_FILTER).lean().exec();
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
