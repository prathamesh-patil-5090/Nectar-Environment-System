import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MentorProfile, MentorProfileDocument } from '../../../db/schemas/training';
import { PeopleService } from './people.service';

export type MentorInput = Partial<
  Pick<MentorProfile, 'title' | 'department' | 'bio' | 'photoUrl' | 'specialties' | 'active'>
>;

@Injectable()
export class MentorsService {
  constructor(
    @InjectModel(MentorProfile.name) private mentorModel: Model<MentorProfileDocument>,
    private readonly people: PeopleService,
  ) {}

  list(activeOnly = true) {
    return this.mentorModel.find(activeOnly ? { active: true } : {}).sort({ name: 1 }).lean().exec();
  }

  async getByEmployee(employeeId: string) {
    const m = await this.mentorModel.findOne({ employeeId }).lean().exec();
    if (!m) throw new NotFoundException(`${employeeId} is not a mentor`);
    return m;
  }

  /** Make an employee a mentor, or update their profile. Name always comes from the employee record. */
  async upsert(employeeId: string, input: MentorInput) {
    const person = await this.people.one(employeeId);
    if (!person) throw new BadRequestException(`Employee ${employeeId} not found`);
    return this.mentorModel
      .findOneAndUpdate(
        { employeeId },
        {
          ...input,
          employeeId,
          name: person.name,
          title: input.title ?? person.designation,
          $setOnInsert: { id: `mentor-${employeeId}` },
        },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
  }
}
