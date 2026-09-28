import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LeavesService } from './leaves.service';

@ApiTags('leaves')
@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all leave requests' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'employeeId', required: false })
  findAll(
    @Query('siteId') siteId?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.leavesService.findAll(siteId, employeeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave request by ID' })
  findOne(@Param('id') id: string) {
    return this.leavesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new leave request' })
  create(@Body() body: Record<string, any>) {
    return this.leavesService.create(body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update leave request status' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; [key: string]: any },
  ) {
    const { status, ...meta } = body;
    return this.leavesService.updateStatus(id, status, meta);
  }
}
