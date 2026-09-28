import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';
import { LeaveRequest, LeaveRequestSchema } from '../../../db/schemas/leave-request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LeaveRequest.name, schema: LeaveRequestSchema }]),
  ],
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
