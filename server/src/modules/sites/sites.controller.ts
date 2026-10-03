import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SitesService } from './sites.service';

@ApiTags('sites')
@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  @ApiOperation({ summary: 'Get operational plant sites (scope=all adds new, upcoming and closed plants)' })
  @ApiQuery({ name: 'scope', required: false, enum: ['all'] })
  findAll(@Query('scope') scope?: string) {
    return this.sitesService.findAll(scope === 'all');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plant site by id' })
  findById(@Param('id') id: string) {
    return this.sitesService.findById(id);
  }
}
