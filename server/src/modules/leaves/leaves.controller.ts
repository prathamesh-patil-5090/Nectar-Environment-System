import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { LeavesService } from './leaves.service';

@ApiTags('leaves')
@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Get('policy')
  @ApiOperation({ summary: 'Get active org leave policy' })
  getPolicy() {
    return this.leavesService.getPolicy();
  }

  @Get('balances/:employeeId')
  @ApiOperation({ summary: 'Get leave balances for an employee' })
  getBalance(@Param('employeeId') employeeId: string) {
    return this.leavesService.getBalance(employeeId);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Dry-run leave policy validation (PASS / WARN / BLOCK)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['employeeId', 'mode', 'leaveType', 'startDate', 'endDate'],
      properties: {
        employeeId: { type: 'string' },
        mode: { type: 'string', enum: ['planned', 'emergency'] },
        leaveType: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        expectedReturnDate: { type: 'string' },
        entrySource: { type: 'string' },
        isHalfDay: { type: 'boolean' },
        halfDaySlot: { type: 'string', enum: ['morning', 'afternoon'] },
        asOfDate: { type: 'string' },
      },
    },
  })
  validate(@Body() body: Record<string, any>) {
    return this.leavesService.validatePolicy(body as any);
  }

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
  @ApiOperation({ summary: 'Create a new leave request (policy-gated)' })
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
