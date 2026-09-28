import { Controller, Get, Param, Patch, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all employees, optionally filtered by siteId' })
  @ApiQuery({ name: 'siteId', required: false, description: 'Filter by plant site ID' })
  findAll(@Query('siteId') siteId?: string) {
    return this.employeesService.findAll(siteId);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get employee count, optionally filtered by siteId' })
  @ApiQuery({ name: 'siteId', required: false })
  count(@Query('siteId') siteId?: string) {
    return this.employeesService.count(siteId).then((c) => ({ count: c }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single employee by id or employeeId' })
  findOne(@Param('id') id: string) {
    return this.employeesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee fields' })
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.employeesService.update(id, body);
  }
}
