import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { Site, SiteSchema } from '../../../db/schemas/site.schema';
import {
  ShiftRoster,
  ShiftRosterSchema,
} from '../../../db/schemas/shift-roster.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Site.name, schema: SiteSchema },
      { name: ShiftRoster.name, schema: ShiftRosterSchema },
    ]),
  ],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
