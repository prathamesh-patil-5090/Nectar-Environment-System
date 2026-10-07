import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../../db/schemas/user.schema';
import { Department } from '../../../db/schemas/e-permit-master.schema';

/** What the client keeps as its session — never the password. */
export type LoginAccount = {
  email: string;
  name: string;
  role: string;
  siteId?: string;
  employeeId?: string;
  /** Heads of Department only: the department they head or deputise. */
  departmentName?: string;
  isDeputy?: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Department.name) private readonly departments: Model<Department>,
  ) {}

  /** Accounts listed on the login page, optionally for one role. */
  async listLoginAccounts(role?: string): Promise<LoginAccount[]> {
    const filter: Record<string, unknown> = { active: true, visibleOnLogin: true };
    if (role) filter.role = role;
    const rows = await this.users.find(filter).sort({ email: 1 }).lean();
    const depts = await this.hodDepartments();
    return rows.map((u) => this.toAccount(u, depts));
  }

  async login(email: string, password: string): Promise<LoginAccount> {
    const user = await this.users
      .findOne({ email: String(email ?? '').trim().toLowerCase(), active: true })
      .lean();
    if (!user || user.password !== password) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.toAccount(user, await this.hodDepartments());
  }

  /** person id "user:<email>" → department name + whether they are the deputy. */
  private async hodDepartments(): Promise<Map<string, { name: string; isDeputy: boolean }>> {
    const rows = await this.departments.find({}, { name: 1, headUserId: 1, deputyUserIds: 1 }).lean();
    const map = new Map<string, { name: string; isDeputy: boolean }>();
    for (const d of rows) {
      if (d.headUserId) map.set(d.headUserId, { name: d.name, isDeputy: false });
      for (const id of d.deputyUserIds ?? []) map.set(id, { name: d.name, isDeputy: true });
    }
    return map;
  }

  private toAccount(
    u: Pick<User, 'email' | 'name' | 'role' | 'siteId' | 'employeeId'>,
    depts: Map<string, { name: string; isDeputy: boolean }>,
  ): LoginAccount {
    const dept = u.role === 'hod' ? depts.get(`user:${u.email}`) : undefined;
    return {
      email: u.email,
      name: u.name,
      role: u.role,
      ...(u.siteId ? { siteId: u.siteId } : {}),
      ...(u.employeeId ? { employeeId: u.employeeId } : {}),
      ...(dept ? { departmentName: dept.name, isDeputy: dept.isDeputy } : {}),
    };
  }
}
