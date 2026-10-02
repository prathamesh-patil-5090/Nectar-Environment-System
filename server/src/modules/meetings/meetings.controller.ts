import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';

@ApiTags('meetings')
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  @ApiOperation({ summary: 'List meetings (coming soon — returns empty list)' })
  findAll() {
    return this.meetingsService.findAll();
  }
}
