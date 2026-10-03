import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { SafetyService } from './safety.service';

const MB = 1024 * 1024;
const IMAGE_MAX = 10 * MB;
const VIDEO_MAX = 50 * MB;
/** server/uploads/safety — works from src/ (ts-node) and dist/src/ (build). */
const SERVER_ROOT =
  [path.join(__dirname, '..', '..', '..'), path.join(__dirname, '..', '..', '..', '..')].find((p) =>
    fs.existsSync(path.join(p, 'package.json')),
  ) ?? process.cwd();
const MEDIA_ROOT = path.join(SERVER_ROOT, 'uploads', 'safety');
const SAFE_NAME = /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]{1,8})?$/;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/**
 * Safety: incidents, near-misses, breakdowns, return-to-work clearance and protocols.
 * Every write takes `actor { id, name, role, siteId }`; role + site scope are checked in SafetyService.
 */
@ApiTags('safety')
@Controller('safety')
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}

  @Get('events')
  @ApiOperation({ summary: 'List safety events (incidents, near-misses, breakdowns)' })
  list(
    @Query('siteId') siteId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.safety.list({ siteId, type, status, employeeId });
  }

  @Get('events/:id')
  get(@Param('id') id: string) {
    return this.safety.get(id);
  }

  @Post('events')
  @ApiOperation({ summary: 'Report an incident, near-miss or breakdown' })
  create(@Body() body: Record<string, any>) {
    return this.safety.create(body);
  }

  @Patch('events/:id')
  @ApiOperation({ summary: 'Edit details / root cause / breakdown fields' })
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.safety.updateDetails(id, body);
  }

  @Patch('events/:id/status')
  changeStatus(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.safety.changeStatus(id, body);
  }

  @Post('events/:id/comments')
  comment(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.safety.comment(id, body);
  }

  @Post('events/:id/actions')
  addAction(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.safety.addAction(id, body);
  }

  @Patch('events/:id/actions/:actionId')
  setActionDone(@Param('id') id: string, @Param('actionId') actionId: string, @Body() body: Record<string, any>) {
    return this.safety.setActionDone(id, actionId, body);
  }

  @Post('events/:id/promote')
  @ApiOperation({ summary: 'Escalate a near-miss into an incident' })
  promote(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.safety.promote(id, body);
  }

  @Post('events/:id/clearance/:employeeId')
  @ApiOperation({ summary: 'Clear or waive return-to-work for an involved employee' })
  clearance(@Param('id') id: string, @Param('employeeId') employeeId: string, @Body() body: Record<string, any>) {
    return this.safety.decideClearance(id, employeeId, body);
  }

  @Post('events/:id/link-leave')
  linkLeave(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.safety.linkLeave(id, body);
  }

  @Post('events/:id/call')
  startCall(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.safety.startCall(id, body);
  }

  @Post('events/:id/call/join')
  joinCall(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.safety.joinCall(id, body);
  }

  @Post('events/:id/ack-emergency')
  ackEmergency(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.safety.ackEmergency(id, body);
  }

  @Post('events/:id/media')
  @ApiOperation({ summary: 'Upload a photo (≤10 MB) or video (≤50 MB). Multipart: file + actor (JSON string)' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: VIDEO_MAX } }))
  async upload(@Param('id') id: string, @UploadedFile() file: any, @Body() body: Record<string, any>) {
    if (!file?.buffer) throw new BadRequestException('file is required');
    let actor: unknown;
    try {
      actor = typeof body.actor === 'string' ? JSON.parse(body.actor) : body.actor;
    } catch {
      throw new BadRequestException('actor must be JSON');
    }
    const ext = EXT[file.mimetype];
    if (!ext) throw new BadRequestException('Only JPG, PNG, WEBP, GIF, MP4, WEBM or MOV files');
    const kind = file.mimetype.startsWith('video/') ? 'video' : 'image';
    if (kind === 'image' && file.size > IMAGE_MAX) throw new BadRequestException('Photos must be 10 MB or smaller');
    await this.safety.assertCanAddMedia(id, actor);

    const mediaId = `m-${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
    const dir = path.join(MEDIA_ROOT, id.replace(/[^a-zA-Z0-9_-]/g, ''));
    await fs.promises.mkdir(dir, { recursive: true });
    const fileName = `${mediaId}.${ext}`;
    await fs.promises.writeFile(path.join(dir, fileName), file.buffer);
    return this.safety.addMedia(id, actor, {
      id: mediaId,
      url: `/safety/media/${encodeURIComponent(id)}/${fileName}`,
      kind,
      name: String(file.originalname ?? fileName).slice(0, 200),
      size: file.size,
    });
  }

  @Get('media/:eventId/:file')
  media(@Param('eventId') eventId: string, @Param('file') file: string, @Res() res: any) {
    if (!SAFE_NAME.test(eventId) || !SAFE_NAME.test(file)) throw new NotFoundException();
    const full = path.join(MEDIA_ROOT, eventId, file);
    if (!full.startsWith(MEDIA_ROOT) || !fs.existsSync(full)) throw new NotFoundException();
    return res.sendFile(full);
  }

  @Get('clearance/pending')
  @ApiOperation({ summary: 'Pending return-to-work clearances (optionally for one employee)' })
  pending(@Query('employeeId') employeeId?: string) {
    return this.safety.pendingClearances(employeeId);
  }

  @Get('emergencies/active')
  @ApiOperation({ summary: 'Open emergency broadcasts not yet acknowledged by this person' })
  emergencies(@Query('personId') personId: string) {
    return this.safety.activeEmergencies(personId);
  }

  @Get('people/stakeholders')
  stakeholders(@Query('siteId') siteId: string) {
    if (!siteId) throw new BadRequestException('siteId is required');
    return this.safety.stakeholdersFor(siteId);
  }

  @Get('protocols')
  protocols(@Query('siteId') siteId?: string) {
    return this.safety.listProtocols(siteId);
  }

  @Post('protocols')
  createProtocol(@Body() body: Record<string, any>) {
    return this.safety.createProtocol(body);
  }

  @Patch('protocols/:id')
  updateProtocol(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.safety.updateProtocol(id, body);
  }

  @Delete('protocols/:id')
  @ApiOperation({ summary: 'Archive a protocol (soft delete). Body: { actor }' })
  deleteProtocol(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.safety.deleteProtocol(id, body);
  }
}
