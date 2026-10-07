import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EPermitsService } from './e-permits.service';

/** Reads say who is looking (`viewerId`, `viewerRole`, `viewerSiteId`) — only concerned people see a permit. */
const viewerOf = (id?: string, role?: string, siteId?: string, name?: string) => ({ id, name: name || id, role, siteId });

/**
 * E-Permits (Permit to Work). Every write takes `actor { id, name, role, siteId }`;
 * role, site and department scope are checked in EPermitsService with the shared e-permit-rules.ts.
 */
@ApiTags('e-permits')
@Controller('e-permits')
export class EPermitsController {
  constructor(private readonly permits: EPermitsService) {}

  @Get('masters')
  @ApiOperation({ summary: 'Departments (HoD + deputies), seeded locations and per-site emergency contacts' })
  masters() {
    return this.permits.masters();
  }

  @Get('policy')
  @ApiOperation({ summary: 'Permit policy (versioned), shifts, gas limits, form checklists and rules' })
  policy() {
    return this.permits.policy();
  }

  @Patch('departments/:id/availability')
  @ApiOperation({ summary: 'HoD marks themselves unavailable until a date (or null). Body: { actor, until }' })
  availability(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.setHeadAvailability(id, body);
  }

  @Patch('locations/:id/departments')
  @ApiOperation({ summary: 'Director / Plant Manager sets the other departments concerned with a location. Body: { actor, departmentIds }' })
  locationDepartments(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.setLocationDepartments(id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Permits the viewer is concerned with' })
  list(
    @Query('siteId') siteId?: string,
    @Query('status') status?: string,
    @Query('safetyEventId') safetyEventId?: string,
    @Query('viewerId') viewerId?: string,
    @Query('viewerRole') viewerRole?: string,
    @Query('viewerSiteId') viewerSiteId?: string,
  ) {
    return this.permits.list({ siteId, status, safetyEventId }, viewerOf(viewerId, viewerRole, viewerSiteId));
  }

  @Get(':id')
  get(
    @Param('id') id: string,
    @Query('viewerId') viewerId?: string,
    @Query('viewerRole') viewerRole?: string,
    @Query('viewerSiteId') viewerSiteId?: string,
  ) {
    return this.permits.get(id, viewerOf(viewerId, viewerRole, viewerSiteId));
  }

  @Post()
  @ApiOperation({ summary: 'Draft a permit (submit: true also submits it)' })
  create(@Body() body: Record<string, any>) {
    return this.permits.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a draft' })
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.updateDraft(id, body);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit for approval (issuer acknowledges). Soft blocks → 409 unless overridden by PM / Director' })
  submit(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.submit(id, body);
  }

  @Post(':id/decide')
  @ApiOperation({ summary: 'Approve / reject one approval. Body: { actor, kind, departmentId?, decision, remark? }' })
  decide(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.decide(id, body);
  }

  @Post(':id/revise')
  revise(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.revise(id, body);
  }

  @Post(':id/ack')
  @ApiOperation({ summary: 'Acknowledge (issue / renewal). Body: { actor, personId?, lat?, lng? }' })
  ack(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.acknowledge(id, body);
  }

  @Post(':id/renewal')
  @ApiOperation({ summary: 'Request renewal into the next shift. Body: { actor, newIssuerId?, newHolderId?, gasReadings?, remark? }' })
  requestRenewal(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.requestRenewal(id, body);
  }

  @Post(':id/renewal/decide')
  decideRenewal(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.decideRenewal(id, body);
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.suspend(id, body);
  }

  @Post(':id/resume')
  resume(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.resume(id, body);
  }

  @Post('sites/:siteId/suspend')
  @ApiOperation({ summary: 'Stop all work at a site (emergency). Body: { actor, reason }' })
  suspendSite(@Param('siteId') siteId: string, @Body() body: Record<string, any>) {
    return this.permits.suspendSite(siteId, body);
  }

  @Post(':id/site-safe')
  @ApiOperation({ summary: 'Return step 1 — Permit Holder declares site & equipment safe' })
  siteSafe(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.declareSiteSafe(id, body);
  }

  @Post(':id/return')
  @ApiOperation({ summary: 'Return step 2 — issuer returns. Body: { actor, outcome, note? }' })
  returnPermit(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.returnPermit(id, body);
  }

  @Post(':id/return/accept')
  @ApiOperation({ summary: 'Return step 3 — Authoriser accepts or sends back. Body: { actor, decision, remark? }' })
  acceptReturn(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.acceptReturn(id, body);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.cancel(id, body);
  }

  @Post(':id/post-review')
  postReview(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.postReview(id, body);
  }

  @Post(':id/ot')
  @ApiOperation({ summary: 'Link an OT decision raised for this permit. Body: { actor, otDecisionId }' })
  linkOt(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.permits.linkOt(id, body);
  }
}
