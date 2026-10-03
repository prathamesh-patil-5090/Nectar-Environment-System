import { Body, Controller, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RsvpStatus } from '../../../db/schemas/training';
import { EventInput, EventListQuery, EventsService } from './events.service';
import { CommunitiesService, CommunityInput } from './communities.service';
import { MentorInput, MentorsService } from './mentors.service';

/**
 * Meetup-style training events, communities and mentors.
 * The API has no auth yet: callers pass the acting employee as `viewerId` / `actorId`.
 */
@ApiTags('training')
@Controller('training')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly communities: CommunitiesService,
    private readonly mentors: MentorsService,
  ) {}

  // ----- Events -----

  @Get('events')
  @ApiOperation({ summary: 'List events with going count, spots left and the viewer RSVP' })
  @ApiQuery({ name: 'viewerId', required: false })
  @ApiQuery({ name: 'view', required: false, enum: ['upcoming', 'going', 'past', 'hosting'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'communityId', required: false })
  @ApiQuery({ name: 'hostId', required: false })
  @ApiQuery({ name: 'format', required: false })
  @ApiQuery({ name: 'topic', required: false })
  listEvents(@Query() q: EventListQuery) {
    return this.events.list(q);
  }

  @Post('events')
  @ApiOperation({ summary: 'Create an event (draft, or publish:true). repeat:{every,count} creates a series.' })
  createEvent(@Body() body: EventInput & { actorId: string }) {
    return this.events.create(body, body.actorId);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Event detail' })
  @ApiQuery({ name: 'viewerId', required: false })
  getEvent(@Param('id') id: string, @Query('viewerId') viewerId?: string) {
    return this.events.get(id, viewerId);
  }

  @Patch('events/:id')
  @ApiOperation({ summary: 'Edit an event (hosts). Time/venue changes notify attendees.' })
  updateEvent(@Param('id') id: string, @Body() body: EventInput & { actorId: string }) {
    return this.events.update(id, body, body.actorId);
  }

  @Post('events/:id/publish')
  @ApiOperation({ summary: 'Publish a draft (notifies community members and the audience)' })
  publishEvent(@Param('id') id: string, @Body() body: { actorId: string }) {
    return this.events.publish(id, body.actorId);
  }

  @Post('events/:id/cancel')
  @ApiOperation({ summary: 'Cancel with a reason (notifies going + waitlist)' })
  cancelEvent(@Param('id') id: string, @Body() body: { actorId: string; reason: string }) {
    return this.events.cancel(id, body.reason, body.actorId);
  }

  @Post('events/:id/duplicate')
  @ApiOperation({ summary: 'Copy as a new draft' })
  duplicateEvent(@Param('id') id: string, @Body() body: { actorId: string }) {
    return this.events.duplicate(id, body.actorId);
  }

  @Get('events/:id/similar')
  @ApiOperation({ summary: 'More events like this (same community, host or topics)' })
  @ApiQuery({ name: 'viewerId', required: false })
  similarEvents(@Param('id') id: string, @Query('viewerId') viewerId?: string) {
    return this.events.similar(id, viewerId);
  }

  @Get('events/:id/calendar.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="event.ics"')
  @ApiOperation({ summary: 'Add to calendar' })
  eventIcs(@Param('id') id: string) {
    return this.events.ics(id);
  }

  @Get('events-report')
  @ApiOperation({ summary: 'Attendance per event: going, attended, no-show, cancelled' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  eventsReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.events.attendanceReport({ from, to });
  }

  @Get('events-hours/:employeeId')
  @ApiOperation({ summary: 'Training hours from attended events (a training stage, not a certificate stage)' })
  trainingHours(@Param('employeeId') employeeId: string) {
    return this.events.trainingHours(employeeId);
  }

  // ----- RSVP & attendees -----

  @Post('events/:id/rsvp')
  @ApiOperation({ summary: 'RSVP: going, or waitlist when full (notifies hosts)' })
  rsvp(@Param('id') id: string, @Body() body: { employeeId: string; answer?: string }) {
    return this.events.rsvp(id, body.employeeId, body.answer);
  }

  @Post('events/:id/rsvp/cancel')
  @ApiOperation({ summary: 'Cancel RSVP (promotes the first waitlisted person)' })
  cancelRsvp(@Param('id') id: string, @Body() body: { employeeId: string }) {
    return this.events.cancelRsvp(id, body.employeeId);
  }

  @Get('events/:id/attendees')
  @ApiOperation({ summary: 'Hosts: all RSVPs with answers. Others: people going.' })
  @ApiQuery({ name: 'viewerId', required: false })
  attendees(@Param('id') id: string, @Query('viewerId') viewerId?: string) {
    return this.events.attendees(id, viewerId);
  }

  @Get('events/:id/attendees.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="attendees.csv"')
  @ApiOperation({ summary: 'Attendee export (hosts)' })
  attendeesCsv(@Param('id') id: string, @Query('actorId') actorId: string) {
    return this.events.attendeesCsv(id, actorId);
  }

  @Patch('events/:id/attendees/:rsvpId')
  @ApiOperation({ summary: 'Hosts: going (off waitlist), cancelled (remove), attended, no_show' })
  updateAttendee(
    @Param('id') id: string,
    @Param('rsvpId') rsvpId: string,
    @Body() body: { actorId: string; status: RsvpStatus },
  ) {
    return this.events.updateAttendee(id, rsvpId, body.status, body.actorId);
  }

  // ----- Discussion -----

  @Get('events/:id/posts')
  @ApiOperation({ summary: 'Event discussion (pinned first)' })
  posts(@Param('id') id: string) {
    return this.events.posts(id);
  }

  @Post('events/:id/posts')
  @ApiOperation({ summary: 'Post a question/comment (attendees) or an announcement (hosts)' })
  addPost(
    @Param('id') id: string,
    @Body() body: { authorEmployeeId: string; text: string; kind?: string; parentId?: string },
  ) {
    return this.events.addPost(id, body);
  }

  @Patch('events/:id/posts/:postId')
  @ApiOperation({ summary: 'Pin / unpin a post (hosts)' })
  pinPost(
    @Param('id') id: string,
    @Param('postId') postId: string,
    @Body() body: { actorId: string; pinned: boolean },
  ) {
    return this.events.pinPost(id, postId, Boolean(body.pinned), body.actorId);
  }

  // ----- Communities -----

  @Get('communities')
  @ApiOperation({ summary: 'Communities with member count and isMember' })
  @ApiQuery({ name: 'viewerId', required: false })
  listCommunities(@Query('viewerId') viewerId?: string) {
    return this.communities.list(viewerId);
  }

  @Post('communities')
  @ApiOperation({ summary: 'Create a community (HR / director)' })
  createCommunity(@Body() body: CommunityInput) {
    return this.communities.create(body);
  }

  @Get('communities/:slug')
  @ApiOperation({ summary: 'Community detail' })
  @ApiQuery({ name: 'viewerId', required: false })
  getCommunity(@Param('slug') slug: string, @Query('viewerId') viewerId?: string) {
    return this.communities.getBySlug(slug, viewerId);
  }

  @Patch('communities/:slug')
  @ApiOperation({ summary: 'Edit a community' })
  updateCommunity(@Param('slug') slug: string, @Body() body: CommunityInput) {
    return this.communities.update(slug, body);
  }

  @Get('communities/:slug/members')
  @ApiOperation({ summary: 'Community members' })
  communityMembers(@Param('slug') slug: string) {
    return this.communities.members(slug);
  }

  @Post('communities/:slug/join')
  joinCommunity(@Param('slug') slug: string, @Body() body: { employeeId: string }) {
    return this.communities.join(slug, body.employeeId);
  }

  @Post('communities/:slug/leave')
  leaveCommunity(@Param('slug') slug: string, @Body() body: { employeeId: string }) {
    return this.communities.leave(slug, body.employeeId);
  }

  // ----- Mentors -----

  @Get('mentors')
  @ApiOperation({ summary: 'Mentor profiles' })
  @ApiQuery({ name: 'all', required: false, description: '1 = include inactive' })
  listMentors(@Query('all') all?: string) {
    return this.mentors.list(all !== '1');
  }

  @Get('mentors/:employeeId')
  @ApiOperation({ summary: 'Mentor profile for an employee (404 if not a mentor)' })
  getMentor(@Param('employeeId') employeeId: string) {
    return this.mentors.getByEmployee(employeeId);
  }

  @Patch('mentors/:employeeId')
  @ApiOperation({ summary: 'Make an employee a mentor / update their profile (HR / director)' })
  upsertMentor(@Param('employeeId') employeeId: string, @Body() body: MentorInput) {
    return this.mentors.upsert(employeeId, body);
  }
}
