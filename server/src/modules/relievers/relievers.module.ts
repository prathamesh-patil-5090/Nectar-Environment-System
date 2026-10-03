import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RelieversController } from './relievers.controller';
import { RelieversService } from './relievers.service';
import { Reliever, RelieverSchema } from '../../../db/schemas/reliever.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reliever.name, schema: RelieverSchema },
    ]),
  ],
  controllers: [RelieversController],
  providers: [RelieversService],
  exports: [RelieversService],
})
export class RelieversModule {}
