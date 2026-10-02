import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Employee, EmployeeDocument } from '../../../db/schemas/employee.schema';
import { Site, SiteDocument } from '../../../db/schemas/site.schema';
import { Leader, LeaderDocument } from '../../../db/schemas/leader.schema';
import { MentorProfile, MentorProfileDocument } from '../../../db/schemas/training';

/** Employee as the training module needs it: identity, role and plant. */
export type Person = {
  id: string;
  name: string;
  designation?: string;
  siteId?: string;
  siteName?: string;
  plantType?: string;
  role: string; // UserRole
  photoUrl?: string;
  managerId?: string;
  isLeader?: boolean; // not an employee (e.g. the Director)
};

/** employees.employeeCategory → client UserRole */
const CATEGORY_ROLE: Record<string, string> = {
  shift: 'employee',
  general: 'employee',
};

export const roleOf = (employeeCategory?: string) =>
  CATEGORY_ROLE[employeeCategory ?? ''] ?? employeeCategory ?? 'employee';

@Injectable()
export class PeopleService {
  constructor(
    @InjectModel(Employee.name) private employeeModel: Model<EmployeeDocument>,
    @InjectModel(Site.name) private siteModel: Model<SiteDocument>,
    @InjectModel(MentorProfile.name) private mentorModel: Model<MentorProfileDocument>,
    @InjectModel(Leader.name) private leaderModel: Model<LeaderDocument>,
  ) {}

  private async sitesById(): Promise<Map<string, Site>> {
    const sites = await this.siteModel.find().lean().exec();
    return new Map(sites.map((s) => [s.id, s]));
  }

  private toPerson(e: Employee, sites: Map<string, Site>, photos: Map<string, string>): Person {
    const site = e.siteId ? sites.get(e.siteId) : undefined;
    return {
      id: e.id,
      name: e.name,
      designation: e.designation,
      siteId: e.siteId ?? undefined,
      siteName: site?.name,
      plantType: site?.plantType,
      role: roleOf(e.employeeCategory),
      photoUrl: photos.get(e.id),
      managerId: e.managerId ?? undefined,
    };
  }

  async many(ids: string[]): Promise<Map<string, Person>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const [employees, leaders, sites, mentors] = await Promise.all([
      this.employeeModel.find({ id: { $in: unique } }).lean().exec(),
      this.leaderModel.find({ id: { $in: unique }, active: true }).lean().exec(),
      this.sitesById(),
      this.mentorModel.find({ employeeId: { $in: unique } }).lean().exec(),
    ]);
    const photos = new Map(mentors.filter((m) => m.photoUrl).map((m) => [m.employeeId, m.photoUrl as string]));
    const out = new Map(employees.map((e) => [e.id, this.toPerson(e, sites, photos)]));
    for (const l of leaders) {
      out.set(l.id, { id: l.id, name: l.name, designation: l.title, role: l.role, photoUrl: photos.get(l.id), isLeader: true });
    }
    return out;
  }

  async one(id: string): Promise<Person | undefined> {
    return (await this.many([id])).get(id);
  }

  /** All active employees matching any of the given roles / plant types. Empty filter = nobody. */
  async matching(filter: { roles?: string[]; plantTypes?: string[] }): Promise<Person[]> {
    const roles = filter.roles ?? [];
    const plantTypes = filter.plantTypes ?? [];
    if (!roles.length && !plantTypes.length) return [];
    const [employees, sites] = await Promise.all([
      this.employeeModel.find({ employmentStatus: { $ne: 'inactive' } }).lean().exec(),
      this.sitesById(),
    ]);
    return employees
      .map((e) => this.toPerson(e, sites, new Map()))
      .filter(
        (p) =>
          (!roles.length || roles.includes(p.role)) &&
          (!plantTypes.length || (p.plantType !== undefined && plantTypes.includes(p.plantType))),
      );
  }

  async all(): Promise<Person[]> {
    const [employees, sites] = await Promise.all([
      this.employeeModel.find({ employmentStatus: { $ne: 'inactive' } }).lean().exec(),
      this.sitesById(),
    ]);
    return employees.map((e) => this.toPerson(e, sites, new Map()));
  }

  async siteName(siteId: string): Promise<string | undefined> {
    return (await this.siteModel.findOne({ id: siteId }).lean().exec())?.name;
  }

  async isActiveMentor(employeeId?: string): Promise<boolean> {
    if (!employeeId) return false;
    return Boolean(await this.mentorModel.exists({ employeeId, active: true }));
  }
}
