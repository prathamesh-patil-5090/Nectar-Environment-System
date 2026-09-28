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

  @Get('recommendations')
  @ApiOperation({ summary: 'Get 4-tier personalized course recommendations (100% DB-backed)' })
  @ApiQuery({ name: 'employeeId', required: false })
  getRecommendations(@Query('employeeId') employeeId?: string) {
    return this.trainingService.getPersonalizedRecommendations(employeeId);
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Get manager directives & training assignments' })
  @ApiQuery({ name: 'employeeId', required: false })
  getAssignments(@Query('employeeId') employeeId?: string) {
    return this.trainingService.findAssignments(employeeId);
  }

  @Post('assignments')
  @ApiOperation({ summary: 'Create manager training directive/assignment for employee' })
  createAssignment(@Body() body: any) {
    return this.trainingService.createAssignment(body);
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

  // -------------------------------------------------------------------
  // Executive & Plant Lead Masterclasses (Mentor Live Sessions)
  // -------------------------------------------------------------------
  @Get('mentor-sessions')
  @ApiOperation({ summary: 'Get all Executive & Plant Lead Masterclasses' })
  findAllMentorSessions() {
    return this.trainingService.findAllMentorLiveSessions();
  }

  @Get('mentor-sessions/:id')
  @ApiOperation({ summary: 'Get Masterclass by ID' })
  findMentorSessionById(@Param('id') id: string) {
    return this.trainingService.findMentorLiveSessionById(id);
  }

  @Post('mentor-sessions/:id/enroll')
  @ApiOperation({ summary: 'Enroll employee in Masterclass (capped at 30-35 slots) with optional doubt/question' })
  enrollInMentorSession(
    @Param('id') id: string,
    @Body() body: { employeeId: string; employeeName: string; question?: string },
  ) {
    return this.trainingService.enrollInMentorLiveSession(
      id,
      body.employeeId,
      body.employeeName,
      body.question,
    );
  }

  @Post('mentor-sessions/:id/cancel')
  @ApiOperation({ summary: 'Cancel Masterclass enrollment' })
  cancelMentorSession(
    @Param('id') id: string,
    @Body() body: { employeeId: string },
  ) {
    return this.trainingService.cancelMentorLiveSession(id, body.employeeId);
  }

  @Post('mentor-sessions/:id/questions')
  @ApiOperation({ summary: 'Submit doubt/question to Masterclass mentor' })
  addQuestionToMentorSession(
    @Param('id') id: string,
    @Body() body: { employeeId: string; employeeName: string; question: string },
  ) {
    return this.trainingService.addQuestionToMentorSession(
      id,
      body.employeeId,
      body.employeeName,
      body.question,
    );
  }
}
