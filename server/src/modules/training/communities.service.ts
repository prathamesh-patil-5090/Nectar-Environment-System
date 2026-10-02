import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Community, CommunityDocument } from '../../../db/schemas/training';
import { PeopleService } from './people.service';

const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export type CommunityInput = Partial<
  Pick<Community, 'name' | 'description' | 'domain' | 'coverUrl' | 'organizerEmployeeIds' | 'autoJoin'>
>;

@Injectable()
export class CommunitiesService {
  constructor(
    @InjectModel(Community.name) private communityModel: Model<CommunityDocument>,
    private readonly people: PeopleService,
  ) {}

  /** Effective members = explicit + autoJoin matches − opted out. */
  async memberIds(communityId: string): Promise<string[]> {
    const c = await this.communityModel.findOne({ id: communityId }).lean().exec();
    if (!c) return [];
    return this.effectiveMembers(c);
  }

  private async effectiveMembers(c: Community): Promise<string[]> {
    const auto = (await this.people.matching(c.autoJoin ?? {})).map((p) => p.id);
    const out = new Set([...c.memberEmployeeIds, ...auto, ...c.organizerEmployeeIds]);
    c.optedOutEmployeeIds.forEach((id) => out.delete(id));
    return [...out];
  }

  private async decorate(c: Community, viewerId?: string) {
    const members = await this.effectiveMembers(c);
    const organizers = await this.people.many(c.organizerEmployeeIds);
    return {
      ...c,
      organizers: c.organizerEmployeeIds.map((id) => organizers.get(id)).filter(Boolean),
      memberCount: members.length,
      isMember: Boolean(viewerId && members.includes(viewerId)),
    };
  }

  async list(viewerId?: string) {
    const all = await this.communityModel.find().sort({ name: 1 }).lean().exec();
    return Promise.all(all.map((c) => this.decorate(c, viewerId)));
  }

  async getBySlug(slug: string, viewerId?: string) {
    const c = await this.communityModel.findOne({ $or: [{ slug }, { id: slug }] }).lean().exec();
    if (!c) throw new NotFoundException(`Community ${slug} not found`);
    return this.decorate(c, viewerId);
  }

  async members(slug: string) {
    const c = await this.communityModel.findOne({ $or: [{ slug }, { id: slug }] }).lean().exec();
    if (!c) throw new NotFoundException(`Community ${slug} not found`);
    const people = await this.people.many(await this.effectiveMembers(c));
    return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(input: CommunityInput) {
    if (!input.name?.trim()) throw new BadRequestException('Name is required');
    const slug = slugify(input.name);
    if (await this.communityModel.exists({ slug })) throw new BadRequestException('A community with this name exists');
    const doc = await this.communityModel.create({
      id: `com-${slug}`,
      slug,
      name: input.name.trim(),
      description: input.description ?? '',
      domain: input.domain,
      coverUrl: input.coverUrl,
      organizerEmployeeIds: input.organizerEmployeeIds ?? [],
      autoJoin: input.autoJoin ?? {},
    });
    return this.decorate(doc.toObject());
  }

  async update(slug: string, input: CommunityInput) {
    const c = await this.communityModel
      .findOneAndUpdate({ $or: [{ slug }, { id: slug }] }, input, { new: true })
      .lean()
      .exec();
    if (!c) throw new NotFoundException(`Community ${slug} not found`);
    return this.decorate(c);
  }

  async join(slug: string, employeeId: string) {
    if (!employeeId) throw new BadRequestException('employeeId is required');
    const c = await this.communityModel
      .findOneAndUpdate(
        { $or: [{ slug }, { id: slug }] },
        { $addToSet: { memberEmployeeIds: employeeId }, $pull: { optedOutEmployeeIds: employeeId } },
        { new: true },
      )
      .lean()
      .exec();
    if (!c) throw new NotFoundException(`Community ${slug} not found`);
    return this.decorate(c, employeeId);
  }

  async leave(slug: string, employeeId: string) {
    if (!employeeId) throw new BadRequestException('employeeId is required');
    const c = await this.communityModel
      .findOneAndUpdate(
        { $or: [{ slug }, { id: slug }] },
        { $pull: { memberEmployeeIds: employeeId }, $addToSet: { optedOutEmployeeIds: employeeId } },
        { new: true },
      )
      .lean()
      .exec();
    if (!c) throw new NotFoundException(`Community ${slug} not found`);
    return this.decorate(c, employeeId);
  }
}
