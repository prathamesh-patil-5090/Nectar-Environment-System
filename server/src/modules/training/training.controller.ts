import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TrainingService } from './training.service';
import { FeedService } from './feed.service';

@ApiTags('training')
@Controller('training')
export class TrainingController {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly feed: FeedService,
  ) {}

  @Get('courses')
  @ApiOperation({ summary: 'Get all training courses' })
  @ApiQuery({ name: 'section', required: false })
  findAllCourses(@Query('section') section?: string) {
    return this.trainingService.findAllCourses(section);
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Explainable recommendations: { course, score, reasons[], reason }' })
  @ApiQuery({ name: 'employeeId', required: true })
  getRecommendations(@Query('employeeId') employeeId: string) {
    return this.feed.recommendations(employeeId);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Personal Training Home: assigned, continue, recommended, role paths, events, popular' })
  @ApiQuery({ name: 'employeeId', required: true })
  getFeed(@Query('employeeId') employeeId: string) {
    return this.feed.home(employeeId);
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Explore catalog with the viewer status per course' })
  @ApiQuery({ name: 'employeeId', required: false })
  getCatalog(@Query('employeeId') employeeId?: string) {
    return this.feed.catalog(employeeId);
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Manager assignments & weak-area flags' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'assignedBy', required: false })
  @ApiQuery({ name: 'kind', required: false, enum: ['mandatory', 'suggested'] })
  @ApiQuery({ name: 'status', required: false, description: 'open | resolved | dismissed' })
  getAssignments(
    @Query('employeeId') employeeId?: string,
    @Query('assignedBy') assignedBy?: string,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
  ) {
    return this.trainingService.findAssignments({ employeeId, assignedBy, kind, status });
  }

  @Post('assignments')
  @ApiOperation({ summary: 'Assign a course, or flag a weak topic, for one or more employees (notifies each)' })
  createAssignment(@Body() body: any) {
    return this.trainingService.createAssignments(body);
  }

  @Patch('assignments/:id')
  @ApiOperation({ summary: 'Edit an assignment (creator only)' })
  updateAssignment(@Param('id') id: string, @Body() body: any) {
    return this.trainingService.updateAssignment(id, body, body?.actorId);
  }

  @Post('assignments/:id/resolve')
  @ApiOperation({ summary: 'Mark resolved (notifies the creator)' })
  resolveAssignment(@Param('id') id: string, @Body() body: { actorId: string }) {
    return this.trainingService.closeAssignment(id, 'resolved', body?.actorId);
  }

  @Post('assignments/:id/dismiss')
  @ApiOperation({ summary: 'Dismiss (creator only)' })
  dismissAssignment(@Param('id') id: string, @Body() body: { actorId: string }) {
    return this.trainingService.closeAssignment(id, 'dismissed', body?.actorId);
  }

  @Get('role-paths')
  @ApiOperation({ summary: 'Role learning paths' })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'designation', required: false })
  @ApiQuery({ name: 'plantType', required: false })
  getRolePaths(
    @Query('role') role?: string,
    @Query('designation') designation?: string,
    @Query('plantType') plantType?: string,
  ) {
    return this.trainingService.findRolePaths({ role, designation, plantType });
  }

  @Get('courses/:id')
  @ApiOperation({ summary: 'Get course by ID' })
  findCourseById(@Param('id') id: string) {
    return this.trainingService.findCourseById(id);
  }

  @Patch('courses/:id/content')
  @ApiOperation({ summary: 'Course authoring: quiz / skill-map / written questions, validity (HR / Director)' })
  updateCourseContent(@Param('id') id: string, @Body() body: any) {
    return this.trainingService.updateCourseContent(id, body);
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

  @Post('sessions')
  @ApiOperation({ summary: 'Schedule a practical / oral assessment slot (notifies candidates)' })
  createSession(@Body() body: any) {
    return this.trainingService.createSession(body);
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
