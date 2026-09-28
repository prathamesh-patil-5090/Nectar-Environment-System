import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RelieversService } from './relievers.service';

@ApiTags('relievers')
@Controller('relievers')
export class RelieversController {
  constructor(private readonly relieversService: RelieversService) {}

  @Get()
  @ApiOperation({ summary: 'Get all relievers in the pool' })
  @ApiQuery({ name: 'status', required: false })
  findAll(@Query('status') status?: string) {
    return this.relieversService.findAll(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reliever by ID or employee ID' })
  findById(@Param('id') id: string) {
    return this.relieversService.findById(id);
  }

  @Patch(':id/availability')
  @ApiOperation({ summary: 'Update reliever availability' })
  updateAvailability(
    @Param('id') id: string,
    @Body('availability') availability: string,
  ) {
    return this.relieversService.updateAvailability(id, availability);
  }

  @Post('assign')
  @ApiOperation({ summary: 'Assign a reliever to a site/absence' })
  assign(@Body() data: { relieverId: string; siteId: string; absenceId?: string }) {
    return this.relieversService.assign(data);
  }
}
