import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';

@ApiTags('shifts')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('sites')
  @ApiOperation({ summary: 'Get sites for shift roster' })
  getSites(@Query('siteId') siteId?: string) {
    return this.shiftsService.getSites(siteId);
  }

  @Get('rosters')
  @ApiOperation({ summary: 'Get shift rosters' })
  @ApiQuery({ name: 'siteId', required: false })
  getRosters(@Query('siteId') siteId?: string) {
    return this.shiftsService.getRosters(siteId);
  }

  @Get('rosters/:id')
  @ApiOperation({ summary: 'Get shift roster by ID' })
  getRosterById(@Param('id') id: string) {
    return this.shiftsService.getRosterById(id);
  }

  @Post('rosters')
  @ApiOperation({ summary: 'Create rotation roster' })
  createRoster(@Body() data: any) {
    return this.shiftsService.createRoster(data);
  }

  @Patch('rosters/:id')
  @ApiOperation({ summary: 'Update rotation roster' })
  updateRoster(@Param('id') id: string, @Body() data: any) {
    return this.shiftsService.updateRoster(id, data);
  }

  @Get('change-requests')
  @ApiOperation({ summary: 'Get shift change requests' })
  @ApiQuery({ name: 'siteId', required: false })
  getChangeRequests(@Query('siteId') siteId?: string) {
    return this.shiftsService.getChangeRequests(siteId);
  }

  @Post('change-requests')
  @ApiOperation({ summary: 'Create a shift change request' })
  createChangeRequest(@Body() data: any) {
    return this.shiftsService.createChangeRequest(data);
  }

  @Patch('change-requests/:id')
  @ApiOperation({ summary: 'Update/decide a shift change request' })
  updateChangeRequest(@Param('id') id: string, @Body() data: any) {
    return this.shiftsService.updateChangeRequest(id, data);
  }
}
