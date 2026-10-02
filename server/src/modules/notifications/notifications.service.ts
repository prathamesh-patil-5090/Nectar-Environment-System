import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from '../../../db/schemas/notification.schema';

export type NotifyInput = {
  employeeId: string;
  kind: string;
  title: string;
  body: string;
  href?: string;
  meta?: Record<string, string>;
};

const newId = () => `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
  ) {}

  async findForEmployee(employeeId: string, unreadOnly = false): Promise<Notification[]> {
    const filter: Record<string, unknown> = { employeeId };
    if (unreadOnly) filter.read = false;
    return this.notificationModel.find(filter).sort({ createdAt: -1 }).limit(200).lean().exec();
  }

  async notify(input: NotifyInput): Promise<Notification> {
    const doc = await this.notificationModel.create({ ...input, id: newId(), read: false });
    return doc.toObject();
  }

  async notifyMany(inputs: NotifyInput[]): Promise<void> {
    if (!inputs.length) return;
    await this.notificationModel.insertMany(inputs.map((n) => ({ ...n, id: newId(), read: false })));
  }

  async markRead(id: string): Promise<Notification> {
    const row = await this.notificationModel
      .findOneAndUpdate({ id }, { read: true }, { new: true })
      .lean()
      .exec();
    if (!row) throw new NotFoundException(`Notification ${id} not found`);
    return row;
  }

  async markAllRead(employeeId: string): Promise<{ updated: number }> {
    const res = await this.notificationModel.updateMany({ employeeId, read: false }, { read: true }).exec();
    return { updated: res.modifiedCount };
  }
}
