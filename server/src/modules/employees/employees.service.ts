import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Employee, EmployeeDocument } from '../../../db/schemas/employee.schema';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name) private employeeModel: Model<EmployeeDocument>,
  ) {}

  async findAll(siteId?: string): Promise<Employee[]> {
    const filter =
      siteId && siteId !== 'all' && siteId !== 'undefined' ? { siteId } : {};
    return this.employeeModel.find(filter).lean().exec();
  }

  async findById(id: string): Promise<Employee> {
    const employee = await this.employeeModel
      .findOne({ $or: [{ id }, { employeeId: id }] })
      .lean()
      .exec();
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return employee;
  }

  async update(id: string, data: Partial<Employee>): Promise<Employee> {
    const updated = await this.employeeModel
      .findOneAndUpdate({ $or: [{ id }, { employeeId: id }] }, data, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(`Employee ${id} not found`);
    return updated;
  }

  async count(siteId?: string): Promise<number> {
    const filter =
      siteId && siteId !== 'all' && siteId !== 'undefined' ? { siteId } : {};
    return this.employeeModel.countDocuments(filter).exec();
  }
}
