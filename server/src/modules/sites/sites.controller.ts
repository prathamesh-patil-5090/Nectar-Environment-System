import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SitesService } from './sites.service';

@ApiTags('sites')
@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all plant sites' })
  findAll() {
    return this.sitesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plant site by id' })
  findById(@Param('id') id: string) {
    return this.sitesService.findById(id);
  }
}
