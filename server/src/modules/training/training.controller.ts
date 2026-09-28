import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TrainingService } from './training.service';

@ApiTags('training')
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('courses')
  @ApiOperation({ summary: 'Get all training courses' })
  @ApiQuery({ name: 'section', required: false })
  findAllCourses(@Query('section') section?: string) {
    return this.trainingService.findAllCourses(section);
  }

  @Get('courses/:id')
  @ApiOperation({ summary: 'Get course by ID' })
  findCourseById(@Param('id') id: string) {
    return this.trainingService.findCourseById(id);
  }

  @Get('records')
  @ApiOperation({ summary: 'Get unified training records (with progress and 4x test scores)' })
  @ApiQuery({ name: 'employeeId', required: false })
  findRecords(@Query('employeeId') employeeId?: string) {
    return this.trainingService.findRecords(employeeId);
  }

  @Post('records')
  @ApiOperation({ summary: 'Save or update training record' })
  saveRecord(@Body() data: any) {
    return this.trainingService.saveRecord(data);
  }

  // Backward compatibility alias for enrollments
  @Get('enrollments')
  @ApiOperation({ summary: 'Get course enrollments' })
  @ApiQuery({ name: 'employeeId', required: false })
  findEnrollments(@Query('employeeId') employeeId?: string) {
    return this.trainingService.findEnrollments(employeeId);
  }

  @Post('enrollments')
  @ApiOperation({ summary: 'Save or update course enrollment' })
  saveEnrollment(@Body() data: any) {
    return this.trainingService.saveEnrollment(data);
  }

  @Get('certificates')
  @ApiOperation({ summary: 'Get certificates' })
  @ApiQuery({ name: 'employeeId', required: false })
  findCertificates(@Query('employeeId') employeeId?: string) {
    return this.trainingService.findCertificates(employeeId);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get scheduled training sessions & drills' })
  @ApiQuery({ name: 'employeeId', required: false })
  findSessions(@Query('employeeId') employeeId?: string) {
    return this.trainingService.findSessions(employeeId);
  }
}
