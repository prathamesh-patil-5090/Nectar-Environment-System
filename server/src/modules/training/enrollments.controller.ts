import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AbilityScore } from '../../../db/schemas/training';
import { EnrollmentsService } from './enrollments.service';

/** Learning progress and assessment gates. All scoring happens here, never in the browser. */
@ApiTags('training')
@Controller('training')
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Get('enrollments')
  @ApiOperation({ summary: 'Enrollments (progress + assessment results)' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'courseId', required: false })
  list(@Query('employeeId') employeeId?: string, @Query('courseId') courseId?: string) {
    return this.enrollments.list({ employeeId, courseId });
  }

  @Post('enrollments')
  @ApiOperation({ summary: 'Enroll (get-or-create)' })
  enroll(@Body() body: { employeeId: string; courseId: string }) {
    return this.enrollments.enroll(body.employeeId, body.courseId);
  }

  @Post('enrollments/:id/video')
  @ApiOperation({ summary: 'Record video progress (>= 90% completes the video)' })
  video(@Param('id') id: string, @Body() body: { abilityId: string; watchedPct: number }) {
    return this.enrollments.videoProgress(id, body.abilityId, body.watchedPct);
  }

  @Post('enrollments/:id/reading')
  @ApiOperation({ summary: 'Acknowledge the reading for an ability' })
  reading(@Param('id') id: string, @Body() body: { abilityId: string }) {
    return this.enrollments.acknowledgeReading(id, body.abilityId);
  }

  @Post('enrollments/:id/quiz')
  @ApiOperation({ summary: 'Submit a micro-quiz (passing unlocks the next ability)' })
  quiz(@Param('id') id: string, @Body() body: { abilityId: string; answers: Record<string, string> }) {
    return this.enrollments.microQuiz(id, body.abilityId, body.answers ?? {});
  }

  @Post('enrollments/:id/skill-map')
  @ApiOperation({ summary: 'Gate 1: skill mapping test' })
  skillMap(@Param('id') id: string, @Body() body: { answers: Record<string, string> }) {
    return this.enrollments.skillMap(id, body.answers ?? {});
  }

  @Post('enrollments/:id/written')
  @ApiOperation({ summary: 'Gate 2: written test' })
  written(@Param('id') id: string, @Body() body: { answers: Record<string, string> }) {
    return this.enrollments.written(id, body.answers ?? {});
  }

  @Post('enrollments/:id/practical')
  @ApiOperation({ summary: 'Gate 3: on-site practical (Director or allotted manager)' })
  practical(@Param('id') id: string, @Body() body: { evaluatorId: string; scores: AbilityScore[]; notes?: string }) {
    return this.enrollments.evaluate(id, 'practical', body);
  }

  @Post('enrollments/:id/oral')
  @ApiOperation({ summary: 'Gate 4: oral viva (Director or allotted manager)' })
  oral(@Param('id') id: string, @Body() body: { evaluatorId: string; scores: AbilityScore[]; notes?: string }) {
    return this.enrollments.evaluate(id, 'oral', body);
  }

  @Get('pending-evaluations')
  @ApiOperation({ summary: 'Learners waiting for a practical or oral' })
  @ApiQuery({ name: 'evaluatorId', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  pending(@Query('evaluatorId') evaluatorId?: string, @Query('siteId') siteId?: string) {
    return this.enrollments.pendingEvaluations({ evaluatorId, siteId });
  }
}
